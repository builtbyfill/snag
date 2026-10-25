import type { HistoryEntry } from './history';
import { officeParts } from './sent-at';

type Status = 'new' | 'in_progress' | 'done';

/** The client's list: In progress (received or being worked on) and Done, newest first in each. */
export function groupReports(history: HistoryEntry[], statuses: Record<string, Status | undefined>) {
  const newestFirst = [...history].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  return {
    // A status not loaded yet counts as open: never show a report as done before the server says so.
    open: newestFirst.filter((e) => statuses[e.ticketId] !== 'done'),
    done: newestFirst.filter((e) => statuses[e.ticketId] === 'done'),
  };
}

/** The client's list by status: Received, In progress, Done; newest first in each. A status not loaded yet reads as Received. */
export function groupByStatus(history: HistoryEntry[], statuses: Record<string, Status | undefined>): Record<Status, HistoryEntry[]> {
  const newestFirst = [...history].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  return {
    new: newestFirst.filter((e) => (statuses[e.ticketId] ?? 'new') === 'new'),
    in_progress: newestFirst.filter((e) => statuses[e.ticketId] === 'in_progress'),
    done: newestFirst.filter((e) => statuses[e.ticketId] === 'done'),
  };
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Day and short month for the date tile in lists, in the office's zone (the same on the server and in the browser). */
export function dateTile(iso: string): { day: string; month: string } {
  const d = officeParts(iso);
  if (!d) return { day: '', month: '' };
  return { day: String(d.day), month: MONTHS[d.month - 1] };
}
