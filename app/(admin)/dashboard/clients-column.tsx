"use client";

import { MenuIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { adminCopy, fillIn } from "@/lib/copy/admin";
import { cn } from "@/lib/utils";
import { useOpenNav } from "./dashboard-frame";
import { NewProjectDialog } from "./new-project-dialog";
import type { ClientRowView } from "./types";

const GROUPS: ClientRowView["group"][] = ["today", "yesterday", "week", "older", "waiting"];

/** Search ignores case and diacritics, so "cistoca" finds "Čistoća". */
const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("bs");

/**
 * The clients column: search, New project, then one row per project grouped by its latest report
 * (Today, Yesterday, Previous 7 days, Older), as in the ChatGPT sidebar, and last the projects
 * still waiting for a first report. From 1280px the nav names the view, so the search takes the
 * header row and every column's header line sits at 52px.
 */
export function ClientsColumn({
  view,
  rows,
  openId,
  openChosen,
  anyProject,
  className,
}: {
  view: "inbox" | "done";
  rows: ClientRowView[];
  openId: string | null;
  /** False when the open client was picked by default: on a phone no chat is open yet. */
  openChosen: boolean;
  anyProject: boolean;
  className?: string;
}) {
  const c = adminCopy.clients;
  const openNav = useOpenNav();
  const titleId = useId();
  const [search, setSearch] = useState("");
  const needle = fold(search.trim());
  const shown = needle ? rows.filter((r) => fold(`${r.name} ${r.sentence ?? ""}`).includes(needle)) : rows;

  const searchField = (where: string) => (
    <div className={cn("relative", where)}>
      <label htmlFor={`${titleId}-${where}`} className="sr-only">
        {c.search}
      </label>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
      <input
        id={`${titleId}-${where}`}
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={c.search}
        autoComplete="off"
        className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-2.5 pl-8 text-body text-ink placeholder:text-ink-faint pointer-coarse:h-11"
      />
    </div>
  );

  return (
    <section aria-labelledby={titleId} data-list className={cn("min-h-0 flex-col overflow-hidden border-r border-line bg-pane", className)}>
      <div className="flex h-[52px] shrink-0 items-center gap-1 border-b border-line px-2">
        <button
          type="button"
          onClick={openNav}
          aria-label={adminCopy.nav.open}
          className="flex size-9 items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-hover hover:text-ink pointer-coarse:size-11 xl:hidden"
        >
          <MenuIcon className="size-5" aria-hidden />
        </button>
        <h1 id={titleId} className="px-2 text-body font-semibold text-ink xl:sr-only">
          {c.pageTitle[view]}
        </h1>
        {searchField("hidden flex-1 xl:block")}
      </div>

      <div className="flex shrink-0 flex-col gap-1 p-2">
        {searchField("xl:hidden")}
        <NewProjectDialog />
      </div>

      {/* relative: keeps the rows' screen-reader text inside this scroller, not the page's height. */}
      <div className="relative min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {shown.length === 0 && (
          <p className="px-2.5 py-3 text-meta text-ink-muted">
            {needle
              ? fillIn(c.noMatch, { text: search.trim() })
              : !anyProject
                ? adminCopy.empty.noProjectsBody
                : view === "done"
                  ? c.emptyDone
                  : c.emptyInbox}
          </p>
        )}
        {GROUPS.map((group) => {
          const inGroup = shown.filter((r) => r.group === group);
          if (inGroup.length === 0) return null;
          return (
            <div key={group} className="pt-3">
              <h2 className="px-2.5 pb-1 text-meta font-medium text-ink-muted">{c.groups[group]}</h2>
              <ul className="flex flex-col gap-0.5">
                {inGroup.map((row) => (
                  <li key={row.id}>
                    <ClientRow row={row} open={row.id === openId} chosen={openChosen} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ClientRow({ row, open, chosen }: { row: ClientRowView; open: boolean; chosen: boolean }) {
  const c = adminCopy.clients;
  // A client opened by default is only "open" where its chat shows beside the list (from 1024px).
  // The open client: a white row with a 3px lime bar and a 1px ink line beside it. Lime alone is
  // 1.2:1 on the light list; the ink line carries the selected state at 3:1 or more (16 here).
  const selected = open
    ? chosen
      ? "bg-selected before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-l-full before:bg-lime after:absolute after:inset-y-2 after:left-[3px] after:w-px after:bg-ink"
      : "hover:bg-hover lg:bg-selected lg:hover:bg-selected lg:before:absolute lg:before:inset-y-2 lg:before:left-0 lg:before:w-[3px] lg:before:rounded-l-full lg:before:bg-lime lg:after:absolute lg:after:inset-y-2 lg:after:left-[3px] lg:after:w-px lg:after:bg-ink"
    : "hover:bg-hover";
  return (
    <Link
      href={row.href}
      aria-current={open ? "page" : undefined}
      className={cn("group relative flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors", selected)}
    >
      <span aria-hidden className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-meta font-semibold text-ink-secondary">
        {row.initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-body font-medium text-ink">{row.name}</span>
          <span className="shrink-0 text-meta text-ink-muted tabular-nums">{row.time}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-meta", row.sentence ? "text-ink-secondary" : "text-ink-muted")}>
            {row.sentence ?? c.noReports}
          </span>
          {row.openCount > 0 && (
            // Ink with white text: readable on the list, its hover and the white selected row.
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-chrome px-1.5 text-meta font-medium text-primary-foreground tabular-nums">
              <span aria-hidden>{row.openCount}</span>
              <span className="sr-only">, {fillIn(c.openCount, { count: row.openCount })}</span>
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
