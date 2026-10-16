import { createHmac } from 'node:crypto';
import { and, count, eq, gt } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { tickets } from '@/lib/db/schema';

export const REPORTS_PER_HOUR = 10;

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
