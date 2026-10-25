// When a report was sent: "17 Oct, 01:09", or "30 Dec 2025, 08:00" for another year, in the
// office's time zone (lib/office-hours.ts), 24-hour clock, the same short months as the date
// tiles. Fixed to one zone on purpose: the server renders a demo project's reports, and the
// browser must print the same text or React reports a hydration mismatch (#418).
import { DEFAULT_OFFICE_HOURS } from '@/lib/office-hours';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const format = new Intl.DateTimeFormat('en-GB', {
  timeZone: DEFAULT_OFFICE_HOURS.timeZone,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** The calendar date and clock time in the office's zone, or null for an unreadable date. */
export function officeParts(iso: string): { year: number; month: number; day: number; time: string } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = format.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')), time: `${get('hour')}:${get('minute')}` };
}

export function formatSentAt(iso: string, now: Date = new Date()): string {
  const d = officeParts(iso);
  if (!d) return '';
  const day = `${d.day} ${MONTHS[d.month - 1]}`;
  const sameYear = d.year === officeParts(now.toISOString())?.year;
  return sameYear ? `${day}, ${d.time}` : `${day} ${d.year}, ${d.time}`;
}
