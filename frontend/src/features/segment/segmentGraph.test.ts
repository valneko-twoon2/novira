import { describe, expect, it } from 'vitest';
import type { ComfyNodeDefs } from '@/backend';
import { graphRequest } from '@/state/comfy/graphJob';
import { buildEraseGraph, buildRedrawGraph, buildSegmentGraph, lamaModel, SEGMENT_NODE } from './segmentGraph';

describe('segmentation prompt', () => {
  const graph = buildSegmentGraph('photo.png', [
    { x: 10.4, y: 20.6, include: true },
    { x: 30, y: 40, include: true },
    { x: 5, y: 6, include: false },
  ]);

  it('reads the gallery picture and writes the clicks as the pack expects them', () => {
    expect(graph.prompt.source!.inputs.image).toEqual({ $image: 'photo.png' });
    const select = graph.prompt.select!;
    expect(select.class_type).toBe(SEGMENT_NODE);
    expect(JSON.parse(select.inputs.coordinates_positive as string)).toEqual([
      { x: 10, y: 21 },
      { x: 30, y: 40 },
    ]);
    expect(JSON.parse(select.inputs.coordinates_negative as string)).toEqual([{ x: 5, y: 6 }]);
  });

  it('leaves out the points to exclude when there are none, and keeps only the mask picture as output', () => {
    const only = buildSegmentGraph('photo.png', [{ x: 1, y: 2, include: true }]);
    expect('coordinates_negative' in only.prompt.select!.inputs).toBe(false);
    expect(graph.outputs).toEqual(['save']);
    expect(graph.prompt.save!.class_type).toBe('SaveImage');
    // Every link points at a node of the prompt.
    for (const node of Object.values(graph.prompt)) for (const v of Object.values(node.inputs)) if (Array.isArray(v)) expect(graph.prompt[v[0] as string]).toBeDefined();
  });

  it('runs first in line and hidden from the gallery', () => {
    const req = graphRequest(graph, 'intermediate');
    expect(req.destination).toBe('intermediate');
    expect(req.prepend).toBe(true);
    expect(req.params.generationMode).toBe('graph');
    expect(req.comfyGraph).toBe(graph);
  });
});

describe('erase prompt', () => {
  const links = (g: ReturnType<typeof buildEraseGraph>) => {
    for (const node of Object.values(g.prompt)) for (const v of Object.values(node.inputs)) if (Array.isArray(v)) expect(g.prompt[v[0] as string]).toBeDefined();
  };

  it('fills from the surroundings with OpenCV when no LaMa model is installed', () => {
    const g = buildEraseGraph('photo.png', 'mask.png', { invert: false, lama: null });
    expect(g.prompt.fill!.class_type).toBe('INPAINT_MaskedFill');
    expect(g.prompt.fill!.inputs.fill).toBe('telea');
    expect(g.prompt.cover!.inputs.image).toEqual({ $image: 'mask.png' });
    expect(g.prompt.grow!.inputs.mask).toEqual(['mask', 0]);
    expect(g.prompt.flip).toBeUndefined();
    expect(g.outputs).toEqual(['save']);
    links(g);
  });

  it('uses LaMa when it is installed, and grows the inverted mask when inverted', () => {
    const g = buildEraseGraph('photo.png', 'mask.png', { invert: true, lama: 'big-lama.pt' });
    expect(g.prompt.model!.inputs.model_name).toBe('big-lama.pt');
    expect(g.prompt.fill!.class_type).toBe('INPAINT_InpaintWithModel');
    expect(g.prompt.grow!.inputs.mask).toEqual(['flip', 0]);
    links(g);
  });

  it('finds the LaMa file in the model list in either format ComfyUI reports it', () => {
    const node = (spec: unknown) => ({ INPAINT_LoadInpaintModel: { input: { required: { model_name: spec } } } }) as unknown as ComfyNodeDefs;
    expect(lamaModel(node([['other.pth', 'big-lama.pt']]))).toBe('big-lama.pt');
    expect(lamaModel(node(['COMBO', { options: ['big-lama.pt'] }]))).toBe('big-lama.pt');
    expect(lamaModel(node(['COMBO', { options: [] }]))).toBeNull();
    expect(lamaModel(null)).toBeNull();
  });
});

describe('redraw prompt', () => {
  const options = { modelKey: 'sdxl-1', prompt: 'blue hair', negative: 'lowres', strength: 0.7, invert: false };
  const g = buildRedrawGraph('photo.png', 'mask.png', options);

  it('samples only the selected part of the picture from a library model with the two texts', () => {
    expect(g.prompt.ckpt!.inputs.ckpt_name).toEqual({ $model: 'sdxl-1' });
    expect(g.prompt.pos!.inputs.text).toBe('blue hair');
    expect(g.prompt.neg!.inputs.text).toBe('lowres');
    expect(g.prompt.limit!.class_type).toBe('SetLatentNoiseMask');
    expect(g.prompt.limit!.inputs.mask).toEqual(['grow', 0]);
    expect(g.prompt.sample!.inputs.denoise).toBe(0.7);
    expect(g.prompt.sample!.inputs.seed).toEqual({ $seed: true });
  });

  it('pastes the result back through a softened mask over the original picture', () => {
    expect(g.prompt.paste!.inputs.destination).toEqual(['source', 0]);
    expect(g.prompt.paste!.inputs.mask).toEqual(['feather', 0]);
    expect(g.outputs).toEqual(['save']);
    for (const node of Object.values(g.prompt)) for (const v of Object.values(node.inputs)) if (Array.isArray(v)) expect(g.prompt[v[0] as string]).toBeDefined();
  });

  it('flips the mask first when the rest of the picture was selected', () => {
    const flipped = buildRedrawGraph('photo.png', 'mask.png', { ...options, invert: true });
    expect(flipped.prompt.flip).toBeDefined();
    expect(flipped.prompt.grow!.inputs.mask).toEqual(['flip', 0]);
    expect(g.prompt.flip).toBeUndefined();
  });

  it('describes the job for the gallery without changing the defaults of the other requests', () => {
    const req = graphRequest(g, 'gallery', 'board-1', { positivePrompt: 'blue hair', seed: 42 });
    expect(req.params.positivePrompt).toBe('blue hair');
    expect(req.params.seed).toBe(42);
    expect(req.boardId).toBe('board-1');
    expect(graphRequest(g, 'intermediate').params.positivePrompt).toBe('');
  });
});

