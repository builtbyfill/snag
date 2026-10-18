import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { adminCopy } from "@/lib/copy/admin";

export const metadata: Metadata = { title: `${adminCopy.shell.pageTitle} · Snag` };

// Placeholder until the chats (slice 7). The page checks the session itself as well: a layout
// doesn't re-run on every navigation, a page does.
export default async function DashboardPage() {
  await requireSession();
  const c = adminCopy.shell;
  return (
    <main className="flex h-full flex-col items-center justify-center px-4 text-center">
      <h1 className="text-title font-semibold text-ink">{c.pageTitle}</h1>
      <p className="mt-1 text-body text-ink-muted">{c.emptyBody}</p>
    </main>
  );
}
