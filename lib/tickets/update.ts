// One field of a ticket, saved from the detail page. A hard whitelist of editable columns: the
// client's sentence, the extraction bookkeeping and the evidence columns can't be reached from
// here. Status and priority changes are recorded in ticket_events for the thread's change rows.
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '@/lib/db/client';
import { ticketEvents, tickets } from '@/lib/db/schema';

const Status = z.enum(['new', 'in_progress', 'done']);
const Priority = z.enum(['low', 'medium', 'high']);

/** Trimmed text, or null when empty; refused above `max` characters. */
const text = (max: number) => z.string().max(max).transform((v) => v.trim() || null);
/** One step per line, blank lines dropped; an empty list becomes null. */
const lines = z.string().max(4000).transform((v) => {
  const steps = v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return steps.length > 0 ? steps.slice(0, 30) : null;
});
/** Comma-separated tags, trimmed, without empties or duplicates. */
const tags = z.string().max(500).transform((v) => [...new Set(v.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 20));

const EDITABLE = {
  title: text(200),
  location: text(500),
  actualResult: text(2000),
  expectedResult: text(2000),
  stepsToReproduce: lines,
  tags,
  priority: z.union([Priority, z.literal('').transform(() => null)]),
  status: Status,
} as const;

export type EditableField = keyof typeof EDITABLE;
export const EDITABLE_FIELDS = Object.keys(EDITABLE) as EditableField[];
export const isEditableField = (field: unknown): field is EditableField =>
  typeof field === 'string' && Object.prototype.hasOwnProperty.call(EDITABLE, field);

export type UpdateResult =
  | { ok: true; value: string | string[] | null }
  | { ok: false; error: 'notFound' | 'invalid' | 'tooLong' };

export async function updateTicketField(db: Db, ticketId: string, field: unknown, value: unknown, now: Date = new Date()): Promise<UpdateResult> {
  if (!z.uuid().safeParse(ticketId).success) return { ok: false, error: 'notFound' };
  if (!isEditableField(field)) return { ok: false, error: 'invalid' };
  const parsed = EDITABLE[field].safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.some((i) => i.code === 'too_big') ? 'tooLong' : 'invalid' };
  }
  const next = parsed.data;

  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(tickets).where(eq(tickets.id, ticketId)).for('update');
    if (!current) return { ok: false, error: 'notFound' } as const;

    const set: Partial<typeof tickets.$inferInsert> = { [field]: next, updatedAt: now };
    // Evidence explains the extraction's own wording. Once the developer changes or clears the
    // value it no longer applies, so the ticket stops calling it "suggested". The model's original
    // stays in the extractions table.
    const changed = JSON.stringify(current[field] ?? null) !== JSON.stringify(next ?? null);
    if (field === 'expectedResult' && changed) set.expectedResultEvidence = null;
    if (field === 'stepsToReproduce' && changed) set.stepsToReproduceEvidence = null;
    await tx.update(tickets).set(set).where(eq(tickets.id, ticketId));

    if ((field === 'status' || field === 'priority') && current[field] !== next) {
      await tx.insert(ticketEvents).values({ ticketId, field, fromValue: current[field], toValue: next as string | null, createdAt: now });
    }
    return { ok: true, value: next } as const;
  });
}
