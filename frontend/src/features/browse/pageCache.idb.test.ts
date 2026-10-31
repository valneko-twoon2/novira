// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny in-memory IndexedDB: just the calls pageCache.ts makes (open, createObjectStore, transaction, get, getAll, put, delete).
interface Req<T> {
  result: T;
  onsuccess?: () => void;
  onerror?: () => void;
  onupgradeneeded?: () => void;
  onblocked?: () => void;
}

function settle<T>(value: T): Req<T> {
  const req = { result: value } as Req<T>;
  queueMicrotask(() => queueMicrotask(() => req.onsuccess?.()));
  return req;
}

function makeIdb(opts: { openFails?: 'error' | 'blocked' | 'throw'; getFails?: boolean } = {}) {
  const rows = new Map<string, { key: string; savedAt: number }>();
  const store = {
    get: (k: string) => {
      if (opts.getFails) {
        const r = { result: undefined } as Req<undefined>;
        queueMicrotask(() => r.onerror?.());
        return r;
      }
      return settle(rows.get(k));
    },
    getAll: () => settle([...rows.values()]),
    put: (v: { key: string; savedAt: number }) => {
      rows.set(v.key, v);
      return settle(undefined);
    },
    delete: (k: string) => {
      rows.delete(k);
      return settle(undefined);
    },
  };
  const db = { transaction: () => ({ objectStore: () => store }), createObjectStore: vi.fn() };
  const open = vi.fn(() => {
    if (opts.openFails === 'throw') throw new Error('denied');
    const req = { result: { ...db, createObjectStore: db.createObjectStore } } as Req<unknown>;
    queueMicrotask(() => {
      if (opts.openFails === 'error') return req.onerror?.();
      if (opts.openFails === 'blocked') return req.onblocked?.();
      req.onupgradeneeded?.();
      req.onsuccess?.();
    });
    return req;
  });
  return { rows, open, db };
}

async function load() {
  vi.resetModules();
  return import('./pageCache');
}

describe('pageCache with IndexedDB', () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.unstubAllGlobals());

  it('writes a page and reads it back, creating the store on first open', async () => {
    const idb = makeIdb();
    vi.stubGlobal('indexedDB', idb);
    const { readCachedPage, writeCachedPage } = await load();
    await writeCachedPage('q', { items: [], next: 'n2' }, 1000);
    expect(idb.db.createObjectStore).toHaveBeenCalledWith('first-pages', { keyPath: 'key' });
    await expect(readCachedPage('q', 2000)).resolves.toEqual({ items: [], next: 'n2' });
    expect(idb.open).toHaveBeenCalledTimes(1);
  });

  it('reads null for an unknown key, a stale page and a malformed row', async () => {
    const idb = makeIdb();
    vi.stubGlobal('indexedDB', idb);
    const { readCachedPage, writeCachedPage } = await load();
    const week = 7 * 24 * 60 * 60 * 1000;
    await writeCachedPage('old', { items: [], next: null }, 0);
    await expect(readCachedPage('missing')).resolves.toBeNull();
    await expect(readCachedPage('old', week)).resolves.toEqual({ items: [], next: null });
    await expect(readCachedPage('old', week + 1)).resolves.toBeNull();
    idb.rows.set('bad', { key: 'bad', savedAt: 1 });
    await expect(readCachedPage('bad', 2)).resolves.toBeNull();
  });

  it('keeps only the 30 newest searches', async () => {
    const idb = makeIdb();
    vi.stubGlobal('indexedDB', idb);
    const { writeCachedPage } = await load();
    for (let i = 0; i < 32; i++) await writeCachedPage(`k${i}`, { items: [], next: null }, 100 + i);
    expect(idb.rows.size).toBe(30);
    expect(idb.rows.has('k0')).toBe(false);
    expect(idb.rows.has('k1')).toBe(false);
    expect(idb.rows.has('k31')).toBe(true);
  });

  it('reads nothing when the get request fails', async () => {
    vi.stubGlobal('indexedDB', makeIdb({ getFails: true }));
    const { readCachedPage } = await load();
    await expect(readCachedPage('k')).resolves.toBeNull();
  });

  it.each(['error', 'blocked', 'throw'] as const)('reads nothing and writes without failing when open is %s', async (mode) => {
    const idb = makeIdb({ openFails: mode });
    vi.stubGlobal('indexedDB', idb);
    const { readCachedPage, writeCachedPage } = await load();
    await expect(writeCachedPage('k', { items: [], next: null })).resolves.toBeUndefined();
    await expect(readCachedPage('k')).resolves.toBeNull();
    expect(idb.rows.size).toBe(0);
  });

  it('swallows a failure while saving', async () => {
    const idb = makeIdb();
    vi.stubGlobal('indexedDB', idb);
    const { writeCachedPage } = await load();
    idb.db.transaction = () => {
      throw new Error('quota');
    };
    await expect(writeCachedPage('k', { items: [], next: null })).resolves.toBeUndefined();
  });
});
