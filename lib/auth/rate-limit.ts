import { createHmac } from 'node:crypto';
import { and, count, eq, gt, lte } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { loginFailures, tickets } from '@/lib/db/schema';

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
 * First x-forwarded-for value. Behind Caddy, and on Vercel (which replaces whatever the client
 * sent), that is the real client address; locally Next fills it from the socket unless the
 * client sent its own (accepted: spec.md > Security Checklist).
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

export type LoginLimiter = {
  isLocked(ip: string, now?: number): Promise<boolean>;
  /** Records one failure; true when this one locks the address. */
  recordFailure(ip: string, now?: number): Promise<boolean>;
  clear(ip: string): Promise<void>;
};

/**
 * Failed logins per address, at most `allowed` in any `windowMs`, kept in login_failures so every
 * app instance (Vercel runs several) sees the same count. Stores the HMAC of the address only.
 */
export function createDbLoginLimiter(
  db: Db,
  ipHashSecret: string,
  allowed = LOGIN_FAILURES_ALLOWED,
  windowMs = LOGIN_WINDOW_MS,
): LoginLimiter {
  const since = (now: number) => new Date(now - windowMs);
  const recent = async (ipHash: string, now: number) => {
    const [row] = await db
      .select({ n: count() })
      .from(loginFailures)
      .where(and(eq(loginFailures.ipHash, ipHash), gt(loginFailures.createdAt, since(now))));
    return row.n;
  };

  return {
    async isLocked(ip, now = Date.now()) {
      return (await recent(hashIp(ip, ipHashSecret), now)) >= allowed;
    },
    async recordFailure(ip, now = Date.now()) {
      const ipHash = hashIp(ip, ipHashSecret);
      // Drop every address's expired failures first, so the table can't grow without bound.
      await db.delete(loginFailures).where(lte(loginFailures.createdAt, since(now)));
      await db.insert(loginFailures).values({ ipHash, createdAt: new Date(now) });
      return (await recent(ipHash, now)) === allowed;
    },
    async clear(ip) {
      await db.delete(loginFailures).where(eq(loginFailures.ipHash, hashIp(ip, ipHashSecret)));
    },
  };
}
