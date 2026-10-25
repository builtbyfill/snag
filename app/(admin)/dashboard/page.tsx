import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { adminCopy, fillIn } from "@/lib/copy/admin";
import { getDb } from "@/lib/db/client";
import { readAuthEnv } from "@/lib/env";
import { ticketToMarkdown } from "@/lib/tickets/markdown";
import { getClient, hasProjects, listClients, listThread, type ThreadTicket } from "@/lib/tickets/queries";
import { dateTime, recencyGroup, relativeTime } from "@/lib/tickets/recency";
import { initials } from "@/lib/utils";
import { ClientsColumn } from "./clients-column";
import { confidenceLevel } from "@/lib/tickets/confidence";
import { dashboardHref, readQuery } from "./href";
import { Thread } from "./thread";
import type { CardView, ClientRowView, DashboardQuery, TabCounts } from "./types";

const THUMB_MAX_WIDTH = 280;
const THUMB_MAX_HEIGHT = 240;

export const metadata: Metadata = { title: `${adminCopy.shell.pageTitle} · Snag` };

// Thumbnails fit inside 280 × 240. The exact size is set before the image loads, so the thread's
// height is final at once and it can open scrolled to the newest report.
function thumbSize({ width, height }: { width: number; height: number }) {
  const scale = Math.min(1, THUMB_MAX_WIDTH / width, THUMB_MAX_HEIGHT / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** "Status changed to In progress", "Priority set to High", "Priority cleared". */
function eventText(e: ThreadTicket["events"][number]): string {
  const c = adminCopy.card;
  if (e.field === "status") return fillIn(adminCopy.thread.statusChanged, { value: c.status[e.toValue as keyof typeof c.status] ?? e.toValue ?? "" });
  if (e.toValue === null) return adminCopy.thread.priorityCleared;
  return fillIn(adminCopy.thread.priorityChanged, { value: c.priority[e.toValue as keyof typeof c.priority] ?? e.toValue });
}

function toCard(t: ThreadTicket, q: DashboardQuery, now: Date): CardView {
  const image = `/dashboard/images/${t.id}`;
  return {
    id: t.id,
    number: t.number,
    status: t.status,
    extractionState: t.extractionState,
    interrupted: t.failedReason === "interrupted_by_restart",
    confidence: t.extractionState === "extracted" && t.confidence !== null ? t.confidence.toFixed(2) : null,
    confidenceLow: t.confidence !== null && confidenceLevel(t.confidence) === 'low',
    title: t.title,
    actualResult: t.actualResult,
    priority: t.priority,
    askClient: t.askClient === true,
    sentence: t.clientSentence,
    sentAt: dateTime(t.createdAt, now),
    thumb: t.attachment && { src: `${image}?w=320`, srcSet: `${image}?w=320 320w, ${image}?w=640 640w`, ...thumbSize(t.attachment) },
    followUps: t.followUps.map((f) => ({ id: f.id, body: f.body, at: dateTime(f.createdAt, now) })),
    events: t.events.map((e) => ({ id: e.id, text: eventText(e), at: dateTime(e.createdAt, now) })),
    markdown: ticketToMarkdown(t),
    href: dashboardHref(`/dashboard/tickets/${t.id}`, q),
  };
}

/**
 * The chats: clients on the left, the open client's reports on the right. Below 1024px the client
 * list is the page until a client is chosen.
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireSession();
  const q = readQuery(await searchParams);
  const db = getDb();
  const now = new Date();

  const clients = await listClients(db, q.view);
  // Without a project in the URL: the client with the latest report, not a project created later
  // that has none yet.
  const open = q.project ? await getClient(db, q.project) : (clients.find((c) => c.lastAt !== null) ?? clients[0] ?? null);
  // The whole thread, so each tab can show its count; the open tab filters it here.
  const [all, anyProject] = await Promise.all([
    open ? listThread(db, open.id, "all") : Promise.resolve([]),
    clients.length > 0 || hasProjects(db),
  ]);
  const counts: TabCounts = { all: all.length, new: 0, in_progress: 0, done: 0 };
  for (const t of all) counts[t.status]++;
  const tickets = q.status === "all" ? all : all.filter((t) => t.status === q.status);

  const rows: ClientRowView[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    initials: initials(c.name),
    sentence: c.lastSentence,
    time: relativeTime(c.lastAt ?? c.createdAt, now),
    openCount: c.openCount,
    group: c.lastAt ? recencyGroup(c.lastAt, now) : "waiting",
    href: dashboardHref("/dashboard", { view: q.view, project: c.id }),
  }));
  const threadQuery: DashboardQuery = { ...q, project: open?.id ?? null };
  const chosen = q.project !== null && open !== null;

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
      <ClientsColumn
        view={q.view}
        rows={rows}
        openId={open?.id ?? null}
        openChosen={chosen}
        anyProject={anyProject}
        className={chosen ? "hidden lg:flex" : "flex"}
      />
      <Thread
        key={`${open?.id ?? "none"}:${q.status}`}
        query={threadQuery}
        client={open && { id: open.id, name: open.name, initials: initials(open.name), reportUrl: `${readAuthEnv().APP_URL}/r/${open.slug}` }}
        cards={tickets.map((t) => toCard(t, threadQuery, now))}
        counts={counts}
        anyProject={anyProject}
        backHref={dashboardHref("/dashboard", { view: q.view })}
        className={chosen ? "flex" : "hidden lg:flex"}
      />
    </div>
  );
}
