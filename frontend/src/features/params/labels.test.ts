import { describe, expect, it } from 'vitest';
import type { CoherenceMode, InfillMethod, RefImageMethod } from '@/state/params';
import { coherenceLabel, infillLabel, methodLabel, optimalDimension, SCHEDULER_LABELS } from './labels';

describe('parameter labels', () => {
  it('gives every reference-image method, coherence mode and infill method a non-empty label', () => {
    const methods: RefImageMethod[] = ['full', 'style', 'composition', 'style_strong', 'style_precise'];
    const modes: CoherenceMode[] = ['Gaussian Blur', 'Box Blur', 'Staged'];
    const infills: InfillMethod[] = ['patchmatch', 'lama', 'cv2', 'color', 'tile'];
    for (const m of methods) expect(methodLabel(m)).not.toBe('');
    for (const m of modes) expect(coherenceLabel(m)).not.toBe('');
    for (const m of infills) expect(infillLabel(m)).not.toBe('');
    expect(new Set(methods.map(methodLabel)).size).toBe(methods.length);
  });

  it('keeps engine names for infill methods that are not translated', () => {
    expect(infillLabel('patchmatch')).toBe('PatchMatch');
    expect(infillLabel('lama')).toBe('LaMa');
    expect(infillLabel('cv2')).toBe('cv2');
  });

  it('labels every scheduler with a distinct name', () => {
    const labels = Object.values(SCHEDULER_LABELS);
    expect(labels.length).toBeGreaterThan(0);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('picks the optimal square side from the model base, defaulting to 1024', () => {
    expect(optimalDimension('sd-1')).toBe(512);
    expect(optimalDimension('sd-2')).toBe(768);
    expect(optimalDimension('sdxl')).toBe(1024);
    expect(optimalDimension('flux')).toBe(1024);
    expect(optimalDimension(undefined)).toBe(1024);
    expect(optimalDimension('')).toBe(1024);
  });
});
