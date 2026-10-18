"use client";

import { ClockIcon } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useDropzone } from "react-dropzone";
import { getReportStatusesAction, submitReportAction } from "@/app/actions/report";
import { SnagMark } from "@/components/snag-mark";
import type { TicketStatus } from "@/components/status-glyph";
import { clientCopy as copy } from "@/lib/copy/client";
import { addToHistory, historyKey, readHistory, type HistoryEntry } from "@/lib/reports/history";
import { prepareScreenshot } from "@/lib/reports/prepare-image";
import { checkSentenceDetail } from "@/lib/reports/validate";
import { NOT_READ, notifyStoredString, useStoredString } from "@/lib/use-stored-string";
import { NewReport, type Chosen, type Problem } from "./new-report";
import { ReportList } from "./report-list";
import { ReportTimeline } from "./report-timeline";
import { WelcomeNotes } from "./welcome-notes";

const draftKey = (slug: string) => `snag:draft:v1:${slug}`;
const SLOW_AFTER_MS = 3000;

const wideScreen = () => window.matchMedia("(min-width: 1024px)").matches;

/**
 * The client's page: a graphite bar on top, this device's reports on the left (In progress /
 * Done), and either a new report or one report's timeline on the right. On phones the list is
 * the home view once reports exist. Only reports sent from this device appear, and only their
 * status comes from the server.
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  // Phones only: true while the New report form is open over the list.
  const [composing, setComposing] = useState(false);
  const [focusTimeline, setFocusTimeline] = useState(false);
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
      setSelectedId(null); // a screenshot always starts a new report
      setComposing(true);
      setProblem(null);
      setPreparing(true);
      const prepared = await prepareScreenshot(file);
      setPreparing(false);
      if (!prepared.ok) {
        setChosen(null);
        setProblem({ field: "screenshot", code: prepared.error });
        return;
      }
      setChosen({ file: prepared.file, thumb: prepared.thumb, url: URL.createObjectURL(prepared.file) });
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
    const text = `${chip}: `;
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
    const sentenceProblem = checkSentenceDetail(sentence, copy.newReport.chips);
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
        setStatuses((prev) => ({ ...prev, [result.ticketId]: "new" }));
        setChosen(null);
        setTyped("");
        // The confirmation is the report itself, marked Received; focus and the announcement
        // follow it, because the form that had focus is gone.
        setFreshId(result.ticketId);
        setSelectedId(result.ticketId);
        setComposing(false);
        setFocusTimeline(true);
        setAnnouncement(copy.report.announce);
      } catch {
        // Network failure: the screenshot and the text stay in the form.
        setProblem({ field: "form", code: "server" });
      } finally {
        clearTimeout(slowTimer);
        setSlow(false);
      }
    });
  }

  const hasHistory = (history?.length ?? 0) > 0;
  const firstVisit = history !== null && !hasHistory;
  const selected = history?.find((h) => h.ticketId === selectedId) ?? null;
  // On phones the list unmounts when a report opens, so focus moves to the report's heading.
  const select = (id: string | null) => {
    setSelectedId(id);
    setFreshId(null);
    setAnnouncement("");
    setComposing(id === null);
    setFocusTimeline(id !== null && !wideScreen());
  };
  const notes = (
    <WelcomeNotes copy={copy} projectName={projectName} developerName={developerName} developerEmail={developerEmail} />
  );
  // Phones open on the list once there are reports; the form is one tap away.
  const phoneHome = hasHistory && !composing;

  return (
    <div {...getRootProps({ className: "relative flex h-dvh flex-col bg-canvas outline-none lg:bg-chrome" })}>
      <input {...getInputProps({ "aria-label": copy.newReport.attach })} />
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {/* The graphite bar: who this page belongs to and how quickly they usually answer. */}
      <header data-surface="dark" className="flex h-14 shrink-0 items-center gap-3 bg-chrome px-4 text-chrome-fg lg:px-5">
        <SnagMark className="size-8 shrink-0 text-chrome-fg [--snag-mark-cut:var(--chrome)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body leading-tight font-semibold">{projectName}</p>
          <p className="mt-0.5 flex min-w-0 items-center gap-x-3 text-meta text-chrome-fg-muted">
            {developerName && <span className="truncate">{developerName}</span>}
            <span className="flex shrink-0 items-center gap-1">
              <ClockIcon className="size-3.5" aria-hidden />
              {copy.header.responseTime}
            </span>
          </p>
        </div>
      </header>

      {/* The light workspace, set into the graphite frame on wide screens. */}
      <div className="flex min-h-0 flex-1 bg-canvas lg:mx-2 lg:mb-2 lg:overflow-hidden lg:rounded-xl lg:border lg:border-chrome-line">
        <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface lg:flex">
          {firstVisit ? (
            <div className="p-5">{notes}</div>
          ) : hasHistory ? (
            <ReportList history={history ?? []} statuses={statuses} selectedId={selectedId} copy={copy} onSelect={select} />
          ) : null}
        </aside>

        <main className="flex min-w-0 flex-1 scroll-pb-32 flex-col overflow-y-auto lg:scroll-pb-0">
          {selected ? (
            <ReportTimeline
              entry={selected}
              status={statuses[selected.ticketId] ?? "new"}
              copy={copy}
              onBack={() => {
                select(null);
                setComposing(false);
              }}
              fresh={selected.ticketId === freshId}
              focusHeading={focusTimeline}
            />
          ) : (
            <>
              {phoneHome && (
                <div className="lg:hidden">
                  <ReportList history={history ?? []} statuses={statuses} selectedId={null} copy={copy} onSelect={select} asPage />
                </div>
              )}
              <div className={phoneHome ? "hidden flex-1 flex-col lg:flex" : "flex flex-1 flex-col"}>
                <NewReport
                  copy={copy}
                  after={firstVisit ? notes : undefined}
                  onBack={hasHistory ? () => setComposing(false) : undefined}
                  chosen={chosen}
                  preparing={preparing}
                  sentence={sentence}
                  onSentenceChange={(value) => {
                    setTyped(value);
                    // Once a sentence hint is showing, clear it as soon as the text is long enough.
                    if (problem?.field === "sentence" && !checkSentenceDetail(value, copy.newReport.chips)) setProblem(null);
                  }}
                  onAttach={() => !sending && open()}
                  onRemove={() => {
                    if (sending) return;
                    setChosen(null);
                    // The Remove button is gone; put focus on the screenshot area that replaces it.
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
            </>
          )}
        </main>
      </div>

      {isDragActive && (
        <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-line-strong bg-surface/95">
          <p className="text-body font-semibold text-ink">{copy.newReport.dropHint}</p>
        </div>
      )}
    </div>
  );
}
