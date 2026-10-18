"use client";

import { ClockIcon, ListIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { getReportStatusesAction, submitReportAction } from "@/app/actions/report";
import { SnagMark } from "@/components/snag-mark";
import type { TicketStatus } from "@/components/status-glyph";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { clientCopy as copy, fill } from "@/lib/copy/client";
import { DEFAULT_OFFICE_HOURS, officeStatus, type OfficeStatus } from "@/lib/office-hours";
import { groupReports } from "@/lib/reports/groups";
import { addFollowUpToHistory, addToHistory, historyKey, readHistory, type FollowUp, type HistoryEntry } from "@/lib/reports/history";
import { prepareScreenshot } from "@/lib/reports/prepare-image";
import { pruneScreenshots, saveScreenshot } from "@/lib/reports/screenshot-store";
import { applyStarter } from "@/lib/reports/starters";
import { formatSentAt } from "@/lib/reports/sent-at";
import { checkSentenceDetail } from "@/lib/reports/validate";
import { NOT_READ, notifyStoredString, useStoredString } from "@/lib/use-stored-string";
import { cn } from "@/lib/utils";
import { Composer, type Chosen, type Problem } from "./composer";
import { FeedItem } from "./feed-item";
import { FollowUpComposer } from "./follow-up-composer";
import { HelpBlock } from "./help-block";
import { NextSteps } from "./next-steps";
import { ReportDetails } from "./report-details";
import { ReportList } from "./report-list";
import { WelcomeBlock, replyLine } from "./welcome-block";

const draftKey = (slug: string) => `snag:draft:v1:${slug}`;
const SLOW_AFTER_MS = 3000;
const OFFICE_REFRESH_MS = 60_000;

/**
 * The client's page (Filip, 2026-10-18): a dark bar on top, then full-bleed panes. Every report is
 * its own chat, as in a messaging app. Left (300px): "New report" and this device's reports, with
 * Help pinned below. Middle: either a new chat (welcome block, composer pinned to the bottom) or
 * one report's chat (her message with its status rows; no composer, because a report takes no
 * replies). Right (320px): the open report's status. Below 1024px only the middle pane shows and
 * the list opens from an icon in the bar. Only reports sent from this device appear, and only
 * their status comes from the server.
 */
export function ClientPortal({
  slug,
  projectName,
  developerName,
  developerEmail,
}: {
  slug: string;
  projectName: string;
  developerName: string | null;
  developerEmail: string | null;
}) {
  const problemId = useId();
  const attachRef = useRef<HTMLButtonElement>(null);
  const sentenceRef = useRef<HTMLTextAreaElement>(null);

  // This device's history, read after hydration (null until then). If the browser can't store
  // it, the reports sent in this visit are kept in memory instead.
  const storedHistory = useStoredString(historyKey(slug));
  const [unsaved, setUnsaved] = useState<HistoryEntry[] | null>(null);
  const history = useMemo(
    () => unsaved ?? (storedHistory === NOT_READ ? null : readHistory(slug, { getItem: () => storedHistory })),
    [slug, storedHistory, unsaved],
  );
  const [statuses, setStatuses] = useState<Record<string, TicketStatus>>({});
  // The open chat: a report id, null for a new chat, undefined until the client chooses (then
  // the ?report= link decides, else a new chat).
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [freshFollowUpId, setFreshFollowUpId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [preparing, setPreparing] = useState(false);
  // An unsent draft survives a reload. null = not typed in this visit.
  const storedDraft = useStoredString(draftKey(slug));
  const [typed, setTyped] = useState<string | null>(null);
  const sentence = typed ?? (storedDraft === NOT_READ ? "" : storedDraft ?? "");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [slow, setSlow] = useState(false);
  const [sending, startSending] = useTransition();

  // Office hours depend on the clock, so they are computed in the browser after hydration (the
  // server renders the open-hours line) and refreshed every minute.
  const [office, setOffice] = useState<OfficeStatus>({ open: true });
  useEffect(() => {
    const tick = () => setOffice(officeStatus(new Date(), DEFAULT_OFFICE_HOURS));
    tick();
    const timer = setInterval(tick, OFFICE_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typed === null) return;
    try {
      if (typed) localStorage.setItem(draftKey(slug), typed);
      else localStorage.removeItem(draftKey(slug));
    } catch {
      // storage blocked or full: nothing to keep
    }
  }, [slug, typed]);

  // Statuses for this device's reports only, refreshed whenever the page becomes visible again.
  const ids = useMemo(() => (history ?? []).map((h) => h.ticketId), [history]);
  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;
    const refresh = async () => {
      const rows = await getReportStatusesAction(slug, ids).catch(() => []);
      if (!cancelled) setStatuses((prev) => ({ ...prev, ...Object.fromEntries(rows.map((r) => [r.id, r.status])) }));
    };
    refresh();
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slug, ids]);

  // A "Copy link to this report" link (?report=<id>) opens that report's chat, when this device
  // has it. Elsewhere the link opens a new chat: reports live only where they were sent.
  const linkedId = useSearchParams().get("report");

  // Release the preview's memory when it is replaced or removed.
  useEffect(() => {
    const url = chosen?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [chosen]);

  const choose = useCallback(
    async (file: File | undefined) => {
      if (!file || sending) return;
      setSelectedId(null); // a screenshot always starts a new chat
      setProblem(null);
      setPreparing(true);
      const prepared = await prepareScreenshot(file);
      setPreparing(false);
      if (!prepared.ok) {
        setChosen(null);
        setProblem({ field: "screenshot", code: prepared.error });
        return;
      }
      setChosen({ file: prepared.file, thumb: prepared.thumb, preview: prepared.preview, url: URL.createObjectURL(prepared.file) });
    },
    [sending],
  );

  // The whole page takes a dropped screenshot on desktop; the attach button opens the native picker.
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: { "image/*": [] }, // any image: the browser converts what the server doesn't take
    multiple: false,
    noClick: true,
    noKeyboard: true,
    onDropAccepted: (files) => void choose(files[0]),
    onDropRejected: (rejections) =>
      setProblem({ field: "screenshot", code: rejections.length > 1 ? "oneFile" : "invalidType" }),
  });

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) void choose(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [choose]);

  function startWithChip(chip: string) {
    const text = applyStarter(sentence, chip, copy.composer.chips);
    setTyped(text);
    if (problem?.field === "sentence") setProblem(null);
    // Focus inside the tap itself: iOS opens the keyboard only for a synchronous focus().
    const field = sentenceRef.current;
    field?.focus();
    setTimeout(() => field?.setSelectionRange(text.length, text.length), 0);
  }

  function send() {
    if (sending || preparing) return;
    if (!chosen) {
      setProblem({ field: "screenshot", code: "missingImage" });
      attachRef.current?.focus();
      return;
    }
    const sentenceProblem = checkSentenceDetail(sentence, copy.composer.chips);
    if (sentenceProblem) {
      setProblem({ field: "sentence", code: sentenceProblem });
      sentenceRef.current?.focus();
      return;
    }

    const data = new FormData();
    data.set("sentence", sentence);
    data.set("screenshot", chosen.file);
    setProblem(null);
    const slowTimer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    startSending(async () => {
      try {
        const result = await submitReportAction(slug, data);
        if (!result.ok) {
          setProblem({ field: result.field, code: result.error });
          return;
        }
        const saved = addToHistory(slug, {
          ticketId: result.ticketId,
          sentence: sentence.trim(),
          thumb: chosen.thumb,
          sentAt: new Date().toISOString(),
        });
        if (saved.ok) notifyStoredString();
        else setUnsaved(saved.entries);
        // The full-size copy stays on this device; copies of reports that left the history go.
        const preview = chosen.preview;
        void saveScreenshot(slug, result.ticketId, preview).then(() =>
          pruneScreenshots(slug, saved.entries.map((e) => e.ticketId)),
        );
        setStatuses((prev) => ({ ...prev, [result.ticketId]: "new" }));
        setChosen(null);
        setTyped("");
        // The new chat becomes this report's chat, marked Sent; the announcement tells screen readers.
        setFreshId(result.ticketId);
        setSelectedId(result.ticketId);
        setAnnouncement(copy.report.announce);
      } catch {
        // Network failure: the screenshot and the text stay in the composer.
        setProblem({ field: "form", code: "server" });
      } finally {
        clearTimeout(slowTimer);
        setSlow(false);
      }
    });
  }

  const hasHistory = (history?.length ?? 0) > 0;
  const inProgress = groupReports(history ?? [], statuses).open.length;
  const activeId = selectedId === undefined ? linkedId : selectedId;
  const selected = activeId ? (history?.find((h) => h.ticketId === activeId) ?? null) : null;

  // A follow-up is saved on the server first, then kept in this device's history to show in the chat.
  const addedFollowUp = (ticketId: string, followUp: FollowUp) => {
    const saved = addFollowUpToHistory(slug, ticketId, followUp);
    if (saved.ok) notifyStoredString();
    else setUnsaved(saved.entries);
    setFreshFollowUpId(followUp.id);
    setAnnouncement(copy.followUp.announce);
  };

  // null opens a new chat and puts the cursor in its composer; an id opens that report's chat.
  const select = (id: string | null) => {
    setListOpen(false);
    setAnnouncement("");
    setSelectedId(id);
    setFreshId(null);
    if (id === null) setTimeout(() => sentenceRef.current?.focus(), 0);
  };
  const help = <HelpBlock copy={copy} projectName={projectName} developerName={developerName} developerEmail={developerEmail} />;
  const list = <ReportList history={history ?? []} statuses={statuses} selectedId={selected?.ticketId ?? null} copy={copy} onSelect={select} />;

  return (
    <div {...getRootProps({ className: "relative flex h-dvh flex-col bg-canvas outline-none" })}>
      <input {...getInputProps({ "aria-label": copy.composer.attach })} />
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {/* The bar: who this page belongs to and when to expect a reply. */}
      <header data-surface="dark" className="shrink-0 border-b border-chrome-line bg-chrome text-chrome-fg">
        <div className="flex h-[51px] w-full items-center gap-3 px-4">
          {hasHistory && (
            <Sheet open={listOpen} onOpenChange={setListOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    aria-label={`${copy.list.title}, ${history?.length}`}
                    className="-ml-2 h-9 min-w-9 shrink-0 gap-1.5 rounded-md px-2 text-chrome-fg hover:bg-chrome-hover hover:text-chrome-fg pointer-coarse:h-11 pointer-coarse:min-w-11 lg:hidden"
                  />
                }
              >
                <ListIcon className="size-5" aria-hidden />
                <span aria-hidden className="text-meta font-medium tabular-nums">
                  {history?.length}
                </span>
              </SheetTrigger>
              <SheetContent side="left" showCloseButton={false} className="w-[85%] max-w-[300px] gap-0 border-line bg-pane p-0 text-ink shadow-none">
                <div className="flex shrink-0 items-center justify-between border-b border-line py-1.5 pr-2 pl-4">
                  <SheetTitle className="text-body font-semibold text-ink">{copy.list.title}</SheetTitle>
                  <SheetClose render={<Button variant="ghost" aria-label={copy.list.close} className="size-9 rounded-md pointer-coarse:size-11" />}>
                    <XIcon className="size-5" aria-hidden />
                  </SheetClose>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
                <div className="shrink-0 border-t border-line p-4">{help}</div>
              </SheetContent>
            </Sheet>
          )}
          <SnagMark className="size-7 shrink-0 text-chrome-fg [--snag-mark-cut:var(--chrome)]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body leading-tight font-semibold">{projectName}</p>
            <p className="mt-0.5 flex min-w-0 items-center gap-x-3 text-meta text-chrome-fg-muted">
              {developerName && <span className="truncate">{developerName}</span>}
              <span className="flex shrink-0 items-center gap-1">
                <ClockIcon className="size-3.5" aria-hidden />
                {replyLine(copy, office)}
              </span>
            </p>
          </div>
        </div>
      </header>

      {/* Three full-bleed panes from 1024px; below that, the conversation alone fills the page. */}
      <div
        className={cn(
          "flex min-h-0 w-full flex-1 flex-col bg-canvas",
          "lg:grid lg:grid-rows-[minmax(0,1fr)]",
          selected ? "lg:grid-cols-[300px_minmax(0,1fr)_320px]" : "lg:grid-cols-[300px_minmax(0,1fr)]",
        )}
      >
        <aside className="hidden min-h-0 flex-col border-r border-line bg-pane lg:flex">
          {hasHistory ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
              {/* With reports, the list leads and the help is pinned at the bottom. */}
              <div className="shrink-0 border-t border-line p-4">{help}</div>
            </>
          ) : (
            // No reports yet: the help is what the pane is for, so it comes first.
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{help}</div>
          )}
        </aside>

        {/* The chat: one report's thread, or a new chat with the composer pinned to the bottom. */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selected ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-10 md:py-6">
                <h1 className="sr-only">{fill(copy.thread.title, { date: formatSentAt(selected.sentAt) })}</h1>
                <FeedItem
                  key={selected.ticketId}
                  entry={selected}
                  status={statuses[selected.ticketId] ?? "new"}
                  copy={copy}
                  slug={slug}
                  fresh={selected.ticketId === freshId}
                  freshFollowUpId={freshFollowUpId}
                />
              </div>
              {/* Add to this report, or start a new one for something else. */}
              <FollowUpComposer
                key={selected.ticketId}
                copy={copy}
                slug={slug}
                ticketId={selected.ticketId}
                onAdded={(followUp) => addedFollowUp(selected.ticketId, followUp)}
                onNewReport={() => select(null)}
              />
            </>
          ) : (
            // A new chat: the welcome card, then the composer, pinned to the bottom. Only on desktop
            // with no reports yet does it sit right under the card (Filip, 2026-10-18).
            <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4 md:px-10 md:pt-6", !hasHistory && "lg:pb-6")}>
              <WelcomeBlock copy={copy} developerName={developerName} inProgress={inProgress} />
              <Composer
                className={cn(
                  "sticky bottom-0 -mx-4 mt-auto md:-mx-10",
                  !hasHistory && "lg:static lg:mx-0 lg:mt-4 lg:border-t-0 lg:px-0 lg:pt-0 lg:pb-0",
                )}
                copy={copy}
                chosen={chosen}
                preparing={preparing}
                sentence={sentence}
                onSentenceChange={(value) => {
                  setTyped(value);
                  // Once a sentence hint is showing, clear it as soon as the text is long enough.
                  if (problem?.field === "sentence" && !checkSentenceDetail(value, copy.composer.chips)) setProblem(null);
                }}
                onAttach={() => !sending && open()}
                onRemove={() => {
                  if (sending) return;
                  setChosen(null);
                  setTimeout(() => attachRef.current?.focus(), 0);
                }}
                onChip={startWithChip}
                onSend={send}
                sending={sending}
                slow={slow}
                problem={problem}
                problemId={problemId}
                attachRef={attachRef}
                sentenceRef={sentenceRef}
              />
            </div>
          )}
        </main>

        {/* The details pane: the open report's status. Phones get the status rows in the thread instead. */}
        {selected && (
          <aside aria-label={copy.report.progressLabel} className="hidden min-h-0 border-l border-line bg-pane p-4 lg:block lg:overflow-y-auto">
            <ReportDetails
              entry={selected}
              status={statuses[selected.ticketId] ?? "new"}
              copy={copy}
              panel={<NextSteps copy={copy} developerEmail={developerEmail} />}
            />
          </aside>
        )}
      </div>

      {isDragActive && (
        <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-line-strong bg-surface/95">
          <p className="text-body font-semibold text-ink">{copy.composer.dropHint}</p>
        </div>
      )}
    </div>
  );
}
