import { beforeEach, describe, expect, it } from 'vitest';
import { attachments, followUps, projects, tickets } from '@/lib/db/schema';
import { countOpenTickets, listClients, listThread } from '@/lib/tickets/queries';
import { setupTestDb } from '../helpers/db';

const db = setupTestDb();
const HASH = 'h'.repeat(64);
const at = (iso: string) => new Date(iso);

let clinic: string;
let barber: string;
let bakery: string;
let empty: string;
const ids: Record<string, string> = {};

async function ticket(name: string, projectId: string, createdAt: string, over: Partial<typeof tickets.$inferInsert> = {}) {
  const [row] = await db()
    .insert(tickets)
    .values({ projectId, clientSentence: `${name}: the page doesn't work.`, reporterIpHash: HASH, createdAt: at(createdAt), ...over })
    .returning({ id: tickets.id });
  ids[name] = row.id;
  return row.id;
}

beforeEach(async () => {
  const insert = (name: string, slug: string, createdAt: string) =>
    db().insert(projects).values({ name, slug, createdAt: at(createdAt) }).returning({ id: projects.id }).then(([p]) => p.id);
  clinic = await insert('Clinic booking', 'ClinicSlugClinicSlug1', '2026-10-01T08:00:00Z');
  barber = await insert('Barber shop', 'BarberSlugBarberSlug1', '2026-10-01T08:00:00Z');
  bakery = await insert('Bakery orders', 'BakerySlugBakerySlug1', '2026-10-01T08:00:00Z');
  empty = await insert('New client', 'EmptySlugEmptySlugEm1', '2026-10-17T09:00:00Z');

  await ticket('clinic-old', clinic, '2026-10-10T09:00:00Z', { status: 'done', extractionState: 'extracted', title: 'Old one' });
  await ticket('clinic-mid', clinic, '2026-10-16T09:00:00Z', { status: 'in_progress', extractionState: 'extracted', title: 'Middle' });
  await ticket('clinic-new', clinic, '2026-10-18T09:00:00Z');
  await ticket('barber-1', barber, '2026-10-15T09:00:00Z', { extractionState: 'extraction_failed', failedReason: 'extraction_error' });
  await ticket('bakery-1', bakery, '2026-10-12T09:00:00Z', { status: 'done' });
  await ticket('bakery-2', bakery, '2026-10-13T09:00:00Z', { status: 'done' });

  await db().insert(attachments).values({ ticketId: ids['clinic-new'], storageKey: `${clinic}/${ids['clinic-new']}.png`, mimeType: 'image/png', width: 1170, height: 2532, bytes: 1000 });
  await db().insert(followUps).values([
    { ticketId: ids['clinic-mid'], body: 'Second note', reporterIpHash: HASH, createdAt: at('2026-10-16T11:00:00Z') },
    { ticketId: ids['clinic-mid'], body: 'First note', reporterIpHash: HASH, createdAt: at('2026-10-16T10:00:00Z') },
  ]);
});

describe('countOpenTickets', () => {
  it('counts every ticket that is not done, across projects', async () => {
    expect(await countOpenTickets(db())).toBe(3); // clinic-mid, clinic-new, barber-1
  });
});

describe('listClients', () => {
  it('Inbox: clients with an open ticket by latest report, then projects still waiting for one', async () => {
    const rows = await listClients(db(), 'inbox');
    expect(rows.map((r) => r.name)).toEqual(['Clinic booking', 'Barber shop', 'New client']);
  });

  it('gives each client its latest sentence, its time and the open count', async () => {
    const [clinicRow, barberRow, emptyRow] = await listClients(db(), 'inbox');
    expect(clinicRow).toMatchObject({ id: clinic, slug: 'ClinicSlugClinicSlug1', lastSentence: "clinic-new: the page doesn't work.", openCount: 2 });
    expect(clinicRow.lastAt?.toISOString()).toBe('2026-10-18T09:00:00.000Z');
    expect(emptyRow).toMatchObject({ id: empty, lastSentence: null, lastAt: null, openCount: 0 });
    expect(emptyRow.createdAt.toISOString()).toBe('2026-10-17T09:00:00.000Z');
    expect(barberRow).toMatchObject({ id: barber, openCount: 1 });
  });

  it('Done: clients that have reports and nothing open', async () => {
    const rows = await listClients(db(), 'done');
    expect(rows.map((r) => ({ id: r.id, openCount: r.openCount }))).toEqual([{ id: bakery, openCount: 0 }]);
    expect(rows[0].lastSentence).toBe("bakery-2: the page doesn't work.");
  });

  it('orders waiting projects newest first, and by name when created at the same time', async () => {
    await db().insert(projects).values({ name: 'Archive app', slug: 'ArchiveSlugArchiveSl1', createdAt: at('2026-10-17T09:00:00Z') });
    await db().insert(projects).values({ name: 'Brand new', slug: 'BrandNewSlugBrandNew1', createdAt: at('2026-10-18T11:00:00Z') });
    const names = (await listClients(db(), 'inbox')).map((r) => r.name);
    expect(names).toEqual(['Clinic booking', 'Barber shop', 'Brand new', 'Archive app', 'New client']);
  });
});

describe('listThread', () => {
  it('returns one client\'s tickets oldest first, done ones included, with numbers', async () => {
    const thread = await listThread(db(), clinic, 'all');
    expect(thread.map((t) => t.id)).toEqual([ids['clinic-old'], ids['clinic-mid'], ids['clinic-new']]);
    expect(thread[0].number).toBeLessThan(thread[1].number);
    expect(thread[1].number).toBeLessThan(thread[2].number);
  });

  it('attaches the screenshot size and the follow-ups, oldest first', async () => {
    const thread = await listThread(db(), clinic, 'all');
    const mid = thread.find((t) => t.id === ids['clinic-mid'])!;
    const fresh = thread.find((t) => t.id === ids['clinic-new'])!;
    expect(mid.followUps.map((f) => f.body)).toEqual(['First note', 'Second note']);
    expect(mid.attachment).toBeNull();
    expect(fresh.attachment).toEqual({ width: 1170, height: 2532 });
    expect(fresh.followUps).toEqual([]);
  });

  it('narrows to one status for the New, In progress and Done tabs', async () => {
    const statusOf = async (status: 'new' | 'in_progress' | 'done') => (await listThread(db(), clinic, status)).map((t) => t.id);
    expect(await statusOf('new')).toEqual([ids['clinic-new']]);
    expect(await statusOf('in_progress')).toEqual([ids['clinic-mid']]);
    expect(await statusOf('done')).toEqual([ids['clinic-old']]);
  });

  it('never returns another client\'s tickets, and nothing for an unknown client', async () => {
    expect((await listThread(db(), barber, 'all')).map((t) => t.id)).toEqual([ids['barber-1']]);
    expect(await listThread(db(), empty, 'all')).toEqual([]);
    expect(await listThread(db(), '00000000-0000-4000-8000-000000000000', 'all')).toEqual([]);
  });
});

describe('getClient and hasProjects', () => {
  it('finds one client by id whatever the view, and nothing for an unknown or malformed id', async () => {
    const { getClient } = await import('@/lib/tickets/queries');
    expect(await getClient(db(), bakery)).toEqual({ id: bakery, name: 'Bakery orders', slug: 'BakerySlugBakerySlug1' });
    expect(await getClient(db(), '00000000-0000-4000-8000-000000000000')).toBeNull();
    expect(await getClient(db(), 'not-a-uuid')).toBeNull();
  });

  it('says whether any project exists', async () => {
    const { hasProjects } = await import('@/lib/tickets/queries');
    expect(await hasProjects(db())).toBe(true);
    await db().delete(projects);
    expect(await hasProjects(db())).toBe(false);
  });
});

describe('getTicketHeading', () => {
  it('gives the number, title, sentence and client of one ticket, and null otherwise', async () => {
    const { getTicketHeading } = await import('@/lib/tickets/queries');
    expect(await getTicketHeading(db(), ids['clinic-mid'])).toEqual({
      id: ids['clinic-mid'],
      number: expect.any(Number),
      title: 'Middle',
      clientSentence: "clinic-mid: the page doesn't work.",
      projectId: clinic,
    });
    expect(await getTicketHeading(db(), '00000000-0000-4000-8000-000000000000')).toBeNull();
    expect(await getTicketHeading(db(), 'nope')).toBeNull();
  });
});
