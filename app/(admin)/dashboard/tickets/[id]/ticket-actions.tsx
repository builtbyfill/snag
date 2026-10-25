"use client";

import { CheckIcon, ClipboardCopyIcon } from "lucide-react";
import { TYPING_OR_MENU } from "@/app/(admin)/dashboard/escape-to";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { updateTicketFieldAction } from "@/app/actions/tickets";
import { PriorityBars } from "@/components/priority-bars";
import { StatusGlyph } from "@/components/status-glyph";
import { copyText } from "@/lib/clipboard";
import { adminCopy } from "@/lib/copy/admin";
import { cn } from "@/lib/utils";
import { RetryButton } from "../../retry-button";
import { MenuSelect } from "./menu-select";

const FLASH_MS = 2000;
// The menu needs a value for "no priority"; the action takes an empty string for it.
const NO_PRIORITY = "none";

/**
 * The header's actions: Status and Priority (saved at once), and Copy as Markdown (also `c`).
 * Confirmations show on the control itself; a failure says so beside it.
 */
export function TicketActions({
  ticketId,
  status,
  priority,
  markdown,
  pending,
  failed,
}: {
  ticketId: string;
  status: "new" | "in_progress" | "done";
  priority: "low" | "medium" | "high" | null;
  markdown: string;
  pending: boolean;
  failed: boolean;
}) {
  const c = adminCopy.ticket;
  const router = useRouter();
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const say = (text: string, ok: boolean) => {
    setNote({ text, ok });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), FLASH_MS);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  async function change(field: "status" | "priority", value: string) {
    try {
      const result = await updateTicketFieldAction(ticketId, field, value);
      if (!result.ok) return say(c.saveFailed, false);
      say(c.saved, true);
      router.refresh();
    } catch {
      say(c.saveFailed, false);
    }
  }

  function copy() {
    copyText(markdown).then(
      () => {
        setCopied(true);
        say(c.copied, true);
        setTimeout(() => setCopied(false), FLASH_MS);
      },
      () => say(c.copyFailed, false),
    );
  }

  // `c` copies while focus is in the ticket, unless a field, menu or dialog has the keyboard.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "c" || event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
      if (!(event.target instanceof HTMLElement) || !event.target.closest("main") || event.target.closest(TYPING_OR_MENU)) return;
      event.preventDefault();
      copy();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MenuSelect
        label={c.statusLabel}
        value={status}
        onChange={(next) => change("status", next)}
        options={(["new", "in_progress", "done"] as const).map((s) => ({
          value: s,
          label: adminCopy.card.status[s],
          glyph: <StatusGlyph status={s} className="size-3.5" />,
        }))}
      />
      {!pending && (
        <MenuSelect
          label={c.priorityLabel}
          value={priority ?? NO_PRIORITY}
          onChange={(next) => change("priority", next === NO_PRIORITY ? "" : next)}
          options={[
            { value: NO_PRIORITY, label: c.noPriority },
            ...(["low", "medium", "high"] as const).map((p) => ({
              value: p,
              label: adminCopy.card.priority[p],
              glyph: <PriorityBars priority={p} />,
            })),
          ]}
        />
      )}
      <button
        type="button"
        onClick={copy}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-meta font-medium text-ink transition-colors hover:bg-hover pointer-coarse:h-11"
      >
        {copied ? <CheckIcon className="size-3.5 animate-pop" aria-hidden /> : <ClipboardCopyIcon className="size-3.5" aria-hidden />}
        {copied ? c.copied : c.copyMarkdown}
        <kbd className="hidden pointer-fine:inline-flex">c</kbd>
      </button>
      {failed && <RetryButton ticketId={ticketId} />}
      <span role="status" className={cn("text-meta", note ? (note.ok ? "text-ink-muted" : "font-medium text-ink") : "sr-only")}>
        {note?.text}
      </span>
    </div>
  );
}
