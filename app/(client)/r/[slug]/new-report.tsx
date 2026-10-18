"use client";

import { ArrowLeftIcon, CircleAlertIcon, ImagePlusIcon, XIcon } from "lucide-react";
import { useEffect, useId, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { ClientCopy } from "@/lib/copy/client";
import type { ReportErrorCode } from "@/lib/reports/validate";
import { cn } from "@/lib/utils";

export type Chosen = { file: File; thumb: string; url: string };
export type Problem = { field: "screenshot" | "sentence" | "form"; code: ReportErrorCode };

/**
 * The new report: one screenshot, one sentence, Send. The screenshot area and the field are
 * the whole task, so they get the space. Each problem is shown next to the thing it is about.
 * Nothing fades while sending; the form is marked busy.
 */
export function NewReport({
  copy,
  after,
  onBack,
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
}: {
  copy: ClientCopy;
  /** Shown under the form on phones (the first-visit notes). */
  after?: ReactNode;
  /** Back to the report list on phones, when there is one. */
  onBack?: () => void;
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
}) {
  const c = copy.newReport;
  const sentenceId = `${problemId}-sentence`;
  const chipsLabelId = useId();
  const describe = (field: Problem["field"]) => (problem?.field === field ? problemId : undefined);
  const message = (field: Problem["field"]) =>
    problem?.field === field && (
      <p id={problemId} role="alert" className="flex items-start gap-2 text-meta font-medium text-ink">
        <CircleAlertIcon className="mt-px size-4 shrink-0" aria-hidden />
        <span>{copy.errors[problem.code]}</span>
      </p>
    );
  const screenshotWrong = problem?.field === "screenshot";

  // A field's message can land under the pinned Send bar on phones; bring it into view above it
  // (the scroll container keeps room for the bar with scroll-padding).
  useEffect(() => {
    if (problem && problem.field !== "form") document.getElementById(problemId)?.scrollIntoView({ block: "nearest" });
  }, [problem, problemId]);

  return (
    <>
      <form
        noValidate
        aria-busy={sending}
        aria-labelledby="new-report-title"
        className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-6 px-4 pt-6 lg:pt-10"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-mb-2 -ml-2 flex min-h-11 items-center gap-2 self-start rounded-md px-2 text-body text-ink-secondary transition-colors duration-(--motion-fast) hover:text-ink lg:hidden"
          >
            <ArrowLeftIcon className="size-4" aria-hidden />
            {c.back}
          </button>
        )}

        <header>
          <h1 id="new-report-title" className="text-display text-ink">
            {c.title}
          </h1>
          <p className="mt-1.5 text-body text-ink-secondary">{c.intro}</p>
        </header>

        {/* The screenshot area: one big target, or the chosen screenshot with Replace and Remove. */}
        <div className="flex flex-col gap-2">
          {chosen && !preparing ? (
            <figure className="relative overflow-hidden rounded-lg border border-line-medium bg-sunken">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen screenshot */}
              <img src={chosen.url} alt={copy.screenshotAlt} className="mx-auto max-h-72 w-auto object-contain" />
              <div className="flex justify-end gap-2 border-t border-line-medium bg-surface p-2">
                <Button ref={attachRef} type="button" variant="outline" onClick={onAttach} className="h-11 border-line-strong px-4 text-body">
                  {c.replace}
                </Button>
                <Button type="button" variant="outline" onClick={onRemove} aria-label={c.remove} className="size-11 border-line-strong">
                  <XIcon className="size-5" aria-hidden />
                </Button>
              </div>
            </figure>
          ) : (
            <button
              ref={attachRef}
              type="button"
              onClick={onAttach}
              disabled={preparing}
              aria-describedby={describe("screenshot")}
              className={cn(
                "flex min-h-40 w-full flex-col items-center justify-center gap-1.5 rounded-lg border bg-surface px-4 py-6 text-center",
                "transition-colors duration-(--motion-fast) hover:bg-sunken active:translate-y-px",
                screenshotWrong ? "border-2 border-ink" : "border-line-strong",
              )}
            >
              {preparing ? (
                <>
                  <Spinner className="size-6" aria-hidden />
                  <span className="text-body text-ink">{c.preparing}</span>
                </>
              ) : (
                <>
                  {screenshotWrong ? (
                    <CircleAlertIcon className="size-7 text-ink" aria-hidden />
                  ) : (
                    <ImagePlusIcon className="size-7 text-ink" aria-hidden />
                  )}
                  <span className="text-body font-semibold text-ink">{c.attach}</span>
                  <span className="text-meta text-ink-muted">{c.attachHint}</span>
                  <span className="hidden text-meta text-ink-muted pointer-fine:block">{c.pasteHint}</span>
                </>
              )}
            </button>
          )}
          {message("screenshot")}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={sentenceId} className="text-body font-semibold text-ink">
            {c.sentenceLabel}
          </label>
          <Textarea
            id={sentenceId}
            ref={sentenceRef}
            name="sentence"
            rows={3}
            maxLength={1000}
            value={sentence}
            readOnly={sending}
            placeholder={c.placeholder}
            aria-invalid={problem?.field === "sentence" ? true : undefined}
            aria-describedby={describe("sentence")}
            onChange={(event) => onSentenceChange(event.target.value)}
            className="min-h-24 rounded-md border-line-strong bg-surface px-3 py-2.5 text-body placeholder:text-ink-faint aria-invalid:border-2 aria-invalid:border-ink aria-invalid:px-[11px] aria-invalid:py-[9px] aria-invalid:ring-0 md:text-body"
          />
          {message("sentence")}
          {sentence.trim() === "" && (
            <div role="group" aria-labelledby={chipsLabelId} className="flex flex-wrap items-center gap-2 pt-1">
              <span id={chipsLabelId} className="text-meta text-ink-muted">
                {c.chipsLabel}
              </span>
              {c.chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onChip(chip)}
                  className="min-h-11 rounded-full border border-line-strong bg-surface px-3.5 text-meta text-ink transition-colors duration-(--motion-fast) hover:border-ink hover:bg-sunken active:translate-y-px"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pinned to the bottom on phones, within thumb reach; inline on wide screens. */}
        <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-2 border-t border-line bg-canvas px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:pb-10">
          {message("form")}
          <Button
            type="submit"
            aria-describedby={describe("form")}
            className="h-11 w-full rounded-md text-body font-semibold transition-colors duration-(--motion-fast) active:translate-y-px lg:w-auto lg:self-start lg:px-6"
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
          <p aria-live="polite" className="text-meta text-ink-muted">
            {sending && slow ? c.slow : c.reassurance}
          </p>
        </div>
      </form>
      {after && <div className="mx-auto w-full max-w-[560px] px-4 pt-6 pb-10 lg:hidden">{after}</div>}
    </>
  );
}
