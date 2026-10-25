import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { projects, ticketEvents, tickets } from '@/lib/db/schema';
import { updateTicketField } from '@/lib/tickets/update';
import { setupTestDb } from '../helpers/db';

const db = setupTestDb();
const NOW = new Date('2026-10-19T10:00:00Z');
let ticketId: string;

beforeEach(async () => {
  const [p] = await db().insert(projects).values({ name: 'Clinic booking', slug: 'UpdateSlugUpdateSlug1' }).returning();
  [{ id: ticketId }] = await db()
    .insert(tickets)
    .values({
      projectId: p.id,
      clientSentence: 'The page is blank.',
      reporterIpHash: 'h'.repeat(64),
      extractionState: 'extracted',
      confidence: 0.8,
      title: 'Blank page',
      actualResult: 'Blank',
      priority: 'medium',
      expectedResult: 'Content',
      expectedResultEvidence: 'The header says Content.',
    })
    .returning({ id: tickets.id });
});

const read = async () => (await db().select().from(tickets).where(eq(tickets.id, ticketId)))[0];
const events = () => db().select().from(ticketEvents).orderBy(ticketEvents.createdAt);
const update = (field: string, value: unknown) => updateTicketField(db(), ticketId, field, value, NOW);

describe('updateTicketField: text fields', () => {
  it('saves a trimmed text field and bumps updatedAt', async () => {
    expect(await update('title', '  Blank booking page  ')).toEqual({ ok: true, value: 'Blank booking page' });
    const t = await read();
    expect(t.title).toBe('Blank booking page');
    expect(t.updatedAt).toEqual(NOW);
  });

  it('clears a text field when emptied', async () => {
    expect(await update('location', '   ')).toEqual({ ok: true, value: null });
    expect((await read()).location).toBeNull();
  });

  it('keeps evidence when an inferred value is edited, and drops it when the value is cleared', async () => {
    await update('expectedResult', 'Content shows');
    expect(await read()).toMatchObject({ expectedResult: 'Content shows', expectedResultEvidence: 'The header says Content.' });
    await update('expectedResult', '');
    expect(await read()).toMatchObject({ expectedResult: null, expectedResultEvidence: null });
  });

  it('a hand-typed inferred field has no evidence', async () => {
    await update('stepsToReproduce', 'Open the page\n\nReload\n');
    expect(await read()).toMatchObject({ stepsToReproduce: ['Open the page', 'Reload'], stepsToReproduceEvidence: null });
  });

  it('reads tags as a comma-separated list, trimmed, without empties or duplicates', async () => {
    expect(await update('tags', ' booking, Form ,,booking ')).toEqual({ ok: true, value: ['booking', 'Form'] });
    expect((await read()).tags).toEqual(['booking', 'Form']);
    await update('tags', '');
    expect((await read()).tags).toEqual([]);
  });

  it('refuses a value that is too long, and leaves the ticket alone', async () => {
    expect(await update('title', 'x'.repeat(201))).toEqual({ ok: false, error: 'tooLong' });
    expect((await read()).title).toBe('Blank page');
  });
});

describe('updateTicketField: status and priority', () => {
  it('changes status and records the change', async () => {
    expect(await update('status', 'in_progress')).toEqual({ ok: true, value: 'in_progress' });
    expect((await read()).status).toBe('in_progress');
    expect(await events()).toMatchObject([{ ticketId, field: 'status', fromValue: 'new', toValue: 'in_progress', createdAt: NOW }]);
  });

  it('changes priority, including to none, and records each change', async () => {
    await update('priority', 'high');
    await update('priority', '');
    expect((await read()).priority).toBeNull();
    expect((await events()).map((e) => [e.field, e.fromValue, e.toValue])).toEqual([
      ['priority', 'medium', 'high'],
      ['priority', 'high', null],
    ]);
  });

  it('records nothing when the value does not change', async () => {
    await update('status', 'new');
    expect(await events()).toEqual([]);
  });

  it('refuses a value outside the enum', async () => {
    expect(await update('status', 'closed')).toEqual({ ok: false, error: 'invalid' });
    expect(await update('priority', 'urgent')).toEqual({ ok: false, error: 'invalid' });
    expect(await events()).toEqual([]);
  });
});

describe('updateTicketField: whitelist and ids', () => {
  it('refuses every column outside the whitelist, however it is spelled', async () => {
    for (const field of ['clientSentence', 'confidence', 'extractionState', 'expectedResultEvidence', 'reporterIpHash', 'projectId', 'number', 'id', 'created_at', '__proto__']) {
      expect(await update(field, 'x')).toEqual({ ok: false, error: 'invalid' });
    }
    expect(await read()).toMatchObject({ clientSentence: 'The page is blank.', confidence: 0.8 });
  });

  it('says notFound for an unknown or malformed id', async () => {
    expect(await updateTicketField(db(), '00000000-0000-4000-8000-000000000000', 'title', 'x', NOW)).toEqual({ ok: false, error: 'notFound' });
    expect(await updateTicketField(db(), 'nope', 'title', 'x', NOW)).toEqual({ ok: false, error: 'notFound' });
  });
});
