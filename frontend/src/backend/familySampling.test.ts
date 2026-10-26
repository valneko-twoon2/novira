// The samplers the backend fixes per family: which models they apply to (the table itself is checked against the
// backend through contract/family-sampling.json).
import { describe, expect, it } from 'vitest';
import { FAMILY_SAMPLING, fixedSampling, samplingLabel } from './familySampling';

describe('fixedSampling', () => {
  it('applies to main and diffusion models of a picture family only', () => {
    expect(fixedSampling({ base: 'flux', type: 'main' })).toEqual({ sampler: 'euler', scheduler: 'simple' });
    expect(fixedSampling({ base: 'flux', type: 'diffusion_model' })).toEqual(FAMILY_SAMPLING.flux);
    expect(fixedSampling({ base: 'flux', type: 'lora' })).toBeUndefined();
    // Anima runs the scheduler setting, so nothing is fixed for it.
    expect(fixedSampling({ base: 'anima', type: 'main' })).toBeUndefined();
    expect(fixedSampling({ base: 'anima', type: 'diffusion_model' })).toBeUndefined();
    expect(fixedSampling({ base: 'sdxl', type: 'main' })).toBeUndefined();
    expect(fixedSampling({ base: 'sd-1', type: 'main' })).toBeUndefined();
    expect(fixedSampling({ base: 'wan', type: 'diffusion_model' })).toBeUndefined();
  });

  it('reads as the engine names', () => {
    expect(samplingLabel({ sampler: 'euler', scheduler: 'Flux2Scheduler' })).toBe('euler / Flux2Scheduler');
  });
});
