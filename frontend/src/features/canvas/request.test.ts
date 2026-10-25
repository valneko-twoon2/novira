import { beforeEach, describe, expect, it } from 'vitest';
import { useCanvas, type PoseObject, type RectObject } from '@/state/canvas';
import { useParams } from '@/state/params';
import type { Coverage } from './geometry';
import type { CanvasRenderer } from './render/generationInputs';
import { buildCanvasRequest } from './request';

const initialCanvas = useCanvas.getState();
const initialParams = useParams.getState();

const c = () => useCanvas.getState();
const rect = (id: string): RectObject => ({ kind: 'rect', id, x: 0, y: 0, width: 8, height: 8, color: { r: 255, g: 255, b: 255, a: 1 } });

let calls: string[] = [];

/** Pixels stand-in: the coverage and mask the case wants, and the renders it was asked for. */
function renderer(coverage: Coverage, mask: string | null = 'blob:mask'): CanvasRenderer {
  return {
    coverage: async () => coverage,
    sourceAndMask: async (_s, opts) => {
      calls.push(`source outpaint=${opts.outpaint} infill=${opts.infill.method}/${opts.infill.color}`);
      return { initImageUrl: 'blob:source', maskImageUrl: mask };
    },
    controlImage: async (_s, e) => {
      calls.push(`control ${e.id}`);
      return `blob:control-${e.id}`;
    },
    regionMask: async (_s, e) => {
      calls.push(`region ${e.id}`);
      return `blob:region-${e.id}`;
    },
  };
}

const build = (r: CanvasRenderer) => buildCanvasRequest(c(), useParams.getState(), false, r);

beforeEach(() => {
  useCanvas.setState(initialCanvas, true);
  useParams.setState({ ...initialParams, refImages: [], maskBlur: 12, strength: 0.6, infillMethod: 'lama', infillColor: 'black' }, true);
  calls = [];
});

describe('canvas request', () => {
  it('generates from text on an empty bbox and renders nothing', async () => {
    const req = await build(renderer('empty'));
    expect(req).toMatchObject({ initImageUrl: null, maskImageUrl: null, controlLayers: [], refImages: [] });
    expect(req.params).toMatchObject({ generationMode: 'txt2img', controlLayerCount: 0, refImageCount: 0 });
    expect(req.params.strength).toBeUndefined();
    expect(req.params.maskBlur).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it('inpaints with the mask of the inpaint layers', async () => {
    c().addEntity('inpaint', { objects: [rect('m')] });
    const req = await build(renderer('full'));
    expect(req.params).toMatchObject({ generationMode: 'inpaint', strength: 0.6, maskBlur: 12 });
    expect(req).toMatchObject({ initImageUrl: 'blob:source', maskImageUrl: 'blob:mask' });
    expect(calls).toEqual(['source outpaint=false infill=lama/black']);
  });

  it('falls back to image to image when the mask has nothing inside the bbox', async () => {
    c().addEntity('inpaint', { objects: [rect('m')] });
    const req = await build(renderer('full', null));
    expect(req.params.generationMode).toBe('img2img');
    expect(req.maskImageUrl).toBeNull();
    expect(req.params.maskBlur).toBeUndefined();
    expect(req.initImageUrl).toBe('blob:source');
  });

  it('reworks a fully covered bbox without inpaint layers as image to image, without a mask', async () => {
    const req = await build(renderer('full'));
    expect(req.params.generationMode).toBe('img2img');
    expect(req.maskImageUrl).toBeNull();
  });

  it('outpaints a partly covered bbox, filling the empty part as the infill setting says', async () => {
    useParams.setState({ infillMethod: 'color', infillColor: 'white' });
    const req = await build(renderer('partial'));
    expect(req.params.generationMode).toBe('outpaint');
    expect(req.maskImageUrl).toBe('blob:mask');
    expect(calls).toEqual(['source outpaint=true infill=color/white']);
  });

  it('sends each enabled control layer with content and a model, in order, with its settings', async () => {
    const a = c().addEntity('control', { objects: [rect('a')], modelKey: 'cn-1', weight: 0.5, beginEnd: [0.1, 0.8], controlMode: 'more_control' });
    c().addEntity('control', { objects: [rect('b')], modelKey: 'cn-2', isEnabled: false });
    c().addEntity('control', { objects: [], modelKey: 'cn-3' });
    c().addEntity('control', { objects: [rect('d')], modelKey: null });
    // A layer whose picture is only the filter preview so far still counts.
    const e = c().addEntity('control', { objects: [], modelKey: 'cn-5' });
    c().setFilterPreview(e, { url: 'blob:preview', x: 0, y: 0, width: 8, height: 8 });
    const req = await build(renderer('empty'));
    expect(req.controlLayers).toEqual([
      { imageUrl: `blob:control-${a}`, modelKey: 'cn-1', weight: 0.5, beginEnd: [0.1, 0.8], controlMode: 'more_control' },
      { imageUrl: `blob:control-${e}`, modelKey: 'cn-5', weight: 0.75, beginEnd: [0, 0.75], controlMode: 'balanced' },
    ]);
    expect(req.params.controlLayerCount).toBe(2);
    c().setGroupHidden('control', true);
    expect((await build(renderer('empty'))).controlLayers).toEqual([]);
  });

  it('says what each control picture shows, so a union ControlNet is told it: the filter kind, or a pose', async () => {
    const pose: PoseObject = { kind: 'pose', id: 'p', points: Array.from({ length: 36 }, () => 4), hidden: [], width: 2 };
    c().addEntity('control', { objects: [pose], modelKey: 'cn' });
    for (const filter of ['depth', 'canny', 'lineart', 'hed', 'normal', 'color_map'] as const) c().addEntity('control', { objects: [rect(filter)], modelKey: 'cn', filter });
    c().addEntity('control', { objects: [rect('drawn')], modelKey: 'cn' });
    const req = await build(renderer('empty'));
    expect(req.controlLayers?.map((l) => l.controlType)).toEqual(['openpose', 'depth', 'lineart', 'lineart', 'softedge', 'normal', undefined, undefined]);
    // An unknown kind is left out of the request, not sent empty.
    expect(req.controlLayers?.[7]).not.toHaveProperty('controlType');
  });

  it('sends the global reference images and the regional layers that have content and a prompt', async () => {
    useParams.getState().addRefImage({ imageName: 'r.png', imageUrl: 'http://novira-image.localhost/full/r.png', modelKey: 'ipa', method: 'composition' });
    const hat = c().addEntity('regional', { objects: [rect('g')], positivePrompt: ' a hat ', negativePrompt: null, autoNegative: true });
    c().addEntity('regional', { objects: [], positivePrompt: 'empty region' });
    c().addEntity('regional', { objects: [rect('h')], positivePrompt: null, negativePrompt: '  ' });
    const req = await build(renderer('empty'));
    expect(req.refImages).toEqual([
      { imageUrl: 'http://novira-image.localhost/full/r.png', modelKey: 'ipa', clipVisionModel: 'ViT-H', weight: 1, beginEnd: [0, 1], method: 'composition' },
    ]);
    // Only the layer with a region and a prompt is sent, with its prompts trimmed.
    expect(req.regionalLayers).toEqual([{ imageUrl: `blob:region-${hat}`, positivePrompt: 'a hat', negativePrompt: null, autoNegative: true }]);
    expect(req.params).toMatchObject({ refImageCount: 1, regionalGuidanceCount: 1 });
    expect(calls).toEqual([`region ${hat}`]);
    c().setGroupHidden('regional', true);
    const hidden = await build(renderer('empty'));
    expect(hidden.regionalLayers).toEqual([]);
    expect(hidden.params.regionalGuidanceCount).toBeUndefined();
  });
});
