"use client";

import { PencilIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { updateTicketFieldAction } from "@/app/actions/tickets";
import { adminCopy } from "@/lib/copy/admin";
import type { EditableField as FieldName } from "@/lib/tickets/update";
import { cn } from "@/lib/utils";

const SAVED_MS = 2000;

/**
 * One editable field. At rest it reads as text (steps as a numbered list) with a pencil that
 * shows on hover; a click turns it into a field that saves when you leave it, with "Saved" for
 * two seconds. The helper text shows only while editing. A value that no longer reads as the AI
 * wrote it carries an "Edited" mark; hover or focus shows what the AI wrote. Esc leaves the
 * field without leaving the page.
 */
export function EditableField({
  ticketId,
  field,
  label,
  value,
  placeholder,
  hint,
  below,
  large,
  numbered,
  aiOriginal,
  edited,
  className,
}: {
  ticketId: string;
  field: FieldName;
  label: string;
  value: string;
  placeholder?: string;
  hint?: string;
  /** Under the field: the evidence line, or the empty-field text with Add (which opens the editor). */
  below?: (open: () => void) => ReactNode;
  /** The title: display size, label for screen readers only. */
  large?: boolean;
  /** Steps: one per line, shown as a numbered list at rest. */
  numbered?: boolean;
  /** What the extraction wrote, as text; null when it wrote nothing. Undefined: no extraction. */
  aiOriginal?: string | null;
  edited?: boolean;
  className?: string;
}) {
  const c = adminCopy.ticket;
  const router = useRouter();
  const id = useId();
  const [text, setText] = useState(value);
  const [saved, setSaved] = useState<string>(value);
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [editing, text, ref]);
  useEffect(() => () => clearTimeout(timer.current), []);
  // After a keyboard exit the textarea is gone; put focus on the button that replaced it.
  const refocus = () => requestAnimationFrame(() => document.getElementById(id)?.focus());

  async function save() {
    setEditing(false);
    if (text === saved) return;
    try {
      const result = await updateTicketFieldAction(ticketId, field, text);
      if (!result.ok) {
        setState("error");
        setError(result.error === "tooLong" ? c.tooLong : c.saveFailed);
        return;
      }
      const stored = Array.isArray(result.value) ? result.value.join(field === "tags" ? ", " : "\n") : (result.value ?? "");
      setText(stored);
      setSaved(stored);
      setError(null);
      setState("saved");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), SAVED_MS);
      router.refresh(); // the Markdown, the Edited marks and the thread's card follow
    } catch {
      setState("error");
      setError(c.saveFailed);
    }
  }

  const steps = numbered ? text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
  const empty = text.trim() === "";
  const aiText = aiOriginal === null ? c.aiWroteNothing : aiOriginal ? `${c.aiWrote} ${aiOriginal}` : null;

  return (
    <div className={cn("group/field", className)}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <label id={`${id}-label`} htmlFor={id} className={cn("text-meta font-medium text-ink-secondary", large && "sr-only")}>
          {label}
        </label>
        {edited && (
          <span className="rounded-md bg-sunken px-1.5 text-meta text-ink-secondary" title={aiText ?? undefined}>
            {c.edited}
          </span>
        )}
        {edited && aiText && (
          <span id={`${id}-edited`} className="sr-only">
            {`${c.edited}. ${aiText}`}
          </span>
        )}
        {state === "saved" && (
          <span role="status" className="animate-pop text-meta text-ink-muted">
            {c.saved}
          </span>
        )}
        {hint && editing && !large && <span className="text-meta text-ink-muted">{hint}</span>}
      </div>

      {editing ? (
        <textarea
          ref={ref}
          id={id}
          rows={1}
          value={text}
          placeholder={placeholder}
          aria-invalid={state === "error" ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => setText(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              event.currentTarget.blur();
              refocus();
            }
            if (event.key === "Enter" && !event.shiftKey && !numbered && field !== "actualResult" && field !== "expectedResult") {
              event.preventDefault();
              event.currentTarget.blur();
              refocus();
            }
          }}
          className={cn(
            "-mx-2 block w-[calc(100%+1rem)] resize-none overflow-hidden rounded-lg border border-line-strong bg-sunken px-2 py-1 text-ink placeholder:text-ink-faint focus:outline-none",
            large ? "text-display" : "mt-0.5 text-body",
          )}
        />
      ) : (
        <button
          type="button"
          id={id}
          onClick={() => setEditing(true)}
          aria-labelledby={`${id}-label ${id}-value`}
          aria-describedby={edited && aiText ? `${id}-edited` : undefined}
          className={cn(
            "-mx-2 flex w-[calc(100%+1rem)] items-start gap-2 rounded-lg border border-transparent px-2 py-1 text-left transition-colors hover:border-line hover:bg-hover focus-visible:border-line-strong",
            large ? "text-display" : "mt-0.5 text-body",
            empty ? "text-ink-muted" : "text-ink",
          )}
        >
          <span id={`${id}-value`} className="min-w-0 flex-1 break-words whitespace-pre-line">
            {empty ? (
              placeholder
            ) : numbered ? (
              <ol className="list-decimal pl-5">
                {steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            ) : (
              text
            )}
          </span>
          <PencilIcon
            aria-hidden
            className={cn("mt-1 size-3.5 shrink-0 text-ink-muted opacity-0 transition-opacity group-hover/field:opacity-100 group-focus-within/field:opacity-100 pointer-coarse:opacity-100", large && "mt-2.5 size-4")}
          />
        </button>
      )}

      {edited && aiText && (
        <p className="mt-0.5 hidden text-meta break-words text-ink-muted group-hover/field:block group-focus-within/field:block">{aiText}</p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-meta font-medium text-ink">
          {error}
        </p>
      )}
      {below?.(() => setEditing(true))}
    </div>
  );
}
