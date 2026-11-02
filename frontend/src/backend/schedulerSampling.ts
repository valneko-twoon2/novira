// The ComfyUI sampler and noise schedule each scheduler name of the Generate settings runs (`sampler_for` in
// backend/crates/novira-core/src/comfy/graph.rs; the contract fixture `contract/scheduler-sampling.json` is this table,
// checked by both sides). `tcd` has none: the backend refuses it.
import { fixedSampling } from './familySampling';
import type { ModelConfig, Sampling, SchedulerName } from './types';

export const SCHEDULER_SAMPLING: Partial<Record<SchedulerName, Sampling>> = {
  euler: { sampler: 'euler', scheduler: 'normal' },
  euler_a: { sampler: 'euler_ancestral', scheduler: 'normal' },
  euler_k: { sampler: 'euler', scheduler: 'karras' },
  dpmpp_2m: { sampler: 'dpmpp_2m', scheduler: 'normal' },
  dpmpp_2m_k: { sampler: 'dpmpp_2m', scheduler: 'karras' },
  dpmpp_2m_sde_k: { sampler: 'dpmpp_2m_sde', scheduler: 'karras' },
  dpmpp_sde_k: { sampler: 'dpmpp_sde', scheduler: 'karras' },
  heun: { sampler: 'heun', scheduler: 'normal' },
  lms: { sampler: 'lms', scheduler: 'normal' },
  ddim: { sampler: 'ddim', scheduler: 'ddim_uniform' },
  unipc: { sampler: 'uni_pc', scheduler: 'normal' },
  lcm: { sampler: 'lcm', scheduler: 'sgm_uniform' },
};

/**
 * What a picture of `model` runs while no sampler or noise schedule is named: its family's own, or the scheduler
 * setting's pair (Anima's plain `euler` is its template's `euler / simple`, as `Family::sampling_for` has it).
 * Undefined when there is none to show (no model and no usable setting).
 */
export function runningSampling(model: Pick<ModelConfig, 'base' | 'type'> | undefined, scheduler: SchedulerName): Sampling | undefined {
  const fixed = model ? fixedSampling(model) : undefined;
  if (fixed) return fixed;
  if (model?.base === 'anima' && model.type !== 'lora' && scheduler === 'euler') return { sampler: 'euler', scheduler: 'simple' };
  return SCHEDULER_SAMPLING[scheduler];
}
