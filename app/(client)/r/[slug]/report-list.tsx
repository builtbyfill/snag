"use client";

import { PlusIcon } from "lucide-react";
import { DateTile } from "@/components/date-tile";
import { StatusGlyph, type TicketStatus } from "@/components/status-glyph";
import type { ClientCopy } from "@/lib/copy/client";
import { groupReports } from "@/lib/reports/groups";
import type { HistoryEntry } from "@/lib/reports/history";
import { cn } from "@/lib/utils";

// The selection mark for a report row: the selected shade, with a 2px ink bar on its left edge.
const current =
  "bg-selected before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-ink";

/**
 * This device's reports, grouped In progress / Done like a support portal, newest first.
 * "New report" stays pinned on top. The left pane on wide screens; a sheet from the bar below.
 */
export function ReportList({
  history,
  statuses,
  selectedId,
  copy,
  onSelect,
}: {
  history: HistoryEntry[];
  statuses: Record<string, TicketStatus>;
  selectedId: string | null;
  copy: ClientCopy;
  onSelect: (ticketId: string | null) => void;
}) {
  const { open, done } = groupReports(history, statuses);

  return (
    <nav aria-label={copy.list.title} className="flex flex-col gap-4 p-3">
      {/* A plain bordered button: no selection bar. Focus is the global 2px focus-visible ring. */}
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-current={selectedId === null ? "true" : undefined}
        className="flex h-9 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-body font-medium text-ink transition-colors duration-(--motion-fast) hover:bg-sunken active:translate-y-px pointer-coarse:h-11"
      >
        <PlusIcon className="size-4" aria-hidden />
        {copy.list.newReport}
      </button>

      <Group label={copy.list.groups.open} entries={open} {...{ statuses, selectedId, copy, onSelect }} />
      <Group label={copy.list.groups.done} entries={done} muted {...{ statuses, selectedId, copy, onSelect }} />
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
}: {
  label: string;
  entries: HistoryEntry[];
  muted?: boolean;
  statuses: Record<string, TicketStatus>;
  selectedId: string | null;
  copy: ClientCopy;
  onSelect: (ticketId: string) => void;
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
          const selected = entry.ticketId === selectedId;
          return (
            <li key={entry.ticketId}>
              <button
                type="button"
                onClick={() => onSelect(entry.ticketId)}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "relative flex min-h-14 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left",
                  "transition-colors duration-(--motion-fast) hover:bg-sunken",
                  selected && current,
                )}
              >
                <DateTile iso={entry.sentAt} />
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
