import { CheckIcon } from "lucide-react";
import { StatusGlyph, type TicketStatus } from "@/components/status-glyph";
import type { ClientCopy } from "@/lib/copy/client";
import type { HistoryEntry } from "@/lib/reports/history";
import { formatSentAt } from "@/lib/reports/sent-at";
import { cn } from "@/lib/utils";

const STEPS: TicketStatus[] = ["new", "in_progress", "done"];
type StepKind = "completed" | "current" | "future";

/** Passed steps are completed; the reached one is current, except Done, which is an ending. */
const stepKind = (i: number, reached: number): StepKind =>
  i < reached || (i === reached && STEPS[i] === "done") ? "completed" : i === reached ? "current" : "future";

/**
 * The details pane for the selected report (from 1280px): where it stands in words, then the
 * timeline with a timestamp and one short line under each step, then one contact line.
 */
export function ReportDetails({
  entry,
  status,
  copy,
  contactEmail,
}: {
  entry: HistoryEntry;
  status: TicketStatus;
  copy: ClientCopy;
  contactEmail: string | null;
}) {
  const reached = STEPS.indexOf(status);
  // Only the time the report was sent is known; the other steps show "—" until the server records them.
  const times: Partial<Record<TicketStatus, string>> = { new: formatSentAt(entry.sentAt) };
  const [before, after = ""] = copy.report.contactLine.split("{email}");

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-title text-ink">{copy.report.headline[status]}</h2>
        <p className="mt-1 max-w-prose text-body text-ink-secondary">{copy.report.detail[status]}</p>
      </header>

      <ol aria-label={copy.report.progressLabel} className="flex flex-col">
        {STEPS.map((step, i) => {
          const k = stepKind(i, reached);
          const next = i < STEPS.length - 1 ? stepKind(i + 1, reached) : null;
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
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-3">
                  <span className={cn("pt-px", k === "future" ? "text-ink-muted" : k === "current" ? "font-semibold text-ink" : "text-ink")}>
                    {copy.status[step]}
                  </span>
                  {times[step] ? (
                    <time dateTime={entry.sentAt} className="pt-px text-ink-muted tabular-nums">
                      {times[step]}
                    </time>
                  ) : (
                    <span className="pt-px text-ink-muted">—</span>
                  )}
                </span>
                <span className={cn("mt-0.5 block", k === "future" ? "text-ink-muted" : "text-ink-secondary")}>{copy.report.stepLines[step]}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {contactEmail && (
        <p className="text-meta text-ink-secondary">
          {before}
          <a href={`mailto:${contactEmail}`} className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            {contactEmail}
          </a>
          {after}
        </p>
      )}
    </div>
  );
}

/**
 * The same facts in one line, for 1024 to 1279px where there is no room for the pane: the
 * headline, then the three steps with the sent time on Received.
 */
export function StatusStrip({ entry, status, copy }: { entry: HistoryEntry; status: TicketStatus; copy: ClientCopy }) {
  const reached = STEPS.indexOf(status);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-meta">
      <span className="font-semibold text-ink">{copy.report.headline[status]}</span>
      <ol aria-label={copy.report.progressLabel} className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {STEPS.map((step, i) => {
          const k = stepKind(i, reached);
          return (
            <li key={step} aria-current={k === "current" ? "step" : undefined} className={cn("flex items-center gap-1.5", k === "future" ? "text-ink-muted" : "text-ink")}>
              <StatusGlyph status={step} className={cn("size-3.5", k === "future" && "opacity-50")} />
              <span className={k === "current" ? "font-medium" : undefined}>{copy.status[step]}</span>
              {step === "new" && <span className="text-ink-muted tabular-nums">{formatSentAt(entry.sentAt)}</span>}
            </li>
          );
        })}
      </ol>
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
