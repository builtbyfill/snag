// What the dashboard page hands its client components: plain, already formatted values, so the
// server decides every time zone and nothing has to be recomputed (or mismatch) in the browser.
import type { ClientsView, StatusTab } from "@/lib/tickets/queries";
import type { RecencyGroup } from "@/lib/tickets/recency";

export type DashboardQuery = { view: ClientsView; project: string | null; status: StatusTab };

export type ClientRowView = {
  id: string;
  name: string;
  initials: string;
  /** The latest client sentence, or null when the project has no reports. */
  sentence: string | null;
  /** "4 min", "2 h", "17 Oct": since the latest report, or since the project was created. */
  time: string;
  openCount: number;
  /** "waiting": a project with no reports yet, listed after the clients with work. */
  group: RecencyGroup | "waiting";
  href: string;
};

export type TabCounts = Record<"all" | "new" | "in_progress" | "done", number>;

export type CardView = {
  id: string;
  number: number;
  status: "new" | "in_progress" | "done";
  extractionState: "pending" | "extracted" | "extraction_failed";
  interrupted: boolean;
  confidence: string | null;
  /** Under the Ask client threshold (0.6). */
  confidenceLow: boolean;
  title: string | null;
  actualResult: string | null;
  priority: "low" | "medium" | "high" | null;
  askClient: boolean;
  sentence: string;
  sentAt: string;
  /** width/height: the size it shows at (inside 280 × 240), known before it loads. */
  thumb: { src: string; srcSet: string; width: number; height: number } | null;
  followUps: { id: string; body: string; at: string }[];
  /** Status and priority changes, already worded ("Status changed to In progress"). */
  events: { id: string; text: string; at: string }[];
  markdown: string;
  href: string;
};

export type ThreadClient = { id: string; name: string; initials: string; reportUrl: string };
