import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { projects, tickets } from '@/lib/db/schema';
import { retryExtraction } from '@/lib/tickets/retry';
import { setupTestDb } from '../helpers/db';

const db = setupTestDb();
const NOW = new Date('2026-10-18T12:00:00Z');
let projectId: string;

beforeEach(async () => {
  [{ id: projectId }] = await db().insert(projects).values({ name: 'Clinic booking', slug: 'RetrySlugRetrySlugRe1' }).returning({ id: projects.id });
});

const ticket = async (over: Partial<typeof tickets.$inferInsert>) =>
  (await db().insert(tickets).values({ projectId, clientSentence: 'The page is blank.', reporterIpHash: 'h'.repeat(64), ...over }).returning())[0];
const read = async (id: string) => (await db().select().from(tickets).where(eq(tickets.id, id)))[0];

describe('retryExtraction', () => {
  it('puts a failed ticket back to pending, clears the error and keeps what was typed by hand', async () => {
    const failed = await ticket({ extractionState: 'extraction_failed', failedReason: 'interrupted_by_restart', extractionError: 'Interrupted.', title: 'Typed by hand' });
    expect(await retryExtraction(db(), failed.id, NOW)).toEqual({ ok: true });
    expect(await read(failed.id)).toMatchObject({ extractionState: 'pending', failedReason: null, extractionError: null, title: 'Typed by hand', updatedAt: NOW });
  });

  it('leaves a ticket that is reading or already extracted alone', async () => {
    for (const extractionState of ['pending', 'extracted'] as const) {
      const t = await ticket({ extractionState });
      expect(await retryExtraction(db(), t.id, NOW)).toEqual({ ok: false, error: 'notFailed' });
      expect(await read(t.id)).toEqual(t);
    }
  });

  it('retries once when pressed twice', async () => {
    const failed = await ticket({ extractionState: 'extraction_failed', failedReason: 'extraction_error' });
    const results = await Promise.all([retryExtraction(db(), failed.id, NOW), retryExtraction(db(), failed.id, NOW)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it('says notFound for an unknown or malformed id', async () => {
    expect(await retryExtraction(db(), '00000000-0000-4000-8000-000000000000', NOW)).toEqual({ ok: false, error: 'notFound' });
    expect(await retryExtraction(db(), 'nope', NOW)).toEqual({ ok: false, error: 'notFound' });
  });
});
