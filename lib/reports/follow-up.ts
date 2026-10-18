import { and, count, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import { hashIp } from '@/lib/auth/rate-limit';
import type { Db } from '@/lib/db/client';
import { followUps, projects, tickets } from '@/lib/db/schema';
import { FOLLOW_UP_MIN, SENTENCE_MAX, type ReportErrorCode } from './validate';

export const FOLLOW_UPS_PER_HOUR = 20;

export type FollowUpDeps = { db: Db; ipHashSecret: string; now?: Date };
export type FollowUpInput = { slug: string; ticketId: unknown; body: unknown; ip: string };
export type FollowUpResult =
  | { ok: true; id: string; createdAt: string }
  | { ok: false; error: Extract<ReportErrorCode, 'notFound' | 'followUpEmpty' | 'sentenceLong' | 'rateLimited' | 'server'> };

/**
 * Adds text to a report the client already sent (Filip, 2026-10-18). The report id works like
 * a key, as for statuses: only the device that sent the report holds it. The report must belong
 * to the link's project; anything else is "notFound", so this can't be used to probe other
 * projects' reports. Rate-limited per hashed address. The ticket itself is never changed.
 */
export async function addFollowUp(deps: FollowUpDeps, input: FollowUpInput): Promise<FollowUpResult> {
  const id = z.uuid().safeParse(input.ticketId);
  if (!id.success) return { ok: false, error: 'notFound' };

  const [report] = await deps.db
    .select({ id: tickets.id })
    .from(tickets)
    .innerJoin(projects, eq(projects.id, tickets.projectId))
    .where(and(eq(projects.slug, input.slug), eq(tickets.id, id.data)));
  if (!report) return { ok: false, error: 'notFound' };

  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (body.length < FOLLOW_UP_MIN) return { ok: false, error: 'followUpEmpty' };
  if (body.length > SENTENCE_MAX) return { ok: false, error: 'sentenceLong' };

  const now = deps.now ?? new Date();
  const ipHash = hashIp(input.ip, deps.ipHashSecret);
  const [recent] = await deps.db
    .select({ n: count() })
    .from(followUps)
    .where(and(eq(followUps.reporterIpHash, ipHash), gt(followUps.createdAt, new Date(now.getTime() - 60 * 60 * 1000))));
  if (recent.n >= FOLLOW_UPS_PER_HOUR) return { ok: false, error: 'rateLimited' };

  const [row] = await deps.db
    .insert(followUps)
    .values({ ticketId: report.id, body, reporterIpHash: ipHash, createdAt: now })
    .returning({ id: followUps.id, createdAt: followUps.createdAt });
  return { ok: true, id: row.id, createdAt: row.createdAt.toISOString() };
}
