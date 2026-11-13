// A preset's high-resolution fix: one saved before the finish choice existed has no `mode`, and still redraws even
// when the form was set to enlarge only.
import { describe, expect, it } from 'vitest';
import { DEFAULT_HIRES, useParams } from '../params';
import { presetPatch } from './imagePresets';

const form = () => ({ ...useParams.getState(), hires: { ...DEFAULT_HIRES, enabled: true, mode: 'upscale' as const, scale: 3 } });

describe('a preset with the high-resolution fix', { tags: [] }, () => {
  it('redraws when it was saved before the finish choice, whatever the form had', { tags: ['regression'] }, () => {
    const { mode: _none, ...old } = { ...DEFAULT_HIRES, enabled: true, scale: 1.75 };
    expect(presetPatch(form(), { hires: old }).hires).toMatchObject({ enabled: true, scale: 1.75, mode: 'redraw' });
  });

  it('keeps the choice it was saved with', { tags: ['equivalence'] }, () => {
    expect(presetPatch(form(), { hires: { ...DEFAULT_HIRES, enabled: true, mode: 'upscale', scale: 2.5 } }).hires).toMatchObject({ mode: 'upscale', scale: 2.5 });
  });
});
