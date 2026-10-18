import type { HistoryEntry } from './history';

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

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Day and short month for the date tile in lists (local time). */
export function dateTile(iso: string): { day: string; month: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: '', month: '' };
  return { day: String(d.getDate()), month: MONTHS[d.getMonth()] };
}
