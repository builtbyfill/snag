"use client";

import { CheckIcon, LinkIcon, PlusIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TicketStatus } from "@/components/status-glyph";
import { fill, type ClientCopy } from "@/lib/copy/client";
import type { FollowUp, HistoryEntry } from "@/lib/reports/history";
import { loadScreenshot } from "@/lib/reports/screenshot-store";
import { formatSentAt } from "@/lib/reports/sent-at";
import { cn } from "@/lib/utils";
import { FollowUpComposer } from "./follow-up-composer";

const STEPS: TicketStatus[] = ["new", "in_progress", "done"];

/**
 * One report in the feed, laid out like the dashboard's client message: the framed screenshot
 * (opens full size), the sentence, and one quiet meta row: when it was sent, Copy link, Add to
 * this report. Then what she added later. On a phone the row also carries a system line per
 * status reached and the selected report's lime bar; from 1024px the right pane owns status.
 */
export function FeedItem({
  entry,
  status,
  copy,
  slug,
  fresh,
  freshFollowUpId = null,
  selected = false,
  onSelect,
  onAdded,
}: {
  entry: HistoryEntry;
  status: TicketStatus;
  copy: ClientCopy;
  slug: string;
  /** Just sent in this visit: shows the "Sent" confirmation. */
  fresh: boolean;
  /** A follow-up added in this visit settles in; older ones are just there. */
  freshFollowUpId?: string | null;
  selected?: boolean;
  onSelect?: () => void;
  onAdded?: (followUp: FollowUp) => void;
}) {
  const localCopy = useFullSizeCopy(slug, entry.ticketId);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const sent = formatSentAt(entry.sentAt);
  const reached = STEPS.indexOf(status);
  // Full size: this device's own copy, or the server's for a demo report.
  const full = localCopy ?? entry.full ?? null;
  const canAdd = Boolean(onAdded) && status !== "done";

  async function copyLink() {
    const url = `${window.location.origin}/r/${slug}?report=${entry.ticketId}`;
    if (await copyText(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const image = localCopy ? (
    // eslint-disable-next-line @next/next/no-img-element -- full-size copy kept on this device
    <img src={localCopy} alt={copy.screenshotAlt} className="block max-h-[400px] w-auto max-w-[min(100%,280px)] rounded-lg lg:max-h-[320px] lg:max-w-full lg:object-contain" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- a small data-URL thumbnail kept on this device, or a demo image
    <img src={entry.thumb} alt={copy.screenshotAlt} className="block h-auto max-w-full rounded-lg lg:max-h-[320px] lg:w-auto lg:object-contain" />
  );

  const addButton = (className: string) =>
    canAdd && !adding ? (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className={cn("items-center rounded-md text-ink-secondary transition-colors duration-(--motion-fast) hover:text-ink", className)}
      >
        <PlusIcon className="size-3.5" aria-hidden />
        {copy.followUp.label}
      </button>
    ) : null;

  return (
    <article
      id={`report-${entry.ticketId}`}
      tabIndex={-1}
      aria-label={fill(copy.report.sentOn, { date: sent })}
      aria-current={selected ? "true" : undefined}
      onFocus={onSelect}
      onClick={onSelect}
      className={cn(
        "relative scroll-mt-4 outline-none",
        selected &&
          "before:absolute before:inset-y-0 before:-left-4 before:w-[3px] before:rounded-r-full before:bg-lime after:absolute after:inset-y-0 after:-left-[13px] after:w-px after:bg-ink md:before:-left-6 md:after:-left-[21px] lg:before:hidden lg:after:hidden",
        fresh && "animate-settle",
      )}
    >
      {/* A 1px frame on white sets the screenshot off the page. */}
      <figure className="w-fit max-w-full rounded-xl border border-line-medium bg-surface p-1">
        {full ? (
          <button
            ref={openerRef}
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            aria-label={copy.report.openScreenshot}
            className="block cursor-zoom-in rounded-lg transition-opacity duration-(--motion-fast) hover:opacity-90"
          >
            {image}
          </button>
        ) : (
          image
        )}
      </figure>
      <p className="mt-2 max-w-prose rounded-lg bg-sunken px-3 py-2 text-body text-ink lg:w-fit">{entry.sentence}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-muted lg:gap-x-2">
        {fresh && (
          <span className="flex items-center gap-1 font-medium text-ink">
            <CheckIcon className="size-3.5" aria-hidden />
            {copy.feed.sent}
          </span>
        )}
        <time dateTime={entry.sentAt} className="tabular-nums">
          {sent}
        </time>
        <span aria-hidden className="hidden lg:inline">
          ·
        </span>
        <button
          type="button"
          onClick={copyLink}
          className="-my-1 flex min-h-7 items-center gap-1 rounded-md px-1 text-ink-secondary transition-colors duration-(--motion-fast) hover:text-ink pointer-coarse:min-h-11 lg:px-0"
        >
          {copied ? (
            <CheckIcon key="copied" className="size-3.5 animate-pop" aria-hidden />
          ) : (
            <LinkIcon key="link" className="size-3.5" aria-hidden />
          )}
          <span aria-live="polite">{copied ? copy.feed.linkCopied : copy.feed.copyLink}</span>
        </button>
        {canAdd && !adding && (
          <span aria-hidden className="hidden lg:inline">
            ·
          </span>
        )}
        {addButton("hidden gap-1 lg:inline-flex")}
      </div>

      {/* Phones: one system row per status the report has reached (the right pane does this from 1024px). */}
      <ol aria-label={copy.report.progressLabel} className="mt-3 ml-1 flex flex-col gap-1.5 border-l border-line pl-3 lg:hidden">
        {STEPS.slice(0, reached + 1).map((step) => (
          <li key={step} className="relative flex items-center gap-2 text-meta text-ink-muted">
            <span aria-hidden className="absolute top-1/2 -left-[16.5px] size-2 -translate-y-1/2 rounded-full bg-ink-muted" />
            <span className={step === status ? "font-medium text-ink-secondary" : undefined}>{copy.status[step]}</span>
            {step === "new" && <span className="tabular-nums">{sent}</span>}
          </li>
        ))}
      </ol>

      {/* What she added later, oldest first. */}
      {(entry.followUps ?? []).map((followUp) => (
        <div key={followUp.id} className={cn("mt-4", followUp.id === freshFollowUpId && "animate-settle")}>
          <p className="max-w-prose rounded-lg bg-sunken px-3 py-2 text-body whitespace-pre-line text-ink lg:w-fit">{followUp.body}</p>
          <p className="mt-1.5 text-meta text-ink-muted tabular-nums">{fill(copy.followUp.added, { date: formatSentAt(followUp.sentAt) })}</p>
        </div>
      ))}
      {addButton("mt-3 flex min-h-8 gap-1.5 text-meta font-medium pointer-coarse:min-h-11 lg:hidden")}
      {canAdd && onAdded && <FollowUpComposer copy={copy} slug={slug} ticketId={entry.ticketId} open={adding} onAdded={onAdded} />}

      {full && (
        <dialog
          ref={dialogRef}
          data-zoom
          aria-label={copy.screenshotAlt}
          onClick={(event) => event.target === event.currentTarget && event.currentTarget.close()}
          onClose={() => openerRef.current?.focus()}
          className="m-auto max-h-[92dvh] max-w-[min(92vw,1100px)] overflow-hidden rounded-xl border border-line-medium bg-surface p-0 text-ink backdrop:bg-chrome/80"
        >
          <div className="flex justify-end border-b border-line p-1">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label={copy.report.closeScreenshot}
              className="flex size-9 items-center justify-center rounded-md text-ink-secondary transition-colors duration-(--motion-fast) hover:bg-hover hover:text-ink pointer-coarse:size-11"
            >
              <XIcon className="size-5" aria-hidden />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- the full-size copy (this device's, or the demo's on the server) */}
          <img src={full} alt={copy.screenshotAlt} className="block max-h-[calc(92dvh-46px)] w-auto max-w-full object-contain" />
        </dialog>
      )}
    </article>
  );
}

/** Copies text; falls back to a hidden field where the Clipboard API is missing (plain-http LAN). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  }
}

/** An object URL for this report's full-size copy on this device, or null when there is none. */
function useFullSizeCopy(slug: string, ticketId: string): string | null {
  const [copy, setCopy] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    void loadScreenshot(slug, ticketId).then((blob) => {
      if (cancelled || !blob) return;
      url = URL.createObjectURL(blob);
      setCopy({ id: ticketId, url });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [slug, ticketId]);
  return copy?.id === ticketId ? copy.url : null;
}
