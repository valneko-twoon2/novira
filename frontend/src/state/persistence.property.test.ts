// @vitest-environment jsdom
// Fuzz-style tests for the persisted stores: whatever junk browser storage holds, loading it never throws and text that
// is not a saved state leaves the defaults alone. jsdom provides the in-memory `localStorage` the stores bind to at
// import time; nothing leaves the process.
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import { junkJson, junkText, pbt, blockExternalNetwork } from '@/propertyTest.testkit';
import { useAgent } from './agent';
import { useCanvas } from './canvas';
import { useDrafts } from './drafts';
import { useGallery } from './gallery';
import { useLogo } from './media/logo';
import { useMusic } from './media/music';
import { useVideo } from './media/video';
import { useVoice } from './media/voice';
import { useParams } from './params';
import { useImagePresets } from './presets/imagePresets';
import { useLogoPresets } from './presets/logoPresets';
import { useMusicPresets } from './presets/musicPresets';
import { useTextStylePresets } from './presets/textStylePresets';
import { useVideoPresets } from './presets/videoPresets';
import { useVoicePresets } from './presets/voicePresets';
import { usePromptBook } from './prompts/promptBook';
import { useWildcards } from './prompts/wildcards';
import { useSettings } from './settings';
import { useTextEditor } from './text/textEditor';
import { newTextLayer } from './text/textModel';
import { useWorkflows } from './workflows/workflows';

blockExternalNetwork();

interface Persisted {
  getState: () => object;
  setState: (s: object, replace?: boolean) => void;
  persist: { rehydrate: () => Promise<void> | void; getOptions: () => { name?: string } };
}

const STORES: [string, Persisted][] = [
  ['agent', useAgent],
  ['canvas', useCanvas],
  ['drafts', useDrafts],
  ['gallery', useGallery],
  ['logo', useLogo],
  ['music', useMusic],
  ['video', useVideo],
  ['voice', useVoice],
  ['params', useParams],
  ['imagePresets', useImagePresets],
  ['logoPresets', useLogoPresets],
  ['musicPresets', useMusicPresets],
  ['textStylePresets', useTextStylePresets],
  ['videoPresets', useVideoPresets],
  ['voicePresets', useVoicePresets],
  ['promptBook', usePromptBook],
  ['wildcards', useWildcards],
  ['settings', useSettings],
  ['textEditor', useTextEditor],
  ['workflows', useWorkflows],
].map(([name, store]) => [name as string, store as unknown as Persisted]);

const snapshot = (s: object) => JSON.stringify(s, (_k, v: unknown) => (typeof v === 'function' ? undefined : v));
const defaults = new Map(STORES.map(([name, store]) => [name, store.getState()]));

afterEach(() => {
  localStorage.clear();
  for (const [name, store] of STORES) store.setState(defaults.get(name)!, true);
});

/** What storage can hold under a store's key: any text, or a wrapper around any JSON value. */
const stored = fc.oneof(
  junkText,
  fc.record({ state: junkJson, version: fc.integer({ min: -1, max: 3 }) }).map((v) => JSON.stringify(v)),
  junkJson.map((v) => JSON.stringify(v)),
);

describe('persisted stores load arbitrary stored text (fuzz)', () => {
  for (const [name, store] of STORES) {
    it(`${name}: rehydrate never throws and keeps its actions`, async () => {
      const key = store.persist.getOptions().name!;
      const actions = Object.entries(store.getState()).filter(([, v]) => typeof v === 'function').map(([k]) => k);
      await fc.assert(
        fc.asyncProperty(stored, async (text) => {
          localStorage.setItem(key, text);
          await store.persist.rehydrate();
          const s = store.getState() as Record<string, unknown>;
          for (const a of actions) expect(typeof s[a]).toBe('function');
        }),
        pbt(40),
      );
    });

    it(`${name}: text that is not JSON leaves the defaults alone`, async () => {
      const key = store.persist.getOptions().name!;
      const before = snapshot(store.getState());
      await fc.assert(
        fc.asyncProperty(
          junkText.filter((s) => {
            try {
              JSON.parse(s);
              return false;
            } catch {
              return true;
            }
          }),
          async (text) => {
            localStorage.setItem(key, text);
            await store.persist.rehydrate();
            expect(snapshot(store.getState())).toBe(before);
          },
        ),
        pbt(40),
      );
    });
  }

  // A field added to a form after a user saved it must start from its default for that user, not `undefined`.
  /** Saved objects that are one value, not a form: they gain no fields. */
  const VALUES: Record<string, string[]> = { canvas: ['fillColor'] };
  for (const [name, store] of STORES) {
    it(`${name}: a saved object without a field added since loads that field's default`, async () => {
      const { name: key, partialize, version } = store.persist.getOptions() as { name: string; partialize?: (s: object) => object; version?: number };
      const saved = (partialize ?? ((s: object) => s))(defaults.get(name)!) as Record<string, unknown>;
      const objects = Object.entries(saved).filter(([k, v]) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0 && !VALUES[name]?.includes(k));
      for (const [field, value] of objects) {
        const [dropped, ...kept] = Object.keys(value as object);
        const old = Object.fromEntries(kept.map((k) => [k, (value as Record<string, unknown>)[k]]));
        localStorage.setItem(key, JSON.stringify({ state: { ...saved, [field]: old }, version: version ?? 0 }));
        await store.persist.rehydrate();
        expect((store.getState() as Record<string, Record<string, unknown>>)[field]?.[dropped!], `${field}.${dropped}`).toEqual((value as Record<string, unknown>)[dropped!]);
      }
    });
  }

  it('a text scene and the settings come back unchanged after save and load', async () => {
    const text = fc.string({ maxLength: 20 });
    await fc.assert(
      fc.asyncProperty(fc.array(fc.record({ text, x: fc.integer({ min: -500, max: 3000 }), y: fc.integer({ min: -500, max: 3000 }), vertical: fc.boolean() }), { maxLength: 5 }), fc.constantFrom('dark', 'light'), fc.integer({ min: 0, max: 500 }), async (layers, theme, delay) => {
        const base = { width: 900, height: 700 };
        const scene = {
          ...base,
          background: { kind: 'color' as const, color: '#112233' },
          layers: layers.map((l, i) => {
            const layer = newTextLayer(base, l.text);
            return { ...layer, id: `l${i}`, x: l.x, y: l.y, style: { ...layer.style, vertical: l.vertical } };
          }),
        };
        useTextEditor.setState({ scene });
        useSettings.setState({ theme, mockStepDelay: delay });
        const saved = { text: localStorage.getItem('novira.text')!, settings: localStorage.getItem('novira.settings')! };
        useTextEditor.setState({ scene: { width: 1, height: 1, background: { kind: 'color', color: null }, layers: [] } });
        useSettings.setState({ theme: 'dark', mockStepDelay: 60 });
        // forget the in-memory state (this rewrites the storage too), put the saved text back and load it
        localStorage.setItem('novira.text', saved.text);
        localStorage.setItem('novira.settings', saved.settings);
        await useTextEditor.persist.rehydrate();
        await useSettings.persist.rehydrate();
        expect(useTextEditor.getState().scene).toEqual(scene);
        expect(useSettings.getState().theme).toBe(theme);
        expect(useSettings.getState().mockStepDelay).toBe(delay);
      }),
      pbt(40),
    );
  });

  it('really loads a valid saved state (so the cases above exercise the loader)', async () => {
    localStorage.setItem('novira.settings', JSON.stringify({ state: { theme: 'light' }, version: 0 }));
    await useSettings.persist.rehydrate();
    expect(useSettings.getState().theme).toBe('light');
  });

  it('covers every persisted store (the list matches the stores that write to storage)', () => {
    const keys = STORES.map(([, s]) => s.persist.getOptions().name);
    expect(new Set(keys).size).toBe(STORES.length);
    expect(keys.every((k) => k?.startsWith('novira.'))).toBe(true);
  });
});
