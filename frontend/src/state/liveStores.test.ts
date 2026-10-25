// @vitest-environment jsdom
// A running page takes another page's saved state into its stores: the real stores, the real storage, a backend that
// holds what the other page saved. This is the phone-to-PC case with the PC page left open.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import type { BackendEvent } from '@/backend';
import { LOCAL_ONLY_KEYS, liveKeys } from './liveStores';
import { useDrafts, type DraftGroup } from './drafts';
import { useMangaFinish } from './mangaFinish';
import { useParams } from './params';
import { useImagePresets } from './presets/imagePresets';
import { usePromptBook } from './prompts/promptBook';
import { useSettings } from './settings';
import { collectUiState } from './uiStateStorage';
import { adoptBackendUiState } from './uiStateSync';

const phoneEntry = { tag: 'phone tag', meaning: 'phone', category: 'c', note: '' };
const group = (id: string): DraftGroup => ({ id, createdAt: 1, params: { positivePrompt: 'p' } as DraftGroup['params'], boardId: null, position: 0.5, candidates: [] });

/** The state of the other page: the stores are put into it, and what they wrote to the storage is the saved state. */
function phoneState(): string {
  useParams.getState().set({ positivePrompt: 'from the phone', negativePrompt: 'lowres', modelKey: 'phone-model', steps: 33, cfgScale: 4.5 });
  useParams.getState().addLora('phone-lora');
  useImagePresets.setState({ presets: [{ id: 'pr-phone', name: 'phone preset', data: {} as never }], selectedId: 'pr-phone' });
  usePromptBook.getState().add(phoneEntry);
  useDrafts.setState({ groups: [group('g-phone')], currentId: 'g-phone' });
  useMangaFinish.getState().set({ screenLines: 333 });
  return collectUiState(localStorage);
}

describe('a running page follows another page', () => {
  let remote: string;
  let emit: (e: BackendEvent) => void;
  let save: ReturnType<typeof vi.spyOn>;
  const phone = phoneState();
  // Back to a PC page that was working on something else.
  useParams.getState().set({ positivePrompt: 'on the PC', modelKey: 'pc-model', steps: 20, loras: [] });
  useImagePresets.setState({ presets: [], selectedId: null });
  usePromptBook.setState({ entries: [] });
  useDrafts.setState({ groups: [], currentId: null });
  useMangaFinish.getState().set({ screenLines: 200 });
  useSettings.getState().set({ theme: 'light' });
  const pc = collectUiState(localStorage);

  beforeAll(async () => {
    vi.useFakeTimers();
    remote = pc;
    vi.spyOn(backend, 'subscribe').mockImplementation((l) => {
      emit = l;
      return () => undefined;
    });
    vi.spyOn(backend, 'adoptUiState').mockImplementation(() => Promise.resolve(remote));
    save = vi.spyOn(backend, 'saveUiState').mockResolvedValue();
    await adoptBackendUiState(localStorage);
    await vi.advanceTimersByTimeAsync(5000);
  });
  afterAll(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows the phone\'s prompt, model, LoRAs, settings, presets, prompt book, drafts and finish values on the PC', async () => {
    expect(useParams.getState().positivePrompt).toBe('on the PC');
    // The phone's state, but its settings (theme) are its own and the PC keeps its own.
    const pcSettings = localStorage.getItem('novira.settings');
    remote = JSON.stringify({ ...JSON.parse(phone), 'novira.settings': '{"state":{"theme":"dark","language":"en"},"version":0}' });
    emit({ type: 'ui_state_changed', origin: 'page-phone', revision: 5 });
    await vi.advanceTimersByTimeAsync(300);

    const p = useParams.getState();
    expect(p).toMatchObject({ positivePrompt: 'from the phone', negativePrompt: 'lowres', modelKey: 'phone-model', steps: 33, cfgScale: 4.5 });
    expect(p.loras.map((l) => l.key)).toEqual(['phone-lora']);
    expect(useImagePresets.getState().presets.map((x) => x.name)).toEqual(['phone preset']);
    expect(useImagePresets.getState().selectedId).toBe('pr-phone');
    expect(usePromptBook.getState().entries[0]).toMatchObject({ id: expect.any(String) as string, ...phoneEntry });
    expect(useDrafts.getState().groups.map((g) => g.id)).toEqual(['g-phone']);
    expect(useDrafts.getState().currentId).toBe('g-phone');
    expect(useMangaFinish.getState().values.screenLines).toBe(333);
    // Functions of the store survive the read.
    expect(typeof useParams.getState().set).toBe('function');
    // The per-device settings are not changed from outside.
    expect(useSettings.getState().theme).toBe('light');
    expect(localStorage.getItem('novira.settings')).toBe(pcSettings);
    // Taking the phone's state is not a change of the PC's: nothing is sent back.
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
  });

  it('does not touch what the user types on the PC while the other page changes it, and sends the typed text', async () => {
    useParams.getState().set({ positivePrompt: 'typing on the PC' });
    remote = JSON.stringify({ ...JSON.parse(remote), 'novira.params': JSON.stringify({ state: { positivePrompt: 'phone again' }, version: 1 }) });
    emit({ type: 'ui_state_changed', origin: 'page-phone', revision: 6 });
    await vi.advanceTimersByTimeAsync(300);
    expect(useParams.getState().positivePrompt).toBe('typing on the PC');
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(useParams.getState().positivePrompt).toBe('typing on the PC');
  });
});

describe('which keys follow another page', () => {
  /** Every `novira.*` text the sources name outside the tests: the keys the app writes to the storage. */
  function sourceKeys(): string[] {
    const found = new Set<string>();
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name) && !/\.(test|testkit|spec)\./.test(name)) {
          for (const m of readFileSync(path, 'utf8').matchAll(/'(novira\.[A-Za-z][A-Za-z0-9.]*)'/g)) found.add(m[1]!);
        }
      }
    };
    walk(join(__dirname, '..'));
    return [...found];
  }

  it('names every saved key either as following another page or as per page', () => {
    const named = new Set([...liveKeys(), ...LOCAL_ONLY_KEYS]);
    expect(sourceKeys().filter((k) => !named.has(k))).toEqual([]);
  });

  it('never lists a key both ways, and every following key is one the sources write', () => {
    expect(liveKeys().filter((k) => LOCAL_ONLY_KEYS.includes(k))).toEqual([]);
    const sources = new Set(sourceKeys());
    expect(liveKeys().filter((k) => !sources.has(k))).toEqual([]);
  });

  it('keeps the screens\' own state per page', () => {
    for (const key of ['novira.settings', 'novira.gallery', 'novira.agent', 'novira.canvas']) expect(liveKeys()).not.toContain(key);
    for (const key of ['novira.params', 'novira.drafts', 'novira.presets', 'novira.promptBook']) expect(liveKeys()).toContain(key);
  });
});
