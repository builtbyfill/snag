import { describe, expect, it } from 'vitest';
import { recencyGroup, relativeTime } from '@/lib/tickets/recency';

// 14:00 on Sunday 18 October 2026 in Sarajevo (CEST, UTC+2).
const NOW = new Date('2026-10-18T12:00:00Z');

describe('recencyGroup: calendar days in Europe/Sarajevo', () => {
  it('starts Today at local midnight, not UTC midnight', () => {
    expect(recencyGroup(new Date('2026-10-17T22:00:00Z'), NOW)).toBe('today'); // 00:00 on the 18th
    expect(recencyGroup(new Date('2026-10-17T21:59:00Z'), NOW)).toBe('yesterday'); // 23:59 on the 17th
  });

  it('puts the two to seven days before today in Previous 7 days, and anything earlier in Older', () => {
    expect(recencyGroup(new Date('2026-10-16T21:59:00Z'), NOW)).toBe('week'); // the 16th
    expect(recencyGroup(new Date('2026-10-10T22:00:00Z'), NOW)).toBe('week'); // the 11th, seven days back
    expect(recencyGroup(new Date('2026-10-10T21:59:00Z'), NOW)).toBe('older'); // the 10th
    expect(recencyGroup(new Date('2025-12-30T10:00:00Z'), NOW)).toBe('older');
  });

  it('counts days across the switch back to winter time (25 October)', () => {
    const monday = new Date('2026-10-26T10:00:00Z'); // 11:00 CET
    expect(recencyGroup(new Date('2026-10-25T22:59:00Z'), monday)).toBe('yesterday'); // 23:59 CET on the 25th
    expect(recencyGroup(new Date('2026-10-25T23:00:00Z'), monday)).toBe('today'); // 00:00 CET on the 26th
  });

  it('treats a time slightly in the future (clock skew) as today', () => {
    expect(recencyGroup(new Date('2026-10-18T12:00:30Z'), NOW)).toBe('today');
  });
});

describe('relativeTime', () => {
  it('says "now" under a minute, and for a time slightly in the future', () => {
    expect(relativeTime(new Date('2026-10-18T11:59:01Z'), NOW)).toBe('now');
    expect(relativeTime(new Date('2026-10-18T12:00:20Z'), NOW)).toBe('now');
  });

  it('counts minutes under an hour and hours under a day', () => {
    expect(relativeTime(new Date('2026-10-18T11:56:00Z'), NOW)).toBe('4 min');
    expect(relativeTime(new Date('2026-10-18T11:00:01Z'), NOW)).toBe('59 min');
    expect(relativeTime(new Date('2026-10-18T10:00:00Z'), NOW)).toBe('2 h');
    expect(relativeTime(new Date('2026-10-17T12:00:01Z'), NOW)).toBe('23 h');
  });

  it('gives the Sarajevo date after a day, with the year only when it differs', () => {
    expect(relativeTime(new Date('2026-10-17T12:00:00Z'), NOW)).toBe('17 Oct');
    expect(relativeTime(new Date('2026-09-30T22:30:00Z'), NOW)).toBe('1 Oct'); // already 1 Oct in Sarajevo
    expect(relativeTime(new Date('2026-09-05T08:00:00Z'), NOW)).toBe('5 Sep');
    expect(relativeTime(new Date('2025-12-30T10:00:00Z'), NOW)).toBe('30 Dec 2025');
  });
});

describe('dateTime', () => {
  it('gives the Sarajevo date and 24-hour time, with the year only when it differs', async () => {
    const { dateTime } = await import('@/lib/tickets/recency');
    expect(dateTime(new Date('2026-10-18T12:05:00Z'), NOW)).toBe('18 Oct, 14:05');
    expect(dateTime(new Date('2026-10-17T22:30:00Z'), NOW)).toBe('18 Oct, 00:30');
    expect(dateTime(new Date('2026-10-26T08:00:00Z'), NOW)).toBe('26 Oct, 09:00'); // winter time, UTC+1
    expect(dateTime(new Date('2025-12-30T10:00:00Z'), NOW)).toBe('30 Dec 2025, 11:00');
  });
});
