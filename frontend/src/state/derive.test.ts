// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type GenerationMetadata, type ImageDTO, type ModelConfig, type RefImageInput } from '@/backend';
import { useModels } from '@/state/models';
import { useToasts } from '@/state/toasts';
import { buildDerivedRequest, canDerive, deriveFrom, SUBTLE_STRENGTH } from './derive';

const metadata: GenerationMetadata = {
  generationMode: 'txt2img',
  positivePrompt: 'a girl, brown hair',
  negativePrompt: 'lowres',
  modelKey: 'main-xl',
  modelName: 'Main XL',
  vaeKey: null,
  seed: 11,
  steps: 30,
  cfgScale: 6,
  cfgRescale: 0,
  scheduler: 'euler',
  width: 832,
  height: 1216,
  clipSkip: 0,
  seamlessX: false,
  seamlessY: false,
  loras: [{ key: 'lora-a', weight: 0.7, isEnabled: true }] as GenerationMetadata['loras'],
  refImageCount: 1,
  controlLayerCount: 2,
  maskBlur: 8,
};

const reference: RefImageInput = {
  imageUrl: 'http://novira-image.localhost/full/ref.png',
  modelKey: 'ipa',
  clipVisionModel: 'ViT-H',
  weight: 0.6,
  beginEnd: [0, 1],
  method: 'full',
};

const picture = (over: Partial<ImageDTO> = {}): ImageDTO => ({
  name: 'p.png',
  mediaType: 'image',
  url: 'http://novira-image.localhost/full/p.png',
  thumbnailUrl: 't',
  width: 1024,
  height: 1536,
  createdAt: 0,
  boardId: 'b1',
  starred: false,
  isIntermediate: false,
  category: 'general',
  metadata,
  workflow: null,
  ...over,
});

const model = { key: 'main-xl', name: 'Main XL', base: 'sdxl', type: 'main', format: 'checkpoint', description: '', path: '', size: 0, source: '' } as ModelConfig;

describe('canDerive', () => {
  it('is true for pictures made from a prompt, false for the rest', () => {
    expect(canDerive(picture())).toBe(true);
    expect(canDerive(picture({ metadata: { ...metadata, generationMode: 'inpaint' } }))).toBe(true);
    expect(canDerive(picture({ metadata: { ...metadata, generationMode: 'upscale' } }))).toBe(false);
    expect(canDerive(picture({ metadata: { ...metadata, generationMode: 'graph' } }))).toBe(false);
    expect(canDerive(picture({ metadata: null }))).toBe(false);
    expect(canDerive(picture({ metadata: { ...metadata, modelKey: '' } }))).toBe(false);
    expect(canDerive(picture({ mediaType: 'video' }))).toBe(false);
    expect(canDerive(undefined)).toBe(false);
  });
});

describe('buildDerivedRequest', () => {
  it('a variation keeps every setting and draws again with a new seed on the same board', () => {
    const req = buildDerivedRequest(picture({ metadata: { ...metadata, generationMode: 'img2img', strength: 0.5 } }), 'variation', 4);
    expect(req).toMatchObject({ origin: 'generate', destination: 'gallery', iterations: 4, randomizeSeed: true, boardId: 'b1' });
    expect(req.params).toMatchObject({ generationMode: 'txt2img', positivePrompt: 'a girl, brown hair', modelKey: 'main-xl', steps: 30, cfgScale: 6, width: 832, height: 1216 });
    expect(req.params.loras).toHaveLength(1);
    expect(req.params.strength).toBeUndefined();
    expect(req.initImageUrl).toBeUndefined();
  });

  it('a subtle redo starts from the picture itself at a low strength and at its size', () => {
    const req = buildDerivedRequest(picture(), 'subtle', 1);
    expect(req.params).toMatchObject({ generationMode: 'img2img', strength: SUBTLE_STRENGTH, width: 1024, height: 1536 });
    expect(req.initImageUrl).toBe('http://novira-image.localhost/full/p.png');
  });

  it('a variation keeps the high-resolution fix, a redo of the finished picture drops it', () => {
    const image = picture({ metadata: { ...metadata, hiresFix: { scale: 1.5, strength: 0.45 } } });
    expect(buildDerivedRequest(image, 'variation', 1).params.hiresFix).toEqual({ scale: 1.5, strength: 0.45 });
    const redo = buildDerivedRequest(image, 'subtle', 1).params;
    expect(redo.hiresFix).toBeUndefined();
    expect([redo.width, redo.height]).toEqual([1024, 1536]);
  });

  it('a redo uses the strength it is given', () => {
    expect(buildDerivedRequest(picture(), 'subtle', 1, 0.8).params.strength).toBe(0.8);
  });

  it('does not carry over guidance that is not stored with the picture, and never reuses the stored seed', () => {
    const req = buildDerivedRequest(picture(), 'variation', 1);
    for (const key of ['refImageCount', 'controlLayerCount', 'maskBlur'] as const) expect(req.params[key]).toBeUndefined();
    expect(req.refImages).toBeUndefined();
    expect(req.params.seed).not.toBe(metadata.seed);
    expect(metadata.refImageCount).toBe(1);
  });

  it('uses the reference images and control layers stored with the picture, as request fields', () => {
    const control = { imageUrl: 'http://novira-image.localhost/full/c.png', modelKey: 'cn', weight: 1, beginEnd: [0, 1] as [number, number], controlMode: 'balanced' as const };
    for (const kind of ['variation', 'subtle'] as const) {
      const req = buildDerivedRequest(picture({ metadata: { ...metadata, refImages: [reference], controlLayers: [control] } }), kind, 2);
      expect(req.refImages).toEqual([reference]);
      expect(req.controlLayers).toEqual([control]);
      expect(req.params).toMatchObject({ refImageCount: 1, controlLayerCount: 1 });
      expect(req.params.refImages).toBeUndefined();
      expect(req.params.controlLayers).toBeUndefined();
    }
  });
});

describe('regional guidance of a derived picture', () => {
  const region = { imageUrl: 'http://novira-image.localhost/full/r.png', positivePrompt: 'a red hat', negativePrompt: null, autoNegative: true };

  it('uses the regional layers stored with the picture, as request fields', () => {
    for (const kind of ['variation', 'subtle'] as const) {
      const req = buildDerivedRequest(picture({ metadata: { ...metadata, regionalGuidanceCount: 1, regionalLayers: [region] } }), kind, 1);
      expect(req.regionalLayers).toEqual([region]);
      expect(req.params.regionalGuidanceCount).toBe(1);
      expect(req.params.regionalLayers).toBeUndefined();
    }
    // A picture made before the layers were stored has the count only: nothing to carry over.
    const old = buildDerivedRequest(picture({ metadata: { ...metadata, regionalGuidanceCount: 1 } }), 'variation', 1);
    expect(old.regionalLayers).toBeUndefined();
    expect(old.params.regionalGuidanceCount).toBeUndefined();
  });
});

describe('deriveFrom', () => {
  beforeEach(() => {
    useModels.getState().setModels([model]);
    useToasts.setState({ toasts: [] });
  });
  afterEach(() => vi.restoreAllMocks());

  it('queues the request and tells what could not be carried over', async () => {
    const enqueue = vi.spyOn(backend, 'enqueue').mockResolvedValue([]);
    await deriveFrom(picture(), 'variation', 4);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0]![0].iterations).toBe(4);
    const toast = useToasts.getState().toasts[0]!;
    expect(toast.status).toBe('success');
    expect(toast.description).toBeTruthy();
    useToasts.setState({ toasts: [] });
    await deriveFrom(picture({ metadata: { ...metadata, refImageCount: undefined, controlLayerCount: undefined, maskBlur: undefined } }), 'subtle', 1);
    expect(useToasts.getState().toasts[0]!.description).toBeUndefined();
    // References that were stored are used, so nothing is reported as lost.
    useToasts.setState({ toasts: [] });
    await deriveFrom(picture({ metadata: { ...metadata, refImages: [reference], controlLayerCount: undefined, maskBlur: undefined } }), 'variation', 1);
    expect(useToasts.getState().toasts[0]!.description).toBeUndefined();
  });

  it('queues nothing and says why when the original model is not installed', async () => {
    useModels.getState().setModels([]);
    const enqueue = vi.spyOn(backend, 'enqueue').mockResolvedValue([]);
    await deriveFrom(picture(), 'variation', 1);
    expect(enqueue).not.toHaveBeenCalled();
    expect(useToasts.getState().toasts[0]!.status).toBe('error');
  });

  it('reports a failed enqueue instead of throwing', async () => {
    vi.spyOn(backend, 'enqueue').mockRejectedValue(new Error('queue is full'));
    await deriveFrom(picture(), 'variation', 1);
    const toast = useToasts.getState().toasts[0]!;
    expect(toast.status).toBe('error');
    expect(toast.description).toBe('queue is full');
  });
});

describe('pictures a derived picture gave its model as references', () => {
  it('carries them over as request fields', () => {
    const pictures = ['http://novira-image.localhost/full/mina.png'];
    for (const kind of ['variation', 'subtle'] as const) {
      const req = buildDerivedRequest(picture({ metadata: { ...metadata, referencePictures: pictures } }), kind, 1);
      expect(req.referencePictures).toEqual(pictures);
      expect(req.params.referencePictures).toBeUndefined();
    }
    expect(buildDerivedRequest(picture({ metadata }), 'variation', 1).referencePictures).toBeUndefined();
  });
});
