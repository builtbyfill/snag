// Reports sent from this device for one report link, kept in localStorage for the client chat
// page. Storage can be missing, blocked or full (private windows, quotas), so nothing here
// throws: reads fall back to [] and failed writes say so through `ok`.
import { z } from 'zod';

export const HISTORY_LIMIT = 20;
export const FOLLOW_UP_LIMIT = 20; // per report

const followUpSchema = z.object({ id: z.uuid(), body: z.string(), sentAt: z.iso.datetime() });

const entrySchema = z.object({
  ticketId: z.uuid(),
  sentence: z.string(),
  thumb: z.string().startsWith('data:image/'),
  sentAt: z.iso.datetime(),
  // Added 2026-10-18; entries stored before that simply have none.
  followUps: z.array(followUpSchema).optional(),
});

export type FollowUp = { id: string; body: string; sentAt: string };
export type HistoryEntry = { ticketId: string; sentence: string; thumb: string; sentAt: string; followUps?: FollowUp[] };

/** This project's history: "snag:<slug>". Nothing else under "snag:" or any other key is read. */
export function historyKey(slug: string): string {
  return `snag:${slug}`;
}
/** The key before 2026-10-25; moveLegacyHistory carries its entries over once. */
export const legacyHistoryKey = (slug: string): string => `snag:reports:v1:${slug}`;

/**
 * Moves a history stored under the old key to the new one, once, and only when the new key is
 * still empty (a newer history is never overwritten). Returns true when something was moved.
 */
export function moveLegacyHistory(
  slug: string,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    const old = storage.getItem(legacyHistoryKey(slug));
    if (old === null) return false;
    if (storage.getItem(historyKey(slug)) === null) storage.setItem(historyKey(slug), old);
    storage.removeItem(legacyHistoryKey(slug));
    return true;
  } catch {
    return false;
  }
}

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Storage is injectable for tests; defaults to globalThis.localStorage when available. */
export function readHistory(
  slug: string,
  storage: Pick<Storage, 'getItem'> | null = defaultStorage(),
): HistoryEntry[] {
  if (!storage) return [];
  let parsed: unknown;
  try {
    const raw = storage.getItem(historyKey(slug));
    if (raw === null) return [];
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  // One bad entry shouldn't hide the rest of the history.
  const entries: HistoryEntry[] = [];
  for (const item of parsed) {
    const result = entrySchema.safeParse(item);
    if (result.success) entries.push(result.data);
  }
  return entries.slice(-HISTORY_LIMIT);
}

/**
 * Appends the entry (once per ticketId) and keeps the newest HISTORY_LIMIT. `entries` is the
 * resulting list even when the write fails, so the page can still show it for this visit.
 * `base` is the list the page is showing: when storage refused an earlier write, it holds reports
 * that storage doesn't, and they must not be lost.
 */
export function addToHistory(
  slug: string,
  entry: HistoryEntry,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = defaultStorage(),
  base: HistoryEntry[] = readHistory(slug, storage),
): { ok: boolean; entries: HistoryEntry[] } {
  const current = base;
  const valid = entrySchema.safeParse(entry);
  if (!valid.success) return { ok: false, entries: current };
  if (current.some((e) => e.ticketId === entry.ticketId)) return { ok: true, entries: current };

  const entries = [...current, valid.data].slice(-HISTORY_LIMIT);
  if (!storage) return { ok: false, entries };
  try {
    storage.setItem(historyKey(slug), JSON.stringify(entries));
    return { ok: true, entries };
  } catch {
    return { ok: false, entries };
  }
}

/**
 * Appends a follow-up to one report in this device's history (newest FOLLOW_UP_LIMIT kept).
 * Fails without throwing when the report isn't here or storage refuses; `entries` is the
 * resulting list either way, so the page can still show it for this visit.
 */
export function addFollowUpToHistory(
  slug: string,
  ticketId: string,
  followUp: FollowUp,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = defaultStorage(),
  base: HistoryEntry[] = readHistory(slug, storage),
): { ok: boolean; entries: HistoryEntry[] } {
  const current = base;
  const valid = followUpSchema.safeParse(followUp);
  if (!valid.success || !current.some((e) => e.ticketId === ticketId)) return { ok: false, entries: current };

  const entries = current.map((e) =>
    e.ticketId === ticketId ? { ...e, followUps: [...(e.followUps ?? []), valid.data].slice(-FOLLOW_UP_LIMIT) } : e,
  );
  if (!storage) return { ok: false, entries };
  try {
    storage.setItem(historyKey(slug), JSON.stringify(entries));
    return { ok: true, entries };
  } catch {
    return { ok: false, entries };
  }
}
