import { describe, expect, it } from 'vitest';
import type { ComfyNodeDefs } from '@/backend';
import { CUTOUT_NODE, buildCutoutGraph, cutoutModels } from './cutout';

const defsWith = (models: string[]) => ({ [CUTOUT_NODE]: { input: { required: { model: [models] } } } }) as unknown as ComfyNodeDefs;

describe('cutout prompt', () => {
  it('reads the gallery picture, keeps its alpha and saves one picture', () => {
    const g = buildCutoutGraph('photo.png', { model: 'RMBG-2.0', sensitivity: 0.8, edge: -2, background: 'alpha' });
    expect(g.prompt.source!.inputs.image).toEqual({ $image: 'photo.png' });
    const cut = g.prompt.cut!;
    expect(cut.class_type).toBe(CUTOUT_NODE);
    expect(cut.inputs).toMatchObject({ model: 'RMBG-2.0', sensitivity: 0.8, mask_offset: -2, background: 'Alpha' });
    expect(g.prompt.save!.inputs.images).toEqual(['cut', 0]);
    expect(g.outputs).toEqual(['save']);
  });

  it('can put a plain white background in place of the old one', () => {
    const cut = buildCutoutGraph('photo.png', { model: 'RMBG-2.0', sensitivity: 1, edge: 0, background: 'white' }).prompt.cut!;
    expect(cut.inputs).toMatchObject({ background: 'Color', background_color: '#FFFFFF' });
  });
});

describe('cutout models', () => {
  it('lists what the loaded node offers, the best known first', () => {
    expect(cutoutModels(defsWith(['BEN', 'INSPYRENET', 'RMBG-2.0', 'BEN2']))).toEqual(['RMBG-2.0', 'INSPYRENET', 'BEN2', 'BEN']);
  });

  it('is empty while the pack is not loaded', () => {
    expect(cutoutModels(null)).toEqual([]);
    expect(cutoutModels({} as ComfyNodeDefs)).toEqual([]);
  });
});
