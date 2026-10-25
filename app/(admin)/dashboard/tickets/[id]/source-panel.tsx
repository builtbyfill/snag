"use client";

import { XIcon } from "lucide-react";
import { useRef } from "react";
import { adminCopy, fillIn } from "@/lib/copy/admin";

export type Source = {
  ticketId: string;
  projectName: string;
  sentence: string;
  receivedAt: string;
  image: { src: string; srcSet: string; full: string; width: number; height: number } | null;
  followUps: { id: string; body: string; at: string }[];
};

/**
 * The left column: what the client sent, exactly. The screenshot opens full size in a native
 * dialog (Esc closes it and, because the dialog has the key, doesn't leave the page).
 */
export function SourcePanel({ source }: { source: Source }) {
  const c = adminCopy.ticket;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const alt = fillIn(adminCopy.thread.screenshotAlt, { name: source.projectName });

  return (
    <aside aria-label={c.clientWrote} className="flex flex-col gap-4">
      {source.image ? (
        <figure className="w-fit max-w-full rounded-xl border border-line-medium bg-surface p-1">
          <button
            ref={openerRef}
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            aria-label={c.openScreenshot}
            className="block cursor-zoom-in rounded-xl border border-line-medium bg-surface p-1 transition-opacity hover:opacity-90"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated route, sized thumbnails */}
            <img
              src={source.image.src}
              srcSet={source.image.srcSet}
              sizes={`${source.image.width}px`}
              width={source.image.width}
              height={source.image.height}
              alt={alt}
              className="block h-auto max-w-full rounded-lg"
            />
          </button>
        </figure>
      ) : (
        <p className="text-meta text-ink-muted">{c.noScreenshot}</p>
      )}

      <div>
        <h2 className="text-meta font-medium text-ink-secondary">{c.clientWrote}</h2>
        <p className="mt-1.5 w-fit max-w-prose rounded-lg bg-sunken px-3 py-2 text-body whitespace-pre-line text-ink">{source.sentence}</p>
        <p className="mt-1.5 text-meta text-ink-muted">{fillIn(c.received, { time: source.receivedAt })}</p>
        {source.followUps.map((note) => (
          <div key={note.id} className="mt-3">
            <p className="w-fit max-w-prose rounded-lg bg-sunken px-3 py-2 text-body whitespace-pre-line text-ink">{note.body}</p>
            <p className="mt-1.5 text-meta text-ink-muted">{fillIn(c.later, { time: note.at })}</p>
          </div>
        ))}
      </div>

      {source.image && (
        <dialog
          ref={dialogRef}
          data-zoom
          aria-label={alt}
          onClick={(event) => event.target === event.currentTarget && event.currentTarget.close()}
          onClose={() => openerRef.current?.focus()}
          className="m-auto max-h-[92dvh] max-w-[min(92vw,1100px)] overflow-hidden rounded-xl border border-line-medium bg-surface p-0 text-ink backdrop:bg-sunken/90"
        >
          <div className="flex justify-end border-b border-line p-1">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label={c.closeScreenshot}
              className="flex size-9 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-hover hover:text-ink pointer-coarse:size-11"
            >
              <XIcon className="size-5" aria-hidden />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- the original, through the authenticated route */}
          <img src={source.image.full} alt={alt} className="block max-h-[calc(92dvh-46px)] w-auto max-w-full object-contain" />
        </dialog>
      )}
    </aside>
  );
}
