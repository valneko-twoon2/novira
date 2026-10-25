// Video creation: the form values (kept between sessions) and the state of the video model download.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BaseModel } from '@/backend';
import { overDefaults } from '../persistDefaults';

export type VideoMode = 'text' | 'image';
/** `fast` is the distilled Wan 2.2 5B that makes a clip in 4 steps. */
export type VideoModel = 'standard' | 'fast';

export interface VideoForm {
  mode: VideoMode;
  model: VideoModel;
  /** An installed video model (Wan, HunyuanVideo, LTX-Video) instead of the two above; null uses `model`. */
  modelKey: string | null;
  positivePrompt: string;
  negativePrompt: string;
  /** Gallery image that is animated in image mode. */
  sourceImageName: string | null;
  width: number;
  height: number;
  /** Length in seconds; the frame count follows from it and the frame rate. */
  seconds: number;
  fps: number;
  steps: number;
  cfgScale: number;
  seed: number;
  randomizeSeed: boolean;
  /** For a small GPU: the model's weights as fp8, and the frames decoded in tiles. */
  fp8: boolean;
  tiledDecode: boolean;
}

const VIDEO_DEFAULTS: VideoForm = {
  mode: 'text',
  model: 'standard',
  modelKey: null,
  positivePrompt: '',
  negativePrompt: 'blurry, low quality, worst quality, static, jpeg artifacts, deformed, watermark, text',
  sourceImageName: null,
  width: 832,
  height: 480,
  seconds: 2,
  fps: 24,
  steps: 20,
  cfgScale: 5,
  seed: 123456789,
  randomizeSeed: true,
  fp8: false,
  tiledDecode: false,
};

/** Steps and CFG each model is made for; picking a model sets them. */
export const VIDEO_PRESETS: Record<VideoModel, { steps: number; cfgScale: number }> = {
  standard: { steps: 20, cfgScale: 5 },
  fast: { steps: 4, cfgScale: 1 },
};

/** What an installed video family is made for; picking such a model sets these. */
export const VIDEO_FAMILY_PRESETS: Partial<Record<BaseModel, { steps: number; cfgScale: number; fps: number; width: number; height: number }>> = {
  wan: { steps: 30, cfgScale: 6, fps: 16, width: 832, height: 480 },
  'hunyuan-video': { steps: 20, cfgScale: 6, fps: 24, width: 848, height: 480 },
  'ltx-video': { steps: 30, cfgScale: 3, fps: 25, width: 768, height: 512 },
  'hunyuan-video-15': { steps: 20, cfgScale: 6, fps: 24, width: 848, height: 480 },
  ltx2: { steps: 20, cfgScale: 4, fps: 24, width: 960, height: 544 },
};

export const VIDEO_LIMITS = { seconds: { min: 1, max: 10 }, fps: { min: 8, max: 30 }, steps: { min: 4, max: 50 }, cfg: { min: 1, max: 12 } };

/** Sizes the video model is offered at. */
export const VIDEO_SIZES = [
  { value: '832x480', width: 832, height: 480 },
  { value: '640x352', width: 640, height: 352 },
  { value: '352x640', width: 352, height: 640 },
  { value: '480x832', width: 480, height: 832 },
  { value: '1024x576', width: 1024, height: 576 },
  { value: '576x1024', width: 576, height: 1024 },
  { value: '704x704', width: 704, height: 704 },
  { value: '848x480', width: 848, height: 480 },
  { value: '768x512', width: 768, height: 512 },
  { value: '512x768', width: 512, height: 768 },
];

/** Frames for a length: 4n + 1, within what the model accepts. */
export function framesFor(seconds: number, fps: number): number {
  const wanted = Math.max(5, Math.min(241, Math.round(seconds * fps)));
  return Math.floor((wanted - 1) / 4) * 4 + 1;
}

interface VideoState {
  form: VideoForm;
  setForm: (patch: Partial<VideoForm>) => void;
}

export const useVideo = create<VideoState>()(
  persist(
    (set, get) => ({
      form: VIDEO_DEFAULTS,
      setForm: (patch) => set({ form: { ...get().form, ...patch } }),
    }),
    {
      name: 'novira.video',
      version: 3,
      partialize: (s) => ({ form: s.form }),
      // Forms saved before the model choice existed.
      migrate: (saved) => ({ form: { ...VIDEO_DEFAULTS, ...(saved as { form?: Partial<VideoForm> }).form } }),
      merge: overDefaults('form', VIDEO_DEFAULTS),
    },
  ),
);
