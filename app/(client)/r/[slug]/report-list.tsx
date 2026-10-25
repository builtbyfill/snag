"use client";

import { PlusIcon } from "lucide-react";
import { DateTile } from "@/components/date-tile";
import { StatusGlyph, type TicketStatus } from "@/components/status-glyph";
import type { ClientCopy } from "@/lib/copy/client";
import { groupByStatus } from "@/lib/reports/groups";
import type { HistoryEntry } from "@/lib/reports/history";
import { cn } from "@/lib/utils";

// The selection mark for a report row: white on the list pane, a 3px lime bar with a 1px ink line.
const current =
  "bg-selected before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-l-full before:bg-lime after:absolute after:inset-y-2 after:left-[3px] after:w-px after:bg-ink";

const GROUPS: TicketStatus[] = ["new", "in_progress", "done"];

/**
 * The reports in this feed, grouped Received / In progress / Done, newest first in each. "New
 * report" stays pinned on top and puts the cursor in the composer. The left pane on wide screens;
 * a sheet from the bar below.
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
  const groups = groupByStatus(history, statuses);

  return (
    <nav aria-label={copy.list.title} className="flex flex-col gap-3 p-2">
      {/* A plain bordered button: no selection bar. Focus is the global 2px focus-visible ring. */}
      <button
        type="button"
        onClick={() => onSelect(null)}
        className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-body font-medium text-ink transition-colors duration-(--motion-fast) hover:bg-hover active:translate-y-px pointer-coarse:h-11"
      >
        <PlusIcon className="size-4" aria-hidden />
        {copy.list.newReport}
      </button>

      {GROUPS.map((group) => (
        <Group
          key={group}
          label={copy.status[group]}
          entries={groups[group]}
          muted={group === "done"}
          {...{ statuses, selectedId, copy, onSelect }}
        />
      ))}
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
      <h2 className="flex items-center justify-between px-2.5 pb-1 text-meta font-medium text-ink-muted">
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
                  "relative flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left",
                  "transition-colors duration-(--motion-fast) hover:bg-hover",
                  selected && current,
                )}
              >
                <DateTile iso={entry.sentAt} small className="mt-0.5" />
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
