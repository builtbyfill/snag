import { describe, expect, it } from 'vitest';
import { DEFAULT_OFFICE_HOURS, officeStatus } from '@/lib/office-hours';

// Europe/Sarajevo is UTC+2 in October (summer time), UTC+1 from 25 Oct 2026.
const at = (iso: string) => new Date(iso);

describe('officeStatus (Mon–Fri 9–17 Europe/Sarajevo by default)', () => {
  it('is open inside working hours', () => {
    // Friday 16 Oct 2026, 10:30 in Sarajevo
    expect(officeStatus(at('2026-10-16T08:30:00Z'), DEFAULT_OFFICE_HOURS)).toEqual({ open: true });
  });

  it('reopens today at 9:00 before opening time on a working day', () => {
    // Friday 16 Oct, 07:15 in Sarajevo
    expect(officeStatus(at('2026-10-16T05:15:00Z'), DEFAULT_OFFICE_HOURS)).toEqual({ open: false, back: 'today', time: '9:00' });
  });

  it('reopens tomorrow after closing time when tomorrow is a working day', () => {
    // Thursday 15 Oct, 18:00 in Sarajevo
    expect(officeStatus(at('2026-10-15T16:00:00Z'), DEFAULT_OFFICE_HOURS)).toEqual({ open: false, back: 'tomorrow', time: '9:00' });
  });

  it('names the weekday when the next working day is further away', () => {
    // Saturday 17 Oct, 12:00 in Sarajevo → Monday
    expect(officeStatus(at('2026-10-17T10:00:00Z'), DEFAULT_OFFICE_HOURS)).toEqual({ open: false, back: 'Monday', time: '9:00' });
    // Friday 16 Oct, 17:00 sharp is closed → Monday
    expect(officeStatus(at('2026-10-16T15:00:00Z'), DEFAULT_OFFICE_HOURS)).toEqual({ open: false, back: 'Monday', time: '9:00' });
  });

  it('uses the office time zone, not the server clock, across the clock change', () => {
    // Sunday 25 Oct 2026 23:30 UTC = Monday 26 Oct 00:30 in Sarajevo (UTC+1 by then) → today 9:00
    expect(officeStatus(at('2026-10-25T23:30:00Z'), DEFAULT_OFFICE_HOURS)).toEqual({ open: false, back: 'today', time: '9:00' });
  });
});
