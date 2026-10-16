"use client";

import { CheckIcon, CircleAlertIcon, ImageIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { submitReportAction } from "@/app/actions/report";
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/components/kibo-ui/dropzone";
import { Attachment, AttachmentMedia } from "@/components/ui/attachment";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { clientCopy, type ClientCopy, type ClientLocale } from "@/lib/i18n/client-copy";
import { checkScreenshot, checkSentence, type ReportErrorCode } from "@/lib/reports/validate";

// The native picker filters to these; no `capture` attribute, so Photo Library stays available.
const ACCEPT = { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"] };

type Chosen = { file: File; url: string };

export function ReportForm({ slug, locale }: { slug: string; locale: ClientLocale }) {
  const copy = clientCopy[locale];
  const ids = { screenshotError: useId(), sentence: useId(), sentenceHint: useId(), sentenceError: useId(), formError: useId(), reassurance: useId() };
  const screenshotRef = useRef<HTMLDivElement>(null);
  const sentenceRef = useRef<HTMLTextAreaElement>(null);

  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [screenshotError, setScreenshotError] = useState<ReportErrorCode | null>(null);
  const [sentence, setSentence] = useState("");
  const [sentenceError, setSentenceError] = useState<ReportErrorCode | null>(null);
  const [formError, setFormError] = useState<ReportErrorCode | null>(null);
  const [sent, setSent] = useState<{ url: string; sentence: string } | null>(null);
  const [sending, startSending] = useTransition();

  function choose(file: File | undefined) {
    if (!file) return;
    const problem = checkScreenshot(file);
    setFormError(null);
    if (problem) {
      // The area stays empty and says why, before anything is sent.
      setChosen(null);
      setScreenshotError(problem);
      return;
    }
    setScreenshotError(null);
    setChosen({ file, url: URL.createObjectURL(file) });
  }

  // Release the previous preview's memory when it is replaced. The sent preview is kept.
  useEffect(() => {
    const url = chosen?.url;
    return () => {
      if (url && url !== sent?.url) URL.revokeObjectURL(url);
    };
  }, [chosen, sent]);

  // Desktop: paste a screenshot straight from the clipboard.
  useEffect(() => {
    if (sent) return;
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) choose(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [sent]);

  function send() {
    const sentenceProblem = checkSentence(sentence);
    setSentenceError(sentenceProblem);
    if (!chosen) {
      setScreenshotError("missingImage");
      screenshotRef.current?.querySelector("button")?.focus();
      return;
    }
    if (sentenceProblem) {
      sentenceRef.current?.focus();
      return;
    }

    const data = new FormData();
    data.set("sentence", sentence);
    data.set("screenshot", chosen.file);
    setFormError(null);
    startSending(async () => {
      try {
        const result = await submitReportAction(slug, data);
        if (result.ok) {
          setSent({ url: chosen.url, sentence: sentence.trim() });
          return;
        }
        if (result.field === "screenshot") setScreenshotError(result.error);
        else if (result.field === "sentence") setSentenceError(result.error);
        else setFormError(result.error);
      } catch {
        // Network failure: everything the client typed stays.
        setFormError("server");
      }
    });
  }

  function reset() {
    if (sent) URL.revokeObjectURL(sent.url);
    setSent(null);
    setChosen(null);
    setSentence("");
    setSentenceError(null);
    setScreenshotError(null);
    setFormError(null);
  }

  if (sent) return <Confirmation copy={copy} sent={sent} onSendAnother={reset} />;

  return (
    <form
      noValidate
      className="flex flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (!sending) send();
      }}
    >
      <fieldset disabled={sending} className="flex flex-1 flex-col gap-6">
        <div ref={screenshotRef}>
          <Dropzone
            accept={ACCEPT}
            maxFiles={1}
            multiple={false}
            src={chosen ? [chosen.file] : undefined}
            onDrop={(files) => choose(files[0])}
            onError={(error) => {
              setChosen(null);
              setScreenshotError(error.message === "Too many files" ? "oneFile" : "invalidType");
            }}
            className={cn(
              "min-h-60 w-full rounded-2xl border-2 bg-surface text-ink whitespace-normal hover:bg-surface aria-expanded:bg-surface",
              chosen ? "border-solid border-line p-2" : "border-dashed border-line p-6",
            )}
          >
            <DropzoneEmptyState>
              <div className="flex flex-col items-center gap-2 text-center">
                <ImageIcon className="size-8 text-ink-muted" aria-hidden />
                <span className="text-body font-medium">{copy.screenshot.add}</span>
                <span className="text-meta font-normal text-ink-muted">
                  <span className="pointer-coarse:hidden">{copy.screenshot.hintPointer}</span>
                  <span className="hidden pointer-coarse:inline">{copy.screenshot.hintTouch}</span>
                </span>
              </div>
            </DropzoneEmptyState>
            <DropzoneContent>
              {chosen && (
                <Attachment state="done" orientation="vertical" className="w-full border-0 bg-transparent p-0">
                  <AttachmentMedia variant="image" className="aspect-auto w-full rounded-xl bg-canvas *:[img]:aspect-auto *:[img]:object-contain">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                    <img src={chosen.url} alt={copy.screenshot.alt} className="max-h-[60dvh] w-full object-contain" />
                  </AttachmentMedia>
                  <span className="absolute top-3 right-3 rounded-md bg-surface/90 px-3 py-1.5 text-meta text-ink shadow-none ring-1 ring-line">
                    {copy.screenshot.replace}
                  </span>
                </Attachment>
              )}
            </DropzoneContent>
          </Dropzone>
          {screenshotError && <InlineMessage id={ids.screenshotError}>{copy.errors[screenshotError]}</InlineMessage>}
        </div>

        <Field className="gap-2">
          <FieldLabel htmlFor={ids.sentence} className="text-body font-medium">
            {copy.sentence.label}
          </FieldLabel>
          <FieldDescription id={ids.sentenceHint} className="text-meta font-normal text-ink-muted">
            {copy.sentence.hint}
          </FieldDescription>
          <Textarea
            id={ids.sentence}
            ref={sentenceRef}
            name="sentence"
            value={sentence}
            maxLength={1000}
            rows={3}
            placeholder={copy.sentence.placeholder}
            aria-invalid={sentenceError ? true : undefined}
            aria-describedby={sentenceError ? `${ids.sentenceHint} ${ids.sentenceError}` : ids.sentenceHint}
            onChange={(event) => {
              setSentence(event.target.value);
              // Once an error is showing, clear it as soon as the text is long enough.
              if (sentenceError) setSentenceError(checkSentence(event.target.value));
            }}
            onBlur={() => {
              if (sentence.length > 0) setSentenceError(checkSentence(sentence));
            }}
            className="min-h-28 rounded-md bg-surface text-body placeholder:text-ink-faint md:text-body"
          />
          {sentenceError && <InlineMessage id={ids.sentenceError}>{copy.errors[sentenceError]}</InlineMessage>}
        </Field>

        {/* Pinned to the bottom on phones, within thumb reach, above the home indicator. */}
        <div className="sticky bottom-0 -mx-4 mt-auto bg-canvas px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:px-0">
          {formError && (
            <InlineMessage id={ids.formError} className="mb-3 mt-0">
              {copy.errors[formError]}
            </InlineMessage>
          )}
          {/* Always looks active: tapping it while something is missing is what shows the hints. */}
          <Button
            type="submit"
            aria-describedby={formError ? `${ids.formError} ${ids.reassurance}` : ids.reassurance}
            className="h-12 w-full rounded-md text-body font-semibold"
          >
            {sending ? (
              <>
                <Spinner aria-hidden className="size-5" />
                {copy.sending}
              </>
            ) : (
              copy.send
            )}
          </Button>
          <p id={ids.reassurance} className="mt-3 text-meta font-normal text-ink-muted">
            {copy.reassurance}
          </p>
        </div>
      </fieldset>
    </form>
  );
}

// Errors are instructions, in ink with an icon: red is reserved for "extraction failed".
function InlineMessage({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className={cn("mt-2 flex items-start gap-2 text-meta font-normal text-ink", className)}>
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function Confirmation({ copy, sent, onSendAnother }: { copy: ClientCopy; sent: { url: string; sentence: string }; onSendAnother: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <section aria-labelledby="sent-heading" className="flex flex-1 flex-col pb-8">
      {/* The screenshot area settles into a sent message, like a photo in a chat. */}
      <figure className="animate-settle ml-auto w-[85%] rounded-2xl rounded-br-md border border-line bg-surface p-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
        <img src={sent.url} alt={copy.screenshot.alt} className="max-h-[50dvh] w-full rounded-xl bg-canvas object-contain" />
        <figcaption className="px-2 pt-2 text-body break-words">{sent.sentence}</figcaption>
        <p className="flex items-center justify-end gap-1 px-2 pb-1 text-meta font-normal text-ink-muted">
          <CheckIcon className="size-4" aria-hidden />
          {copy.sent.badge}
        </p>
      </figure>

      <h2 id="sent-heading" ref={headingRef} tabIndex={-1} className="mt-8 text-title text-ink outline-none">
        {copy.sent.heading}
      </h2>
      <p className="mt-2 text-body text-ink-muted">{copy.sent.close}</p>
      <button type="button" onClick={onSendAnother} className="mt-6 self-start text-body text-ink underline underline-offset-4">
        {copy.sent.another}
      </button>
      <p className="mt-auto pt-12 text-meta font-normal text-ink-muted">{copy.sent.footer}</p>
    </section>
  );
}
