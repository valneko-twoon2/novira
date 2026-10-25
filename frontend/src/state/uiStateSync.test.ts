// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { adoptBackendUiState } from './uiStateSync';

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
  it('hands over the page\'s own state the first time, and keeps it when the backend had none', async () => {
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

  it('takes the backend state in place of the page\'s and leaves other keys alone', async () => {
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

  it('leaves the storage alone and sends nothing when the backend cannot be read', async () => {
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

  it('sends the whole state once after the changes settle, for app keys only', async () => {
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

    storage.removeItem('novira.a');
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(JSON.parse(save.mock.calls[1]![0])).toEqual({ 'novira.b': '2' });
    storage.clear();
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(save.mock.calls[2]![0]).toBe('{}');
  });

  it('does not send a state that did not change, and sends it again after a failure', async () => {
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

  it('sends at once when the page is hidden', async () => {
    const save = vi.spyOn(backend, 'saveUiState').mockResolvedValue();
    await adoptBackendUiState(storage);
    storage.setItem('novira.a', '1');
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(save).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });
});
