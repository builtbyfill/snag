import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { adminCopy } from "@/lib/copy/admin";
import { getDb } from "@/lib/db/client";
import { getTicketHeading } from "@/lib/tickets/queries";
import { EscapeTo } from "../../escape-to";
import { dashboardHref, readQuery } from "../../href";

export const metadata: Metadata = { title: `${adminCopy.ticket.pageTitle} · Snag` };

// Slice 7 keeps only the way in and out: the number, the title, "Back to chat" and Esc. Slice 8
// replaces the body with the screenshot beside the fields.
export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const { id } = await params;
  const ticket = await getTicketHeading(getDb(), id);
  if (!ticket) notFound();

  const q = readQuery(await searchParams);
  const back = dashboardHref("/dashboard", { ...q, project: ticket.projectId });
  const c = adminCopy.ticket;

  return (
    <main className="relative flex h-full min-h-0 flex-col overflow-y-auto bg-canvas">
      <EscapeTo href={back} />
      <div className="flex h-[52px] shrink-0 items-center border-b border-line px-2 md:px-4">
        <Link href={back} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-meta font-medium text-ink-secondary transition-colors hover:bg-sunken hover:text-ink pointer-coarse:h-11">
          <ArrowLeftIcon className="size-4" aria-hidden />
          {c.back}
        </Link>
      </div>
      <div className="mx-auto w-full max-w-[720px] px-4 py-8 md:px-8">
        <p className="font-mono text-meta text-ink-secondary">SN-{ticket.number}</p>
        <h1 className="mt-1 text-display text-ink">{ticket.title ?? ticket.clientSentence}</h1>
        <p className="mt-3 text-body text-ink-muted">{c.comingNext}</p>
      </div>
    </main>
  );
}
