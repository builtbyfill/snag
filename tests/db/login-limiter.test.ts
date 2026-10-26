import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDbLoginLimiter, hashIp, LOGIN_FAILURES_ALLOWED, LOGIN_WINDOW_MS } from '@/lib/auth/rate-limit';
import { loginFailures } from '@/lib/db/schema';
import { setupTestDb } from '../helpers/db';

const db = setupTestDb();
const SECRET = 'i'.repeat(44);
const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);
const MINUTE = 60 * 1000;

describe('login limiter (database)', () => {
  it('allows five failures from one address in 15 minutes, then locks it', async () => {
    const limiter = createDbLoginLimiter(db(), SECRET);
    expect(LOGIN_FAILURES_ALLOWED).toBe(5);
    expect(LOGIN_WINDOW_MS).toBe(15 * MINUTE);
    for (let i = 0; i < 4; i++) {
      expect(await limiter.recordFailure('203.0.113.7', NOW + i * MINUTE)).toBe(false);
      expect(await limiter.isLocked('203.0.113.7', NOW + i * MINUTE)).toBe(false);
    }
    expect(await limiter.recordFailure('203.0.113.7', NOW + 4 * MINUTE)).toBe(true); // this failure locks
    expect(await limiter.isLocked('203.0.113.7', NOW + 4 * MINUTE)).toBe(true);
  });

  it('frees one attempt when the oldest failure is 15 minutes old', async () => {
    const limiter = createDbLoginLimiter(db(), SECRET);
    for (let i = 0; i < 5; i++) await limiter.recordFailure('203.0.113.7', NOW + i * MINUTE);
    expect(await limiter.isLocked('203.0.113.7', NOW + 15 * MINUTE - 1)).toBe(true);
    expect(await limiter.isLocked('203.0.113.7', NOW + 15 * MINUTE)).toBe(false);
  });

  it('counts each address on its own, and clearing one leaves the others', async () => {
    const limiter = createDbLoginLimiter(db(), SECRET);
    for (let i = 0; i < 5; i++) {
      await limiter.recordFailure('203.0.113.7', NOW);
      await limiter.recordFailure('198.51.100.2', NOW);
    }
    expect(await limiter.isLocked('192.0.2.1', NOW)).toBe(false);
    await limiter.clear('203.0.113.7');
    expect(await limiter.isLocked('203.0.113.7', NOW)).toBe(false);
    expect(await limiter.isLocked('198.51.100.2', NOW)).toBe(true);
  });

  it('stores only a hash of the address', async () => {
    await createDbLoginLimiter(db(), SECRET).recordFailure('203.0.113.7', NOW);
    const rows = await db().select().from(loginFailures);
    expect(rows).toHaveLength(1);
    expect(rows[0].ipHash).toBe(hashIp('203.0.113.7', SECRET));
    expect(JSON.stringify(rows)).not.toContain('203.0.113.7');
  });

  it('two limiters on the same database share the count (two Vercel instances)', async () => {
    const a = createDbLoginLimiter(db(), SECRET);
    const b = createDbLoginLimiter(db(), SECRET);
    for (let i = 0; i < 3; i++) await a.recordFailure('203.0.113.7', NOW);
    for (let i = 0; i < 2; i++) await b.recordFailure('203.0.113.7', NOW);
    expect(await a.isLocked('203.0.113.7', NOW)).toBe(true);
    expect(await b.isLocked('203.0.113.7', NOW)).toBe(true);
  });

  it('deletes failures older than the window when a new one is recorded', async () => {
    const limiter = createDbLoginLimiter(db(), SECRET);
    await limiter.recordFailure('203.0.113.7', NOW);
    await limiter.recordFailure('198.51.100.2', NOW + 20 * MINUTE);
    const [{ n }] = (await db().execute(sql`select count(*)::int as n from login_failures`)).rows as { n: number }[];
    expect(n).toBe(1);
  });
});
