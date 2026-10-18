"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { StatusGlyph, type TicketStatus } from "@/components/status-glyph";
import { fill, type ClientCopy } from "@/lib/copy/client";
import type { HistoryEntry } from "@/lib/reports/history";
import { formatSentAt } from "@/lib/reports/sent-at";
import { cn } from "@/lib/utils";

const STEPS: TicketStatus[] = ["new", "in_progress", "done"];

/**
 * One report. The headline says where it stands in words, her message sits under it, and the
 * whole path (Received, In progress, Done) is shown so she can see how far it has come. No reply
 * box: a report is one screenshot and one sentence.
 */
export function ReportTimeline({
  entry,
  status,
  copy,
  onBack,
  fresh,
  focusHeading,
}: {
  entry: HistoryEntry;
  status: TicketStatus;
  copy: ClientCopy;
  onBack: () => void;
  fresh: boolean;
  /** Move focus here when the view replaced what had focus (after sending, or on phones). */
  focusHeading: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusHeading) headingRef.current?.focus();
  }, [focusHeading, entry.ticketId]);

  const reached = STEPS.indexOf(status);

  return (
    <article aria-labelledby="report-title" className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-4 py-6 lg:py-10">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 flex min-h-11 items-center gap-2 self-start rounded-md px-2 text-body text-ink-secondary transition-colors duration-(--motion-fast) hover:text-ink lg:hidden"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        {copy.report.back}
      </button>

      <header className="flex items-start gap-3">
        <StatusGlyph status={status} className="mt-0.5 size-6 text-ink" />
        <div className="min-w-0">
          <h1 id="report-title" ref={headingRef} tabIndex={-1} className="text-title text-ink">
            {copy.report.headline[status]}
          </h1>
          <p className="mt-1 text-body text-ink-secondary">{copy.report.detail[status]}</p>
        </div>
      </header>

      {/* Her message: sunken, end-aligned, like a sent message. */}
      <figure className={cn("flex flex-col items-end gap-1.5 self-end", fresh && "animate-settle")}>
        <div className="max-w-[min(100%,420px)] rounded-xl rounded-br-sm bg-sunken p-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- small data-URL thumbnail kept on this device */}
          <img src={entry.thumb} alt={copy.screenshotAlt} className="max-h-60 w-auto max-w-full rounded-lg" />
          <p className="px-1.5 pt-2 pb-1 text-body text-ink">{entry.sentence}</p>
        </div>
        <figcaption className="text-meta text-ink-muted">
          {fill(copy.report.sentOn, { date: formatSentAt(entry.sentAt) })}
        </figcaption>
      </figure>

      {/* The path: steps reached so far in ink, the rest hollow and muted. */}
      <ol aria-label={copy.report.progressLabel} className="flex flex-col">
        {STEPS.map((step, i) => {
          const done = i <= reached;
          return (
            <li
              key={step}
              aria-current={i === reached ? "step" : undefined}
              className="relative flex min-h-9 items-center gap-3 text-meta"
            >
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn("absolute top-[calc(50%+9px)] left-[7px] h-[calc(100%-18px)] w-px", i < reached ? "bg-ink" : "bg-line-medium")}
                />
              )}
              {/* Passed steps get a check, the current one its own glyph, future ones an empty ring. */}
              <StatusGlyph
                status={!done ? "new" : i === reached && step === "in_progress" ? "in_progress" : "done"}
                className={cn("size-4", done ? "text-ink" : "text-line-strong")}
              />
              <span className={cn(i === reached ? "font-semibold text-ink" : done ? "text-ink-secondary" : "text-ink-muted")}>
                {copy.status[step]}
              </span>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
