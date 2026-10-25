import { describe, expect, it } from 'vitest';
import { followUps, projects, tickets } from '@/lib/db/schema';
import { ALWAYS_OPEN } from '@/lib/office-hours';
import { createProject } from '@/lib/projects/create';
import { isDemoTicket, listDemoReports } from '@/lib/reports/demo';
import { setupTestDb } from '../helpers/db';

const db = setupTestDb();
const T1 = new Date('2026-10-20T10:00:00Z');
const T2 = new Date('2026-10-21T10:00:00Z');

async function project(demo: boolean, slug: string) {
  const [p] = await db().insert(projects).values({ name: demo ? 'Demo clinic' : 'Real clinic', slug, demo, officeHours: demo ? ALWAYS_OPEN : null }).returning();
  const [a] = await db().insert(tickets).values({ projectId: p.id, clientSentence: 'First report.', reporterIpHash: 'h'.repeat(64), createdAt: T1, status: 'done' }).returning();
  const [b] = await db().insert(tickets).values({ projectId: p.id, clientSentence: 'Second report.', reporterIpHash: 'h'.repeat(64), createdAt: T2 }).returning();
  await db().insert(followUps).values({ ticketId: a.id, body: 'Still broken.', reporterIpHash: 'h'.repeat(64), createdAt: T2 });
  return { project: p, a, b };
}

describe('listDemoReports', () => {
  it('lists every report of a demo project oldest first, with status, follow-ups and an image link', async () => {
    const { a, b } = await project(true, 'DemoSlugDemoSlugDemoS');
    const reports = await listDemoReports(db(), 'DemoSlugDemoSlugDemoS');
    expect(reports?.map((r) => r.ticketId)).toEqual([a.id, b.id]);
    expect(reports?.[0]).toMatchObject({
      sentence: 'First report.',
      status: 'done',
      sentAt: T1.toISOString(),
      thumb: `/r/DemoSlugDemoSlugDemoS/images/${a.id}?w=640`,
      full: `/r/DemoSlugDemoSlugDemoS/images/${a.id}`,
      followUps: [{ body: 'Still broken.', sentAt: T2.toISOString() }],
    });
    expect(reports?.[1]).toMatchObject({ status: 'new', followUps: [] });
  });

  it('returns null for a real project, even with its own slug, and for an unknown link', async () => {
    await project(false, 'RealSlugRealSlugRealS');
    expect(await listDemoReports(db(), 'RealSlugRealSlugRealS')).toBeNull();
    expect(await listDemoReports(db(), 'NoSuchSlugNoSuchSlugN')).toBeNull();
  });
});

describe('isDemoTicket (the public image route)', () => {
  it('is true only for a ticket of a demo project reached through that project\'s link', async () => {
    const demo = await project(true, 'DemoSlugDemoSlugDemoS');
    const real = await project(false, 'RealSlugRealSlugRealS');
    expect(await isDemoTicket(db(), 'DemoSlugDemoSlugDemoS', demo.a.id)).toBe(true);
    expect(await isDemoTicket(db(), 'RealSlugRealSlugRealS', real.a.id)).toBe(false); // real project: never
    expect(await isDemoTicket(db(), 'DemoSlugDemoSlugDemoS', real.a.id)).toBe(false); // another project's ticket
    expect(await isDemoTicket(db(), 'DemoSlugDemoSlugDemoS', 'not-a-uuid')).toBe(false);
    expect(await isDemoTicket(db(), 42, demo.a.id)).toBe(false);
  });
});

describe('a new project', () => {
  it('is not a demo and has no office hours of its own', async () => {
    const result = await createProject(db(), 'Dental clinic');
    const [row] = await db().select().from(projects);
    expect(result.ok).toBe(true);
    expect(row).toMatchObject({ demo: false, officeHours: null });
  });
});
