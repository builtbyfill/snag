// The glue between extractTicket (pure: no database, no files) and the saved report.
// spec.md > Modules and Seams > lib/extraction/run.ts; spec.md > Save-Then-Extract.
import { and, eq, lt, max } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { describeError } from '@/lib/log';
import { attachments, extractions, tickets } from '@/lib/db/schema';
import type { Storage } from '@/lib/storage';
import type { ImageMime } from './image';
import { extractTicket, type ExtractionDeps, type ExtractionOutcome, type ExtractionOutput } from './index';

export type RunDeps = {
  db: Db;
  storage: Storage;
  /** Passed through to extractTicket; tests use it for a FakeProvider. */
  extraction?: ExtractionDeps;
};

export type RunResult =
  | { state: 'extracted' | 'extraction_failed'; attempts: number }
  | { state: 'skipped'; reason: 'not_found' | 'not_pending' };

/**
 * Reads one saved report and turns it into a ticket. The only place that moves a ticket out of
 * `pending`, so Retry (slice 8) puts the ticket back to `pending` and calls this unchanged.
 *
 * - Runs only on a `pending` ticket; anything else is skipped without calling the model.
 * - On success fills only the columns that are still empty, so nothing the developer typed is
 *   overwritten, and copies `confidence` and `language` (ask_client is computed from them).
 * - Writes one `extractions` row per attempt, numbered after any earlier attempts.
 * - Model, network and file problems end in `extraction_failed` with the error kept and
 *   `failed_reason = 'extraction_error'`. Only a database failure throws; the caller logs it. The
 *   ticket is then marked failed if that smaller write succeeds, else it stays `pending` until
 *   the start-up sweep below marks it.
 */
export async function runExtraction(ticketId: string, deps: RunDeps): Promise<RunResult> {
  const [report] = await deps.db
    .select({ state: tickets.extractionState, sentence: tickets.clientSentence, storageKey: attachments.storageKey, mimeType: attachments.mimeType })
    .from(tickets)
    .innerJoin(attachments, eq(attachments.ticketId, tickets.id))
    .where(eq(tickets.id, ticketId));
  if (!report) return { state: 'skipped', reason: 'not_found' };
  if (report.state !== 'pending') return { state: 'skipped', reason: 'not_pending' };

  // The slow part (the model call) happens outside any transaction or lock.
  let outcome: ExtractionOutcome;
  try {
    const image = await deps.storage.get(report.storageKey);
    outcome = await extractTicket({ image, mimeType: report.mimeType as ImageMime, sentence: report.sentence }, deps.extraction);
  } catch (error) {
    // Missing file, or the extraction isn't configured (no API key). Messages name the problem, never a secret.
    outcome = { ok: false, error: `Couldn't read the screenshot or start the extraction: ${(error as Error).message}`, attempts: [] };
  }

  try {
    return await writeOutcome(ticketId, outcome, deps.db);
  } catch (error) {
    // Nothing of the outcome was written. Marking the ticket failed is a second, smaller write
    // that may well succeed (the first may have failed on the extractions rows), and it gives
    // the developer a Retry button instead of a spinner that only a restart ends.
    const reason = (error as Error).message.split('\n')[0];
    await deps.db.update(tickets)
      .set({ extractionState: 'extraction_failed', failedReason: 'extraction_error', extractionError: `Couldn't save the result: ${reason}`, updatedAt: new Date() })
      .where(and(eq(tickets.id, ticketId), eq(tickets.extractionState, 'pending')))
      .catch(() => {});
    throw error;
  }
}

function writeOutcome(ticketId: string, outcome: ExtractionOutcome, db: Db): Promise<RunResult> {
  return db.transaction(async (tx) => {
    // Lock the row and check again: if two runs raced (a double after()), the second one waits
    // here, then finds the ticket no longer pending and writes nothing.
    const [current] = await tx.select().from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.extractionState, 'pending')))
      .for('update');
    if (!current) return { state: 'skipped', reason: 'not_pending' } as const;

    if (outcome.attempts.length > 0) {
      const [{ last }] = await tx.select({ last: max(extractions.attempt) }).from(extractions).where(eq(extractions.ticketId, ticketId));
      await tx.insert(extractions).values(outcome.attempts.map((a) => ({
        ticketId,
        attempt: (last ?? 0) + a.attempt,
        result: a.result,
        model: a.model,
        rawResponse: a.rawResponse,
        parsed: a.parsed,
        error: a.error,
        inputTokens: a.inputTokens,
        outputTokens: a.outputTokens,
        durationMs: a.durationMs,
      })));
    }

    const changes = outcome.ok
      ? { ...fillEmpty(current, outcome.output), extractionState: 'extracted' as const, extractionError: null, failedReason: null }
      : { extractionState: 'extraction_failed' as const, extractionError: outcome.error, failedReason: 'extraction_error' as const };
    await tx.update(tickets).set({ ...changes, updatedAt: new Date() }).where(eq(tickets.id, ticketId));

    return { state: changes.extractionState, attempts: outcome.attempts.length };
  });
}

/** The extracted values for every column that is still empty; filled ones keep their value. */
function fillEmpty(current: typeof tickets.$inferSelect, output: ExtractionOutput) {
  const { observed, inferred } = output;
  // An inferred field and its evidence travel together: both from the model, or both kept.
  const expected = current.expectedResult === null
    ? { expectedResult: inferred.expectedResult?.value ?? null, expectedResultEvidence: inferred.expectedResult?.evidence ?? null }
    : {};
  const steps = current.stepsToReproduce === null
    ? { stepsToReproduce: inferred.stepsToReproduce?.value ?? null, stepsToReproduceEvidence: inferred.stepsToReproduce?.evidence ?? null }
    : {};
  return {
    title: current.title ?? observed.title,
    location: current.location ?? observed.location,
    actualResult: current.actualResult ?? observed.actualResult,
    priority: current.priority ?? observed.priority,
    tags: current.tags.length > 0 ? current.tags : observed.tags,
    ...expected,
    ...steps,
    // These two describe this extraction, so they are always copied.
    confidence: output.confidence,
    language: output.language,
  };
}

export const INTERRUPTED_ERROR = 'Extraction interrupted by a restart. Retry when ready.';

/**
 * On Vercel a pending ticket older than this lost its extraction: the function that ran it is
 * stopped after maxDuration (300 s, set on the pages whose actions start one), plus a minute.
 */
export const STALE_PENDING_MS = 6 * 60 * 1000;

/** How old a pending ticket must be before the sweep marks it: 0 (all of them) unless on Vercel. */
export function sweepAgeMs(source: Record<string, string | undefined> = process.env): number {
  return source.VERCEL === '1' ? STALE_PENDING_MS : 0;
}

/**
 * Marks orphaned `pending` tickets as `extraction_failed` with `failed_reason =
 * 'interrupted_by_restart'`, so the dashboard can tell them apart from a model failure and offer
 * Retry. Returns how many were marked.
 *
 * Compose (olderThanMs 0): runs once when the server starts (instrumentation.ts), before it takes
 * requests. Extraction runs inside the server process (after()), and Compose runs exactly one app
 * container, stopping the old one before starting the new, so anything still pending at that
 * moment lost its extraction, however recent.
 * Vercel (olderThanMs STALE_PENDING_MS): many instances run at once and each start runs this, so
 * only tickets pending longer than any function can live are marked; the dashboard pages run it
 * too, since cold starts aren't guaranteed. Age is `updated_at`, which submit and Retry set.
 * Nothing is re-extracted here: Retry stays a manual action, so a report that crashes the
 * server can't put it into a restart loop.
 */
export async function failInterruptedExtractions(db: Db, now: Date = new Date(), olderThanMs = 0): Promise<number> {
  const stale = olderThanMs > 0 ? lt(tickets.updatedAt, new Date(now.getTime() - olderThanMs)) : undefined;
  const marked = await db.update(tickets)
    .set({ extractionState: 'extraction_failed', extractionError: INTERRUPTED_ERROR, failedReason: 'interrupted_by_restart', updatedAt: now })
    .where(and(eq(tickets.extractionState, 'pending'), stale))
    .returning({ id: tickets.id });
  return marked.length;
}

/** Vercel only: the dashboard pages' sweep of stale pending tickets. Never throws; the page still loads. */
export async function sweepStaleExtractions(db: Db): Promise<void> {
  const age = sweepAgeMs();
  if (age === 0) return; // Compose: the start-up sweep already covers it
  try {
    const marked = await failInterruptedExtractions(db, new Date(), age);
    if (marked > 0) console.warn(`Marked ${marked} interrupted extraction(s) as failed; Retry is available.`);
  } catch (error) {
    console.error(`Sweep of interrupted extractions failed: ${describeError(error)}`);
  }
}
