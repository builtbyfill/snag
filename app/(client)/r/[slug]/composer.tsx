"use client";

import { CircleAlertIcon, ImagePlusIcon, XIcon } from "lucide-react";
import { useEffect, useId, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { ClientCopy } from "@/lib/copy/client";
import type { ReportErrorCode } from "@/lib/reports/validate";
import { cn } from "@/lib/utils";

export type Chosen = { file: File; thumb: string; url: string; preview: Blob };
export type Problem = { field: "screenshot" | "sentence" | "form"; code: ReportErrorCode };

/**
 * The composer, pinned to the bottom of the conversation: attach, a one-line field that grows,
 * Send. Suggestion chips sit above the field while it is empty; the chosen screenshot shows as a
 * small chip with Remove. One problem at a time, above the field. On a computer with a mouse,
 * Enter sends and Shift+Enter starts a new line; on touch screens Enter is a new line.
 */
export function Composer({
  copy,
  chosen,
  preparing,
  sentence,
  onSentenceChange,
  onAttach,
  onRemove,
  onChip,
  onSend,
  sending,
  slow,
  problem,
  problemId,
  attachRef,
  sentenceRef,
  className,
  contentClassName,
}: {
  copy: ClientCopy;
  chosen: Chosen | null;
  preparing: boolean;
  sentence: string;
  onSentenceChange: (value: string) => void;
  onAttach: () => void;
  onRemove: () => void;
  onChip: (chip: string) => void;
  onSend: () => void;
  sending: boolean;
  slow: boolean;
  problem: Problem | null;
  problemId: string;
  attachRef: RefObject<HTMLButtonElement | null>;
  sentenceRef: RefObject<HTMLTextAreaElement | null>;
  /** Placement from the page (pinned on phones, in the flow on desktop). */
  className?: string;
  /** The column the contents sit in (the page's 640px column on a desktop). */
  contentClassName?: string;
}) {
  const c = copy.composer;
  const fieldId = useId();
  const chipsLabelId = useId();
  const describe = (field: Problem["field"]) => (problem?.field === field ? problemId : undefined);

  // The composer is pinned, but on a phone the keyboard can still cover a message; keep it visible.
  useEffect(() => {
    if (problem) document.getElementById(problemId)?.scrollIntoView({ block: "nearest" });
  }, [problem, problemId]);

  return (
    <form
      noValidate
      aria-busy={sending}
      aria-label={copy.list.newReport}
      className={cn(
        "border-t border-line bg-canvas px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-10",
        className,
      )}
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <div className={cn("flex flex-col gap-2", contentClassName)}>
      {problem && (
        <p id={problemId} role="alert" className="flex items-start gap-2 text-meta font-medium text-ink">
          <CircleAlertIcon className="mt-px size-4 shrink-0" aria-hidden />
          <span>{copy.errors[problem.code]}</span>
        </p>
      )}

      {(chosen || preparing) && (
        <div className="flex animate-pop items-center gap-2 self-start rounded-lg border border-line-medium bg-surface py-1 pr-1 pl-1">
          {preparing ? (
            <span className="flex items-center gap-2 px-2 py-1.5 text-meta text-ink-secondary">
              <Spinner className="size-4" aria-hidden />
              {c.preparing}
            </span>
          ) : (
            chosen && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen screenshot */}
                <img src={chosen.thumb} alt={copy.screenshotAlt} className="size-10 rounded-md object-cover" />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onRemove}
                  aria-label={c.remove}
                  className="size-8 rounded-md text-ink-secondary hover:bg-hover hover:text-ink pointer-coarse:size-11"
                >
                  <XIcon className="size-4" aria-hidden />
                </Button>
              </>
            )
          )}
        </div>
      )}

      {sentence.trim() === "" && (
        <div
          role="group"
          aria-labelledby={chipsLabelId}
          className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
        >
          <span id={chipsLabelId} className="shrink-0 text-meta text-ink-muted">
            {c.chipsLabel}
          </span>
          {c.chips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onChip(chip)}
              className="h-7 shrink-0 rounded-full border border-line-strong bg-surface px-3 text-meta text-ink transition-colors duration-(--motion-fast) hover:border-ink hover:bg-hover active:translate-y-px pointer-coarse:h-11"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      <div
        data-slot="input-group"
        className={cn(
          "flex items-end gap-1.5 rounded-xl border bg-sunken p-1.5",
          problem?.field === "sentence" ? "border-2 border-ink p-[5px]" : "border-line-strong",
        )}
      >
        <button
          ref={attachRef}
          type="button"
          onClick={onAttach}
          disabled={preparing}
          aria-label={c.attach}
          title={c.attach}
          aria-describedby={describe("screenshot")}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-secondary transition-colors duration-(--motion-fast) hover:bg-selected hover:text-ink pointer-coarse:size-11",
            problem?.field === "screenshot" && "text-ink ring-2 ring-ink",
          )}
        >
          <ImagePlusIcon className="size-5" aria-hidden />
        </button>
        <label htmlFor={fieldId} className="sr-only">
          {c.label}
        </label>
        <Textarea
          id={fieldId}
          ref={sentenceRef}
          data-slot="input-group-control"
          name="sentence"
          rows={1}
          maxLength={1000}
          value={sentence}
          readOnly={sending}
          placeholder={c.placeholder}
          aria-invalid={problem?.field === "sentence" ? true : undefined}
          aria-describedby={describe("sentence")}
          onChange={(event) => onSentenceChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && matchMedia("(pointer: fine)").matches) {
              event.preventDefault();
              onSend();
            }
          }}
          className="max-h-40 min-h-9 flex-1 resize-none rounded-none border-0 bg-transparent px-1.5 py-2 text-body text-ink shadow-none placeholder:text-ink-faint focus-visible:ring-0 aria-invalid:ring-0 md:text-body dark:bg-transparent"
        />
        <Button
          type="submit"
          aria-describedby={describe("form")}
          className="h-9 shrink-0 rounded-lg px-4 text-body font-semibold transition-colors duration-(--motion-fast) hover:bg-primary-hover active:translate-y-px pointer-coarse:h-11"
        >
          {sending ? (
            <>
              <Spinner className="size-4" aria-hidden />
              {c.sending}
            </>
          ) : (
            c.send
          )}
        </Button>
      </div>

      {/* Only while a send is taking long; otherwise nothing under the field. */}
      <p aria-live="polite" className="text-meta text-ink-muted empty:hidden">
        {sending && slow ? c.slow : ""}
      </p>
      </div>
    </form>
  );
}
