// Installed models and model install jobs.
import { create } from 'zustand';
import type { BaseModel, ModelConfig, ModelInstallJob, ModelType } from '@/backend';

interface ModelsState {
  models: ModelConfig[];
  installJobs: ModelInstallJob[];
  /** Model shown in the detail panel; null hides the panel. */
  selectedKey: string | null;
  setSelectedKey: (key: string | null) => void;
  /** Favorite model keys (session only). */
  favorites: string[];
  toggleFavorite: (key: string) => void;
  setModels: (models: ModelConfig[]) => void;
  upsertModel: (model: ModelConfig) => void;
  removeModel: (key: string) => void;
  upsertInstallJob: (job: ModelInstallJob) => void;
  clearFinishedJobs: () => void;
}

export const useModels = create<ModelsState>()((set, get) => ({
  models: [],
  installJobs: [],
  selectedKey: null,
  setSelectedKey: (selectedKey) => set({ selectedKey }),
  favorites: [],
  toggleFavorite: (key) => set({ favorites: get().favorites.includes(key) ? get().favorites.filter((k) => k !== key) : [...get().favorites, key] }),
  setModels: (models) => set({ models }),
  upsertModel: (model) => {
    const exists = get().models.some((m) => m.key === model.key);
    set({ models: exists ? get().models.map((m) => (m.key === model.key ? model : m)) : [...get().models, model] });
  },
  removeModel: (key) =>
    set({ models: get().models.filter((m) => m.key !== key), selectedKey: get().selectedKey === key ? null : get().selectedKey }),
  upsertInstallJob: (job) => {
    const exists = get().installJobs.some((j) => j.id === job.id);
    set({ installJobs: exists ? get().installJobs.map((j) => (j.id === job.id ? job : j)) : [job, ...get().installJobs] });
  },
  clearFinishedJobs: () =>
    set({ installJobs: get().installJobs.filter((j) => j.status === 'waiting' || j.status === 'downloading' || j.status === 'running') }),
}));

/** Every base model, in the order model lists group them (newest families first). */
export const BASE_ORDER: BaseModel[] = [
  'qwen-image',
  'z-image',
  'anima',
  'hidream',
  'chroma',
  'flux2',
  'flux',
  'auraflow',
  'hunyuan-image',
  'hunyuan-dit',
  'sd-3',
  'sdxl',
  'sd-2',
  'sd-1',
  'wan',
  'hunyuan-video-15',
  'hunyuan-video',
  'ltx2',
  'ltx-video',
  'any',
];

/** The families the Generate tab runs from a diffusion model loaded in parts (the backend's `comfy/split.rs`). */
export const SPLIT_BASES: ReadonlySet<BaseModel> = new Set<BaseModel>([
  'anima',
  'flux',
  'flux2',
  'chroma',
  'qwen-image',
  'z-image',
  'sd-3',
  'hidream',
  'auraflow',
  'hunyuan-image',
]);

/** A model the Generate tab draws with: a main model, or a diffusion model of a family that loads in parts. */
export function isDrawable(m: ModelConfig): boolean {
  if (m.type === 'main') return !VIDEO_BASES.has(m.base);
  return m.type === 'diffusion_model' && SPLIT_BASES.has(m.base);
}

/** The video families the Video screen runs from a diffusion model the user installed (the backend's `Family::of_video`). */
export const VIDEO_BASES: ReadonlySet<BaseModel> = new Set<BaseModel>(['wan', 'hunyuan-video', 'hunyuan-video-15', 'ltx-video', 'ltx2']);

/** A model the Video screen can draw with besides its own two: a diffusion model of a video family. */
export function isVideoModel(m: ModelConfig): boolean {
  // LTX-Video's checkpoint carries its VAE, so it is a main model of a video base.
  return (m.type === 'diffusion_model' || m.type === 'main') && VIDEO_BASES.has(m.base);
}

export function drawableModels(models: ModelConfig[]): ModelConfig[] {
  return models.filter(isDrawable);
}

/** The drawable models a graph that loads a whole checkpoint (`CheckpointLoaderSimple`) can use: main models, no video ones. */
export function checkpointModels(models: ModelConfig[]): ModelConfig[] {
  return models.filter((m) => m.type === 'main' && isDrawable(m));
}

export function modelsOfType(models: ModelConfig[], type: ModelType, base?: BaseModel | null): ModelConfig[] {
  return models.filter((m) => m.type === type && (!base || m.base === base || m.base === 'any'));
}

/**
 * The reference-image (IP-Adapter) model to start with for the main model `mainKey`, or null when none is installed.
 * A face adapter is only chosen when it is the only one: it read a cartoon character's face as someone else's and
 * did worse than the plain adapter when the picture was a character (checked on a real engine).
 */
export function defaultRefModelKey(mainKey: string | null | undefined): string | null {
  const models = useModels.getState().models;
  const base = models.find((m) => m.key === mainKey)?.base;
  const fitting = modelsOfType(models, 'ip_adapter', base);
  return (fitting.find((m) => !/face/i.test(m.name)) ?? fitting[0])?.key ?? null;
}

export function findModel(key: string | null | undefined): ModelConfig | undefined {
  if (!key) return undefined;
  return useModels.getState().models.find((m) => m.key === key);
}

export const BASE_LABELS: Record<BaseModel, string> = {
  'sd-1': 'SD1.X',
  'sd-2': 'SD2.X',
  sdxl: 'SDXL',
  'sd-3': 'SD3.X',
  flux: 'FLUX',
  flux2: 'FLUX.2',
  anima: 'Anima',
  chroma: 'Chroma',
  'qwen-image': 'Qwen-Image',
  'z-image': 'Z-Image',
  hidream: 'HiDream',
  auraflow: 'AuraFlow',
  'hunyuan-image': 'HunyuanImage 2.1',
  'hunyuan-dit': 'Hunyuan-DiT',
  wan: 'Wan',
  'hunyuan-video': 'HunyuanVideo',
  'hunyuan-video-15': 'HunyuanVideo 1.5',
  'ltx-video': 'LTX-Video',
  ltx2: 'LTX-2',
  any: 'Any',
};
