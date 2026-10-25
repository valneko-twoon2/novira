// The first page of each search, kept on disk (IndexedDB) so the Browse tab shows the last results at once after a restart while the
// search itself runs again. Everything here is best effort: with no IndexedDB, or a failure, it reads nothing and writes nothing.
import type { CivitaiModel } from '@/backend';

export interface CachedPage {
  items: CivitaiModel[];
  next: string | null;
}

interface Entry extends CachedPage {
  key: string;
  savedAt: number;
}

const DB_NAME = 'novira-browse';
const STORE = 'first-pages';
/** Searches kept; the oldest go first. */
const MAX_ENTRIES = 30;
/** A page older than this is not shown (the model sites change). */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

let opened: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  opened ??= new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opened;
}

function done<T>(req: IDBRequest<T>): Promise<T | undefined> {
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(undefined);
  });
}

function isPage(e: unknown): e is Entry {
  const x = e as Partial<Entry> | undefined;
  return !!x && typeof x.savedAt === 'number' && Array.isArray(x.items) && (x.next === null || typeof x.next === 'string');
}

/** The saved first page of a search, or null (none, too old, or unreadable). */
export async function readCachedPage(key: string, now = Date.now()): Promise<CachedPage | null> {
  try {
    const db = await openDb();
    if (!db) return null;
    const found = await done<unknown>(db.transaction(STORE, 'readonly').objectStore(STORE).get(key));
    if (!isPage(found) || now - found.savedAt > MAX_AGE_MS) return null;
    return { items: found.items, next: found.next };
  } catch {
    return null;
  }
}

/** Saves the first page of a search, and drops the oldest searches past the limit. */
export async function writeCachedPage(key: string, page: CachedPage, now = Date.now()): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    store.put({ key, savedAt: now, items: page.items, next: page.next } satisfies Entry);
    const all = (await done<unknown[]>(store.getAll())) ?? [];
    const old = all.filter(isPage).sort((a, b) => b.savedAt - a.savedAt).slice(MAX_ENTRIES);
    for (const e of old) store.delete(e.key);
  } catch {
    // Nothing to show from this search next time; the search itself is not affected.
  }
}
