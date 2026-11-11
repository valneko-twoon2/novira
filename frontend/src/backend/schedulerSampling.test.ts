import { describe, expect, it } from 'vitest';
import { runningSampling, SCHEDULER_SAMPLING } from './schedulerSampling';
import { SCHEDULERS } from './types';

describe('runningSampling', () => {
  it('is the scheduler setting for an SD model, and what the table says for every name but tcd', { tags: ['decision-table'] }, () => {
    expect(runningSampling({ base: 'sdxl', type: 'main' }, 'dpmpp_2m_k')).toEqual({ sampler: 'dpmpp_2m', scheduler: 'karras' });
    expect(runningSampling(undefined, 'euler_a')).toEqual({ sampler: 'euler_ancestral', scheduler: 'normal' });
    for (const name of SCHEDULERS) expect(runningSampling({ base: 'sd-1', type: 'main' }, name), name).toEqual(SCHEDULER_SAMPLING[name]);
    expect(runningSampling({ base: 'sdxl', type: 'main' }, 'tcd')).toBeUndefined();
  });

  it('is the family\'s own for a model that fixes it, whatever the setting says', { tags: ['condition'] }, () => {
    expect(runningSampling({ base: 'flux', type: 'main' }, 'euler_a')).toEqual({ sampler: 'euler', scheduler: 'simple' });
    expect(runningSampling({ base: 'z-image', type: 'diffusion_model' }, 'ddim')).toEqual({ sampler: 'res_multistep', scheduler: 'simple' });
  });

  it('reads plain euler as its template for Anima, and the setting for the rest of its names', { tags: ['decision-table'] }, () => {
    expect(runningSampling({ base: 'anima', type: 'main' }, 'euler')).toEqual({ sampler: 'euler', scheduler: 'simple' });
    expect(runningSampling({ base: 'anima', type: 'main' }, 'euler_a')).toEqual({ sampler: 'euler_ancestral', scheduler: 'normal' });
  });
});
