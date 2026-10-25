import { describe, expect, it } from 'vitest';
import { GLOBAL_REPORTS_PER_HOUR, globalLimitHit, reportLimitHit, REPORTS_PER_HOUR } from '@/lib/auth/rate-limit';
import { projects, tickets } from '@/lib/db/schema';
import { setupTestDb } from '../helpers/db';

const db = setupTestDb();
const NOW = new Date('2026-10-16T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

async function seedTickets(ipHash: string, count: number, createdAt: Date) {
  const [project] = await db().insert(projects).values({ name: 'P', slug: crypto.randomUUID().slice(0, 21) }).returning();
  if (count === 0) return;
  await db().insert(tickets).values(
    Array.from({ length: count }, () => ({ projectId: project.id, clientSentence: 'Ne radi ništa.', reporterIpHash: ipHash, createdAt })),
  );
}

describe('reportLimitHit', () => {
  it('allows the tenth report and blocks the eleventh within an hour', async () => {
    expect(REPORTS_PER_HOUR).toBe(10);
    await seedTickets('h1', 9, minutesAgo(10));
    expect(await reportLimitHit(db(), 'h1', NOW)).toBe(false);
    await seedTickets('h1', 1, minutesAgo(5));
    expect(await reportLimitHit(db(), 'h1', NOW)).toBe(true);
  });

  it('ignores reports older than an hour', async () => {
    await seedTickets('h2', 10, minutesAgo(61));
    expect(await reportLimitHit(db(), 'h2', NOW)).toBe(false);
  });

  it('counts only the same IP hash', async () => {
    await seedTickets('other', 10, minutesAgo(1));
    expect(await reportLimitHit(db(), 'h3', NOW)).toBe(false);
  });
});

describe('globalLimitHit', () => {
  it('caps reports across every address and project at 60 an hour, ignoring older ones', async () => {
    expect(GLOBAL_REPORTS_PER_HOUR).toBe(60);
    await seedTickets('old', 5, minutesAgo(61));
    for (let i = 0; i < 59; i++) await seedTickets(`h${i}`, 1, minutesAgo(1));
    expect(await globalLimitHit(db(), NOW)).toBe(false);
    await seedTickets('h-last', 1, minutesAgo(1));
    expect(await globalLimitHit(db(), NOW)).toBe(true);
  });
});
