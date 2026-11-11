// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { adoptBackendUiState } from './uiStateSync';
import { collectUiState } from './uiStateStorage';

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

const DELAY = 800;
let storage: MemoryStorage;
beforeEach(() => {
  vi.useFakeTimers();
  storage = new MemoryStorage();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('adopting the backend state at start-up', () => {
  it('hands over the page\'s own state the first time, and keeps it when the backend had none', { tags: ['condition'] }, async () => {
    storage.setItem('novira.settings', 'mine');
    storage.setItem('other-site', 'x');
    const adopt = vi.spyOn(backend, 'adoptUiState').mockResolvedValue(null);
    await adoptBackendUiState(storage);
    expect(adopt).toHaveBeenCalledWith('{"novira.settings":"mine"}');
    expect(storage.getItem('novira.settings')).toBe('mine');
    // From then on the page says it has synced before.
    await adoptBackendUiState(storage);
    expect(adopt).toHaveBeenLastCalledWith(null);
  });

  it('takes the backend state in place of the page\'s and leaves other keys alone', { tags: ['condition'] }, async () => {
    storage.setItem('novira.settings', 'mine');
    storage.setItem('novira.old', 'gone');
    storage.setItem('other-site', 'kept');
    vi.spyOn(backend, 'adoptUiState').mockResolvedValue('{"novira.settings":"theirs","novira.drafts":"d"}');
    await adoptBackendUiState(storage);
    expect(storage.getItem('novira.settings')).toBe('theirs');
    expect(storage.getItem('novira.drafts')).toBe('d');
    expect(storage.getItem('novira.old')).toBeNull();
    expect(storage.getItem('other-site')).toBe('kept');
  });

  it('keeps the saved keys of a store that is gone, so a state from an older version loads as it is', { tags: ['condition'] }, async () => {
    const old = { 'novira.logo': '{"state":{"form":{"text":"NOVA"}},"version":1}', 'novira.logoPresets': '{"state":{"presets":[]},"version":0}', 'novira.settings': 'mine' };
    vi.spyOn(backend, 'adoptUiState').mockResolvedValue(JSON.stringify(old));
    const save = vi.spyOn(backend, 'saveUiState').mockResolvedValue();
    await adoptBackendUiState(storage);
    for (const [key, value] of Object.entries(old)) expect(storage.getItem(key)).toBe(value);
    await vi.advanceTimersByTimeAsync(DELAY * 3);
    expect(save).not.toHaveBeenCalled();
  });

  it('leaves the storage alone and sends nothing when the backend cannot be read', { tags: ['error-guessing'] }, async () => {
    storage.setItem('novira.settings', 'mine');
    vi.spyOn(backend, 'adoptUiState').mockRejectedValue(new Error('locked'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const save = vi.spyOn(backend, 'saveUiState').mockResolvedValue();
    await adoptBackendUiState(storage);
    storage.setItem('novira.settings', 'changed');
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(save).not.toHaveBeenCalled();
    expect(storage.getItem('novira.settings')).toBe('changed');
  });
});

describe('sending changes to the backend', () => {
  beforeEach(() => {
    vi.spyOn(backend, 'adoptUiState').mockResolvedValue(null);
  });

  it('sends only the keys that changed, once after the changes settle, for app keys only', { tags: ['condition'] }, async () => {
    const save = vi.spyOn(backend, 'saveUiState').mockResolvedValue();
    await adoptBackendUiState(storage);
    storage.setItem('other-site', 'x');
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(save).not.toHaveBeenCalled();

    storage.setItem('novira.a', '1');
    await vi.advanceTimersByTimeAsync(DELAY / 2);
    storage.setItem('novira.b', '2');
    await vi.advanceTimersByTimeAsync(DELAY / 2);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(save).toHaveBeenCalledTimes(1);
    expect(JSON.parse(save.mock.calls[0]![0])).toEqual({ 'novira.a': '1', 'novira.b': '2' });
    expect(save.mock.calls[0]![2]).toEqual([]);

    // A key that is gone goes in `removed`; the keys that did not change are not sent again.
    storage.removeItem('novira.a');
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(JSON.parse(save.mock.calls[1]![0])).toEqual({});
    expect(save.mock.calls[1]![2]).toEqual(['novira.a']);
    storage.clear();
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(save.mock.calls[2]![0]).toBe('{}');
    expect(save.mock.calls[2]![2]).toEqual(['novira.b']);
  });

  it('does not send a state that did not change, and sends it again after a failure', { tags: ['error-guessing'] }, async () => {
    const save = vi.spyOn(backend, 'saveUiState').mockRejectedValueOnce(new Error('busy')).mockResolvedValue();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await adoptBackendUiState(storage);
    storage.setItem('novira.a', '1');
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(save).toHaveBeenCalledTimes(1);
    // The same text written again is not a change; after the failed send the next write sends it.
    storage.setItem('novira.a', '1');
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(save).toHaveBeenCalledTimes(2);
    storage.setItem('novira.a', '1');
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('sends a small change as a small message and reads nothing from the backend when no other page saved', { tags: ['condition'] }, async () => {
    // A used PC holds hundreds of kilobytes (drafts, chats, the prompt book): a click must not move them twice.
    const drafts = 'd'.repeat(100_000);
    storage.setItem('novira.drafts', drafts);
    const adopt = vi.spyOn(backend, 'adoptUiState').mockResolvedValue(collectUiState(storage));
    const save = vi.spyOn(backend, 'saveUiState').mockResolvedValue();
    await adoptBackendUiState(storage);
    adopt.mockClear();
    storage.setItem('novira.settings', 'changed');
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(adopt).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0]).toBe('{"novira.settings":"changed"}');
    expect(save.mock.calls[0]![2]).toEqual([]);
  });

  it('reads what other pages saved before it sends, when the page woke up and may have missed their events', { tags: ['condition'] }, async () => {
    const adopt = vi.spyOn(backend, 'adoptUiState').mockResolvedValue('{"novira.a":"1"}');
    const save = vi.spyOn(backend, 'saveUiState').mockResolvedValue();
    await adoptBackendUiState(storage);
    adopt.mockClear();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    storage.setItem('novira.b', '2');
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(adopt).toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
    expect(JSON.parse(save.mock.calls[0]![0])).toEqual({ 'novira.b': '2' });
  });

  it('sends at once when the page is hidden', { tags: ['condition'] }, async () => {
    const save = vi.spyOn(backend, 'saveUiState').mockResolvedValue();
    await adoptBackendUiState(storage);
    storage.setItem('novira.a', '1');
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(save).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });
});
