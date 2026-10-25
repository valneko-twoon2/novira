// Saved music presets: style tags and the musical settings; the lyrics and the seed belong to each song.
import { useMusic, type MusicForm } from '../media/music';
import { createPresetStore, pickFields, type Preset, type PresetKind } from './presetStore';
import seed from './seed/music.json';

export const MUSIC_PRESET_FIELDS = [
  'tags',
  'instrumental',
  'language',
  'seconds',
  'bpm',
  'key',
  'timeSignature',
  'steps',
  'cfgScale',
] as const satisfies readonly (keyof MusicForm)[];

export type MusicPresetData = Partial<Pick<MusicForm, (typeof MUSIC_PRESET_FIELDS)[number]>>;

export const useMusicPresets = createPresetStore<MusicPresetData>({ name: 'novira.musicPresets', seed: seed as Preset<MusicPresetData>[] });

export const musicPresets: PresetKind<MusicPresetData> = {
  store: useMusicPresets,
  snapshot: () => pickFields(useMusic.getState().form, MUSIC_PRESET_FIELDS),
  apply: (data) => useMusic.getState().setForm(pickFields(data, MUSIC_PRESET_FIELDS)),
};
