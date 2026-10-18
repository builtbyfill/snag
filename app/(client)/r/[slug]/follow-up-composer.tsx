"use client";

import { CircleAlertIcon, PlusIcon } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { addFollowUpAction } from "@/app/actions/report";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { ClientCopy } from "@/lib/copy/client";
import type { FollowUp } from "@/lib/reports/history";
import type { ReportErrorCode } from "@/lib/reports/validate";

/**
 * The bottom of a report's chat: add text to this report, or start a new report for something
 * else. Text only; a new screenshot belongs in a new report. Focus stays in the field after
 * sending, as in any messaging app.
 */
export function FollowUpComposer({
  copy,
  slug,
  ticketId,
  onAdded,
  onNewReport,
}: {
  copy: ClientCopy;
  slug: string;
  ticketId: string;
  onAdded: (followUp: FollowUp) => void;
  onNewReport: () => void;
}) {
  const c = copy.followUp;
  const fieldId = useId();
  const problemId = useId();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<ReportErrorCode | null>(null);
  const [sending, startSending] = useTransition();

  function send() {
    if (sending) return;
    if (text.trim().length < 2) {
      setProblem("followUpEmpty");
      fieldRef.current?.focus();
      return;
    }
    setProblem(null);
    startSending(async () => {
      try {
        const result = await addFollowUpAction(slug, ticketId, text);
        if (!result.ok) {
          setProblem(result.error);
          return;
        }
        onAdded({ id: result.id, body: text.trim(), sentAt: result.createdAt });
        setText("");
      } catch {
        setProblem("server"); // network failure: the text stays in the field
      }
    });
  }

  return (
    <form
      noValidate
      aria-busy={sending}
      aria-label={c.label}
      className="flex flex-col gap-2 border-t border-line bg-canvas px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-10"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      {problem && (
        <p id={problemId} role="alert" className="flex items-start gap-2 text-meta font-medium text-ink">
          <CircleAlertIcon className="mt-px size-4 shrink-0" aria-hidden />
          <span>{copy.errors[problem]}</span>
        </p>
      )}
      <div data-slot="input-group" className="flex items-end gap-1.5 rounded-xl border border-line-strong bg-sunken p-1.5">
        <label htmlFor={fieldId} className="sr-only">
          {c.label}
        </label>
        <Textarea
          id={fieldId}
          ref={fieldRef}
          data-slot="input-group-control"
          rows={1}
          maxLength={1000}
          value={text}
          readOnly={sending}
          placeholder={c.placeholder}
          aria-invalid={problem === "followUpEmpty" || problem === "sentenceLong" ? true : undefined}
          aria-describedby={problem ? problemId : undefined}
          onChange={(event) => {
            setText(event.target.value);
            if (problem === "followUpEmpty" && event.target.value.trim().length >= 2) setProblem(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && matchMedia("(pointer: fine)").matches) {
              event.preventDefault();
              send();
            }
          }}
          className="max-h-40 min-h-9 flex-1 resize-none rounded-none border-0 bg-transparent px-2 py-2 text-body text-ink shadow-none placeholder:text-ink-faint focus-visible:ring-0 aria-invalid:ring-0 md:text-body dark:bg-transparent"
        />
        <Button
          type="submit"
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-meta text-ink-muted">{c.otherProblem}</p>
        <Button
          type="button"
          variant="outline"
          onClick={onNewReport}
          className="h-8 gap-1.5 rounded-lg border-line-strong bg-surface px-3 text-meta font-medium text-ink hover:bg-sunken pointer-coarse:h-11 dark:bg-surface dark:hover:bg-sunken"
        >
          <PlusIcon className="size-4" aria-hidden />
          {copy.list.newReport}
        </Button>
      </div>
    </form>
  );
}
