import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { TicketStatus } from "@/components/status-glyph";
import type { ClientCopy } from "@/lib/copy/client";
import type { HistoryEntry } from "@/lib/reports/history";
import { formatSentAt } from "@/lib/reports/sent-at";
import { cn } from "@/lib/utils";

const STEPS: TicketStatus[] = ["new", "in_progress", "done"];
type StepKind = "completed" | "current" | "future";

/**
 * The details pane for the selected report (wide screens): where it stands in words, the status
 * timeline, what happens next and contact. On phones each report in the feed carries its own
 * status rows, so this pane is not shown there.
 */
export function ReportDetails({
  entry,
  status,
  copy,
  panel,
}: {
  entry: HistoryEntry;
  status: TicketStatus;
  copy: ClientCopy;
  /** What happens next, and contact. */
  panel: ReactNode;
}) {
  const reached = STEPS.indexOf(status);
  // Only the time the report was sent is known; the other steps show "—" until the server records them.
  const times: Partial<Record<TicketStatus, string>> = { new: formatSentAt(entry.sentAt) };
  // Passed steps are completed; the reached one is current, except Done, which is an ending.
  const kind = (i: number): StepKind =>
    i < reached || (i === reached && STEPS[i] === "done") ? "completed" : i === reached ? "current" : "future";

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-title text-ink">{copy.report.headline[status]}</h2>
        <p className="mt-1 max-w-prose text-body text-ink-secondary">{copy.report.detail[status]}</p>
      </header>

      <ol aria-label={copy.report.progressLabel} className="flex flex-col">
        {STEPS.map((step, i) => {
          const k = kind(i);
          const next = i < STEPS.length - 1 ? kind(i + 1) : null;
          return (
            <li key={step} aria-current={k === "current" ? "step" : undefined} className="relative flex gap-3 pb-5 text-meta last:pb-0">
              {/* Connector to the next step: solid up to where the report is, dashed after. */}
              {next && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-[22px] left-[9px] h-[calc(100%-24px)] border-l-2",
                    next === "future" ? "border-dashed border-line-quiet" : "border-solid border-ink",
                  )}
                />
              )}
              <Marker kind={k} />
              <span className={cn("min-w-24 pt-px", k === "future" ? "text-ink-muted" : k === "current" ? "font-semibold text-ink" : "text-ink")}>
                {copy.status[step]}
              </span>
              {times[step] ? (
                <time dateTime={entry.sentAt} className="pt-px text-ink-muted tabular-nums">
                  {times[step]}
                </time>
              ) : (
                <span className="pt-px text-ink-muted">—</span>
              )}
            </li>
          );
        })}
      </ol>

      {panel}
    </div>
  );
}

/** Completed: solid ink circle with a check. Current: 2px ring with a dot. Future: 1px quiet ring. */
function Marker({ kind }: { kind: StepKind }) {
  if (kind === "completed") {
    return (
      <span aria-hidden className="relative flex size-5 shrink-0 items-center justify-center rounded-full bg-ink text-pane">
        <CheckIcon className="size-3" strokeWidth={3} />
      </span>
    );
  }
  if (kind === "current") {
    return (
      <span aria-hidden className="relative flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-pane">
        <span className="size-2 rounded-full bg-ink" />
      </span>
    );
  }
  return <span aria-hidden className="relative size-5 shrink-0 rounded-full border border-line-quiet bg-pane" />;
}
