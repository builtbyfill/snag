// Retry: a failed ticket goes back to `pending`, and runExtraction (unchanged) reads the screenshot
// again. It fills only empty fields, so anything typed by hand survives, and it numbers its
// attempts after the earlier ones.
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '@/lib/db/client';
import { tickets } from '@/lib/db/schema';

export type RetryResult = { ok: true } | { ok: false; error: 'notFound' | 'notFailed' };

export async function retryExtraction(db: Db, ticketId: string, now: Date = new Date()): Promise<RetryResult> {
  if (!z.uuid().safeParse(ticketId).success) return { ok: false, error: 'notFound' };
  // One conditional UPDATE: of two retries pressed at once, only one finds the ticket failed.
  const [row] = await db
    .update(tickets)
    .set({ extractionState: 'pending', extractionError: null, failedReason: null, updatedAt: now })
    .where(and(eq(tickets.id, ticketId), eq(tickets.extractionState, 'extraction_failed')))
    .returning({ id: tickets.id });
  if (row) return { ok: true };
  const [exists] = await db.select({ id: tickets.id }).from(tickets).where(eq(tickets.id, ticketId));
  return { ok: false, error: exists ? 'notFailed' : 'notFound' };
}
