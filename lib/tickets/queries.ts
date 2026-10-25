// What the dashboard reads (spec.md > Chat Surfaces > Dashboard chats). Every function takes the
// database as an argument, so the DB-backed tests run them against snag_test.
import { and, asc, count, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '@/lib/db/client';
import { attachments, extractions, followUps, projects, ticketEvents, tickets } from '@/lib/db/schema';
import { ExtractionOutput } from '@/lib/extraction/schema';

export type ClientsView = 'inbox' | 'done';
export type StatusTab = 'all' | 'new' | 'in_progress' | 'done';

export type ClientRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  /** The latest report's sentence and time; null for a project without reports. */
  lastSentence: string | null;
  lastAt: Date | null;
  openCount: number;
};

export type ThreadTicket = Pick<
  typeof tickets.$inferSelect,
  | 'id'
  | 'number'
  | 'status'
  | 'extractionState'
  | 'failedReason'
  | 'confidence'
  | 'clientSentence'
  | 'title'
  | 'location'
  | 'actualResult'
  | 'expectedResult'
  | 'expectedResultEvidence'
  | 'stepsToReproduce'
  | 'stepsToReproduceEvidence'
  | 'priority'
  | 'tags'
  | 'askClient'
  | 'createdAt'
> & {
  attachment: { width: number; height: number } | null;
  followUps: { id: string; body: string; createdAt: Date }[];
  /** Status and priority changes, oldest first (slice 9). */
  events: TicketEvent[];
};

export type TicketEvent = { id: string; field: 'status' | 'priority'; fromValue: string | null; toValue: string | null; createdAt: Date };

/** One client by id, whatever the view; null for an unknown or malformed id. */
export async function getClient(db: Db, id: string): Promise<{ id: string; name: string; slug: string } | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db.select({ id: projects.id, name: projects.name, slug: projects.slug }).from(projects).where(eq(projects.id, id));
  return row ?? null;
}

/** The little the ticket page needs before slice 8: number, title, sentence and its client. */
export async function getTicketHeading(db: Db, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db
    .select({ id: tickets.id, number: tickets.number, title: tickets.title, clientSentence: tickets.clientSentence, projectId: tickets.projectId })
    .from(tickets)
    .where(eq(tickets.id, id));
  return row ?? null;
}

/** The seven fields the extraction writes and the developer may edit, as the model wrote them. */
export type AiOriginal = {
  title: string;
  location: string;
  actualResult: string | null;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  expectedResult: string | null;
  stepsToReproduce: string[] | null;
};
export type EditableKey = keyof AiOriginal;
const EDITABLE_KEYS: EditableKey[] = ['title', 'location', 'actualResult', 'priority', 'tags', 'expectedResult', 'stepsToReproduce'];

export type TicketDetail = typeof tickets.$inferSelect & {
  projectName: string;
  attachment: { width: number; height: number } | null;
  followUps: { id: string; body: string; createdAt: Date }[];
  /** What the latest successful extraction wrote, or null when none succeeded. */
  aiOriginal: AiOriginal | null;
  /** Fields whose current value differs from the AI original, in field order. */
  editedFields: EditableKey[];
  editCount: number;
};

/** The AI's values from a stored `extractions.parsed`, or null when it isn't a valid output. */
export function aiOriginalFrom(parsed: unknown): AiOriginal | null {
  const out = ExtractionOutput.safeParse(parsed);
  if (!out.success) return null;
  const { observed, inferred } = out.data;
  return {
    title: observed.title,
    location: observed.location,
    actualResult: observed.actualResult,
    priority: observed.priority,
    tags: observed.tags,
    expectedResult: inferred.expectedResult?.value ?? null,
    stepsToReproduce: inferred.stepsToReproduce?.value ?? null,
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Which editable fields no longer read as the AI wrote them. */
export function editedFields(ticket: Pick<typeof tickets.$inferSelect, EditableKey>, original: AiOriginal | null): EditableKey[] {
  if (!original) return [];
  return EDITABLE_KEYS.filter((key) => !same(ticket[key], original[key]));
}

/** Everything the ticket detail shows: the whole row, its client, screenshot size and follow-ups. */
export async function getTicket(db: Db, id: string): Promise<TicketDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db
    .select({ ticket: tickets, projectName: projects.name, width: attachments.width, height: attachments.height })
    .from(tickets)
    .innerJoin(projects, eq(projects.id, tickets.projectId))
    .leftJoin(attachments, eq(attachments.ticketId, tickets.id))
    .where(eq(tickets.id, id));
  if (!row) return null;
  const notes = await db
    .select({ id: followUps.id, body: followUps.body, createdAt: followUps.createdAt })
    .from(followUps)
    .where(eq(followUps.ticketId, id))
    .orderBy(asc(followUps.createdAt));
  const [latest] = await db
    .select({ parsed: extractions.parsed })
    .from(extractions)
    .where(and(eq(extractions.ticketId, id), eq(extractions.result, 'succeeded')))
    .orderBy(desc(extractions.attempt))
    .limit(1);
  const aiOriginal = latest ? aiOriginalFrom(latest.parsed) : null;
  const edited = editedFields(row.ticket, aiOriginal);
  return {
    ...row.ticket,
    projectName: row.projectName,
    attachment: row.width === null || row.height === null ? null : { width: row.width, height: row.height },
    followUps: notes,
    aiOriginal,
    editedFields: edited,
    editCount: edited.length,
  };
}

/** Whether any project exists: tells "no projects yet" from an empty Inbox. */
export async function hasProjects(db: Db): Promise<boolean> {
  const [row] = await db.select({ n: count() }).from(projects);
  return row.n > 0;
}

/** Tickets that aren't done, across every client: the number next to Inbox. */
export async function countOpenTickets(db: Db): Promise<number> {
  const [row] = await db.select({ n: count() }).from(tickets).where(ne(tickets.status, 'done'));
  return row.n;
}

/**
 * One row per project with its latest report and open count: clients by latest report, then the
 * projects still waiting for a first one, newest first. Inbox: something open, or nothing sent
 * yet. Done: reports, and none of them open.
 */
export async function listClients(db: Db, view: ClientsView): Promise<ClientRow[]> {
  const keep = view === 'done' ? sql`last_at IS NOT NULL AND open_count = 0` : sql`open_count > 0 OR last_at IS NULL`;
  const result = await db.execute<{
    id: string;
    name: string;
    slug: string;
    created_at: string | Date;
    last_sentence: string | null;
    last_at: string | Date | null;
    open_count: number;
  }>(sql`
    WITH clients AS (
      SELECT p.id, p.name, p.slug, p.created_at,
             last.client_sentence AS last_sentence, last.created_at AS last_at,
             (SELECT count(*)::int FROM tickets o WHERE o.project_id = p.id AND o.status <> 'done') AS open_count
      FROM projects p
      LEFT JOIN LATERAL (
        SELECT t.client_sentence, t.created_at FROM tickets t
        WHERE t.project_id = p.id ORDER BY t.created_at DESC LIMIT 1
      ) last ON true
    )
    SELECT * FROM clients
    WHERE ${keep}
    ORDER BY last_at DESC NULLS LAST, created_at DESC, name`);

  return result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    createdAt: new Date(r.created_at),
    lastSentence: r.last_sentence,
    lastAt: r.last_at === null ? null : new Date(r.last_at),
    openCount: Number(r.open_count),
  }));
}

/** One client's tickets, oldest first, with the screenshot's size and the client's follow-ups. */
export async function listThread(db: Db, projectId: string, status: StatusTab): Promise<ThreadTicket[]> {
  if (!z.uuid().safeParse(projectId).success) return [];
  const rows = await db
    .select({
      id: tickets.id,
      number: tickets.number,
      status: tickets.status,
      extractionState: tickets.extractionState,
      failedReason: tickets.failedReason,
      confidence: tickets.confidence,
      clientSentence: tickets.clientSentence,
      title: tickets.title,
      location: tickets.location,
      actualResult: tickets.actualResult,
      expectedResult: tickets.expectedResult,
      expectedResultEvidence: tickets.expectedResultEvidence,
      stepsToReproduce: tickets.stepsToReproduce,
      stepsToReproduceEvidence: tickets.stepsToReproduceEvidence,
      priority: tickets.priority,
      tags: tickets.tags,
      askClient: tickets.askClient,
      createdAt: tickets.createdAt,
      width: attachments.width,
      height: attachments.height,
    })
    .from(tickets)
    .leftJoin(attachments, eq(attachments.ticketId, tickets.id))
    .where(and(eq(tickets.projectId, projectId), status === 'all' ? undefined : eq(tickets.status, status)))
    .orderBy(asc(tickets.createdAt), asc(tickets.number));
  if (rows.length === 0) return [];

  const notes = await db
    .select({ id: followUps.id, ticketId: followUps.ticketId, body: followUps.body, createdAt: followUps.createdAt })
    .from(followUps)
    .where(inArray(followUps.ticketId, rows.map((r) => r.id)))
    .orderBy(asc(followUps.createdAt));

  const changes = await db
    .select({ id: ticketEvents.id, ticketId: ticketEvents.ticketId, field: ticketEvents.field, fromValue: ticketEvents.fromValue, toValue: ticketEvents.toValue, createdAt: ticketEvents.createdAt })
    .from(ticketEvents)
    .where(inArray(ticketEvents.ticketId, rows.map((r) => r.id)))
    .orderBy(asc(ticketEvents.createdAt));

  return rows.map(({ width, height, ...ticket }) => ({
    ...ticket,
    attachment: width === null || height === null ? null : { width, height },
    followUps: notes.filter((n) => n.ticketId === ticket.id).map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt })),
    events: changes.filter((e) => e.ticketId === ticket.id).map((e) => ({ id: e.id, field: e.field, fromValue: e.fromValue, toValue: e.toValue, createdAt: e.createdAt })),
  }));
}
