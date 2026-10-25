// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { useToasts } from './toasts';
import { applyUiState, clearSavedState, collectUiState, PERSIST_PREFIX, takeRestoredUiState } from './uiState';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useToasts.setState({ toasts: [] });
});
afterEach(() => vi.restoreAllMocks());

describe('saved screen state', () => {
  it('collects only the app keys', () => {
    localStorage.setItem('novira.settings', '{"state":{"language":"en"}}');
    localStorage.setItem('novira.characters', '[]');
    localStorage.setItem('other-site', 'x');
    expect(JSON.parse(collectUiState(localStorage))).toEqual({ 'novira.settings': '{"state":{"language":"en"}}', 'novira.characters': '[]' });
    expect(PERSIST_PREFIX).toBe('novira.');
  });

  it('clears one part of the saved state, or every app key for all, and says how many went', () => {
    for (const key of ['novira.settings', 'novira.params', 'novira.agent', 'novira.presets', 'other-site']) localStorage.setItem(key, '{}');
    expect(clearSavedState('assistant', localStorage)).toBe(1);
    expect(clearSavedState('assistant', localStorage)).toBe(0);
    expect(localStorage.getItem('novira.params')).toBe('{}');
    expect(clearSavedState('all', localStorage)).toBe(3);
    expect(Object.keys(localStorage)).toEqual(['other-site']);
  });

  it('replaces every app key and leaves other keys alone', () => {
    localStorage.setItem('novira.old', 'gone');
    localStorage.setItem('novira.settings', 'old');
    localStorage.setItem('other-site', 'kept');
    const written = applyUiState(JSON.stringify({ 'novira.settings': 'new', 'novira.drafts': '{}', foreign: 'ignored', 'novira.bad': 1 }), localStorage);
    expect(written).toBe(2);
    expect(localStorage.getItem('novira.settings')).toBe('new');
    expect(localStorage.getItem('novira.drafts')).toBe('{}');
    expect(localStorage.getItem('novira.old')).toBeNull();
    expect(localStorage.getItem('novira.bad')).toBeNull();
    expect(localStorage.getItem('foreign')).toBeNull();
    expect(localStorage.getItem('other-site')).toBe('kept');
  });

  it('changes nothing when the state is not an object', () => {
    localStorage.setItem('novira.settings', 'kept');
    expect(() => applyUiState('[]', localStorage)).toThrow();
    expect(() => applyUiState('not json', localStorage)).toThrow();
    expect(localStorage.getItem('novira.settings')).toBe('kept');
  });

  it('round-trips through collect and apply', () => {
    localStorage.setItem('novira.a', '1');
    localStorage.setItem('novira.b', '{"x":[1,2]}');
    const saved = collectUiState(localStorage);
    localStorage.clear();
    applyUiState(saved, localStorage);
    expect(collectUiState(localStorage)).toBe(saved);
  });
});

describe('takeRestoredUiState', () => {
  it('puts a restored state in place and reloads once, then reports it after the reload', async () => {
    localStorage.setItem('novira.settings', 'current');
    vi.spyOn(backend, 'takeRestoredUiState').mockResolvedValue({ state: 'restored', uiState: '{"novira.settings":"restored"}' });
    const save = vi.spyOn(backend, 'saveUiState').mockResolvedValue();
    const reload = vi.fn();
    expect(await takeRestoredUiState(localStorage, sessionStorage, reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('novira.settings')).toBe('restored');
    // The backend's own copy takes it too, or its older copy would win at the next start.
    expect(save).toHaveBeenCalledWith('{"novira.settings":"restored"}');

    vi.spyOn(backend, 'takeRestoredUiState').mockResolvedValue({ state: 'none' });
    expect(await takeRestoredUiState(localStorage, sessionStorage, reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(useToasts.getState().toasts.map((t) => t.status)).toEqual(['success']);
  });

  it('reports a failed restore and keeps the current state', async () => {
    localStorage.setItem('novira.settings', 'current');
    vi.spyOn(backend, 'takeRestoredUiState').mockResolvedValue({ state: 'failed', message: 'your data was kept' });
    const reload = vi.fn();
    expect(await takeRestoredUiState(localStorage, sessionStorage, reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(localStorage.getItem('novira.settings')).toBe('current');
    const [shown] = useToasts.getState().toasts;
    expect(shown?.status).toBe('error');
    expect(shown?.description).toBe('your data was kept');
  });

  it('does nothing without a restore', async () => {
    const reload = vi.fn();
    expect(await takeRestoredUiState(localStorage, sessionStorage, reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(useToasts.getState().toasts).toEqual([]);
  });
});
