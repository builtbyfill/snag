// Where a client sits in the dashboard's clients column (Today, Yesterday, Previous 7 days, Older)
// and how old its latest report reads. Calendar days are Sarajevo days, the same zone as the
// office hours, so a report at 00:30 there is "Today" even though it is still yesterday in UTC.
import { DEFAULT_OFFICE_HOURS } from '@/lib/office-hours';

export type RecencyGroup = 'today' | 'yesterday' | 'week' | 'older';

const TIME_ZONE = DEFAULT_OFFICE_HOURS.timeZone;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** The calendar date and clock time in Sarajevo. */
function localDate(date: Date) {
  const parts = dayFormat.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')), time: `${get('hour')}:${get('minute')}` };
}

/** Days since the epoch for a calendar date, so two dates subtract cleanly across DST changes. */
const dayNumber = ({ year, month, day }: { year: number; month: number; day: number }) => Date.UTC(year, month - 1, day) / DAY;

export function recencyGroup(date: Date, now: Date = new Date()): RecencyGroup {
  const days = dayNumber(localDate(now)) - dayNumber(localDate(date));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days <= 7) return 'week';
  return 'older';
}

/** "now", "4 min", "2 h", then the Sarajevo date: "17 Oct", or "30 Dec 2025" in another year. */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const ago = now.getTime() - date.getTime();
  if (ago < MINUTE) return 'now';
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)} min`;
  if (ago < DAY) return `${Math.floor(ago / HOUR)} h`;
  return dayLabel(date, now);
}

/** "18 Oct, 14:05" in Sarajevo, for a message's time; the year only when it differs. */
export function dateTime(date: Date, now: Date = new Date()): string {
  return `${dayLabel(date, now)}, ${localDate(date).time}`;
}

function dayLabel(date: Date, now: Date): string {
  const d = localDate(date);
  const label = `${d.day} ${MONTHS[d.month - 1]}`;
  return d.year === localDate(now).year ? label : `${label} ${d.year}`;
}
