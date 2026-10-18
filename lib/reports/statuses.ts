import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '@/lib/db/client';
import { projects, tickets } from '@/lib/db/schema';

export const MAX_STATUS_IDS = 20; // matches the device history limit

const Input = z.object({
  slug: z.string().min(1).max(64),
  ids: z.array(z.uuid()).max(MAX_STATUS_IDS),
});

export type ReportStatus = { id: string; status: 'new' | 'in_progress' | 'done' };

/**
 * Status of the reports this device sent through this link, and nothing else.
 * A ticket id works like a key: only the device that sent the report holds it. The join on the
 * slug's project means an id from another project returns nothing, and invalid input returns [],
 * so this can never be used to list a project's reports.
 */
export async function getReportStatuses(db: Db, slug: unknown, ids: unknown): Promise<ReportStatus[]> {
  const input = Input.safeParse({ slug, ids });
  if (!input.success || input.data.ids.length === 0) return [];

  return db
    .select({ id: tickets.id, status: tickets.status })
    .from(tickets)
    .innerJoin(projects, eq(projects.id, tickets.projectId))
    .where(and(eq(projects.slug, input.data.slug), inArray(tickets.id, input.data.ids)));
}
