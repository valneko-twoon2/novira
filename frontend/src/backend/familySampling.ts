// The sampler and scheduler the backend always runs for a picture model of the newer families, whatever the scheduler
// setting says (`Family::picture_sampling` in backend/crates/novira-core/src/comfy/split.rs). The contract fixture
// `contract/family-sampling.json` is this table; both sides' contract tests check it, so the copies cannot drift.
import type { BaseModel, ModelConfig, Sampling } from './types';

export const FAMILY_SAMPLING: Partial<Record<BaseModel, Sampling>> = {
  flux: { sampler: 'euler', scheduler: 'simple' },
  flux2: { sampler: 'euler', scheduler: 'Flux2Scheduler' },
  anima: { sampler: 'euler', scheduler: 'simple' },
  chroma: { sampler: 'euler', scheduler: 'beta' },
  'qwen-image': { sampler: 'euler', scheduler: 'simple' },
  'z-image': { sampler: 'res_multistep', scheduler: 'simple' },
  'sd-3': { sampler: 'euler', scheduler: 'sgm_uniform' },
  hidream: { sampler: 'uni_pc', scheduler: 'simple' },
  auraflow: { sampler: 'euler', scheduler: 'normal' },
  'hunyuan-image': { sampler: 'euler', scheduler: 'simple' },
};

/** What a picture of `model` is sampled with when its family fixes it; undefined when the scheduler setting is used. */
export function fixedSampling(model: Pick<ModelConfig, 'base' | 'type'>): Sampling | undefined {
  return model.type === 'main' || model.type === 'diffusion_model' ? FAMILY_SAMPLING[model.base] : undefined;
}

/** How a sampling reads on the screen: the engine's own names. */
export function samplingLabel(s: Sampling): string {
  return `${s.sampler} / ${s.scheduler}`;
}
