// Unit tests for readiness and request building (the expansion itself: state/prompts/dynamicPrompts.test.ts).
import { beforeEach, describe, expect, it } from 'vitest';
import type { ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { useModelParts } from '@/state/modelParts';
import { useModels } from '@/state/models';
import { DEFAULT_HIRES, useParams } from '@/state/params';
import { useWildcards } from '@/state/prompts/wildcards';
import { buildGenerateRequest, buildUpscaleRequest, dynamicBatches } from './buildRequest';
import { autoSelectModels } from './model/autoSelect';
import { modelProfile, profileMismatches } from './model/modelProfile';
import { applyRecommended } from './model/selectMainModel';
import { generateReadiness, generateWarnings, paramsReadiness, upscaleReadiness } from './readiness';

const model = (key: string, type: ModelConfig['type'], base: ModelConfig['base'], name = key): ModelConfig => ({
  key,
  name,
  base,
  type,
  format: 'checkpoint',
  description: '',
  path: '',
  size: 0,
  source: '',
});

describe('params builders', () => {
  beforeEach(() => {
    useModels.getState().setModels([
      model('main-xl', 'main', 'sdxl'),
      model('lora-sd1', 'lora', 'sd-1'),
      model('up', 'spandrel_image_to_image', 'any'),
      model('cn-canny', 'controlnet', 'sdxl', 'canny'),
      model('cn-tile', 'controlnet', 'sdxl', 'tile-xl'),
      model('ipa-xl', 'ip_adapter', 'sdxl'),
      { ...model('clip-h', 'clip_vision', 'any'), path: 'C:\\models\\CLIP-ViT-H-14.safetensors' },
    ]);
    useParams.setState({ modelKey: null, loras: [], refImages: [], positivePrompt: 'a cat', hires: DEFAULT_HIRES, dynamicPromptMode: 'combinatorial', iterations: 1 });
    useWildcards.setState({ lists: [{ id: 'w1', name: 'pet', text: 'cat\ndog\n# not an entry\n\nfox' }] });
    useNodePacks.setState({ packs: null });
    useParams.getState().setUpscale({ initialImage: null, upscaleModelKey: null, tileControlnetModelKey: null });
    // The main model is the user's to choose; nothing picks it.
    autoSelectModels();
    expect(useParams.getState().modelKey).toBeNull();
    useParams.setState({ modelKey: 'main-xl' });
    autoSelectModels();
  });

  it('picks the default upscale and a tile ControlNet for the chosen main model, but never the main model itself', () => {
    expect(useParams.getState().modelKey).toBe('main-xl');
    expect(useParams.getState().upscale.upscaleModelKey).toBe('up');
    expect(useParams.getState().upscale.tileControlnetModelKey).toBe('cn-tile');
  });

  it('reports incompatible LoRAs and incomplete reference images', () => {
    useParams.getState().addLora('lora-sd1');
    useParams.getState().addRefImage();
    expect(paramsReadiness({ refImages: true })).toHaveLength(3);
  });

  it('sends the enabled, complete reference images with the generate request', async () => {
    const p = useParams.getState();
    p.addRefImage({ imageName: 'r.png', imageUrl: 'http://novira-image.localhost/full/r.png', modelKey: 'ipa-xl', method: 'style', weight: 0.6, beginEnd: [0.1, 0.9] });
    p.addRefImage({ isEnabled: false, imageName: 'off.png', imageUrl: 'http://novira-image.localhost/full/off.png', modelKey: 'ipa-xl' });
    const req = await buildGenerateRequest(false);
    expect(req.params.refImageCount).toBe(1);
    expect(req.refImages).toEqual([
      { imageUrl: 'http://novira-image.localhost/full/r.png', modelKey: 'ipa-xl', clipVisionModel: 'ViT-H', weight: 0.6, beginEnd: [0.1, 0.9], method: 'style' },
    ]);
    useParams.setState({ refImages: [] });
    const plain = await buildGenerateRequest(false);
    expect(plain.refImages).toBeUndefined();
    expect(plain.params.refImageCount).toBeUndefined();
  });

  it('asks for the image encoder the reference image needs before the job runs, and not once it is installed', () => {
    useParams.getState().addRefImage({ imageName: 'r.png', imageUrl: 'http://novira-image.localhost/full/r.png', modelKey: 'ipa-xl' });
    const reason = t('params.readiness.refNeedsEncoder', { size: 'ViT-H' });
    expect(paramsReadiness({ refImages: true })).toEqual([]);
    useModels.getState().setModels(useModels.getState().models.filter((m) => m.type !== 'clip_vision'));
    expect(paramsReadiness({ refImages: true })).toEqual([reason]);
    expect(paramsReadiness({ refImages: false })).toEqual([]);
  });

  it('puts the missing parts of the chosen model first, and drops the reason once none is missing', () => {
    const key = useParams.getState().modelKey!;
    const missing = { id: 'te', name: 'qwen_3_06b_base', base: 'any' as const, type: 'text_encoder' as const, description: '', source: 'r::te.safetensors' };
    useModelParts.getState().setReport({ modelKey: key, modelName: 'M', missing: [missing], unavailable: [] });
    expect(paramsReadiness({ refImages: true })[0]).toBe(t('params.readiness.modelNeedsParts', { model: 'M', parts: 'qwen_3_06b_base' }));
    useModelParts.getState().setReport({ modelKey: key, modelName: 'M', missing: [], unavailable: [] });
    expect(paramsReadiness({ refImages: true })).toEqual([]);
    useModelParts.setState({ reports: {} });
  });

  it('asks for the IP-Adapter pack only while it is known to be missing', () => {
    useParams.getState().addRefImage({ imageName: 'r.png', imageUrl: 'http://novira-image.localhost/full/r.png', modelKey: 'ipa-xl' });
    const reason = t('params.readiness.refNeedsPack', { pack: 'ComfyUI_IPAdapter_plus' });
    expect(paramsReadiness({ refImages: true })).toEqual([]);
    useNodePacks.setState({ packs: { available: true, installed: [], comfyVersion: null, restartNeeded: false } });
    expect(paramsReadiness({ refImages: true })).toEqual([reason]);
    useNodePacks.setState({ packs: { available: true, installed: [{ folder: 'ComfyUI_IPAdapter_plus', url: null, version: null }], comfyVersion: null, restartNeeded: true } });
    expect(paramsReadiness({ refImages: true })).toEqual([]);
    // An external ComfyUI: novira cannot tell, the backend checks before the job runs.
    useNodePacks.setState({ packs: { available: false, installed: [], comfyVersion: null, restartNeeded: false } });
    expect(paramsReadiness({ refImages: true })).toEqual([]);
  });

  it('sends the high-resolution fix only from the Generate tab, and only when it is on', async () => {
    expect((await buildGenerateRequest(false)).params.hiresFix).toBeUndefined();
    useParams.getState().setHires({ enabled: true, upscaleModelKey: 'up', steps: 10 });
    expect((await buildGenerateRequest(false)).params.hiresFix).toEqual({ scale: 1.5, strength: 0.45, upscaleModelKey: 'up', steps: 10 });
    const image = { name: 'i', url: 'u', thumbnailUrl: 'u', width: 300, height: 200 } as never;
    useParams.getState().setUpscale({ initialImage: image });
    expect((await buildUpscaleRequest(false)).params.hiresFix).toBeUndefined();
  });

  it('never sends a manga finish, and asks nothing of its pack', async () => {
    useNodePacks.setState({ packs: { available: true, installed: [], comfyVersion: null, restartNeeded: false } });
    expect((await buildGenerateRequest(false)).params.mangaScreen).toBeUndefined();
    expect(generateReadiness()).toEqual([]);
  });

  it('blocks a missing upscale model of the fix and only warns about a size the model may not draw well', () => {
    useParams.setState({ width: 1024, height: 1024 });
    useParams.getState().setHires({ enabled: true, scale: 2, upscaleModelKey: 'gone' });
    expect(generateReadiness()).toEqual([t('params.readiness.hiresNoModel')]);
    // 2048 on the long side is still comfortable for SDXL.
    expect(generateWarnings()).toEqual([]);
    useParams.getState().setHires({ upscaleModelKey: null, scale: 2.05 });
    useParams.setState({ width: 1024, height: 1040 });
    expect(generateReadiness()).toEqual([]);
    expect(generateWarnings()).toEqual([t('params.readiness.hiresLarge', { width: 2096, height: 2136, base: 'SDXL', max: 2048 })]);
    useParams.getState().setHires({ enabled: false });
    expect(generateWarnings()).toEqual([]);
  });

  it('blocks Invoke on a wildcard without a list, and expands the known ones', () => {
    useParams.setState({ positivePrompt: 'a __pet__ and a __bird__' });
    expect(generateReadiness()).toEqual([t('params.readiness.wildcardUnknown', { name: '__bird__' })]);
    useParams.setState({ positivePrompt: 'a __pet__' });
    expect(generateReadiness()).toEqual([]);
    const base = { origin: 'generate', destination: 'gallery', iterations: 2, randomizeSeed: false, prepend: false, boardId: null } as const;
    const batches = dynamicBatches({ ...base, params: { positivePrompt: 'a __pet__', seed: 5 } as never });
    expect(batches.map((b) => [b.params.positivePrompt, b.iterations])).toEqual([
      ['a cat', 2],
      ['a dog', 2],
      ['a fox', 2],
    ]);
  });

  it('random mode makes one picture per count, each prompt fixed by its own seed', () => {
    useParams.setState({ dynamicPromptMode: 'random' });
    const base = { origin: 'generate', destination: 'gallery', iterations: 4, randomizeSeed: false, prepend: false, boardId: null } as const;
    const req = { ...base, params: { positivePrompt: 'a {red|blue} __pet__', seed: 100 } as never };
    const batches = dynamicBatches(req);
    expect(batches.map((b) => [b.params.seed, b.iterations, b.randomizeSeed])).toEqual([
      [100, 1, false],
      [101, 1, false],
      [102, 1, false],
      [103, 1, false],
    ]);
    expect(dynamicBatches(req).map((b) => b.params.positivePrompt)).toEqual(batches.map((b) => b.params.positivePrompt));
    for (const b of batches) expect(b.params.positivePrompt).toMatch(/^a (red|blue) (cat|dog|fox)$/);
    // Random seeds: still one picture per count, each with the seed its prompt was picked with.
    const random = dynamicBatches({ ...req, randomizeSeed: true });
    expect(random).toHaveLength(4);
    expect(random.every((b) => b.randomizeSeed === false && b.iterations === 1)).toBe(true);
    // A plain prompt is not split.
    expect(dynamicBatches({ ...base, params: { positivePrompt: 'a cat', seed: 1 } as never })).toHaveLength(1);
  });

  it('builds an upscale request from the initial image', async () => {
    expect(upscaleReadiness()).toHaveLength(1);
    const image = { name: 'i', url: 'u', thumbnailUrl: 'u', width: 300, height: 200 } as never;
    useParams.getState().setUpscale({ initialImage: image, scale: 2, postProcessingModelKey: 'up' });
    expect(upscaleReadiness()).toEqual([]);
    const req = await buildUpscaleRequest(false);
    expect(req.origin).toBe('upscaling');
    expect(req.initImageUrl).toBe('u');
    expect(req.params).toMatchObject({ generationMode: 'upscale', width: 300, height: 200, upscaleScale: 2, upscaleModelKey: 'up', tileControlnetModelKey: 'cn-tile', postProcessingModelKey: 'up' });
  });

  it('upscales without a tile ControlNet when none fits the main model (Anima has none)', async () => {
    useModels.getState().setModels([...useModels.getState().models, model('main-anima', 'main', 'anima')]);
    const image = { name: 'i', url: 'u', thumbnailUrl: 'u', width: 300, height: 200 } as never;
    useParams.getState().setUpscale({ initialImage: image });
    useParams.setState({ modelKey: 'main-anima' });
    // The SDXL tile is still the stored choice until the models are matched again; it is not sent with an Anima model.
    expect(useParams.getState().upscale.tileControlnetModelKey).toBe('cn-tile');
    expect(upscaleReadiness()).toEqual([]);
    expect((await buildUpscaleRequest(false)).params.tileControlnetModelKey).toBeUndefined();
    autoSelectModels();
    expect(useParams.getState().upscale.tileControlnetModelKey).toBeNull();
    // A stored tile whose model was removed is left out too.
    useParams.setState({ modelKey: 'main-xl' });
    useParams.getState().setUpscale({ tileControlnetModelKey: 'gone' });
    expect((await buildUpscaleRequest(false)).params.tileControlnetModelKey).toBeUndefined();
  });
});

describe('apply recommended', () => {
  it('sets the fallback values of a model without saved defaults, so nothing is left mismatched', () => {
    const wai = model('wai', 'main', 'sdxl', 'waiIllustriousSDXL_v170');
    useModels.setState({ models: [wai] });
    useParams.getState().set({ modelKey: 'wai', steps: 12, cfgScale: 9, scheduler: 'dpmpp_2m_k', width: 832, height: 1216 });
    applyRecommended(wai);
    const s = useParams.getState();
    expect(profileMismatches(modelProfile(wai), s)).toEqual([]);
    expect(s.scheduler).toBe(modelProfile(wai).scheduler);
    expect(s.aspectRatio).toBe('1:1');
  });
});

describe('recommended steps range', () => {
  const settings = { cfgScale: 4.5, scheduler: 'euler' as const, width: 1024, height: 1024 };
  it('flags Anima below 24 of its 30 steps, where riakuLab drew a flat blue picture at 17', () => {
    const anima = modelProfile(model('a', 'main', 'anima'));
    expect(anima.stepsRange).toEqual([24, 38]);
    expect(profileMismatches(anima, { ...settings, steps: 17 })).toContain('steps');
    expect(profileMismatches(anima, { ...settings, steps: 23 })).toContain('steps');
    expect(profileMismatches(anima, { ...settings, steps: 24 })).not.toContain('steps');
    expect(profileMismatches(anima, { ...settings, steps: 38 })).not.toContain('steps');
    expect(profileMismatches(anima, { ...settings, steps: 39 })).toContain('steps');
  });

  it('keeps the wider lower bound of the other families', () => {
    expect(modelProfile(model('x', 'main', 'sdxl')).stepsRange).toEqual([15, 35]);
    expect(modelProfile(model('f', 'main', 'flux')).stepsRange).toEqual([15, 35]);
  });

  it('takes the share of the steps a model saved for itself', () => {
    const own = { ...model('a', 'main', 'anima'), defaultSettings: { steps: 40 } };
    expect(modelProfile(own).stepsRange).toEqual([32, 50]);
  });
});
