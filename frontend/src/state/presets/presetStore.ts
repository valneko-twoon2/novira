// Generic saved-settings presets: one persisted store per kind (image, video, music, voice, text style), and the
// save / apply / overwrite operations that tie a store to the form it snapshots.
import { create, type Mutate, type StoreApi, type UseBoundStore } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Preset<D> {
  id: string;
  name: string;
  data: D;
  /** Shipped with the app; cleared once the user renames or overwrites it. */
  builtin?: boolean;
}

export interface PresetState<D> {
  presets: Preset<D>[];
  /** The preset last applied or saved, shown on the picker's card. */
  selectedId: string | null;
  select: (id: string | null) => void;
  add: (name: string, data: D) => string;
  /** Replaces the settings. */
  overwrite: (id: string, data: D) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
}

export type PresetStore<D> = UseBoundStore<Mutate<StoreApi<PresetState<D>>, [['zustand/persist', Pick<PresetState<D>, 'presets' | 'selectedId'>]]>>;

export interface PresetStoreOptions<D> {
  /** localStorage key. */
  name: string;
  /** Built-in presets a fresh install starts with. */
  seed: Preset<D>[];
  version?: number;
  /** Upgrades a stored state written by an older `version`. */
  migrate?: (stored: { presets?: Preset<D>[]; selectedId?: string | null }, version: number) => { presets: Preset<D>[]; selectedId?: string | null };
}

let seq = 0;
const newId = () => `preset-${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function createPresetStore<D>({ name, seed, version = 1, migrate }: PresetStoreOptions<D>): PresetStore<D> {
  const map = (get: () => PresetState<D>, id: string, f: (p: Preset<D>) => Preset<D>) => get().presets.map((p) => (p.id === id ? f(p) : p));
  return create<PresetState<D>>()(
    persist(
      (set, get) => ({
        presets: seed.map((p) => ({ ...p, builtin: true })),
        selectedId: null,
        select: (selectedId) => set({ selectedId }),
        add: (presetName, data) => {
          const id = newId();
          set({ presets: [...get().presets, { id, name: presetName, data }], selectedId: id });
          return id;
        },
        overwrite: (id, data) => set({ presets: map(get, id, (p) => ({ ...p, data, builtin: false })) }),
        rename: (id, presetName) => set({ presets: map(get, id, (p) => ({ ...p, name: presetName, builtin: false })) }),
        remove: (id) => set({ presets: get().presets.filter((p) => p.id !== id), selectedId: get().selectedId === id ? null : get().selectedId }),
      }),
      {
        name,
        version,
        partialize: (s) => ({ presets: s.presets, selectedId: s.selectedId }),
        migrate: migrate ? (stored, v) => migrate(stored as { presets?: Preset<D>[] }, v) as unknown as PresetState<D> : undefined,
      },
    ),
  );
}

/** Binds a preset store to the settings it saves. */
export interface PresetKind<D> {
  store: PresetStore<D>;
  /** The current settings, as a preset saved now would hold them. */
  snapshot: () => D;
  /** Puts saved settings back. Fields a preset does not hold are left as they are. */
  apply: (data: D) => void;
}

export function savePreset<D>(kind: PresetKind<D>, name: string): string {
  return kind.store.getState().add(name, kind.snapshot());
}

export function overwritePreset<D>(kind: PresetKind<D>, id: string): void {
  kind.store.getState().overwrite(id, kind.snapshot());
}

/** Applies a preset and marks it as the current one; false when it no longer exists. */
export function applyPreset<D>(kind: PresetKind<D>, id: string): boolean {
  const preset = kind.store.getState().presets.find((p) => p.id === id);
  if (!preset) return false;
  kind.apply(structuredClone(preset.data));
  kind.store.getState().select(id);
  return true;
}

/** Copies the listed fields that are present in `data` (a preset never writes a field it does not own). */
export function pickFields<T extends object, K extends keyof T>(data: Partial<T>, fields: readonly K[]): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const key of fields) if (data[key] !== undefined) out[key] = data[key];
  return out;
}

/**
 * Marks the stored copies of built-in presets: built-in when still named and set as shipped. Used by migrations of
 * stores written before presets carried the flag.
 */
export function markBuiltins<D>(presets: Preset<D>[], seed: Preset<D>[]): Preset<D>[] {
  const byId = new Map(seed.map((p) => [p.id, p]));
  return presets.map((p) => {
    const s = byId.get(p.id);
    return { ...p, builtin: !!s && s.name === p.name && JSON.stringify(s.data) === JSON.stringify(p.data) };
  });
}
