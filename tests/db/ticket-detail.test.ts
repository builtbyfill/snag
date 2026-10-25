import { beforeEach, describe, expect, it } from 'vitest';
import { attachments, followUps, projects, tickets } from '@/lib/db/schema';
import { getTicket } from '@/lib/tickets/queries';
import { setupTestDb } from '../helpers/db';

const db = setupTestDb();
const HASH = 'h'.repeat(64);
let projectId: string;
let ticketId: string;

beforeEach(async () => {
  [{ id: projectId }] = await db().insert(projects).values({ name: 'Clinic booking', slug: 'DetailSlugDetailSlug1' }).returning({ id: projects.id });
  [{ id: ticketId }] = await db()
    .insert(tickets)
    .values({
      projectId,
      clientSentence: 'Upisala sam ime i kliknula Dalje.',
      reporterIpHash: HASH,
      language: 'bs',
      status: 'in_progress',
      extractionState: 'extracted',
      confidence: 0.86,
      title: 'Booking step 3 rejects a filled-in name',
      location: 'Booking, step 3',
      actualResult: 'The name field shows an error although it is filled in.',
      priority: 'high',
      tags: ['booking'],
      expectedResult: 'Next opens step 4.',
      expectedResultEvidence: 'The progress bar shows step 3 of 4.',
      stepsToReproduce: ['Reach step 3', 'Tap Next'],
      stepsToReproduceEvidence: 'Step 3 with the fields filled in.',
      createdAt: new Date('2026-10-16T09:00:00Z'),
    })
    .returning({ id: tickets.id });
  await db().insert(attachments).values({ ticketId, storageKey: `${projectId}/${ticketId}.png`, mimeType: 'image/png', width: 780, height: 1688, bytes: 1000 });
  await db().insert(followUps).values([
    { ticketId, body: 'Later note', reporterIpHash: HASH, createdAt: new Date('2026-10-16T11:00:00Z') },
    { ticketId, body: 'First note', reporterIpHash: HASH, createdAt: new Date('2026-10-16T10:00:00Z') },
  ]);
});

describe('getTicket', () => {
  it('returns every field the detail shows, with its client, screenshot size and follow-ups', async () => {
    const ticket = await getTicket(db(), ticketId);
    expect(ticket).toMatchObject({
      id: ticketId,
      number: expect.any(Number),
      projectId,
      projectName: 'Clinic booking',
      status: 'in_progress',
      extractionState: 'extracted',
      failedReason: null,
      extractionError: null,
      confidence: 0.86,
      language: 'bs',
      askClient: false,
      clientSentence: 'Upisala sam ime i kliknula Dalje.',
      title: 'Booking step 3 rejects a filled-in name',
      location: 'Booking, step 3',
      actualResult: 'The name field shows an error although it is filled in.',
      priority: 'high',
      tags: ['booking'],
      expectedResult: 'Next opens step 4.',
      expectedResultEvidence: 'The progress bar shows step 3 of 4.',
      stepsToReproduce: ['Reach step 3', 'Tap Next'],
      stepsToReproduceEvidence: 'Step 3 with the fields filled in.',
      attachment: { width: 780, height: 1688 },
    });
    expect(ticket?.createdAt.toISOString()).toBe('2026-10-16T09:00:00.000Z');
    expect(ticket?.followUps.map((f) => f.body)).toEqual(['First note', 'Later note']);
  });

  it('has no attachment and no follow-ups when there are none', async () => {
    const [{ id }] = await db().insert(tickets).values({ projectId, clientSentence: 'Bare report.', reporterIpHash: HASH }).returning({ id: tickets.id });
    const ticket = await getTicket(db(), id);
    expect(ticket).toMatchObject({ attachment: null, followUps: [], extractionState: 'pending' });
  });

  it('returns null for an unknown or malformed id', async () => {
    expect(await getTicket(db(), '00000000-0000-4000-8000-000000000000')).toBeNull();
    expect(await getTicket(db(), '../etc')).toBeNull();
  });
});

describe('getTicket: what the AI wrote, and what was edited since', () => {
  const parsed = {
    observed: { title: 'Booking step 3 rejects a filled-in name', location: 'Booking, step 3', actualResult: 'The name field shows an error although it is filled in.', priority: 'high', tags: ['booking'] },
    inferred: { expectedResult: { value: 'Next opens step 4.', evidence: 'The progress bar shows step 3 of 4.' }, stepsToReproduce: { value: ['Reach step 3', 'Tap Next'], evidence: 'Step 3 with the fields filled in.' } },
    confidence: 0.86,
    language: 'bs',
  };

  it('has no originals and no edits without a successful extraction', async () => {
    const ticket = await getTicket(db(), ticketId);
    expect(ticket).toMatchObject({ aiOriginal: null, editedFields: [], editCount: 0 });
  });

  it('reads the latest successful attempt and finds no edits when nothing changed', async () => {
    const { extractions } = await import('@/lib/db/schema');
    await db().insert(extractions).values([
      { ticketId, attempt: 1, result: 'failed', model: 'm', error: 'x' },
      { ticketId, attempt: 2, result: 'succeeded', model: 'm', parsed },
    ]);
    const ticket = await getTicket(db(), ticketId);
    expect(ticket?.aiOriginal).toEqual({
      title: 'Booking step 3 rejects a filled-in name',
      location: 'Booking, step 3',
      actualResult: 'The name field shows an error although it is filled in.',
      priority: 'high',
      tags: ['booking'],
      expectedResult: 'Next opens step 4.',
      stepsToReproduce: ['Reach step 3', 'Tap Next'],
    });
    expect(ticket).toMatchObject({ editedFields: [], editCount: 0 });
  });

  it('lists every field that differs from the AI original, in field order', async () => {
    const { extractions, tickets: t } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    await db().insert(extractions).values({ ticketId, attempt: 1, result: 'succeeded', model: 'm', parsed });
    await db().update(t).set({ title: 'Edited title', tags: ['booking', 'form'], stepsToReproduce: ['Reach step 3', 'Tap Next'], expectedResult: null, expectedResultEvidence: null }).where(eq(t.id, ticketId));
    const ticket = await getTicket(db(), ticketId);
    expect(ticket?.editedFields).toEqual(['title', 'tags', 'expectedResult']);
    expect(ticket?.editCount).toBe(3);
  });
});
