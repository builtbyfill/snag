"use client";

import { CheckIcon, LinkIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TicketStatus } from "@/components/status-glyph";
import { fill, type ClientCopy } from "@/lib/copy/client";
import type { HistoryEntry } from "@/lib/reports/history";
import { loadScreenshot } from "@/lib/reports/screenshot-store";
import { formatSentAt } from "@/lib/reports/sent-at";
import { cn } from "@/lib/utils";

const STEPS: TicketStatus[] = ["new", "in_progress", "done"];

/**
 * One report's chat: her screenshot (framed, at most 280px, opens full size), her
 * sentence, when she sent it with a link back to it, and a subdued system row for each status it
 * has reached, GitHub-timeline style. Only Received has a time until the server records status
 * changes (deferred, Filip 2026-10-18).
 */
export function FeedItem({
  entry,
  status,
  copy,
  slug,
  fresh,
  freshFollowUpId = null,
}: {
  entry: HistoryEntry;
  status: TicketStatus;
  copy: ClientCopy;
  slug: string;
  /** Just sent in this visit: shows the "Sent" confirmation. */
  fresh: boolean;
  /** A follow-up added in this visit settles in; older ones are just there. */
  freshFollowUpId?: string | null;
}) {
  const fullSize = useFullSizeCopy(slug, entry.ticketId);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const sent = formatSentAt(entry.sentAt);
  const reached = STEPS.indexOf(status);

  async function copyLink() {
    const url = `${window.location.origin}/r/${slug}?report=${entry.ticketId}`;
    if (await copyText(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const image = fullSize ? (
    // eslint-disable-next-line @next/next/no-img-element -- full-size copy kept on this device
    <img src={fullSize} alt={copy.screenshotAlt} className="block max-h-[400px] w-auto max-w-[min(100%,280px)] rounded-lg" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- small data-URL thumbnail kept on this device
    <img src={entry.thumb} alt={copy.screenshotAlt} className="block h-auto max-w-full rounded-lg" />
  );

  return (
    <article
      id={`report-${entry.ticketId}`}
      tabIndex={-1}
      aria-label={fill(copy.report.sentOn, { date: sent })}
      className={cn(fresh && "animate-settle")}
    >
      {/* Screenshots are light: a raised frame keeps them from glaring on the dark page. */}
      <figure className="w-fit max-w-full rounded-xl border border-line-medium bg-surface p-1">
        {fullSize ? (
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
      <p className="mt-2 max-w-prose rounded-lg bg-sunken px-3 py-2 text-body text-ink">{entry.sentence}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-muted">
        {fresh && (
          <span className="flex items-center gap-1 font-medium text-ink">
            <CheckIcon className="size-3.5" aria-hidden />
            {copy.feed.sent}
          </span>
        )}
        <time dateTime={entry.sentAt} className="tabular-nums">
          {sent}
        </time>
        <button
          type="button"
          onClick={copyLink}
          className="-my-1 flex min-h-7 items-center gap-1 rounded-md px-1 text-ink-secondary transition-colors duration-(--motion-fast) hover:text-ink pointer-coarse:min-h-11"
        >
          {copied ? (
            <CheckIcon key="copied" className="size-3.5 animate-pop" aria-hidden />
          ) : (
            <LinkIcon key="link" className="size-3.5" aria-hidden />
          )}
          <span aria-live="polite">{copied ? copy.feed.linkCopied : copy.feed.copyLink}</span>
        </button>
      </div>

      {/* System rows: one per status the report has reached. */}
      <ol aria-label={copy.report.progressLabel} className="mt-3 ml-1 flex flex-col gap-1.5 border-l border-line pl-3">
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
          <p className="max-w-prose rounded-lg bg-sunken px-3 py-2 text-body whitespace-pre-line text-ink">{followUp.body}</p>
          <p className="mt-1.5 text-meta text-ink-muted tabular-nums">{fill(copy.followUp.added, { date: formatSentAt(followUp.sentAt) })}</p>
        </div>
      ))}

      {fullSize && (
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
              className="flex size-9 items-center justify-center rounded-md text-ink-secondary transition-colors duration-(--motion-fast) hover:bg-sunken hover:text-ink pointer-coarse:size-11"
            >
              <XIcon className="size-5" aria-hidden />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- local full-size copy kept on this device */}
          <img src={fullSize} alt={copy.screenshotAlt} className="block max-h-[calc(92dvh-46px)] w-auto max-w-full object-contain" />
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
