import { describe, expect, it } from 'vitest';
import { formatSentAt } from '@/lib/reports/sent-at';

const now = new Date(2026, 9, 17, 18, 0); // local time, 17 Oct 2026 18:00

describe('formatSentAt (when a report was sent, same words as the date tiles)', () => {
  it('says "today" with the time for today', () => {
    expect(formatSentAt(new Date(2026, 9, 17, 9, 5).toISOString(), now)).toBe('today, 09:05');
  });

  it('shows day and short month for earlier days this year', () => {
    expect(formatSentAt(new Date(2026, 9, 16, 14, 32).toISOString(), now)).toBe('16 Oct, 14:32');
  });

  it('adds the year for an earlier year', () => {
    expect(formatSentAt(new Date(2025, 11, 30, 8, 0).toISOString(), now)).toBe('30 Dec 2025, 08:00');
  });

  it('returns an empty string for an unreadable date instead of "Invalid Date"', () => {
    expect(formatSentAt('not a date', now)).toBe('');
  });
});
