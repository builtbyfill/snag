import { describe, expect, it } from 'vitest';
import { dateTile, groupByStatus, groupReports } from '@/lib/reports/groups';
import type { HistoryEntry } from '@/lib/reports/history';

const entry = (ticketId: string, sentAt: string): HistoryEntry => ({
  ticketId, sentence: `Report ${ticketId}`, thumb: 'data:image/jpeg;base64,AA==', sentAt,
});

describe('groupReports (client list: In progress / Done, newest first)', () => {
  const history = [
    entry('a', '2026-10-15T09:00:00.000Z'),
    entry('b', '2026-10-16T09:00:00.000Z'),
    entry('c', '2026-10-17T09:00:00.000Z'),
  ];

  it('puts received and in-progress reports under In progress, done ones under Done', () => {
    const groups = groupReports(history, { a: 'done', b: 'in_progress', c: 'new' });
    expect(groups.open.map((e) => e.ticketId)).toEqual(['c', 'b']);
    expect(groups.done.map((e) => e.ticketId)).toEqual(['a']);
  });

  it('treats a report whose status is not known yet as in progress', () => {
    expect(groupReports(history, {}).open).toHaveLength(3);
  });
});

describe('dateTile', () => {
  it('gives the day and a short uppercase month for the list tile', () => {
    expect(dateTile('2026-10-17T07:00:00Z')).toEqual({ day: '17', month: 'OCT' });
    expect(dateTile('2026-01-03T08:00:00Z')).toEqual({ day: '3', month: 'JAN' });
    // 23:30 UTC is already the next day in the office's zone, on the server and in the browser alike.
    expect(dateTile('2026-10-16T23:30:00Z')).toEqual({ day: '17', month: 'OCT' });
  });

  it('returns empty parts for an unreadable date', () => {
    expect(dateTile('nope')).toEqual({ day: '', month: '' });
  });
});

describe('groupByStatus (client list: Received / In progress / Done, newest first)', () => {
  const history = [
    { ticketId: 'a', sentence: 'first', thumb: 'data:image/jpeg;base64,x', sentAt: '2026-10-16T10:00:00.000Z' },
    { ticketId: 'b', sentence: 'second', thumb: 'data:image/jpeg;base64,x', sentAt: '2026-10-17T10:00:00.000Z' },
    { ticketId: 'c', sentence: 'third', thumb: 'data:image/jpeg;base64,x', sentAt: '2026-10-18T10:00:00.000Z' },
  ];

  it('puts each report under its status, newest first, and an unknown status under Received', () => {
    const groups = groupByStatus(history, { a: 'done', b: 'in_progress' });
    expect(groups.new.map((e) => e.ticketId)).toEqual(['c']);
    expect(groups.in_progress.map((e) => e.ticketId)).toEqual(['b']);
    expect(groups.done.map((e) => e.ticketId)).toEqual(['a']);
  });
});
