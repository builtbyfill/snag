"use client";

import { CircleAlertIcon, MessageCircleQuestionIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { retryExtractionAction } from "@/app/actions/tickets";
import { PriorityBars } from "@/components/priority-bars";
import { StatusGlyph } from "@/components/status-glyph";
import { Spinner } from "@/components/ui/spinner";
import { adminCopy, fillIn } from "@/lib/copy/admin";
import { cn } from "@/lib/utils";
import type { CardView } from "./types";

/**
 * Snag's answer to a report: the ticket number, status, priority, title, what happens, Ask client
 * and confidence. Reading is a dashed edge; failed is the only red on the page and has Retry;
 * done is muted. The card is an <article> whose link stretches over it, so the Retry button can
 * sit inside without nesting a button in a link. The link is the j/k stop.
 */
export function TicketCard({ card }: { card: CardView }) {
  const c = adminCopy.card;
  const extracted = card.extractionState === "extracted";
  const failed = card.extractionState === "extraction_failed";
  const done = card.status === "done";
  const confidence = card.confidence && (
    <span title={c.confidenceLabel} className="font-mono text-meta text-ink-muted">
      <span className="sr-only">{fillIn(c.confidence, { value: card.confidence })}</span>
      <span aria-hidden>
        {card.confidence}
        {card.confidenceLow && ` · ${c.low}`}
      </span>
    </span>
  );

  return (
    <article
      data-card
      className={cn(
        "relative max-w-[560px] rounded-xl border px-4 py-3 transition-colors",
        extracted && "border-line-medium bg-surface hover:border-line-strong",
        card.extractionState === "pending" && "border-dashed border-line-strong hover:bg-surface",
        failed && "border-danger hover:bg-surface",
      )}
    >
      <Link
        href={card.href}
        data-ticket-card
        data-id={card.id}
        className="group block scroll-my-6 after:absolute after:inset-0 after:rounded-xl after:content-['']"
      >
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-secondary">
          <span className="font-mono text-ink">SN-{card.number}</span>
          <span className="flex items-center gap-1.5">
            <StatusGlyph status={card.status} className="size-3.5" />
            {c.status[card.status]}
          </span>
          {extracted && card.priority && (
            <span className="flex items-center gap-1.5">
              <PriorityBars priority={card.priority} />
              {c.priority[card.priority]}
            </span>
          )}
          {/* Confidence sits by the Ask client pill when the card is flagged, so the two read together. */}
          {!card.askClient && confidence && <span className="ml-auto">{confidence}</span>}
        </span>

        {extracted && (
          <>
            <span className={cn("mt-1.5 line-clamp-2 block text-body font-semibold", done ? "text-ink-muted" : "text-ink")}>
              {card.title ?? c.untitled}
            </span>
            <span className={cn("mt-0.5 block truncate text-meta", done ? "text-ink-muted" : "text-ink-secondary")}>
              <span className="text-ink-muted">{c.whatHappens}</span>{" "}
              {card.actualResult ?? <span className="text-ink-muted">{c.unclear}</span>}
            </span>
            {card.askClient && (
              <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex h-6 items-center gap-1 rounded-full border border-line-strong px-2 text-meta font-medium text-ink">
                  <MessageCircleQuestionIcon className="size-3.5" aria-hidden />
                  {c.askClient}
                  <span className="sr-only">. {c.askClientHint}</span>
                </span>
                {confidence}
                {/* The PRD's hint on hover or focus, so it isn't a mouse-only tooltip. */}
                <span aria-hidden className="hidden text-meta text-ink-muted group-hover:inline group-focus-visible:inline">
                  {c.askClientHint}
                </span>
              </span>
            )}
          </>
        )}

        {card.extractionState === "pending" && (
          <span className="mt-1.5 flex items-center gap-2 text-body text-ink-secondary">
            <Spinner className="size-4" aria-hidden />
            {c.reading}
          </span>
        )}

        {failed && (
          <>
            <span className="mt-1.5 flex items-center gap-2 text-body font-medium text-danger">
              <CircleAlertIcon className="size-4 shrink-0" aria-hidden />
              {c.failed}
            </span>
            <span className="mt-0.5 block text-meta text-ink-secondary">{card.interrupted ? c.interrupted : c.failedError}</span>
          </>
        )}
      </Link>

      {failed && <RetryButton ticketId={card.id} />}
    </article>
  );
}

/** Puts the ticket back to reading; the thread's 3-second refresh then follows it to the end. */
function RetryButton({ ticketId }: { ticketId: string }) {
  const c = adminCopy.card;
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const [problem, setProblem] = useState(false);

  return (
    <span className="relative z-10 mt-2.5 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={retrying}
        onClick={() => {
          setProblem(false);
          startRetry(async () => {
            try {
              await retryExtractionAction(ticketId);
              router.refresh();
            } catch {
              setProblem(true);
            }
          });
        }}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-canvas px-3 text-meta font-medium text-ink transition-colors hover:bg-sunken disabled:opacity-60 pointer-coarse:h-11"
      >
        {retrying ? <Spinner className="size-3.5" aria-hidden /> : <RotateCcwIcon className="size-3.5" aria-hidden />}
        {retrying ? c.retrying : c.retry}
      </button>
      {problem && (
        <span role="alert" className="text-meta text-ink">
          {c.retryFailed}
        </span>
      )}
    </span>
  );
}
