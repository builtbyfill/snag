"use client";

import { CheckCheckIcon, InboxIcon, LogOutIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import { SnagMark } from "@/components/snag-mark";
import { adminCopy, fillIn } from "@/lib/copy/admin";
import { cn, initials } from "@/lib/utils";

const row =
  "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-body transition-colors pointer-coarse:h-11";

/**
 * The dashboard's left column: the wordmark, the two views (Inbox: clients with something open;
 * Done: clients with nothing open), and the developer with Sign out at the bottom.
 */
export function AppNav({ openCount, developerName }: { openCount: number; developerName: string | null }) {
  const c = adminCopy.nav;
  const pathname = usePathname();
  const params = useSearchParams();
  const view = pathname === "/dashboard" ? (params.get("view") === "done" ? "done" : "inbox") : null;
  const name = developerName ?? c.developerFallback;

  const item = (active: boolean) =>
    cn(row, active ? "bg-selected font-medium text-ink" : "text-ink-secondary hover:bg-sunken hover:text-ink");

  return (
    <nav aria-label={c.label} className="flex h-full flex-col bg-pane">
      <div className="flex h-[52px] shrink-0 items-center gap-2.5 border-b border-line px-4">
        <SnagMark className="size-6 text-ink [--snag-mark-cut:var(--pane)]" />
        <span className="text-body font-semibold">Snag</span>
      </div>

      <ul className="flex flex-col gap-0.5 px-2 pt-1">
        <li>
          <Link href="/dashboard" aria-current={view === "inbox" ? "page" : undefined} className={item(view === "inbox")}>
            <InboxIcon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{c.inbox}</span>
            {openCount > 0 && (
              <span className="text-meta text-ink-muted tabular-nums">
                <span className="sr-only">, </span>
                {fillIn(c.inboxCount, { count: openCount })}
              </span>
            )}
          </Link>
        </li>
        <li>
          <Link href="/dashboard?view=done" aria-current={view === "done" ? "page" : undefined} className={item(view === "done")}>
            <CheckCheckIcon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{c.done}</span>
          </Link>
        </li>
      </ul>

      <div className="mt-auto border-t border-line p-2">
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sunken text-meta font-semibold text-ink">
            {initials(name)}
          </span>
          <span className="truncate text-body text-ink">{name}</span>
        </div>
        <form action={signOutAction}>
          <button type="submit" className={cn(row, "w-full text-ink-secondary hover:bg-sunken hover:text-ink")}>
            <LogOutIcon className="size-4 shrink-0" aria-hidden />
            {c.signOut}
          </button>
        </form>
      </div>
    </nav>
  );
}
