import Link from "next/link";
import { SnagMark } from "@/components/snag-mark";
import { adminCopy, fillIn } from "@/lib/copy/admin";
import { SystemRow } from "./system-row";
import { TicketCard } from "./ticket-card";
import type { CardView, ThreadClient } from "./types";

/**
 * One report in the thread: the client's message (framed screenshot, sentence, time) and any
 * follow-ups, then Snag's ticket card under the Snag mark. Avatars in a left gutter say who
 * spoke, as in a chat.
 */
export function ReportMessage({ card, client }: { card: CardView; client: ThreadClient }) {
  const c = adminCopy.thread;
  return (
    <article data-report className="flex flex-col gap-3">
      <div className="flex gap-3">
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-meta font-semibold text-ink-secondary">
          {client.initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2 text-meta">
            <span className="font-medium text-ink">{c.speaker}</span>
            <span className="text-ink-muted">{card.sentAt}</span>
          </p>
          {card.thumb && (
            // Screenshots are light: a raised frame keeps them from glaring on the dark page. The
            // thumbnail opens the ticket too; the card is the keyboard's stop, so this one isn't.
            <Link href={card.href} tabIndex={-1} className="mt-1.5 block w-fit max-w-full rounded-xl border border-line-medium bg-surface p-1 transition-colors hover:border-line-strong">
              {/* eslint-disable-next-line @next/next/no-img-element -- authenticated route, sized thumbnails */}
              <img
                src={card.thumb.src}
                srcSet={card.thumb.srcSet}
                sizes={`${card.thumb.width}px`}
                width={card.thumb.width}
                height={card.thumb.height}
                alt={fillIn(c.screenshotAlt, { name: client.name })}
                loading="lazy"
                className="block h-auto max-w-full rounded-lg"
              />
            </Link>
          )}
          <p className="mt-1.5 w-fit max-w-prose rounded-lg bg-sunken px-3 py-2 text-body whitespace-pre-line text-ink">{card.sentence}</p>
          {card.followUps.map((note) => (
            <div key={note.id} className="mt-2">
              <p className="w-fit max-w-prose rounded-lg bg-sunken px-3 py-2 text-body whitespace-pre-line text-ink">{note.body}</p>
              <p className="mt-1 text-meta text-ink-muted">{fillIn(c.followUpAdded, { time: note.at })}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <span aria-hidden className="flex size-8 shrink-0 items-start justify-center pt-2">
          <SnagMark className="size-5 text-ink-muted [--snag-mark-cut:var(--canvas)]" />
        </span>
        <div className="min-w-0 flex-1">
          <TicketCard card={card} />
          {card.events.map((event) => (
            <SystemRow key={event.id} text={event.text} at={event.at} />
          ))}
        </div>
      </div>
    </article>
  );
}
