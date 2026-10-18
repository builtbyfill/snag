import { asc, eq } from 'drizzle-orm';
import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import { attachments, extractions, projects, tickets } from '@/lib/db/schema';
import { ProviderError } from '@/lib/extraction/provider';
import { failInterruptedExtractions, INTERRUPTED_ERROR, runExtraction } from '@/lib/extraction/run';
import { MapStorage } from '@/lib/storage';
import { FakeProvider, reply } from '../fakes/fake-provider';
import { setupTestDb } from '../helpers/db';

const db = setupTestDb();

const OUTPUT = {
  observed: {
    title: 'Save does nothing on the appointment form',
    location: 'Book appointment, step 2',
    actualResult: 'Tapping Save leaves the form open with no message',
    priority: 'high',
    tags: ['booking', 'form'],
  },
  inferred: {
    expectedResult: { value: 'The appointment is saved and confirmed', evidence: 'The client says nothing happened after Save' },
    stepsToReproduce: { value: ['Open Book appointment', 'Fill in the details', 'Tap Save'], evidence: 'Form title and Save button are visible' },
  },
  confidence: 0.82,
  language: 'bs',
};
const VALID = JSON.stringify(OUTPUT);
const INVALID = VALID.replace('"confidence":0.82', '"confidence":1.82');
const SENTENCE = 'Kliknula sam Sačuvaj na terminu i ništa se nije desilo.';

let storage: MapStorage;
let projectId: string;

beforeEach(async () => {
  storage = new MapStorage();
  const [p] = await db().insert(projects).values({ name: 'Clinic booking', slug: 'RunSlugRunSlugRunSlug' }).returning();
  projectId = p.id;
});

/** A saved report as submitReport leaves it: pending ticket, attachment row, file in storage. */
async function savedReport(over: Partial<typeof tickets.$inferInsert> = {}, { withFile = true } = {}) {
  const [ticket] = await db().insert(tickets)
    .values({ projectId, clientSentence: SENTENCE, reporterIpHash: 'h'.repeat(64), ...over })
    .returning();
  const storageKey = `${projectId}/${ticket.id}.png`;
  await db().insert(attachments).values({ ticketId: ticket.id, storageKey, mimeType: 'image/png', width: 400, height: 800, bytes: 1000 });
  if (withFile) {
    const png = await sharp({ create: { width: 400, height: 800, channels: 3, background: '#fff' } }).png().toBuffer();
    await storage.put(storageKey, png, 'image/png');
  }
  return ticket.id;
}

const run = (ticketId: string, provider: FakeProvider) =>
  runExtraction(ticketId, {
    db: db(),
    storage,
    extraction: { provider, env: { EXTRACTION_MODEL: 'test-model', EXTRACTION_MAX_EDGE: 500 }, sleep: async () => {} },
  });

const ticket = async (id: string) => (await db().select().from(tickets).where(eq(tickets.id, id)))[0];
const attempts = (id: string) =>
  db().select().from(extractions).where(eq(extractions.ticketId, id)).orderBy(asc(extractions.attempt));

describe('runExtraction: success', () => {
  it('fills the ticket, copies confidence and language, and records the attempt', async () => {
    const id = await savedReport();
    const result = await run(id, new FakeProvider([reply(VALID)]));

    expect(result).toEqual({ state: 'extracted', attempts: 1 });
    expect(await ticket(id)).toMatchObject({
      extractionState: 'extracted',
      extractionError: null,
      title: OUTPUT.observed.title,
      location: OUTPUT.observed.location,
      actualResult: OUTPUT.observed.actualResult,
      priority: 'high',
      tags: ['booking', 'form'],
      expectedResult: OUTPUT.inferred.expectedResult.value,
      expectedResultEvidence: OUTPUT.inferred.expectedResult.evidence,
      stepsToReproduce: OUTPUT.inferred.stepsToReproduce.value,
      stepsToReproduceEvidence: OUTPUT.inferred.stepsToReproduce.evidence,
      confidence: expect.closeTo(0.82, 5),
      language: 'bs',
      clientSentence: SENTENCE, // the source is never touched
      askClient: false,
      failedReason: null,
    });
    const rows = await attempts(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      attempt: 1, result: 'succeeded', model: 'test-model@p1', rawResponse: VALID, error: null,
      inputTokens: 1500, outputTokens: 900, parsed: OUTPUT,
    });
  });

  it('fills only empty columns, so a field the developer already set is kept', async () => {
    const id = await savedReport({ title: 'Filip’s own title', tags: ['mine'], priority: 'low' });
    await run(id, new FakeProvider([reply(VALID)]));

    expect(await ticket(id)).toMatchObject({
      title: 'Filip’s own title',
      tags: ['mine'],
      priority: 'low',
      location: OUTPUT.observed.location, // was empty, so it is filled
      extractionState: 'extracted',
    });
  });

  it('leaves an inferred field and its evidence empty together when the model returned null', async () => {
    const id = await savedReport();
    const thin = JSON.stringify({ ...OUTPUT, inferred: { expectedResult: null, stepsToReproduce: null } });
    await run(id, new FakeProvider([reply(thin)]));

    expect(await ticket(id)).toMatchObject({
      expectedResult: null, expectedResultEvidence: null, stepsToReproduce: null, stepsToReproduceEvidence: null,
    });
  });

  it('records both attempts when the first answer fails validation and the retry succeeds', async () => {
    const id = await savedReport();
    const result = await run(id, new FakeProvider([reply(INVALID), reply(VALID)]));

    expect(result).toEqual({ state: 'extracted', attempts: 2 });
    expect((await attempts(id)).map((a) => [a.attempt, a.result])).toEqual([[1, 'failed'], [2, 'succeeded']]);
  });
});

describe('runExtraction: failure', () => {
  it('marks the ticket failed with the last error and keeps every attempt', async () => {
    const id = await savedReport();
    const result = await run(id, new FakeProvider([new ProviderError('400 bad request', false)]));

    expect(result).toEqual({ state: 'extraction_failed', attempts: 1 });
    expect(await ticket(id)).toMatchObject({
      extractionState: 'extraction_failed', extractionError: '400 bad request', failedReason: 'extraction_error', title: null,
    });
    expect((await attempts(id)).map((a) => [a.attempt, a.result, a.error])).toEqual([[1, 'failed', '400 bad request']]);
  });

  it('marks the ticket failed without calling the model when the screenshot file is missing', async () => {
    const id = await savedReport({}, { withFile: false });
    const provider = new FakeProvider([]);
    const result = await run(id, provider);

    expect(result).toEqual({ state: 'extraction_failed', attempts: 0 });
    expect(provider.requests).toHaveLength(0);
    expect(await ticket(id)).toMatchObject({ extractionError: expect.stringMatching(/screenshot/i), failedReason: 'extraction_error' });
    expect(await attempts(id)).toHaveLength(0);
  });
});

describe('runExtraction: guards', () => {
  it('refuses a ticket that is not pending and calls nothing', async () => {
    const id = await savedReport({ extractionState: 'extracted', title: 'Already done' });
    const provider = new FakeProvider([]);

    expect(await run(id, provider)).toEqual({ state: 'skipped', reason: 'not_pending' });
    expect(provider.requests).toHaveLength(0);
    expect((await ticket(id)).title).toBe('Already done');
  });

  it('skips an unknown ticket id', async () => {
    expect(await run('00000000-0000-4000-8000-000000000000', new FakeProvider([]))).toEqual({ state: 'skipped', reason: 'not_found' });
  });

  it('numbers a retry after earlier attempts (3, not 1)', async () => {
    const id = await savedReport();
    await run(id, new FakeProvider([new ProviderError('timeout', true), new ProviderError('timeout', true)]));
    // Retry (slice 8) puts the ticket back to pending and runs the same function again.
    await db().update(tickets).set({ extractionState: 'pending', extractionError: null }).where(eq(tickets.id, id));
    await run(id, new FakeProvider([reply(VALID)]));

    expect((await attempts(id)).map((a) => [a.attempt, a.result])).toEqual([[1, 'failed'], [2, 'failed'], [3, 'succeeded']]);
    expect((await ticket(id)).extractionState).toBe('extracted');
  });

  it('lets only one of two simultaneous runs write (a double after() is harmless)', async () => {
    const id = await savedReport();
    const results = await Promise.all([
      run(id, new FakeProvider([reply(VALID)])),
      run(id, new FakeProvider([reply(VALID)])),
    ]);

    expect(results.map((r) => r.state).sort()).toEqual(['extracted', 'skipped']);
    expect(await attempts(id)).toHaveLength(1);
  });
});

describe('failInterruptedExtractions (runs once when the server starts)', () => {
  it('marks every pending ticket as interrupted, however recent, and leaves the rest alone', async () => {
    const now = new Date('2026-10-18T12:00:00Z');
    const old = await savedReport({ updatedAt: new Date(now.getTime() - 60 * 60_000) });
    const justNow = await savedReport({ updatedAt: new Date(now.getTime() - 5_000) });
    const finished = await savedReport({ extractionState: 'extracted' });
    const failed = await savedReport({ extractionState: 'extraction_failed', extractionError: '400 bad request', failedReason: 'extraction_error' });

    expect(await failInterruptedExtractions(db(), now)).toBe(2);
    for (const id of [old, justNow]) {
      expect(await ticket(id)).toMatchObject({
        extractionState: 'extraction_failed', extractionError: INTERRUPTED_ERROR, failedReason: 'interrupted_by_restart',
      });
    }
    expect((await ticket(finished)).extractionState).toBe('extracted');
    expect(await ticket(failed)).toMatchObject({ extractionError: '400 bad request', failedReason: 'extraction_error' });
  });

  it('starts nothing itself: a Retry (back to pending, then runExtraction) clears the reason on success', async () => {
    const id = await savedReport();
    await failInterruptedExtractions(db());
    expect(await attempts(id)).toHaveLength(0); // no automatic re-extraction

    await db().update(tickets).set({ extractionState: 'pending' }).where(eq(tickets.id, id));
    await run(id, new FakeProvider([reply(VALID)]));
    expect(await ticket(id)).toMatchObject({ extractionState: 'extracted', extractionError: null, failedReason: null });
  });
});
