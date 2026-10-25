import { describe, expect, it } from 'vitest';
import { formatSentAt } from '@/lib/reports/sent-at';

// Times are given in UTC and expected in the office's zone (Sarajevo: CEST until 25 Oct 2026, then CET).
const now = new Date('2026-10-17T16:00:00Z');

describe('formatSentAt (when a report was sent, in the office zone, same words as the date tiles)', () => {
  it('shows day, short month and time, today included', () => {
    expect(formatSentAt('2026-10-16T23:09:00Z', now)).toBe('17 Oct, 01:09');
  });

  it('shows day and short month for earlier days this year', () => {
    expect(formatSentAt('2026-10-16T12:32:00Z', now)).toBe('16 Oct, 14:32');
  });

  it('adds the year for an earlier year', () => {
    expect(formatSentAt('2025-12-30T07:00:00Z', now)).toBe('30 Dec 2025, 08:00');
  });

  it('prints the same text whatever the runtime zone, so the server and the browser agree', () => {
    const before = process.env.TZ;
    try {
      for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
        process.env.TZ = tz;
        expect(formatSentAt('2026-10-16T23:09:00Z', now)).toBe('17 Oct, 01:09');
      }
    } finally {
      process.env.TZ = before;
    }
  });

  it('returns an empty string for an unreadable date instead of "Invalid Date"', () => {
    expect(formatSentAt('not a date', now)).toBe('');
  });
});
