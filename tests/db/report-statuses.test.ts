import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { projects, tickets } from '@/lib/db/schema';
import { getReportStatuses, MAX_STATUS_IDS } from '@/lib/reports/statuses';
import { setupTestDb } from '../helpers/db';

const db = setupTestDb();
const SLUG = 'ClinicSlugClinicSlug1';
const OTHER_SLUG = 'BarberSlugBarberSlug1';

let mine: string[];
let theirs: string;

beforeEach(async () => {
  const [clinic] = await db().insert(projects).values({ name: 'Clinic booking', slug: SLUG }).returning();
  const [barber] = await db().insert(projects).values({ name: 'Barber shop', slug: OTHER_SLUG }).returning();
  const rows = await db().insert(tickets).values([
    { projectId: clinic.id, clientSentence: 'Ne mogu zakazati termin.', reporterIpHash: 'h' },
    { projectId: clinic.id, clientSentence: 'Dugme Sačuvaj ne radi.', reporterIpHash: 'h', status: 'in_progress' },
    { projectId: clinic.id, clientSentence: 'Kalendar je prazan danas.', reporterIpHash: 'h', status: 'done' },
  ]).returning({ id: tickets.id });
  mine = rows.map((r) => r.id);
  [{ id: theirs }] = await db().insert(tickets).values({ projectId: barber.id, clientSentence: 'Ne radi ništa.', reporterIpHash: 'x' }).returning({ id: tickets.id });
});

const sorted = (rows: { id: string; status: string }[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));

describe('getReportStatuses', () => {
  it('returns the status of each id this device holds for this link', async () => {
    const rows = await getReportStatuses(db(), SLUG, mine);
    expect(sorted(rows)).toEqual(sorted([
      { id: mine[0], status: 'new' },
      { id: mine[1], status: 'in_progress' },
      { id: mine[2], status: 'done' },
    ]));
  });

  it('returns id and status only, nothing about the report itself', async () => {
    const [row] = await getReportStatuses(db(), SLUG, [mine[0]]);
    expect(Object.keys(row).sort()).toEqual(['id', 'status']);
  });

  it('ignores ids that belong to another project', async () => {
    expect(await getReportStatuses(db(), SLUG, [theirs])).toEqual([]);
    expect(await getReportStatuses(db(), SLUG, [mine[0], theirs])).toEqual([{ id: mine[0], status: 'new' }]);
  });

  it('returns nothing for an unknown link', async () => {
    expect(await getReportStatuses(db(), 'NoSuchSlugNoSuchSlug1', mine)).toEqual([]);
  });

  it('follows a status change', async () => {
    await db().update(tickets).set({ status: 'done' }).where(eq(tickets.id, mine[0]));
    expect(await getReportStatuses(db(), SLUG, [mine[0]])).toEqual([{ id: mine[0], status: 'done' }]);
  });

  it.each([
    ['not an array', 'abc'],
    ['a malformed id', ['not-a-uuid']],
    ['a non-string slug', null],
    ['too many ids', Array.from({ length: MAX_STATUS_IDS + 1 }, () => crypto.randomUUID())],
  ])('returns [] for %s', async (name, value) => {
    const slug = name === 'a non-string slug' ? value : SLUG;
    const ids = name === 'a non-string slug' ? mine : value;
    expect(await getReportStatuses(db(), slug, ids)).toEqual([]);
  });

  it('accepts exactly the maximum number of ids', async () => {
    expect(MAX_STATUS_IDS).toBe(20);
    const ids = [...mine, ...Array.from({ length: MAX_STATUS_IDS - mine.length }, () => crypto.randomUUID())];
    expect(await getReportStatuses(db(), SLUG, ids)).toHaveLength(3);
  });
});
