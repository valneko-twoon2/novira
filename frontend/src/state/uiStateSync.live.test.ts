// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import type { BackendEvent } from '@/backend';
import { registerRehydrate } from './rehydrate';
import { adoptBackendUiState } from './uiStateSync';
import { parseUiState } from './uiStateStorage';

/** A storage of its own, so the methods `watch` replaces are the ones of this class and no other test sees them. */
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
  [name: string]: unknown;
}

const SAVE_DELAY = 800;
const PULL_DELAY = 150;
const NEWS = 1000;

let storage: MemoryStorage;
/** What the backend holds, as the other pages left it. */
let remote: Record<string, string>;
let emit: (e: BackendEvent) => void;
let adopt: ReturnType<typeof vi.spyOn>;
let save: ReturnType<typeof vi.spyOn>;
const rehydrated: string[] = [];

const event = (origin: string, revision: number): BackendEvent => ({ type: 'ui_state_changed', origin, revision });
/** Another page saves: the backend holds the new state and tells everyone. */
const otherPageSaves = async (patch: Record<string, string | null>, revision = Date.now()) => {
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete remote[k];
    else remote[k] = v;
  }
  emit(event('page-other', revision));
  await vi.advanceTimersByTimeAsync(PULL_DELAY + 10);
};

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-24T12:00:00Z'));
  storage = new MemoryStorage();
  remote = { 'novira.a': 'a0', 'novira.b': 'b0', 'novira.local': 'l0' };
  rehydrated.length = 0;
  for (const key of ['novira.a', 'novira.b']) {
    registerRehydrate(key, () => {
      rehydrated.push(key);
      // What a store does: reads the storage and writes its state back in its own form.
      const text = storage.getItem(key);
      if (text !== null) storage.setItem(key, text);
    });
  }
  vi.spyOn(backend, 'subscribe').mockImplementation((l) => {
    emit = l;
    return () => undefined;
  });
  adopt = vi.spyOn(backend, 'adoptUiState').mockImplementation(() => Promise.resolve(JSON.stringify(remote)));
  save = vi.spyOn(backend, 'saveUiState').mockImplementation((state) => {
    remote = parseUiState(state) ?? remote;
    return Promise.resolve();
  });
  await adoptBackendUiState(storage);
  adopt.mockClear();
  // Later than any writes before this point, so that the keys are not "being typed into".
  await vi.advanceTimersByTimeAsync(5000);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('taking another page state while running', () => {
  it('writes a key another page changed into the storage and has its store read it, without sending it back', async () => {
    await otherPageSaves({ 'novira.a': 'a1' });
    expect(storage.getItem('novira.a')).toBe('a1');
    expect(rehydrated).toEqual(['novira.a']);
    // The store's own write while reading is not a change of this page: nothing goes out.
    await vi.advanceTimersByTimeAsync(SAVE_DELAY * 3);
    expect(save).not.toHaveBeenCalled();
  });

  it('is not moved by its own saves coming back as events, and does not read the backend for them', async () => {
    storage.setItem('novira.a', 'mine');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 50);
    expect(save).toHaveBeenCalledTimes(1);
    const origin = save.mock.calls[0]![1] as string;
    expect(origin).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    adopt.mockClear();
    emit(event(origin, NEWS));
    await vi.advanceTimersByTimeAsync(PULL_DELAY + 10);
    expect(adopt).not.toHaveBeenCalled();
    expect(rehydrated).toEqual([]);
  });

  it('settles after one round when two pages change different keys', async () => {
    await otherPageSaves({ 'novira.a': 'a1' });
    storage.setItem('novira.b', 'b1');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 50);
    expect(save).toHaveBeenCalledTimes(1);
    expect(remote).toMatchObject({ 'novira.a': 'a1', 'novira.b': 'b1' });
    // The backend now holds this page state; a late echo of the other page save changes nothing.
    rehydrated.length = 0;
    emit(event('page-other', NEWS * 2));
    await vi.advanceTimersByTimeAsync(PULL_DELAY + 10);
    expect(rehydrated).toEqual([]);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY * 3);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does not change a key that no store takes', async () => {
    await otherPageSaves({ 'novira.local': 'l1' });
    expect(storage.getItem('novira.local')).toBe('l0');
    expect(rehydrated).toEqual([]);
  });

  it('keeps what this page changed when the same key changed elsewhere, and sends it', async () => {
    storage.setItem('novira.a', 'typed here');
    remote['novira.a'] = 'typed there';
    emit(event('page-other', NEWS));
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 50);
    expect(storage.getItem('novira.a')).toBe('typed here');
    expect(rehydrated).toEqual([]);
    expect(remote['novira.a']).toBe('typed here');
  });

  it('takes the other page news before sending, so that its keys are not overwritten with old ones', async () => {
    storage.setItem('novira.b', 'b1');
    // The other page saved a moment ago, and its event has not reached this page yet.
    remote['novira.a'] = 'a1';
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 50);
    expect(save).toHaveBeenCalledTimes(1);
    expect(parseUiState(save.mock.calls[0]![0] as string)).toMatchObject({ 'novira.a': 'a1', 'novira.b': 'b1' });
    expect(storage.getItem('novira.a')).toBe('a1');
    expect(rehydrated).toEqual(['novira.a']);
  });

  it('waits while the key is being typed into, then takes the other page text', async () => {
    storage.setItem('novira.a', 'a0');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 50);
    save.mockClear();
    remote['novira.a'] = 'a1';
    emit(event('page-other', NEWS));
    await vi.advanceTimersByTimeAsync(PULL_DELAY + 10);
    // Written a moment ago by this page: held back for now.
    expect(storage.getItem('novira.a')).toBe('a0');
    await vi.advanceTimersByTimeAsync(3000);
    expect(storage.getItem('novira.a')).toBe('a1');
    expect(rehydrated).toEqual(['novira.a']);
    expect(save).not.toHaveBeenCalled();
  });

  it('removes a key the other page dropped', async () => {
    await otherPageSaves({ 'novira.b': null });
    expect(storage.getItem('novira.b')).toBeNull();
    expect(rehydrated).toEqual(['novira.b']);
  });

  it('reads once for a burst of events', async () => {
    emit(event('page-other', NEWS));
    emit(event('page-other', NEWS + 1));
    emit(event('page-other', NEWS + 2));
    await vi.advanceTimersByTimeAsync(PULL_DELAY + 10);
    expect(adopt).toHaveBeenCalledTimes(1);
  });

  it('ignores an event it has seen, and events whose fields are not what the backend sends', async () => {
    emit(event('page-other', NEWS));
    await vi.advanceTimersByTimeAsync(PULL_DELAY + 10);
    adopt.mockClear();
    emit(event('page-other', NEWS));
    emit(event('page-other', NEWS - 1));
    const bad = [
      { type: 'ui_state_changed', origin: 5, revision: NEWS * 9 },
      { type: 'ui_state_changed', origin: 'page x<script>', revision: NEWS * 9 },
      { type: 'ui_state_changed', origin: 'p'.repeat(65), revision: NEWS * 9 },
      { type: 'ui_state_changed', origin: 'page-other', revision: '9999' },
      { type: 'ui_state_changed', origin: 'page-other', revision: Number.NaN },
      { type: 'ui_state_changed', origin: 'page-other' },
    ];
    for (const e of bad) emit(e as unknown as BackendEvent);
    await vi.advanceTimersByTimeAsync(PULL_DELAY + 10);
    expect(adopt).not.toHaveBeenCalled();
  });

  it('ignores a state that is not an object of novira.* texts, and one that cannot be read', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let revision = NEWS;
    for (const bad of ['[1]', 'nope', '{"other":"x"}', '{"novira.a":5}', 'null']) {
      adopt.mockResolvedValueOnce(bad);
      emit(event('page-other', revision++));
      await vi.advanceTimersByTimeAsync(PULL_DELAY + 10);
    }
    adopt.mockRejectedValueOnce(new Error('down'));
    emit(event('page-other', revision));
    await vi.advanceTimersByTimeAsync(PULL_DELAY + 10);
    expect(storage.getItem('novira.a')).toBe('a0');
    expect(rehydrated).toEqual([]);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('reads again when the page comes back on screen and when the event socket was reopened', async () => {
    remote['novira.a'] = 'a1';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(PULL_DELAY + 10);
    expect(storage.getItem('novira.a')).toBe('a1');
    remote['novira.a'] = 'a2';
    emit({ type: 'queue_cleared' });
    await vi.advanceTimersByTimeAsync(PULL_DELAY + 10);
    expect(storage.getItem('novira.a')).toBe('a2');
  });

  it('keeps going after one store fails to read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    registerRehydrate('novira.a', () => {
      throw new Error('broken store');
    });
    await otherPageSaves({ 'novira.a': 'a1', 'novira.b': 'b1' });
    expect(rehydrated).toEqual(['novira.b']);
    expect(storage.getItem('novira.b')).toBe('b1');
  });
});

describe('the state read from the backend', () => {
  it('parseUiState takes only an object of novira.* keys with texts of a limited size', () => {
    expect(parseUiState('{"novira.a":"1"}')).toEqual({ 'novira.a': '1' });
    expect(parseUiState('{}')).toEqual({});
    for (const bad of ['[]', '1', 'x', '{"a":"1"}', '{"novira.a":1}', `{"novira.${'k'.repeat(200)}":"1"}`]) {
      expect(parseUiState(bad), bad).toBeNull();
    }
  });
});
