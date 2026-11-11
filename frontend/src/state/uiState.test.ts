// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { useToasts } from './toasts';
import { memoryStorage } from '@/propertyTest.testkit';
import { applyUiState, clearSavedState, collectUiState, PERSIST_PREFIX, takeRestoredUiState } from './uiState';
import { MAX_UI_STATE_CHARS, readUiState } from './uiStateStorage';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useToasts.setState({ toasts: [] });
});
afterEach(() => vi.restoreAllMocks());

describe('saved screen state', () => {
  it('collects only the app keys', { tags: ['condition'] }, () => {
    localStorage.setItem('novira.settings', '{"state":{"language":"en"}}');
    localStorage.setItem('novira.characters', '[]');
    localStorage.setItem('other-site', 'x');
    expect(JSON.parse(collectUiState(localStorage))).toEqual({ 'novira.settings': '{"state":{"language":"en"}}', 'novira.characters': '[]' });
    expect(PERSIST_PREFIX).toBe('novira.');
  });

  it('clears one part of the saved state, or every app key for all, and says how many went', { tags: ['equivalence'] }, () => {
    for (const key of ['novira.settings', 'novira.params', 'novira.agent', 'novira.presets', 'other-site']) localStorage.setItem(key, '{}');
    expect(clearSavedState('assistant', localStorage)).toBe(1);
    expect(clearSavedState('assistant', localStorage)).toBe(0);
    expect(localStorage.getItem('novira.params')).toBe('{}');
    expect(clearSavedState('all', localStorage)).toBe(3);
    expect(Object.keys(localStorage)).toEqual(['other-site']);
  });

  it('replaces every app key and leaves other keys alone', { tags: ['equivalence'] }, () => {
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

  it('changes nothing when the state is not an object', { tags: ['error-guessing'] }, () => {
    localStorage.setItem('novira.settings', 'kept');
    expect(() => applyUiState('[]', localStorage)).toThrow();
    expect(() => applyUiState('not json', localStorage)).toThrow();
    expect(localStorage.getItem('novira.settings')).toBe('kept');
  });

  it('round-trips through collect and apply', { tags: ['scenario'] }, () => {
    localStorage.setItem('novira.a', '1');
    localStorage.setItem('novira.b', '{"x":[1,2]}');
    const saved = collectUiState(localStorage);
    localStorage.clear();
    applyUiState(saved, localStorage);
    expect(collectUiState(localStorage)).toBe(saved);
  });
});

describe('reading the saved state without JSON', () => {
  it('reads the app keys and refuses a key longer than the backend takes', { tags: ['error-guessing'] }, () => {
    expect(readUiState(memoryStorage({ 'novira.a': '1', 'novira.b': '"x"', other: 'y' }))).toEqual({ 'novira.a': '1', 'novira.b': '"x"' });
    expect(readUiState(memoryStorage({ [`novira.${'k'.repeat(193)}`]: '1' }))).toEqual({ [`novira.${'k'.repeat(193)}`]: '1' });
    expect(readUiState(memoryStorage({ [`novira.${'k'.repeat(194)}`]: '1' }))).toBeNull();
  });

  it('measures a state near the size limit as JSON: under it is read, over it (escapes counted) is refused', { tags: ['error-guessing'] }, () => {
    // Six million plain characters could be over the limit if every one were escaped; written out they are not.
    const plain = 'a'.repeat(6_000_000);
    expect(readUiState(memoryStorage({ 'novira.big': plain }))?.['novira.big']).toBe(plain);
    // The same count of control characters is six times as long as JSON: over the limit, as the backend would say.
    const escaped = '\u0001'.repeat(6_000_000);
    expect(collectUiState(memoryStorage({ 'novira.big': escaped })).length).toBeGreaterThan(MAX_UI_STATE_CHARS);
    expect(readUiState(memoryStorage({ 'novira.big': escaped }))).toBeNull();
  });
});

describe('takeRestoredUiState', () => {
  it('puts a restored state in place and reloads once, then reports it after the reload', { tags: ['scenario'] }, async () => {
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

  it('reports a failed restore and keeps the current state', { tags: ['error-guessing'] }, async () => {
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

  it('does nothing without a restore', { tags: ['scenario'] }, async () => {
    const reload = vi.fn();
    expect(await takeRestoredUiState(localStorage, sessionStorage, reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(useToasts.getState().toasts).toEqual([]);
  });
});
