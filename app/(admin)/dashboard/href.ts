import { z } from "zod";
import type { DashboardQuery } from "./types";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Anything unknown in the URL falls back to the default instead of failing the page.
const Query = z.object({
  view: z.enum(["inbox", "done"]).catch("inbox"),
  project: z.uuid().nullable().catch(null),
  status: z.enum(["all", "new", "in_progress", "done"]).catch("all"),
});

/** The dashboard's view, client and tab from a page's searchParams. */
export function readQuery(raw: Record<string, string | string[] | undefined>): DashboardQuery {
  return Query.parse({ view: first(raw.view), project: first(raw.project) ?? null, status: first(raw.status) });
}

/** A dashboard URL that keeps only what differs from the defaults. */
export function dashboardHref(path: string, q: Partial<DashboardQuery>): string {
  const params = new URLSearchParams();
  if (q.view && q.view !== "inbox") params.set("view", q.view);
  if (q.project) params.set("project", q.project);
  if (q.status && q.status !== "all") params.set("status", q.status);
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}
