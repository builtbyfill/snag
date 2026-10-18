// Full-size copies of the screenshots this device sent, so a report can open its screenshot at
// full size later. Screenshots are never public (only the logged-in developer can load them from
// the server), so the copy stays in this browser, like the history. IndexedDB rather than
// localStorage (a 5 MB budget) or Cache Storage (missing on plain-http LAN addresses).
// Every call swallows storage errors: in a private window the page works, just without the copy.

const DB_NAME = 'snag';
const STORE = 'screenshots';

export const screenshotKey = (slug: string, ticketId: string) => `${slug}:${ticketId}`;

/** Keys of this link's copies whose report is no longer in the history. Other links are left alone. */
export function staleScreenshotKeys(keys: string[], slug: string, keepIds: string[]): string[] {
  const keep = new Set(keepIds.map((id) => screenshotKey(slug, id)));
  return keys.filter((k) => k.startsWith(`${slug}:`) && !keep.has(k));
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  try {
    const db = await open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function saveScreenshot(slug: string, ticketId: string, image: Blob): Promise<void> {
  await withStore('readwrite', (s) => s.put(image, screenshotKey(slug, ticketId)));
}

export async function loadScreenshot(slug: string, ticketId: string): Promise<Blob | null> {
  const found = await withStore<unknown>('readonly', (s) => s.get(screenshotKey(slug, ticketId)));
  return found instanceof Blob ? found : null;
}

/** Deletes this link's copies for reports that dropped out of the history (it keeps 20). */
export async function pruneScreenshots(slug: string, keepIds: string[]): Promise<void> {
  const keys = await withStore('readonly', (s) => s.getAllKeys());
  for (const key of staleScreenshotKeys((keys ?? []).map(String), slug, keepIds)) {
    await withStore('readwrite', (s) => s.delete(key));
  }
}
