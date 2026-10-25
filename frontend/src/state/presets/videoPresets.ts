// Saved video presets: the video form without its seed and source picture.
import { useVideo, type VideoForm } from '../media/video';
import { findModel } from '../models';
import { createPresetStore, pickFields, type Preset, type PresetKind } from './presetStore';
import seed from './seed/video.json';

export const VIDEO_PRESET_FIELDS = [
  'mode',
  'model',
  'modelKey',
  'positivePrompt',
  'negativePrompt',
  'width',
  'height',
  'seconds',
  'fps',
  'steps',
  'cfgScale',
  'fp8',
  'tiledDecode',
] as const satisfies readonly (keyof VideoForm)[];

export type VideoPresetData = Partial<Pick<VideoForm, (typeof VIDEO_PRESET_FIELDS)[number]>>;

export const useVideoPresets = createPresetStore<VideoPresetData>({ name: 'novira.videoPresets', seed: seed as Preset<VideoPresetData>[] });

export const videoPresets: PresetKind<VideoPresetData> = {
  store: useVideoPresets,
  snapshot: () => pickFields(useVideo.getState().form, VIDEO_PRESET_FIELDS),
  apply: (data) => {
    const patch = pickFields(data, VIDEO_PRESET_FIELDS);
    // An installed model removed since the preset was saved keeps the current choice.
    if (patch.modelKey && !findModel(patch.modelKey)) delete patch.modelKey;
    useVideo.getState().setForm(patch);
  },
};
