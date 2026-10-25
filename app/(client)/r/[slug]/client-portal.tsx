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
import { clientCopy as copy } from "@/lib/copy/client";
import { officeStatus, type OfficeHours, type OfficeStatus } from "@/lib/office-hours";
import type { DemoReport } from "@/lib/reports/demo";
import { groupReports } from "@/lib/reports/groups";
import {
  addFollowUpToHistory,
  addToHistory,
  historyKey,
  moveLegacyHistory,
  readHistory,
  type FollowUp,
  type HistoryEntry,
} from "@/lib/reports/history";
import { prepareScreenshot } from "@/lib/reports/prepare-image";
import { pruneScreenshots, saveScreenshot } from "@/lib/reports/screenshot-store";
import { applyStarter } from "@/lib/reports/starters";
import { MAX_STATUS_IDS } from "@/lib/reports/statuses";
import { checkSentenceDetail } from "@/lib/reports/validate";
import { NOT_READ, notifyStoredString, useStoredString } from "@/lib/use-stored-string";
import { Composer, type Chosen, type Problem } from "./composer";
import { FeedItem } from "./feed-item";
import { HelpBlock } from "./help-block";
import { HowItWorks } from "./how-it-works";
import { NextSteps } from "./next-steps";
import { ReportDetails } from "./report-details";
import { ReportList } from "./report-list";
import { WelcomeBlock, replyLine } from "./welcome-block";

/** The unsent draft, under the project's own prefix like the history ("snag:<slug>"). */
const draftKey = (slug: string) => `${historyKey(slug)}:draft`;
const SLOW_AFTER_MS = 3000;
const OFFICE_REFRESH_MS = 60_000;

/**
 * The client's page (Filip, 2026-10-25): a bar on top, then three panes locked to the viewport.
 * Left (300px): this feed's reports grouped by status, with Help pinned below. Middle: the
 * welcome card, then every report as one chat, with the composer pinned to the bottom once there
 * is a report (under the card before that). Right (320px): the selected report's status timeline
 * and what happens next, or how it works while nothing is selected. Between 768 and 1023px the
 * right pane moves under the feed and the list opens from the bar; on phones only the chat shows.
 *
 * The feed holds the reports sent from this device (localStorage, "snag:<slug>"). A demo project
 * adds every report it has, so judges see a full feed; a real project never does.
 */
export function ClientPortal({
  slug,
  projectName,
  developerName,
  developerEmail,
  officeHours,
  demoReports,
}: {
  slug: string;
  projectName: string;
  developerName: string | null;
  developerEmail: string | null;
  officeHours: OfficeHours;
  /** Every report of a demo project, with its status; null for a real project. */
  demoReports: DemoReport[] | null;
}) {
  const problemId = useId();
  const attachRef = useRef<HTMLButtonElement>(null);
  const sentenceRef = useRef<HTMLTextAreaElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // A history stored under the old key moves to "snag:<slug>" once, before it is read.
  useEffect(() => {
    if (moveLegacyHistory(slug)) notifyStoredString();
  }, [slug]);

  // This device's history, read after hydration (null until then). If the browser can't store
  // it, the reports sent in this visit are kept in memory instead.
  const storedHistory = useStoredString(historyKey(slug));
  const [unsaved, setUnsaved] = useState<HistoryEntry[] | null>(null);
  const history = useMemo(
    () => unsaved ?? (storedHistory === NOT_READ ? null : readHistory(slug, { getItem: () => storedHistory })),
    [slug, storedHistory, unsaved],
  );
  // Notes added in this visit to demo reports this device didn't send (they have no history entry).
  const [extraFollowUps, setExtraFollowUps] = useState<Record<string, FollowUp[]>>({});

  // The feed: this device's reports, plus a demo project's, oldest first.
  const feed = useMemo(() => {
    const own = new Set((history ?? []).map((h) => h.ticketId));
    const demo = (demoReports ?? [])
      .filter((d) => !own.has(d.ticketId))
      .map((d): HistoryEntry => ({
        ticketId: d.ticketId,
        sentence: d.sentence,
        thumb: d.thumb,
        sentAt: d.sentAt,
        followUps: [...(d.followUps ?? []), ...(extraFollowUps[d.ticketId] ?? [])],
      }));
    return [...(history ?? []), ...demo].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }, [history, demoReports, extraFollowUps]);
  const hasFeed = feed.length > 0;
  const newestId = hasFeed ? feed[feed.length - 1].ticketId : null;

  const [statuses, setStatuses] = useState<Record<string, TicketStatus>>(() =>
    Object.fromEntries((demoReports ?? []).map((d) => [d.ticketId, d.status])),
  );
  // The selected report: an id, null for none (the composer), undefined until chosen (then the
  // ?report= link decides, else the newest report).
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
  const sentence = typed ?? (storedDraft === NOT_READ ? "" : (storedDraft ?? ""));
  const [problem, setProblem] = useState<Problem | null>(null);
  const [slow, setSlow] = useState(false);
  const [sending, startSending] = useTransition();

  // Office hours depend on the clock, so they are computed in the browser after hydration (the
  // server renders the open-hours line) and refreshed every minute.
  const [office, setOffice] = useState<OfficeStatus>({ open: true });
  useEffect(() => {
    const tick = () => setOffice(officeStatus(new Date(), officeHours));
    tick();
    const timer = setInterval(tick, OFFICE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [officeHours]);

  useEffect(() => {
    if (typed === null) return;
    try {
      if (typed) localStorage.setItem(draftKey(slug), typed);
      else localStorage.removeItem(draftKey(slug));
    } catch {
      // storage blocked or full: nothing to keep
    }
  }, [slug, typed]);

  // Statuses for the feed's reports, refreshed whenever the page becomes visible again. The
  // action takes at most MAX_STATUS_IDS ids at a time.
  const ids = useMemo(() => feed.map((h) => h.ticketId), [feed]);
  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;
    const refresh = async () => {
      const rows: { id: string; status: TicketStatus }[] = [];
      for (let i = 0; i < ids.length; i += MAX_STATUS_IDS) {
        rows.push(...(await getReportStatusesAction(slug, ids.slice(i, i + MAX_STATUS_IDS)).catch(() => [])));
      }
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

  // A "Copy link" link (?report=<id>) selects that report when this feed has it.
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

  const scrollToBottom = () =>
    requestAnimationFrame(() => feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight }));

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
        const saved = addToHistory(
          slug,
          { ticketId: result.ticketId, sentence: sentence.trim(), thumb: chosen.thumb, sentAt: new Date().toISOString() },
          undefined,
          history ?? [],
        );
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
        // The new report joins the end of the feed, marked Sent; the announcement tells screen readers.
        setFreshId(result.ticketId);
        setSelectedId(result.ticketId);
        setAnnouncement(copy.report.announce);
        scrollToBottom();
      } catch {
        // Network failure: the screenshot and the text stay in the composer.
        setProblem({ field: "form", code: "server" });
      } finally {
        clearTimeout(slowTimer);
        setSlow(false);
      }
    });
  }

  const inProgress = groupReports(history ?? [], statuses).open.length;
  const activeId = selectedId === undefined ? (feed.some((e) => e.ticketId === linkedId) ? linkedId : newestId) : selectedId;
  const selected = activeId ? (feed.find((h) => h.ticketId === activeId) ?? null) : null;

  // A follow-up is saved on the server first, then kept with its report to show in the feed.
  const addedFollowUp = (ticketId: string, followUp: FollowUp) => {
    const saved = addFollowUpToHistory(slug, ticketId, followUp, undefined, history ?? []);
    if (saved.ok) notifyStoredString();
    else if ((history ?? []).some((e) => e.ticketId === ticketId)) setUnsaved(saved.entries);
    else setExtraFollowUps((prev) => ({ ...prev, [ticketId]: [...(prev[ticketId] ?? []), followUp] }));
    setFreshFollowUpId(followUp.id);
    setAnnouncement(copy.followUp.announce);
  };

  // null puts the cursor in the composer; an id selects that report and scrolls the feed to it.
  const select = (id: string | null) => {
    setListOpen(false);
    setAnnouncement("");
    setSelectedId(id);
    setFreshId(null);
    setFreshFollowUpId(null);
    setTimeout(() => {
      if (id === null) sentenceRef.current?.focus();
      else document.getElementById(`report-${id}`)?.scrollIntoView({ block: "start", behavior: "instant" });
    }, 0);
  };

  // A feed opens at its end, like any chat; a ?report= link opens at that report (activeId
  // already follows the link, so this only scrolls).
  const opened = useRef(false);
  useEffect(() => {
    if (history === null || opened.current) return;
    opened.current = true;
    const linked = linkedId && feed.some((e) => e.ticketId === linkedId) ? document.getElementById(`report-${linkedId}`) : null;
    if (linked) linked.scrollIntoView({ block: "start", behavior: "instant" });
    else if (hasFeed) scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the history has been read
  }, [history]);

  const who = { projectName, developerName, developerEmail };
  const help = <HelpBlock copy={copy} {...who} />;
  const list = <ReportList history={feed} statuses={statuses} selectedId={selected?.ticketId ?? null} copy={copy} onSelect={select} />;
  const sidePanel = selected ? (
    <ReportDetails
      entry={selected}
      status={statuses[selected.ticketId] ?? "new"}
      copy={copy}
      panel={<NextSteps copy={copy} developerEmail={developerEmail} />}
    />
  ) : (
    <HowItWorks copy={copy} {...who} />
  );
  const composer = (
    <Composer
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
      // Pinned to the bottom of the pane once the feed has messages; under the welcome card before.
      className={hasFeed ? "shrink-0 md:px-8 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[720px]" : "border-t-0 px-0 pt-0 pb-0 md:px-0"}
    />
  );

  return (
    <div {...getRootProps({ className: "relative flex h-dvh flex-col bg-canvas outline-none" })}>
      <input {...getInputProps({ "aria-label": copy.composer.attach })} />
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {/* The bar: who this page belongs to and when to expect a reply. */}
      <header data-chrome className="shrink-0 border-b border-chrome-line bg-chrome text-chrome-fg">
        <div className="flex h-[51px] w-full items-center gap-3 px-4">
          {hasFeed && (
            <Sheet open={listOpen} onOpenChange={setListOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    aria-label={`${copy.list.title}, ${feed.length}`}
                    className="-ml-2 h-9 min-w-9 shrink-0 gap-1.5 rounded-md px-2 text-chrome-fg hover:bg-chrome-hover hover:text-chrome-fg pointer-coarse:h-11 pointer-coarse:min-w-11 lg:hidden"
                  />
                }
              >
                <ListIcon className="size-5" aria-hidden />
                <span aria-hidden className="text-meta font-medium tabular-nums">
                  {feed.length}
                </span>
              </SheetTrigger>
              <SheetContent
                side="left"
                showCloseButton={false}
                data-surface="client"
                data-list
                className="w-[85%] max-w-[300px] gap-0 border-line bg-pane p-0 text-ink shadow-none"
              >
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
          <SnagMark className="size-7 shrink-0 text-marker [--snag-mark-cut:var(--chrome)]" />
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

      {/* Three panes from 1024px; below that the chat fills the page (the right pane's content under the feed from 768px). */}
      <div className="grid min-h-0 w-full flex-1 grid-rows-[minmax(0,1fr)] bg-canvas lg:grid-cols-[300px_minmax(0,1fr)_320px]">
        <aside data-list className="hidden min-h-0 flex-col border-r border-line bg-pane lg:flex">
          {hasFeed ? (
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

        {/* The chat: the welcome card, then every report, oldest first; the composer at the bottom. */}
        <main className="flex min-h-0 min-w-0 flex-col">
          <div ref={feedRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6">
            <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
              <WelcomeBlock copy={copy} developerName={developerName} inProgress={inProgress} />
              {!hasFeed && composer}
              {hasFeed && (
                <section aria-label={copy.list.title} className="flex flex-col gap-8">
                  {feed.map((entry) => (
                    <FeedItem
                      key={entry.ticketId}
                      entry={entry}
                      status={statuses[entry.ticketId] ?? "new"}
                      copy={copy}
                      slug={slug}
                      fresh={entry.ticketId === freshId}
                      freshFollowUpId={freshFollowUpId}
                      selected={entry.ticketId === activeId}
                      onSelect={() => entry.ticketId !== activeId && setSelectedId(entry.ticketId)}
                      onAdded={(followUp) => addedFollowUp(entry.ticketId, followUp)}
                    />
                  ))}
                </section>
              )}
              {/* Between 768 and 1023px the right pane's content sits under the feed. */}
              {hasFeed && <div className="hidden border-t border-line pt-6 md:block lg:hidden">{sidePanel}</div>}
            </div>
          </div>
          {hasFeed && composer}
        </main>

        {/* The details pane: the selected report's status, or how it works. Phones carry the status rows in the feed instead. */}
        <aside aria-label={copy.report.progressLabel} className="hidden min-h-0 overflow-y-auto border-l border-line bg-pane-soft p-4 lg:block">
          {sidePanel}
        </aside>
      </div>

      {isDragActive && (
        <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-line-strong bg-surface/95">
          <p className="text-body font-semibold text-ink">{copy.composer.dropHint}</p>
        </div>
      )}
    </div>
  );
}
