import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { countOpenTickets } from "@/lib/tickets/queries";
import { AppNav } from "./app-nav";
import { DashboardFrame } from "./dashboard-frame";

/**
 * The dashboard shell: the nav (Inbox with the open count, Done, the developer, Sign out) beside
 * whatever page is open. It re-renders on router.refresh(), so the count follows the polling.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const openCount = await countOpenTickets(getDb());
  const developerName = process.env.DEVELOPER_NAME?.trim().slice(0, 60) || null;
  return <DashboardFrame nav={<AppNav openCount={openCount} developerName={developerName} />}>{children}</DashboardFrame>;
}
