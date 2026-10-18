import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addFollowUpToHistory,
  addToHistory,
  FOLLOW_UP_LIMIT,
  HISTORY_LIMIT,
  historyKey,
  readHistory,
  type HistoryEntry,
} from '@/lib/reports/history';

class MemoryStorage {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

// Private windows and blocked storage throw on access; a full quota throws on write.
class ThrowingStorage {
  getItem(): string | null {
    throw new Error('SecurityError');
  }
  setItem(): void {
    throw new Error('QuotaExceededError');
  }
}

class FullStorage extends MemoryStorage {
  override setItem(): void {
    throw new Error('QuotaExceededError');
  }
}

const SLUG = 'acme-x7k2';

function entry(n: number): HistoryEntry {
  return {
    ticketId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    sentence: `Dugme ne radi, slučaj ${n}.`,
    thumb: 'data:image/webp;base64,AAAA',
    sentAt: new Date(Date.UTC(2026, 9, 17, 12, 0, n)).toISOString(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('historyKey', () => {
  it('namespaces by version and slug', () => {
    expect(historyKey(SLUG)).toBe('snag:reports:v1:acme-x7k2');
  });
});

describe('readHistory', () => {
  it('returns [] when nothing is stored', () => {
    expect(readHistory(SLUG, new MemoryStorage())).toEqual([]);
  });

  it('returns [] for invalid JSON', () => {
    const storage = new MemoryStorage();
    storage.setItem(historyKey(SLUG), '{not json');
    expect(readHistory(SLUG, storage)).toEqual([]);
  });

  it.each([
    ['an object', '{"ticketId":"x"}'],
    ['a string', '"hello"'],
    ['null', 'null'],
    ['a number', '42'],
  ])('returns [] when the value is %s instead of an array', (_label, raw) => {
    const storage = new MemoryStorage();
    storage.setItem(historyKey(SLUG), raw);
    expect(readHistory(SLUG, storage)).toEqual([]);
  });

  it('drops invalid entries one by one and keeps the valid ones', () => {
    const storage = new MemoryStorage();
    const raw = [
      entry(1),
      { ...entry(2), ticketId: 'not-a-uuid' },
      { ...entry(3), thumb: 'https://evil.example/x.png' },
      { ...entry(4), sentAt: 'yesterday' },
      'garbage',
      null,
      { ticketId: entry(5).ticketId },
      entry(6),
    ];
    storage.setItem(historyKey(SLUG), JSON.stringify(raw));
    expect(readHistory(SLUG, storage)).toEqual([entry(1), entry(6)]);
  });

  it('returns [] when getItem throws', () => {
    expect(readHistory(SLUG, new ThrowingStorage())).toEqual([]);
  });

  it('returns [] when there is no storage at all', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(readHistory(SLUG, null)).toEqual([]);
    expect(readHistory(SLUG)).toEqual([]);
  });

  it('uses globalThis.localStorage when no storage is passed', () => {
    const storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    addToHistory(SLUG, entry(1));
    expect(readHistory(SLUG)).toEqual([entry(1)]);
    expect(storage.items.has(historyKey(SLUG))).toBe(true);
  });
});

describe('addToHistory', () => {
  it('round-trips through storage', () => {
    const storage = new MemoryStorage();
    const result = addToHistory(SLUG, entry(1), storage);
    expect(result).toEqual({ ok: true, entries: [entry(1)] });
    expect(readHistory(SLUG, storage)).toEqual([entry(1)]);
  });

  it('keeps entries oldest first', () => {
    const storage = new MemoryStorage();
    addToHistory(SLUG, entry(1), storage);
    addToHistory(SLUG, entry(2), storage);
    addToHistory(SLUG, entry(3), storage);
    expect(readHistory(SLUG, storage)).toEqual([entry(1), entry(2), entry(3)]);
  });

  it(`keeps at most ${HISTORY_LIMIT} entries, dropping the oldest`, () => {
    expect(HISTORY_LIMIT).toBe(20);
    const storage = new MemoryStorage();
    for (let n = 1; n <= 21; n++) addToHistory(SLUG, entry(n), storage);
    const entries = readHistory(SLUG, storage);
    expect(entries).toHaveLength(20);
    expect(entries[0]).toEqual(entry(2));
    expect(entries[19]).toEqual(entry(21));
  });

  it('is idempotent per ticketId', () => {
    const storage = new MemoryStorage();
    addToHistory(SLUG, entry(1), storage);
    addToHistory(SLUG, entry(2), storage);
    const result = addToHistory(SLUG, entry(1), storage);
    expect(result).toEqual({ ok: true, entries: [entry(1), entry(2)] });
    expect(readHistory(SLUG, storage)).toEqual([entry(1), entry(2)]);
  });

  it('starts over from the valid entries when the stored value is corrupt', () => {
    const storage = new MemoryStorage();
    storage.setItem(historyKey(SLUG), '{not json');
    expect(addToHistory(SLUG, entry(1), storage)).toEqual({ ok: true, entries: [entry(1)] });
  });

  it('refuses to store an entry that reads would drop', () => {
    const storage = new MemoryStorage();
    addToHistory(SLUG, entry(1), storage);
    const result = addToHistory(SLUG, { ...entry(2), thumb: 'https://example.com/x.png' }, storage);
    expect(result).toEqual({ ok: false, entries: [entry(1)] });
    expect(readHistory(SLUG, storage)).toEqual([entry(1)]);
  });

  // On failure the page still gets the list it would have saved, to show for this visit only.
  it('reports failure without throwing when setItem throws (quota)', () => {
    const storage = new FullStorage();
    storage.items.set(historyKey(SLUG), JSON.stringify([entry(1)]));
    expect(addToHistory(SLUG, entry(2), storage)).toEqual({
      ok: false,
      entries: [entry(1), entry(2)],
    });
    expect(readHistory(SLUG, storage)).toEqual([entry(1)]);
  });

  it('reports failure without throwing when storage is blocked', () => {
    expect(addToHistory(SLUG, entry(1), new ThrowingStorage())).toEqual({
      ok: false,
      entries: [entry(1)],
    });
  });

  it('reports failure when there is no storage at all', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(addToHistory(SLUG, entry(1), null)).toEqual({ ok: false, entries: [entry(1)] });
    expect(addToHistory(SLUG, entry(1))).toEqual({ ok: false, entries: [entry(1)] });
  });

  it('keeps separate histories per slug', () => {
    const storage = new MemoryStorage();
    addToHistory('first-slug', entry(1), storage);
    addToHistory('second-slug', entry(2), storage);
    expect(readHistory('first-slug', storage)).toEqual([entry(1)]);
    expect(readHistory('second-slug', storage)).toEqual([entry(2)]);
  });
});

describe('addFollowUpToHistory (text a client added to a report from this device)', () => {
  const followUp = (n: number) => ({
    id: `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    body: `Dodatak ${n}.`,
    sentAt: new Date(Date.UTC(2026, 9, 18, 12, 0, n)).toISOString(),
  });

  it('adds the follow-up to the right report and leaves the others as they were', () => {
    const storage = new MemoryStorage();
    addToHistory(SLUG, entry(1), storage);
    addToHistory(SLUG, entry(2), storage);

    const result = addFollowUpToHistory(SLUG, entry(1).ticketId, followUp(1), storage);

    expect(result.ok).toBe(true);
    const [first, second] = readHistory(SLUG, storage);
    expect(first.followUps).toEqual([followUp(1)]);
    expect(second.followUps ?? []).toEqual([]);
  });

  it(`keeps at most ${FOLLOW_UP_LIMIT} follow-ups per report, dropping the oldest`, () => {
    const storage = new MemoryStorage();
    addToHistory(SLUG, entry(1), storage);
    for (let n = 1; n <= FOLLOW_UP_LIMIT + 2; n++) addFollowUpToHistory(SLUG, entry(1).ticketId, followUp(n), storage);

    const kept = readHistory(SLUG, storage)[0].followUps ?? [];
    expect(kept).toHaveLength(FOLLOW_UP_LIMIT);
    expect(kept[0]).toEqual(followUp(3));
  });

  it('does nothing for a report this device does not have', () => {
    const storage = new MemoryStorage();
    addToHistory(SLUG, entry(1), storage);
    expect(addFollowUpToHistory(SLUG, entry(9).ticketId, followUp(1), storage).ok).toBe(false);
    expect(readHistory(SLUG, storage)[0].followUps ?? []).toEqual([]);
  });

  it('still reads entries stored before follow-ups existed', () => {
    const storage = new MemoryStorage();
    storage.setItem(historyKey(SLUG), JSON.stringify([entry(1)]));
    expect(readHistory(SLUG, storage)).toEqual([entry(1)]);
  });
});
