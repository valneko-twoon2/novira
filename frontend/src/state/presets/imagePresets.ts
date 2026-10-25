// Saved image-generation presets: a snapshot of the Generate settings (never the seed, the iteration count or the picture
// to upscale).
import { findModel } from '../models';
import { useParams, type ParamsFields, type UpscaleParams } from '../params';
import { createPresetStore, markBuiltins, pickFields, type Preset, type PresetKind } from './presetStore';
import seed from './seed/image.json';

export const PRESET_FIELDS = [
  'positivePrompt',
  'negativePrompt',
  'modelKey',
  'vaeKey',
  'vaePrecision',
  'scheduler',
  'steps',
  'cfgScale',
  'cfgRescale',
  'clipSkip',
  'width',
  'height',
  'aspectRatio',
  'seamlessX',
  'seamlessY',
  'loras',
  'strength',
  'refImages',
  'aspectLocked',
  'dynamicPromptMode',
  'maskBlur',
  'coherenceMode',
  'coherenceEdgeSize',
  'coherenceMinDenoise',
  'infillMethod',
  'infillTileSize',
  'infillColor',
  'upscale',
  'hires',
] as const satisfies readonly (keyof ParamsFields)[];

/** The Upscaling settings a preset keeps: all but the picture to enlarge, which belongs to the job. */
export type PresetUpscale = Omit<UpscaleParams, 'initialImage'>;

export type PresetData = Partial<Omit<Pick<ParamsFields, (typeof PRESET_FIELDS)[number]>, 'upscale'> & { upscale: PresetUpscale }>;

export type GenerationPreset = Preset<PresetData>;

const SEED = seed as GenerationPreset[];

export const useImagePresets = createPresetStore<PresetData>({
  name: 'novira.presets',
  seed: SEED,
  version: 3,
  migrate: (stored, version) => {
    let presets = stored.presets ?? [];
    // v2: the built-in presets are named in English; rename the stored copies of them (user presets are kept).
    if (version < 2) {
      const names = new Map(SEED.map((p) => [p.id, p.name]));
      presets = presets.map((p) => (names.has(p.id) ? { ...p, name: names.get(p.id) as string } : p));
    }
    // v3: presets carry a built-in flag (for grouping in the picker).
    if (version < 3) presets = markBuiltins(presets, SEED);
    return { presets, selectedId: stored.selectedId ?? null };
  },
});

const isBlob = (url: string | null) => !!url && (url.startsWith('data:') || url.startsWith('blob:'));

function withoutPicture({ initialImage: _picture, ...upscale }: UpscaleParams): PresetUpscale {
  return upscale;
}

/** A model key of a preset, or the current one when that model was removed since the preset was saved. */
const installedOr = (key: string | null, current: string | null) => (key && !findModel(key) ? current : key);

export function snapshotPresetData(): PresetData {
  const p = useParams.getState();
  return structuredClone({
    ...pickFields(p, PRESET_FIELDS),
    // Pasted / dropped pictures live only in this session; keep the slot but not the picture.
    refImages: p.refImages.map((r) => ({ ...r, imageUrl: isBlob(r.imageUrl) ? null : r.imageUrl })),
    upscale: withoutPicture(p.upscale),
  });
}

export function applyPresetData(data: PresetData) {
  const patch = pickFields(structuredClone(data), PRESET_FIELDS);
  // An unknown model (removed since the preset was saved) keeps the current one.
  if (patch.modelKey && !findModel(patch.modelKey)) delete patch.modelKey;
  const p = useParams.getState();
  // The models the upscale and the high-resolution fix use are checked the same way; the picture to upscale stays.
  const { upscale, hires, ...rest } = patch;
  p.set({
    ...rest,
    ...(upscale && {
      upscale: {
        ...p.upscale,
        ...upscale,
        initialImage: p.upscale.initialImage,
        upscaleModelKey: installedOr(upscale.upscaleModelKey, p.upscale.upscaleModelKey),
        tileControlnetModelKey: installedOr(upscale.tileControlnetModelKey, p.upscale.tileControlnetModelKey),
        postProcessingModelKey: installedOr(upscale.postProcessingModelKey, p.upscale.postProcessingModelKey),
      },
    }),
    ...(hires && { hires: { ...p.hires, ...hires, upscaleModelKey: installedOr(hires.upscaleModelKey, p.hires.upscaleModelKey) } }),
  });
}

export const imagePresets: PresetKind<PresetData> = {
  store: useImagePresets,
  snapshot: snapshotPresetData,
  apply: applyPresetData,
};
