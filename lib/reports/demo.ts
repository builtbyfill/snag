// Demo projects only (Filip, 2026-10-25): their client page shows every report of the project,
// with statuses and follow-ups, so the feed isn't empty in a recording. A real project never
// goes through here: `listDemoReports` returns null unless `projects.demo` is set, and the demo
// image route refuses any ticket outside a demo project.
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '@/lib/db/client';
import { followUps, projects, tickets } from '@/lib/db/schema';
import type { HistoryEntry } from './history';

export type DemoReport = HistoryEntry & { status: 'new' | 'in_progress' | 'done' };

/** The width the client feed asks the demo image route for (lib/tickets/image.ts WIDTHS). */
export const DEMO_THUMB_WIDTH = 640;

export const demoImageUrl = (slug: string, ticketId: string, width: number | null = DEMO_THUMB_WIDTH) =>
  `/r/${slug}/images/${ticketId}${width === null ? '' : `?w=${width}`}`;

/** Every report of a demo project, oldest first, as feed entries; null for a non-demo or unknown link. */
export async function listDemoReports(db: Db, slug: string): Promise<DemoReport[] | null> {
  const [project] = await db.select({ id: projects.id, demo: projects.demo }).from(projects).where(eq(projects.slug, slug));
  if (!project?.demo) return null;

  const rows = await db
    .select({ id: tickets.id, sentence: tickets.clientSentence, status: tickets.status, createdAt: tickets.createdAt })
    .from(tickets)
    .where(eq(tickets.projectId, project.id))
    .orderBy(asc(tickets.createdAt));
  const notes = await db
    .select({ id: followUps.id, ticketId: followUps.ticketId, body: followUps.body, createdAt: followUps.createdAt })
    .from(followUps)
    .innerJoin(tickets, eq(tickets.id, followUps.ticketId))
    .where(eq(tickets.projectId, project.id))
    .orderBy(asc(followUps.createdAt));

  return rows.map((t) => ({
    ticketId: t.id,
    sentence: t.sentence,
    thumb: demoImageUrl(slug, t.id),
    full: demoImageUrl(slug, t.id, null),
    sentAt: t.createdAt.toISOString(),
    status: t.status,
    followUps: notes.filter((n) => n.ticketId === t.id).map((n) => ({ id: n.id, body: n.body, sentAt: n.createdAt.toISOString() })),
  }));
}

/** True only when the link is a demo project's and the ticket belongs to it. */
export async function isDemoTicket(db: Db, slug: unknown, ticketId: unknown): Promise<boolean> {
  if (typeof slug !== 'string' || !z.uuid().safeParse(ticketId).success) return false;
  const [row] = await db
    .select({ id: tickets.id })
    .from(tickets)
    .innerJoin(projects, eq(projects.id, tickets.projectId))
    .where(and(eq(projects.slug, slug), eq(projects.demo, true), eq(tickets.id, ticketId as string)));
  return row !== undefined;
}
