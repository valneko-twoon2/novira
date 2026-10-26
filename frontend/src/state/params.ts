// Generation parameters edited in the left panel (shared by Generate, Canvas, Upscaling), kept across starts.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ClipVisionModel,
  GenerationMetadata,
  HiresFix,
  ImageDTO,
  LoRAParam,
  RefImageInput,
  RefImageMethod,
  SchedulerName,
} from '@/backend';
import { randomSeed } from '@/backend';
import { useGallery } from './gallery';
import { useModels } from './models';
import { recalledModel, recalledModelKey, type RecalledModel } from './recallModel';

export type AspectRatioId =
  'free' | '21:9' | '16:9' | '3:2' | '4:3' | '1:1' | '3:4' | '2:3' | '9:16' | '9:21';

export const ASPECT_RATIOS: { id: AspectRatioId; value: number | null }[] = [
  { id: 'free', value: null },
  { id: '21:9', value: 21 / 9 },
  { id: '16:9', value: 16 / 9 },
  { id: '3:2', value: 3 / 2 },
  { id: '4:3', value: 4 / 3 },
  { id: '1:1', value: 1 },
  { id: '3:4', value: 3 / 4 },
  { id: '2:3', value: 2 / 3 },
  { id: '9:16', value: 9 / 16 },
  { id: '9:21', value: 9 / 21 },
];

export type { RefImageMethod };

/** Global reference image (IP-Adapter) shown under the prompt. */
export interface RefImage {
  id: string;
  isEnabled: boolean;
  imageName: string | null;
  imageUrl: string | null;
  modelKey: string | null;
  weight: number;
  beginEnd: [number, number];
  method: RefImageMethod;
  clipVisionModel: ClipVisionModel;
}

export interface UpscaleParams {
  initialImage: ImageDTO | null;
  upscaleModelKey: string | null;
  scale: 2 | 4 | 8;
  creativity: number;
  structure: number;
  tileControlnetModelKey: string | null;
  postProcessingModelKey: string | null;
}

/** The high-resolution fix of the Generate tab (a second pass that enlarges the picture and draws it again). */
export interface HiresParams {
  enabled: boolean;
  /** Enlargement of the first pass. */
  scale: number;
  /** Denoise of the second pass. */
  strength: number;
  /** An installed upscale model enlarges first; null = smooth (a plain resize, no model). */
  upscaleModelKey: string | null;
  /** Steps of the second pass; 0 = as many as the first pass. */
  steps: number;
}

/** The ranges and defaults the form offers. */
export const HIRES_RANGE = {
  scale: { min: 1.25, max: 2, step: 0.05, default: 1.5 },
  strength: { min: 0.2, max: 0.75, step: 0.05, default: 0.45 },
  steps: { min: 0, max: 100, default: 0 },
} as const;

export const DEFAULT_HIRES: HiresParams = {
  enabled: false,
  scale: HIRES_RANGE.scale.default,
  strength: HIRES_RANGE.strength.default,
  upscaleModelKey: null,
  steps: HIRES_RANGE.steps.default,
};

/** How {a|b} groups and __wildcards__ become prompts: every combination, or one prompt per picture picked at random. */
export type DynamicPromptMode = 'combinatorial' | 'random';

export type CoherenceMode = 'Gaussian Blur' | 'Box Blur' | 'Staged';
export type InfillMethod = 'patchmatch' | 'lama' | 'cv2' | 'color' | 'tile';

export interface ParamsState {
  positivePrompt: string;
  negativePrompt: string;
  modelKey: string | null;
  vaeKey: string | null;
  vaePrecision: 'fp16' | 'fp32';
  scheduler: SchedulerName;
  steps: number;
  cfgScale: number;
  cfgRescale: number;
  clipSkip: number;
  seed: number;
  shouldRandomizeSeed: boolean;
  width: number;
  height: number;
  aspectRatio: AspectRatioId;
  aspectLocked: boolean;
  seamlessX: boolean;
  seamlessY: boolean;
  loras: LoRAParam[];
  iterations: number;
  dynamicPromptMode: DynamicPromptMode;
  /** Denoising strength for img2img / canvas. */
  strength: number;
  refImages: RefImage[];
  // Compositing (canvas)
  maskBlur: number;
  coherenceMode: CoherenceMode;
  coherenceEdgeSize: number;
  coherenceMinDenoise: number;
  infillMethod: InfillMethod;
  infillTileSize: number;
  infillColor: string;
  upscale: UpscaleParams;
  hires: HiresParams;

  set: (patch: Partial<ParamsFields>) => void;
  setUpscale: (patch: Partial<UpscaleParams>) => void;
  setHires: (patch: Partial<HiresParams>) => void;
  setDimension: (axis: 'width' | 'height', value: number) => void;
  setAspectRatio: (id: AspectRatioId) => void;
  swapDimensions: () => void;
  optimizeSize: (base: number) => void;
  addLora: (key: string) => void;
  updateLora: (key: string, patch: Partial<LoRAParam>) => void;
  removeLora: (key: string) => void;
  addRefImage: (init?: Partial<RefImage>) => string;
  updateRefImage: (id: string, patch: Partial<RefImage>) => void;
  removeRefImage: (id: string) => void;
  /**
   * "Use All" — recall every parameter stored in the metadata. The model is found by its key, else by its name
   * (`recalledModel`); when neither finds an installed one the current model stays. Says which way it went.
   */
  recallAll: (m: GenerationMetadata) => RecalledModel;
  recallPrompts: (m: GenerationMetadata) => void;
  recallSeed: (seed: number) => void;
  recallSize: (width: number, height: number) => void;
  /** "Remix" — recall everything except the seed. */
  remix: (m: GenerationMetadata) => RecalledModel;
}

export type ParamsFields = Omit<
  ParamsState,
  | 'set'
  | 'setUpscale'
  | 'setHires'
  | 'setDimension'
  | 'setAspectRatio'
  | 'swapDimensions'
  | 'optimizeSize'
  | 'addLora'
  | 'updateLora'
  | 'removeLora'
  | 'addRefImage'
  | 'updateRefImage'
  | 'removeRefImage'
  | 'recallAll'
  | 'recallPrompts'
  | 'recallSeed'
  | 'recallSize'
  | 'remix'
>;

const roundTo8 = (v: number) => (Number.isFinite(v) ? Math.max(64, Math.round(v / 8) * 8) : 64);

/**
 * The sizes 1024-class models (SDXL and the families after it) were trained on, wide ones; each also stands upright.
 * A model of another base takes them scaled (512 for SD 1.5), in steps of 8.
 */
const TRAINED_SIZES: readonly (readonly [number, number])[] = [
  [1024, 1024],
  [1152, 896],
  [1216, 832],
  [1344, 768],
  [1536, 640],
];

/** The trained size nearest in shape to `width` × `height`, for a model whose base side is `base`. */
export function trainedSize(
  width: number,
  height: number,
  base: number,
): { width: number; height: number } {
  const ratio = width / height;
  const scale = base / 1024;
  const scaled = (v: number) => roundTo8(v * scale);
  const sizes = TRAINED_SIZES.flatMap(([w, h]): (readonly [number, number])[] => [
    [w, h],
    [h, w],
  ]);
  const [w, h] = sizes.reduce((best, s) =>
    Math.abs(Math.log(s[0] / s[1] / ratio)) < Math.abs(Math.log(best[0] / best[1] / ratio))
      ? s
      : best,
  );
  return { width: scaled(w), height: scaled(h) };
}
let refSeq = 1;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** `defaults` with each field `stored` holds in the same kind (storage may hold anything). A null default takes text or null. */
function pickStored<T extends object>(defaults: T, stored: unknown): T {
  if (!isRecord(stored)) return defaults;
  const out = { ...defaults } as Record<string, unknown>;
  for (const [k, d] of Object.entries(defaults)) {
    if (typeof d === 'function' || !(k in stored)) continue;
    const s = stored[k];
    if (d === null) {
      if (s === null || typeof s === 'string') out[k] = s;
    } else if (Array.isArray(d)) {
      if (Array.isArray(s) && s.length === d.length && s.every((x, i) => typeof x === typeof d[i]))
        out[k] = s;
    } else if (isRecord(d)) {
      out[k] = pickStored(d, s);
    } else if (typeof s === typeof d && (typeof s !== 'number' || Number.isFinite(s))) {
      out[k] = s;
    }
  }
  return out as T;
}

const LORA_DEFAULT: LoRAParam = { key: '', weight: 0.75, isEnabled: true };
const REF_DEFAULT: RefImage = {
  id: '',
  isEnabled: true,
  imageName: null,
  imageUrl: null,
  modelKey: null,
  weight: 1,
  beginEnd: [0, 1],
  method: 'full',
  clipVisionModel: 'ViT-H',
};

/** The form as it was left (every setting is kept across starts), from what storage holds; anything unreadable stays at `current`. */
export function restoreParams(stored: unknown, current: ParamsState): ParamsState {
  if (!isRecord(stored)) return current;
  const out = pickStored(current, stored);
  const list = (v: unknown) => (Array.isArray(v) ? v.filter(isRecord) : []);
  out.loras = Array.isArray(stored.loras)
    ? list(stored.loras)
        .filter((l) => typeof l.key === 'string')
        .map((l) => pickStored(LORA_DEFAULT, l))
    : current.loras;
  out.refImages = Array.isArray(stored.refImages)
    ? list(stored.refImages)
        .filter((r) => typeof r.id === 'string')
        .map((r) => pickStored(REF_DEFAULT, r))
    : current.refImages;
  const image = isRecord(stored.upscale) ? stored.upscale.initialImage : undefined;
  const isImage =
    isRecord(image) && typeof image.name === 'string' && typeof image.url === 'string';
  out.upscale = {
    ...out.upscale,
    initialImage: isImage ? (image as unknown as ImageDTO) : current.upscale.initialImage,
  };
  // New reference images must not take an id a restored one has.
  for (const r of out.refImages)
    refSeq = Math.max(refSeq, Number(/^ref-(\d+)$/.exec(r.id)?.[1] ?? 0) + 1);
  return out;
}

/** Prompts saved in place of the boxes' text while another screen borrows the boxes (the comic screen); null otherwise. */
let savedPrompts: Pick<ParamsState, 'positivePrompt' | 'negativePrompt'> | null = null;

/** While set, the stored form keeps these prompts, so a start after closing on the comic screen gets the Generate tab's back. */
/** The drawing settings saved in place of the form's while the comic screen borrows them; null otherwise. */
let savedDraw: object | null = null;

/** While set, the stored form keeps these drawing settings, so a start after closing on the comic screen gets the Generate tab's back. */
export function keepDrawForSaving(settings: object | null): void {
  savedDraw = settings;
}

export function keepPromptsForSaving(
  prompts: Pick<ParamsState, 'positivePrompt' | 'negativePrompt'> | null,
): void {
  savedPrompts = prompts;
}

const fieldsOf = (s: ParamsState) =>
  Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function')) as ParamsFields;

export const useParams = create<ParamsState>()(
  persist(
    (set, get) => ({
      positivePrompt: '',
      negativePrompt: '',
      modelKey: null,
      vaeKey: null,
      vaePrecision: 'fp32',
      scheduler: 'dpmpp_2m_k',
      steps: 30,
      cfgScale: 7,
      cfgRescale: 0,
      clipSkip: 0,
      seed: 123456789,
      shouldRandomizeSeed: true,
      width: 1024,
      height: 1024,
      aspectRatio: '1:1',
      aspectLocked: false,
      seamlessX: false,
      seamlessY: false,
      loras: [],
      iterations: 1,
      dynamicPromptMode: 'combinatorial',
      strength: 0.7,
      refImages: [],
      maskBlur: 16,
      coherenceMode: 'Gaussian Blur',
      coherenceEdgeSize: 16,
      coherenceMinDenoise: 0,
      infillMethod: 'lama',
      infillTileSize: 32,
      infillColor: 'black',
      upscale: {
        initialImage: null,
        upscaleModelKey: null,
        scale: 4,
        creativity: 0,
        structure: 0,
        tileControlnetModelKey: null,
        postProcessingModelKey: null,
      },
      hires: DEFAULT_HIRES,

      set: (patch) => set(patch),
      setUpscale: (patch) => set((s) => ({ upscale: { ...s.upscale, ...patch } })),
      setHires: (patch) => set((s) => ({ hires: { ...s.hires, ...patch } })),
      setDimension: (axis, value) => {
        const s = get();
        const v = roundTo8(value);
        const ratio = ASPECT_RATIOS.find((a) => a.id === s.aspectRatio)?.value ?? null;
        if (ratio && s.aspectLocked) {
          if (axis === 'width') set({ width: v, height: roundTo8(v / ratio) });
          else set({ height: v, width: roundTo8(v * ratio) });
        } else {
          set({
            [axis]: v,
            aspectRatio: s.aspectLocked ? s.aspectRatio : 'free',
          } as Partial<ParamsState>);
        }
      },
      setAspectRatio: (id) => {
        const ratio = ASPECT_RATIOS.find((a) => a.id === id)?.value ?? null;
        if (!ratio) return set({ aspectRatio: id });
        const s = get();
        const area = s.width * s.height;
        const width = roundTo8(Math.sqrt(area * ratio));
        set({ aspectRatio: id, width, height: roundTo8(width / ratio) });
      },
      swapDimensions: () => {
        const s = get();
        const flipped = s.aspectRatio.includes(':')
          ? (s.aspectRatio.split(':').reverse().join(':') as AspectRatioId)
          : s.aspectRatio;
        const known = ASPECT_RATIOS.some((a) => a.id === flipped);
        set({ width: s.height, height: s.width, aspectRatio: known ? flipped : 'free' });
      },
      optimizeSize: (base) => {
        const s = get();
        // A free shape goes to the trained size nearest to it; a chosen ratio keeps that ratio at the model's area.
        if (s.aspectRatio === 'free') {
          set(trainedSize(s.width, s.height, base));
          return;
        }
        const ratio = s.width / s.height;
        const width = roundTo8(Math.sqrt(base * base * ratio));
        set({ width, height: roundTo8(width / ratio) });
      },
      addLora: (key) => {
        if (get().loras.some((l) => l.key === key)) return;
        set({ loras: [...get().loras, { key, weight: 0.75, isEnabled: true }] });
      },
      updateLora: (key, patch) =>
        set({ loras: get().loras.map((l) => (l.key === key ? { ...l, ...patch } : l)) }),
      removeLora: (key) => set({ loras: get().loras.filter((l) => l.key !== key) }),
      addRefImage: (init) => {
        const id = `ref-${refSeq++}`;
        const ref: RefImage = {
          id,
          isEnabled: true,
          imageName: null,
          imageUrl: null,
          modelKey: null,
          weight: 1,
          beginEnd: [0, 1],
          method: 'full',
          clipVisionModel: 'ViT-H',
          ...init,
        };
        set({ refImages: [...get().refImages, ref] });
        return id;
      },
      updateRefImage: (id, patch) =>
        set({ refImages: get().refImages.map((r) => (r.id === id ? { ...r, ...patch } : r)) }),
      removeRefImage: (id) => set({ refImages: get().refImages.filter((r) => r.id !== id) }),
      recallAll: (m) => {
        const model = recalledModel(m, useModels.getState().models);
        set({
          positivePrompt: m.positivePrompt,
          negativePrompt: m.negativePrompt,
          modelKey: recalledModelKey(model, get().modelKey),
          vaeKey: m.vaeKey,
          seed: m.seed,
          shouldRandomizeSeed: false,
          steps: m.steps,
          cfgScale: m.cfgScale,
          cfgRescale: m.cfgRescale,
          // A picture that records the sampling its family fixed did not use its scheduler setting: keep the current one.
          ...(m.sampling ? {} : { scheduler: m.scheduler }),
          width: m.width,
          height: m.height,
          aspectRatio: 'free',
          clipSkip: m.clipSkip,
          seamlessX: m.seamlessX,
          seamlessY: m.seamlessY,
          loras: m.loras.map((l) => ({ ...l })),
          ...(m.strength !== undefined ? { strength: m.strength } : {}),
          ...(m.maskBlur !== undefined ? { maskBlur: m.maskBlur } : {}),
          // The reference images the picture was made with come back too (a picture without any leaves the form's alone).
          ...(m.refImages?.length ? { refImages: refImagesFromInputs(m.refImages) } : {}),
          // The high-resolution fix is on exactly when the picture used it (its stored size is the first pass's).
          hires: hiresFromMetadata(m.hiresFix, get().hires),
        });
        return model;
      },
      recallPrompts: (m) =>
        set({
          positivePrompt: m.positivePrompt,
          negativePrompt: m.negativePrompt,
        }),
      recallSeed: (seed) => set({ seed, shouldRandomizeSeed: false }),
      recallSize: (width, height) => set({ width, height, aspectRatio: 'free' }),
      remix: (m) => {
        const seed = get().seed;
        const random = get().shouldRandomizeSeed;
        const model = get().recallAll(m);
        set({ seed, shouldRandomizeSeed: random });
        return model;
      },
    }),
    {
      name: 'novira.params',
      version: 1,
      partialize: (s) => ({ ...fieldsOf(s), ...savedPrompts, ...savedDraw }),
      merge: (stored, current) => restoreParams(stored, current),
    },
  ),
);

export const newRandomSeed = () => useParams.getState().set({ seed: randomSeed() });

/** The form's high-resolution fix for what a picture stored: on with its values, or off (the other values kept). */
export function hiresFromMetadata(h: HiresFix | undefined, current: HiresParams): HiresParams {
  if (!h) return { ...current, enabled: false };
  return {
    enabled: true,
    scale: h.scale,
    strength: h.strength,
    upscaleModelKey: h.upscaleModelKey ?? null,
    steps: h.steps ?? 0,
  };
}

/** The high-resolution fix as the queue receives it; undefined when it is off. */
export function hiresFixInput(h: HiresParams): HiresFix | undefined {
  if (!h.enabled) return undefined;
  return {
    scale: h.scale,
    strength: h.strength,
    ...(h.upscaleModelKey ? { upscaleModelKey: h.upscaleModelKey } : {}),
    ...(h.steps > 0 ? { steps: h.steps } : {}),
  };
}

/** Size of the second pass: the first size times the scale, snapped to multiples of 8 (as the backend does). */
export function hiresSize(
  width: number,
  height: number,
  scale: number,
): { width: number; height: number } {
  return { width: roundTo8(width * scale), height: roundTo8(height * scale) };
}

/** The form's reference images for what a picture's metadata stored (the gallery knows the pictures by their URL). */
export function refImagesFromInputs(inputs: RefImageInput[]): RefImage[] {
  const images = useGallery.getState().images;
  return inputs.map((r) => ({
    id: `ref-${refSeq++}`,
    isEnabled: true,
    imageName: images.find((i) => i.url === r.imageUrl)?.name ?? null,
    imageUrl: r.imageUrl,
    modelKey: r.modelKey,
    weight: r.weight,
    beginEnd: [r.beginEnd[0], r.beginEnd[1]],
    method: r.method,
    clipVisionModel: r.clipVisionModel,
  }));
}

/** The enabled, complete reference images as the queue receives them (Generate and Canvas). */
export function refImageInputs(refs: RefImage[]): RefImageInput[] {
  return refs.flatMap((r) =>
    r.isEnabled && r.imageUrl && r.modelKey
      ? [
          {
            imageUrl: r.imageUrl,
            modelKey: r.modelKey,
            clipVisionModel: r.clipVisionModel,
            weight: r.weight,
            beginEnd: [r.beginEnd[0], r.beginEnd[1]],
            method: r.method,
          },
        ]
      : [],
  );
}
