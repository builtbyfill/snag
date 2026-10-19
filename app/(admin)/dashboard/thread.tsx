"use client";

import { ArrowLeftIcon, CheckIcon, LinkIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { adminCopy, fillIn } from "@/lib/copy/admin";
import type { StatusTab } from "@/lib/tickets/queries";
import { cn } from "@/lib/utils";
import { dashboardHref } from "./href";
import { NewProjectDialog } from "./new-project-dialog";
import { ReportMessage } from "./report-message";
import { ThreadEmpty } from "./thread-empty";
import type { CardView, DashboardQuery, TabCounts, ThreadClient } from "./types";

const TABS: StatusTab[] = ["all", "new", "in_progress", "done"];
const REFRESH_MS = 3000;
const IDLE_REFRESH_MS = 10_000;
const FLASH_MS = 2000;

/** Keys belong to the field or dialog that has focus, never to the thread. */
const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], dialog') !== null;

/**
 * The open client's reports, oldest first, opened at the newest. j/k (or Down/Up on a card) move
 * between ticket cards, Enter opens one, c copies it as Markdown, Esc leaves it.
 */
export function Thread({
  query,
  client,
  cards,
  counts,
  anyProject,
  backHref,
  className,
}: {
  query: DashboardQuery;
  client: ThreadClient | null;
  cards: CardView[];
  counts: TabCounts;
  anyProject: boolean;
  backHref: string;
  className?: string;
}) {
  const c = adminCopy.thread;
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // What the status line says, and whether it shows (a copied link shows on its own button).
  const [flash, setFlash] = useState<{ text: string; visible: boolean } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reading = cards.some((card) => card.extractionState === "pending");

  const say = (text: string, visible: boolean, link = false) => {
    setFlash({ text, visible });
    setLinkCopied(link);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => {
      setFlash(null);
      setLinkCopied(false);
    }, FLASH_MS);
  };
  const copyMarkdown = (text: string) =>
    navigator.clipboard.writeText(text).then(
      () => say(c.markdownCopied, true),
      () => say(c.copyFailed, true),
    );
  const copyLink = (url: string) =>
    navigator.clipboard.writeText(url).then(
      () => say(c.linkCopied, false, true),
      () => say(c.copyFailed, true),
    );

  // Open at the newest report. Later arrivals scroll into view only if you were already near the
  // bottom, so reading older reports isn't interrupted.
  const count = cards.length;
  const lastCount = useRef(0);
  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 160;
    if (lastCount.current === 0 || (count > lastCount.current && nearBottom)) box.scrollTop = box.scrollHeight;
    lastCount.current = count;
  }, [count]);

  // New cards that arrive after the first paint settle in; the ones already here at load don't.
  useEffect(() => {
    scrollRef.current?.setAttribute("data-live", "");
  }, []);

  // Every 3 seconds while a screenshot is being read, every 10 otherwise, so a new report shows up
  // without a reload. Nothing runs while the tab is hidden; coming back refreshes at once.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, reading ? REFRESH_MS : IDLE_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reading, router]);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const markdown = new Map(cards.map((card) => [card.id, card.markdown]));
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || typing(event.target)) return;
      const list = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-ticket-card]") ?? []);
      if (list.length === 0) return;
      const at = list.indexOf(document.activeElement as HTMLElement);
      const focus = (index: number) => {
        event.preventDefault();
        const card = list[Math.max(0, Math.min(list.length - 1, index))];
        card.focus();
        card.scrollIntoView({ block: "nearest" });
      };
      // With no card focused, j and k start from the newest card, where the thread opens.
      if (event.key === "j" || (event.key === "ArrowDown" && at >= 0)) focus(at < 0 ? list.length - 1 : at + 1);
      else if (event.key === "k" || (event.key === "ArrowUp" && at >= 0)) focus(at < 0 ? list.length - 1 : at - 1);
      else if (event.key === "c" && at >= 0) {
        const text = markdown.get(list[at].dataset.id ?? "");
        if (text) {
          event.preventDefault();
          copyMarkdown(text);
        }
      } else if (event.key === "Escape" && at >= 0) list[at].blur();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!client) {
    return (
      <section className={cn("min-h-0 flex-col bg-canvas", className)}>
        {anyProject ? (
          <ThreadEmpty title={adminCopy.clients.pageTitle[query.view]} body={query.view === "done" ? adminCopy.clients.emptyDone : adminCopy.clients.emptyInbox} />
        ) : (
          <ThreadEmpty title={adminCopy.empty.noProjectsTitle} body={adminCopy.empty.noProjectsBody}>
            <NewProjectDialog variant="button" />
          </ThreadEmpty>
        )}
      </section>
    );
  }

  return (
    <section aria-label={fillIn(c.label, { name: client.name })} className={cn("relative min-h-0 flex-col overflow-hidden bg-canvas", className)}>
      <header className="shrink-0 border-b border-line">
        <div className="flex h-[52px] items-center gap-2 px-2 md:px-4">
          <Link
            href={backHref}
            aria-label={c.back}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-sunken hover:text-ink pointer-coarse:size-11 lg:hidden"
          >
            <ArrowLeftIcon className="size-5" aria-hidden />
          </Link>
          <h2 className="min-w-0 flex-1 truncate px-1 text-body font-semibold text-ink lg:max-w-[16rem] lg:flex-none">{client.name}</h2>
          {counts.all > 0 && <StatusTabs query={query} counts={counts} className="hidden self-stretch lg:flex lg:flex-1" />}
          <CopyLinkButton copied={linkCopied} onCopy={() => copyLink(client.reportUrl)} className="ml-auto" />
        </div>
        {counts.all > 0 && <StatusTabs query={query} counts={counts} className="h-10 px-2 md:px-4 lg:hidden" />}
      </header>

      {/* relative: keeps the cards' screen-reader text inside this scroller, not the page's height. */}
      <div ref={scrollRef} className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        {cards.length === 0 ? (
          query.status === "all" ? (
            <ThreadEmpty title={adminCopy.empty.noReportsTitle} body={adminCopy.empty.noReportsBody}>
              <p className="max-w-full rounded-lg bg-sunken px-3 py-2 font-mono text-meta break-all text-ink">{client.reportUrl}</p>
              <CopyLinkButton copied={linkCopied} onCopy={() => copyLink(client.reportUrl)} primary />
            </ThreadEmpty>
          ) : (
            <ThreadEmpty title={adminCopy.empty.tab[query.status]}>
              <Link
                href={dashboardHref("/dashboard", { ...query, status: "all" })}
                className="flex h-9 items-center rounded-lg border border-line-strong px-3.5 text-body font-medium text-ink transition-colors hover:bg-sunken pointer-coarse:h-11"
              >
                {adminCopy.empty.showAll}
              </Link>
            </ThreadEmpty>
          )
        ) : (
          <div ref={listRef} className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-4 pt-6 pb-16 md:px-8">
            {cards.map((card) => (
              <ReportMessage key={card.id} card={card} client={client} />
            ))}
            <p className="hidden items-center justify-center gap-1.5 pt-2 text-meta text-ink-muted pointer-fine:flex">
              <kbd>j</kbd>
              <kbd>k</kbd>
              <span className="mr-2">{c.keys.move}</span>
              <kbd>Enter</kbd>
              <span className="mr-2">{c.keys.open}</span>
              <kbd>c</kbd>
              <span>{c.keys.copy}</span>
            </p>
          </div>
        )}
      </div>

      <p
        role="status"
        className={cn(
          "pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-ink px-3 py-1.5 text-meta font-medium whitespace-nowrap text-primary-foreground",
          flash?.visible ? "animate-pop" : "sr-only",
        )}
      >
        {flash?.text}
      </p>
    </section>
  );
}

/** All / New / In progress / Done with their counts. Links, so Back and a reload keep the tab. */
function StatusTabs({ query, counts, className }: { query: DashboardQuery; counts: TabCounts; className?: string }) {
  const c = adminCopy.thread;
  return (
    <nav aria-label={c.tabsLabel} className={className}>
      <ul className="relative top-px flex h-full gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const active = tab === query.status;
          return (
            <li key={tab} className="flex">
              <Link
                href={dashboardHref("/dashboard", { ...query, status: tab })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-2.5 text-meta font-medium whitespace-nowrap transition-colors pointer-coarse:min-h-11",
                  active ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                {c.tabs[tab]}
                <span className={cn("tabular-nums", active ? "text-ink-secondary" : "text-ink-muted")}>{counts[tab]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Copy report link; the button itself reads "Report link copied" for two seconds. */
function CopyLinkButton({ copied, onCopy, primary, className }: { copied: boolean; onCopy: () => void; primary?: boolean; className?: string }) {
  const c = adminCopy.thread;
  const Icon = copied ? CheckIcon : LinkIcon;
  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-lg font-medium transition-colors",
        primary
          ? "h-9 bg-primary px-3.5 text-body font-semibold text-primary-foreground hover:bg-primary-hover pointer-coarse:h-11"
          : "h-8 border border-line-strong px-3 text-meta text-ink hover:bg-sunken pointer-coarse:h-11",
        className,
      )}
    >
      <Icon className={cn(primary ? "size-4" : "size-3.5", copied && "animate-pop")} aria-hidden />
      {copied ? c.linkCopied : c.copyLink}
    </button>
  );
}
