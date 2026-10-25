// When the developer is working, for the client page's reply expectation ("Usually replies the
// same day" inside office hours, "Back tomorrow at 9:00" outside). The default applies to every
// project; a project can carry its own in `projects.office_hours` (the demo seed sets every day,
// all day, so a recording on a weekend still shows the same-day line; Filip 2026-10-25).
import { z } from 'zod';

export type OfficeHours = {
  /** ISO weekdays: 1 = Monday … 7 = Sunday. */
  days: number[];
  open: string; // "HH:MM", local to timeZone
  close: string;
  timeZone: string;
};

export const DEFAULT_OFFICE_HOURS: OfficeHours = { days: [1, 2, 3, 4, 5], open: '09:00', close: '17:00', timeZone: 'Europe/Sarajevo' };
/** Every day, all day: the demo projects, so the header says "Usually replies the same day" whenever the video is recorded. */
export const ALWAYS_OPEN: OfficeHours = { days: [1, 2, 3, 4, 5, 6, 7], open: '00:00', close: '24:00', timeZone: 'Europe/Sarajevo' };

const HHMM = /^([01]\d|2[0-4]):[0-5]\d$/;
export const OfficeHoursSchema = z.object({
  days: z.array(z.number().int().min(1).max(7)).min(1),
  open: z.string().regex(HHMM),
  close: z.string().regex(HHMM),
  timeZone: z.string().min(1),
});

/** The stored office hours of a project, or the default when there are none or they don't parse. */
export function readOfficeHours(stored: unknown): OfficeHours {
  const parsed = OfficeHoursSchema.safeParse(stored);
  return parsed.success ? parsed.data : DEFAULT_OFFICE_HOURS;
}

export type OfficeStatus = { open: true } | { open: false; back: string; time: string };

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Weekday (1–7) and minutes since midnight at `now` in the office's time zone. */
function localTime(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { weekday: SHORT.indexOf(get('weekday')) + 1, minute: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** Open now, or when it opens again: "today", "tomorrow" or a weekday name, at the opening time. */
export function officeStatus(now: Date, hours: OfficeHours = DEFAULT_OFFICE_HOURS): OfficeStatus {
  const { weekday, minute } = localTime(now, hours.timeZone);
  const open = minutes(hours.open);
  const time = `${Math.floor(open / 60)}:${String(open % 60).padStart(2, '0')}`;
  const workday = hours.days.includes(weekday);

  if (workday && minute >= open && minute < minutes(hours.close)) return { open: true };
  if (workday && minute < open) return { open: false, back: 'today', time };
  for (let ahead = 1; ahead <= 7; ahead++) {
    const day = ((weekday - 1 + ahead) % 7) + 1;
    if (hours.days.includes(day)) return { open: false, back: ahead === 1 ? 'tomorrow' : WEEKDAYS[day - 1], time };
  }
  return { open: false, back: 'tomorrow', time };
}
