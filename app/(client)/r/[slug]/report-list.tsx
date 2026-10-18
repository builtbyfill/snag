"use client";

import { PlusIcon } from "lucide-react";
import { DateTile } from "@/components/date-tile";
import { StatusGlyph, type TicketStatus } from "@/components/status-glyph";
import type { ClientCopy } from "@/lib/copy/client";
import { groupReports } from "@/lib/reports/groups";
import type { HistoryEntry } from "@/lib/reports/history";
import { cn } from "@/lib/utils";

// The one selection mark in lists: a sunken row with a 2px ink bar on its left edge.
const current =
  "bg-sunken before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-ink";

/**
 * This device's reports, grouped In progress / Done like a support portal, newest first.
 * "New report" stays pinned on top. The left column on wide screens; the home view on phones,
 * where it gets a page heading and marks nothing as current.
 */
export function ReportList({
  history,
  statuses,
  selectedId,
  copy,
  onSelect,
  asPage = false,
}: {
  history: HistoryEntry[];
  statuses: Record<string, TicketStatus>;
  selectedId: string | null;
  copy: ClientCopy;
  onSelect: (ticketId: string | null) => void;
  asPage?: boolean;
}) {
  const { open, done } = groupReports(history, statuses);
  const markCurrent = !asPage;

  return (
    <nav aria-label={copy.list.title} className={cn("flex flex-col gap-5", asPage ? "px-4 pt-6 pb-8" : "p-3")}>
      {asPage && <h1 className="text-display text-ink">{copy.list.title}</h1>}
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-current={markCurrent && selectedId === null ? "true" : undefined}
        className={cn(
          "relative flex min-h-11 items-center gap-2 rounded-md border px-3 text-body font-medium",
          "transition-colors duration-(--motion-fast) active:translate-y-px",
          // On the phone home it is the one action on the screen, so it is the primary button.
          asPage
            ? "justify-center border-ink bg-ink text-white hover:bg-ink/90"
            : "border-line-strong bg-surface text-ink hover:bg-sunken",
          markCurrent && selectedId === null && current,
        )}
      >
        <PlusIcon className="size-4" aria-hidden />
        {copy.list.newReport}
      </button>

      <Group label={copy.list.groups.open} entries={open} {...{ statuses, selectedId, copy, onSelect, markCurrent }} />
      <Group label={copy.list.groups.done} entries={done} muted {...{ statuses, selectedId, copy, onSelect, markCurrent }} />
    </nav>
  );
}

function Group({
  label,
  entries,
  muted,
  statuses,
  selectedId,
  copy,
  onSelect,
  markCurrent,
}: {
  label: string;
  entries: HistoryEntry[];
  muted?: boolean;
  statuses: Record<string, TicketStatus>;
  selectedId: string | null;
  copy: ClientCopy;
  onSelect: (ticketId: string) => void;
  markCurrent: boolean;
}) {
  if (entries.length === 0) return null;
  return (
    <section>
      <h2 className="flex items-center justify-between px-2 pb-1.5 text-label text-ink-muted uppercase">
        <span>{label}</span>
        <span className="tabular-nums">{entries.length}</span>
      </h2>
      <ul className="flex flex-col gap-0.5">
        {entries.map((entry) => {
          const status = statuses[entry.ticketId] ?? "new";
          const selected = markCurrent && entry.ticketId === selectedId;
          return (
            <li key={entry.ticketId}>
              <button
                type="button"
                onClick={() => onSelect(entry.ticketId)}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-md px-2 py-2 text-left",
                  "transition-colors duration-(--motion-fast) hover:bg-sunken",
                  selected && current,
                )}
              >
                <DateTile iso={entry.sentAt} className={cn(selected ? "bg-surface" : undefined)} />
                <span className="min-w-0 flex-1">
                  <span className={cn("line-clamp-2 text-body", muted ? "text-ink-muted" : "font-medium text-ink")}>
                    {entry.sentence}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-meta text-ink-muted">
                    <StatusGlyph status={status} className="size-3.5" />
                    {copy.status[status]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
