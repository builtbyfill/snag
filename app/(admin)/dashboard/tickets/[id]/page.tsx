import { ArrowLeftIcon, MessageCircleQuestionIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PriorityBars } from "@/components/priority-bars";
import { StatusGlyph } from "@/components/status-glyph";
import { requireSession } from "@/lib/auth/session";
import { adminCopy, fillIn } from "@/lib/copy/admin";
import { getDb } from "@/lib/db/client";
import { ticketToMarkdown } from "@/lib/tickets/markdown";
import { getTicket } from "@/lib/tickets/queries";
import { dateTime } from "@/lib/tickets/recency";
import { EscapeTo } from "../../escape-to";
import { dashboardHref, readQuery } from "../../href";
import { EditableField } from "./editable-field";
import { RefreshWhilePending } from "./refresh-while-pending";
import { SourcePanel, type Source } from "./source-panel";
import { TicketActions } from "./ticket-actions";
import { TicketFields, type FieldsView } from "./ticket-fields";

export const metadata: Metadata = { title: `${adminCopy.ticket.pageTitle} · Snag` };

const THUMB_MAX_WIDTH = 320;
const THUMB_MAX_HEIGHT = 480;

/**
 * One ticket beside its source: what the client sent on the left, what was made of it on the
 * right, every field editable in place. "Back to chat" and Esc return to the same client, view
 * and tab; `c` copies the ticket as Markdown.
 */
export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const { id } = await params;
  const ticket = await getTicket(getDb(), id);
  if (!ticket) notFound();

  const q = readQuery(await searchParams);
  const back = dashboardHref("/dashboard", { ...q, project: ticket.projectId });
  const c = adminCopy.ticket;
  const now = new Date();
  const image = `/dashboard/images/${ticket.id}`;
  const scale = ticket.attachment ? Math.min(1, THUMB_MAX_WIDTH / ticket.attachment.width, THUMB_MAX_HEIGHT / ticket.attachment.height) : 1;
  const source: Source = {
    ticketId: ticket.id,
    projectName: ticket.projectName,
    sentence: ticket.clientSentence,
    receivedAt: dateTime(ticket.createdAt, now),
    image: ticket.attachment && {
      src: `${image}?w=320`,
      srcSet: `${image}?w=320 320w, ${image}?w=640 640w`,
      full: image,
      width: Math.max(1, Math.round(ticket.attachment.width * scale)),
      height: Math.max(1, Math.round(ticket.attachment.height * scale)),
    },
    followUps: ticket.followUps.map((f) => ({ id: f.id, body: f.body, at: dateTime(f.createdAt, now) })),
  };
  const ai = ticket.aiOriginal;
  const fields: FieldsView = {
    id: ticket.id,
    extractionState: ticket.extractionState,
    interrupted: ticket.failedReason === "interrupted_by_restart",
    extractionError: ticket.extractionError,
    location: ticket.location ?? "",
    actualResult: ticket.actualResult ?? "",
    tags: ticket.tags.join(", "),
    expectedResult: ticket.expectedResult ?? "",
    expectedResultEvidence: ticket.expectedResultEvidence,
    stepsToReproduce: ticket.stepsToReproduce?.join("\n") ?? "",
    stepsToReproduceEvidence: ticket.stepsToReproduceEvidence,
    ai: ai
      ? {
          location: ai.location,
          actualResult: ai.actualResult,
          tags: ai.tags.join(", ") || null,
          expectedResult: ai.expectedResult,
          stepsToReproduce: ai.stepsToReproduce?.join("\n") ?? null,
        }
      : {},
    edited: ticket.editedFields,
  };
  const pending = ticket.extractionState === "pending";
  const extracted = ticket.extractionState === "extracted";
  const failed = ticket.extractionState === "extraction_failed";
  const confidenceLow = ticket.confidence !== null && ticket.confidence < 0.6;
  const edits = ticket.editCount === 0 ? c.editCount.none : ticket.editCount === 1 ? c.editCount.one : fillIn(c.editCount.many, { count: ticket.editCount });

  return (
    <main className="relative flex h-full min-h-0 flex-col overflow-y-auto bg-canvas">
      <EscapeTo href={back} />
      {pending && <RefreshWhilePending />}
      <div className="sticky top-0 z-20 flex h-[52px] shrink-0 items-center border-b border-line bg-canvas px-2 md:px-4">
        <Link href={back} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-meta font-medium text-ink-secondary transition-colors hover:bg-sunken hover:text-ink pointer-coarse:h-11">
          <ArrowLeftIcon className="size-4" aria-hidden />
          {c.back}
        </Link>
        <span className="min-w-0 flex-1 truncate px-2 text-meta text-ink-muted">{ticket.projectName}</span>
      </div>

      <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-8">
        <p className="font-mono text-meta text-ink-secondary">SN-{ticket.number}</p>
        {pending ? (
          <h1 className="mt-1 text-display text-ink">{ticket.clientSentence}</h1>
        ) : (
          <h1 className="mt-1">
            <EditableField
              ticketId={ticket.id}
              field="title"
              label={c.titleLabel}
              value={ticket.title ?? ""}
              placeholder={c.titlePlaceholder}
              aiOriginal={ai ? ai.title : undefined}
              edited={ticket.editedFields.includes("title")}
              large
            />
          </h1>
        )}

        {/* The meta row holds what you act on: status, priority, confidence, the Ask client flag. */}
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-secondary">
          <span className="flex items-center gap-1.5">
            <StatusGlyph status={ticket.status} className="size-3.5" />
            {adminCopy.card.status[ticket.status]}
          </span>
          {ticket.priority && (
            <span className="flex items-center gap-1.5">
              <PriorityBars priority={ticket.priority} />
              {adminCopy.card.priority[ticket.priority]}
            </span>
          )}
          {extracted && ticket.confidence !== null && (
            <span className="font-mono text-ink-muted">
              {fillIn(adminCopy.card.confidence, { value: ticket.confidence.toFixed(2) })}
              {confidenceLow && ` · ${adminCopy.card.low}`}
            </span>
          )}
          {failed && <span className="text-danger">{c.state.extraction_failed}</span>}
          {ticket.askClient && (
            <span title={adminCopy.card.askClientHint} className="inline-flex h-6 items-center gap-1 rounded-full border border-line-strong px-2 font-medium text-ink">
              <MessageCircleQuestionIcon className="size-3.5" aria-hidden />
              {adminCopy.card.askClient}
              <span className="sr-only">. {adminCopy.card.askClientHint}</span>
            </span>
          )}
        </p>
        {!pending && (
          <details className="mt-1 text-meta text-ink-muted">
            <summary className="cursor-pointer select-none hover:text-ink-secondary">{c.detailsLine}</summary>
            <p className="mt-1 flex flex-wrap gap-x-3">
              <span>{c.state[ticket.extractionState]}</span>
              {ticket.language && <span>{fillIn(c.language, { code: ticket.language })}</span>}
              {ai && <span>{edits}</span>}
            </p>
          </details>
        )}

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10">
          <div className="lg:sticky lg:top-[68px] lg:self-start">
            <SourcePanel source={source} />
          </div>
          <div className="self-start">
            {/* Status, priority, Copy as Markdown and Retry stay in reach while the fields scroll. */}
            <div className="sticky top-[52px] z-10 -mx-2 mb-4 border-b border-line bg-canvas px-2 py-2">
              <TicketActions ticketId={ticket.id} status={ticket.status} priority={ticket.priority} markdown={ticketToMarkdown(ticket)} pending={pending} failed={failed} />
            </div>
            <TicketFields ticket={fields} />
          </div>
        </div>
      </div>
    </main>
  );
}
