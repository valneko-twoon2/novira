// Recommended values of a main model ("profile"): its default settings, else a base-specific fallback.
import { fixedSampling, type ModelConfig, type Sampling, type SchedulerName } from '@/backend';
import type { ParamsState } from '@/state/params';
import { recommendedPrompts } from './recommendedPrompts';

export interface ModelProfile {
  steps: number;
  cfgScale: number;
  scheduler: SchedulerName;
  width: number;
  height: number;
  /** Acceptable ranges around the recommended steps / CFG (inclusive). */
  stepsRange: [number, number];
  cfgRange: [number, number];
  /** Quality words suggested for the positive prompt (`recommendedPrompts`). */
  quality: string;
  /** The sampling the backend always runs for the model's family; then the scheduler setting is not used. */
  fixedSampling?: Sampling;
}

const FALLBACK: Record<ModelConfig['base'], Omit<ModelProfile, 'quality' | 'stepsRange' | 'cfgRange'>> = {
  'sd-1': { steps: 25, cfgScale: 7, scheduler: 'euler_a', width: 512, height: 512 },
  'sd-2': { steps: 25, cfgScale: 7, scheduler: 'dpmpp_2m_k', width: 768, height: 768 },
  sdxl: { steps: 28, cfgScale: 6, scheduler: 'euler_a', width: 1024, height: 1024 },
  'sd-3': { steps: 28, cfgScale: 5, scheduler: 'euler', width: 1024, height: 1024 },
  flux: { steps: 28, cfgScale: 3.5, scheduler: 'euler', width: 1024, height: 1024 },
  flux2: { steps: 20, cfgScale: 4, scheduler: 'euler', width: 1024, height: 1024 },
  anima: { steps: 30, cfgScale: 4.5, scheduler: 'euler', width: 1024, height: 1024 },
  chroma: { steps: 26, cfgScale: 4, scheduler: 'euler', width: 1024, height: 1024 },
  'qwen-image': { steps: 30, cfgScale: 4, scheduler: 'euler', width: 1328, height: 1328 },
  'z-image': { steps: 25, cfgScale: 4, scheduler: 'euler', width: 1024, height: 1024 },
  hidream: { steps: 30, cfgScale: 5, scheduler: 'euler', width: 1024, height: 1024 },
  auraflow: { steps: 30, cfgScale: 3.5, scheduler: 'euler', width: 1024, height: 1024 },
  'hunyuan-image': { steps: 8, cfgScale: 3.5, scheduler: 'euler', width: 1024, height: 1024 },
  'hunyuan-dit': { steps: 40, cfgScale: 5, scheduler: 'euler', width: 1024, height: 1024 },
  wan: { steps: 30, cfgScale: 5, scheduler: 'euler', width: 832, height: 480 },
  'hunyuan-video': { steps: 30, cfgScale: 6, scheduler: 'euler', width: 848, height: 480 },
  'hunyuan-video-15': { steps: 20, cfgScale: 6, scheduler: 'euler', width: 1280, height: 720 },
  'ltx-video': { steps: 30, cfgScale: 3, scheduler: 'euler', width: 768, height: 512 },
  ltx2: { steps: 20, cfgScale: 4, scheduler: 'euler', width: 960, height: 544 },
  any: { steps: 28, cfgScale: 6, scheduler: 'euler_a', width: 1024, height: 1024 },
};

/**
 * How far below the recommended steps a setting still counts as fine, as a share of them (default 0.55). Anima needs
 * more: riakuLab (an Anima model) drew a flat blue picture at 17 of its 30 steps and a sound one at 30, and its author
 * recommends 30, so its lower bound is 24.
 */
const MIN_STEPS_SHARE: Partial<Record<ModelConfig['base'], number>> = { anima: 0.8 };

export function modelProfile(m: ModelConfig): ModelProfile {
  const d = m.defaultSettings ?? {};
  const f = FALLBACK[m.base];
  const steps = d.steps ?? f.steps;
  const cfgScale = d.cfgScale ?? f.cfgScale;
  return {
    steps,
    cfgScale,
    stepsRange: [Math.max(1, Math.round(steps * (MIN_STEPS_SHARE[m.base] ?? 0.55))), Math.round(steps * 1.25)],
    cfgRange: [Math.max(1, cfgScale - 1), cfgScale + 1],
    scheduler: d.scheduler ?? f.scheduler,
    width: d.width ?? f.width,
    height: d.height ?? f.height,
    quality: recommendedPrompts(m).positive,
    fixedSampling: fixedSampling(m),
  };
}

export type ProfileKey = 'steps' | 'cfg' | 'scheduler' | 'size';

/** Settings that differ from the profile. */
export function profileMismatches(p: ModelProfile, s: Pick<ParamsState, 'steps' | 'cfgScale' | 'scheduler' | 'width' | 'height'>): ProfileKey[] {
  const out: ProfileKey[] = [];
  if (s.steps < p.stepsRange[0] || s.steps > p.stepsRange[1]) out.push('steps');
  if (s.cfgScale < p.cfgRange[0] - 0.01 || s.cfgScale > p.cfgRange[1] + 0.01) out.push('cfg');
  if (!p.fixedSampling && s.scheduler !== p.scheduler) out.push('scheduler');
  if (s.width !== p.width || s.height !== p.height) out.push('size');
  return out;
}
