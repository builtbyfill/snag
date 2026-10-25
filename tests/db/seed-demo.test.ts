import { describe, expect, it } from 'vitest';
import { attachments, extractions, followUps, projects, tickets } from '@/lib/db/schema';
import { ALWAYS_OPEN } from '@/lib/office-hours';
import { MapStorage } from '@/lib/storage';
import { DEMO_PROJECTS, DEMO_TICKETS, demoTicketId, seedDemoTickets, type DemoResults } from '@/scripts/seed-demo-data';
import { setupTestDb } from '../helpers/db';

const db = setupTestDb();
const NOW = new Date('2026-10-25T12:00:00Z');

const output = (title: string) => ({
  observed: { title, location: 'Booking page', actualResult: 'Nothing happens after the tap.', priority: 'medium', tags: ['booking'] },
  inferred: { expectedResult: { value: 'The next step opens.', evidence: 'The stepper shows a next step.' }, stepsToReproduce: null },
  confidence: 0.8,
  language: 'en',
});
const results: DemoResults = {
  generatedAt: NOW.toISOString(),
  model: 'test-model',
  tickets: Object.fromEntries(DEMO_TICKETS.filter((t) => !t.failed).map((t) => [t.caseId, { parsed: output(`Case ${t.caseId}`), rawResponse: '{}', inputTokens: 10, outputTokens: 5, durationMs: 100 }])),
};

describe('seedDemoTickets', () => {
  it('creates the four demo projects and every report from the stored results, plus the one failed report', async () => {
    const storage = new MapStorage();
    const { inserted, pending } = await seedDemoTickets(db(), storage, { results, now: NOW });
    expect(inserted).toHaveLength(DEMO_TICKETS.length);
    expect(pending).toEqual([]);
    const rows0 = await db().select().from(projects);
    expect(rows0.map((p) => p.name).sort()).toEqual(DEMO_PROJECTS.map((p) => p.name).sort());
    expect(rows0.every((p) => /^[A-Za-z0-9_-]{21}$/.test(p.slug) && !p.slug.startsWith('Demo'))).toBe(true);
    // Demo projects: their client page shows every report, and the header says same-day on any day.
    expect(rows0.every((p) => p.demo && JSON.stringify(p.officeHours) === JSON.stringify(ALWAYS_OPEN))).toBe(true);

    const rows = await db().select().from(tickets);
    expect(rows).toHaveLength(DEMO_TICKETS.length);
    const failed = rows.find((r) => r.id === demoTicketId('012'))!;
    expect(failed).toMatchObject({ extractionState: 'extraction_failed', failedReason: 'extraction_error', title: null });
    const extracted = rows.find((r) => r.id === demoTicketId('002'))!;
    expect(extracted).toMatchObject({ extractionState: 'extracted', title: 'Case 002', confidence: 0.8, language: 'en', status: 'in_progress', expectedResultEvidence: 'The stepper shows a next step.' });
    expect(new Set(rows.map((r) => r.status))).toEqual(new Set(['new', 'in_progress', 'done']));

    expect(await db().select().from(attachments)).toHaveLength(DEMO_TICKETS.length);
    expect(storage.files.size).toBe(DEMO_TICKETS.length);
    expect((await db().select().from(extractions)).filter((e) => e.result === 'succeeded')).toHaveLength(DEMO_TICKETS.length - 1);
    expect(await db().select().from(followUps)).toHaveLength(1);
  });

  it('is idempotent and leaves the rest of the database alone', async () => {
    const [other] = await db().insert(projects).values({ name: 'Clinic booking', slug: 'NIx7Cq5JQqcSN6IrvmbFQ' }).returning();
    await db().insert(tickets).values({ projectId: other.id, clientSentence: 'A real report.', reporterIpHash: 'r'.repeat(64) });
    await seedDemoTickets(db(), new MapStorage(), { results, now: NOW });
    const second = await seedDemoTickets(db(), new MapStorage(), { results, now: NOW });
    expect(second).toMatchObject({ inserted: [], pending: [] });
    expect(await db().select().from(tickets)).toHaveLength(DEMO_TICKETS.length + 1);
    expect(await db().select().from(followUps)).toHaveLength(1);
  });

  it('gives a demo project left with an old fixed slug a random one', async () => {
    await db().insert(projects).values({ name: 'Northwind Clinic', slug: 'DemoNorthwindClinic01' });
    const { projects: seeded } = await seedDemoTickets(db(), new MapStorage(), { results, now: NOW });
    expect(seeded.clinic.slug).not.toBe('DemoNorthwindClinic01');
    expect(seeded.clinic.slug).toMatch(/^[A-Za-z0-9_-]{21}$/);
    const rows = await db().select().from(projects);
    expect(rows.filter((p) => p.name === 'Northwind Clinic')).toHaveLength(1);
    expect(rows[0]).toMatchObject({ demo: true, officeHours: ALWAYS_OPEN });
  });

  it('without results, inserts the reports as pending for --extract to fill', async () => {
    const { pending } = await seedDemoTickets(db(), new MapStorage(), { results: null, now: NOW });
    expect(pending).toHaveLength(DEMO_TICKETS.length - 1);
    const rows = await db().select({ state: tickets.extractionState }).from(tickets);
    expect(rows.filter((r) => r.state === 'pending')).toHaveLength(DEMO_TICKETS.length - 1);
  });
});
