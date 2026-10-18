// Reports sent from this device for one report link, kept in localStorage for the client chat
// page. Storage can be missing, blocked or full (private windows, quotas), so nothing here
// throws: reads fall back to [] and failed writes say so through `ok`.
import { z } from 'zod';

export const HISTORY_LIMIT = 20;

const entrySchema = z.object({
  ticketId: z.uuid(),
  sentence: z.string(),
  thumb: z.string().startsWith('data:image/'),
  sentAt: z.iso.datetime(),
});

export type HistoryEntry = { ticketId: string; sentence: string; thumb: string; sentAt: string };

export function historyKey(slug: string): string {
  return `snag:reports:v1:${slug}`;
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
 */
export function addToHistory(
  slug: string,
  entry: HistoryEntry,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = defaultStorage(),
): { ok: boolean; entries: HistoryEntry[] } {
  const current = readHistory(slug, storage);
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
