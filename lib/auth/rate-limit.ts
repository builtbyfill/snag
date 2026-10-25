import { createHmac } from 'node:crypto';
import { and, count, eq, gt } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { tickets } from '@/lib/db/schema';

export const REPORTS_PER_HOUR = 10;
/** Across every project and address: the most extractions the app will start in an hour. */
export const GLOBAL_REPORTS_PER_HOUR = 60;

/**
 * HMAC-SHA256 of the IP, keyed with IP_HASH_SECRET. A plain SHA-256 of an IPv4 address could be
 * reversed by hashing all four billion addresses; without the key it can't.
 */
export function hashIp(ip: string, secret: string): string {
  return createHmac('sha256', secret).update(ip).digest('hex');
}

/**
 * First x-forwarded-for value. Behind Caddy that is the real client address; locally Next fills
 * it from the socket unless the client sent its own (accepted: spec.md > Security Checklist).
 */
export function clientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/**
 * True when this IP hash already sent REPORTS_PER_HOUR reports in the last hour. Counted from
 * tickets; the (reporter_ip_hash, created_at) index keeps this a range scan on every submission.
 */
export async function reportLimitHit(db: Db, ipHash: string, now: Date = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - 60 * 60 * 1000);
  const [row] = await db
    .select({ n: count() })
    .from(tickets)
    .where(and(eq(tickets.reporterIpHash, ipHash), gt(tickets.createdAt, since)));
  return row.n >= REPORTS_PER_HOUR;
}

/**
 * True when GLOBAL_REPORTS_PER_HOUR reports already arrived in the last hour, whoever sent them.
 * The per-address limit keys on a header a client can set when the app isn't behind the proxy,
 * so this caps what a spoofed address can cost in API credits.
 */
export async function globalLimitHit(db: Db, now: Date = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - 60 * 60 * 1000);
  const [row] = await db.select({ n: count() }).from(tickets).where(gt(tickets.createdAt, since));
  return row.n >= GLOBAL_REPORTS_PER_HOUR;
}

export const LOGIN_FAILURES_ALLOWED = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/**
 * Failed logins per address, in memory: at most LOGIN_FAILURES_ALLOWED in any LOGIN_WINDOW_MS.
 * One app instance (spec.md), so one Map is the whole truth; a restart forgets it.
 */
export function createLoginLimiter(allowed = LOGIN_FAILURES_ALLOWED, windowMs = LOGIN_WINDOW_MS) {
  const failures = new Map<string, number[]>();
  const recent = (ip: string, now: number) => (failures.get(ip) ?? []).filter((t) => t > now - windowMs);

  return {
    isLocked(ip: string, now: number = Date.now()): boolean {
      return recent(ip, now).length >= allowed;
    },
    /** Records one failure; true when this one locks the address. */
    recordFailure(ip: string, now: number = Date.now()): boolean {
      // Drop addresses with nothing left in the window, so the Map can't grow without bound.
      for (const [key, times] of failures) if (times.every((t) => t <= now - windowMs)) failures.delete(key);
      const times = [...recent(ip, now), now];
      failures.set(ip, times);
      return times.length === allowed;
    },
    clear(ip: string): void {
      failures.delete(ip);
    },
    size(): number {
      return failures.size;
    },
  };
}
export type LoginLimiter = ReturnType<typeof createLoginLimiter>;

// Kept on globalThis so a dev-server reload doesn't forget the failures.
const cache = globalThis as unknown as { snagLoginLimiter?: LoginLimiter };
export const loginLimiter: LoginLimiter = (cache.snagLoginLimiter ??= createLoginLimiter());
