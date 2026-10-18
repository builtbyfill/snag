// The glue between extractTicket (pure: no database, no files) and the saved report.
// spec.md > Modules and Seams > lib/extraction/run.ts; spec.md > Save-Then-Extract.
import { and, eq, max } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
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
 *   `failed_reason = 'extraction_error'`. Only a database failure throws; the caller logs it, and
 *   the ticket stays `pending` until the start-up sweep below marks it.
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

  return deps.db.transaction(async (tx) => {
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
 * Run once when the server starts (instrumentation.ts), before it takes requests. Extraction
 * runs inside the server process (after()), so a ticket that is still `pending` at that moment
 * lost its extraction when the previous process stopped: it is orphaned by definition, however
 * recent. Each one becomes `extraction_failed` with `failed_reason = 'interrupted_by_restart'`
 * so the dashboard can tell it apart from a model failure. Returns how many were marked.
 *
 * Assumes exactly one app process at a time: Compose stops the old container before it starts
 * the new one. A second instance starting next to a running one would mark that one's live
 * extractions; scaling out needs a job queue instead (spec.md > Save-Then-Extract).
 * Nothing is re-extracted here: Retry stays a manual action, so a report that crashes the
 * server can't put it into a restart loop.
 */
export async function failInterruptedExtractions(db: Db, now: Date = new Date()): Promise<number> {
  const marked = await db.update(tickets)
    .set({ extractionState: 'extraction_failed', extractionError: INTERRUPTED_ERROR, failedReason: 'interrupted_by_restart', updatedAt: now })
    .where(eq(tickets.extractionState, 'pending'))
    .returning({ id: tickets.id });
  return marked.length;
}
