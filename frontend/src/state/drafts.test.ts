import { afterEach, describe, expect, it, vi } from 'vitest';
import { backend, draftStep, type EnqueueRequest, type QueueItem, type RefImageInput } from '@/backend';
import type { GenerationMetadata, ModelConfig } from '@/backend';
import { registerInvokeBuilder } from './invoke';
import { useModels } from './models';
import { draftModels, draftRefusal, modelsWithoutDrafts, syncGroups, useDrafts, withModel, type DraftGroup } from './drafts';

const candidate = (over: Partial<DraftGroup['candidates'][number]> = {}): DraftGroup['candidates'][number] => ({
  id: 'c1',
  seed: 5,
  itemId: 1,
  imageName: null,
  status: 'queued',
  error: null,
  finalItemId: null,
  finalImageName: null,
  finalStatus: null,
  verdict: null,
  ...over,
});

const group = (c = candidate()): DraftGroup => ({
  id: 'g',
  createdAt: 0,
  params: { steps: 28 } as DraftGroup['params'],
  boardId: null,
  position: 0.35,
  candidates: [c],
});

const item = (id: number, status: QueueItem['status'], imageName: string | null = null, error: string | null = null) =>
  ({ id, status, imageName, error }) as QueueItem;

describe('draftStep', () => {
  it('keeps the draft readable and leaves at least two steps', () => {
    expect(draftStep(28, 0.35)).toBe(10);
    expect(draftStep(28, 0.1)).toBe(6);
    expect(draftStep(28, 0.99)).toBe(26);
  });
});

describe('syncGroups', () => {
  it('follows the queue item from waiting to the finished draft', () => {
    const groups = [group()];
    expect(syncGroups(groups, [item(1, 'in_progress')])[0]!.candidates[0]!.status).toBe('running');
    const done = syncGroups(groups, [item(1, 'completed', 'a.png')])[0]!.candidates[0]!;
    expect(done).toMatchObject({ status: 'ready', imageName: 'a.png' });
  });

  it('keeps a finished draft after its queue item is gone, and fails one that never produced an image', () => {
    expect(syncGroups([group(candidate({ status: 'ready', imageName: 'a.png' }))], [])[0]!.candidates[0]!.status).toBe('ready');
    expect(syncGroups([group()], [])[0]!.candidates[0]!.status).toBe('failed');
  });

  it('tracks the finishing run separately and returns the same array when nothing changed', () => {
    const groups = [group(candidate({ status: 'ready', imageName: 'a.png', finalItemId: 2, finalStatus: 'queued' }))];
    const next = syncGroups(groups, [item(1, 'completed', 'a.png'), item(2, 'completed', 'b.png')]);
    expect(next[0]!.candidates[0]).toMatchObject({ finalStatus: 'ready', finalImageName: 'b.png' });
    expect(syncGroups(next, [item(1, 'completed', 'a.png'), item(2, 'completed', 'b.png')])).toBe(next);
  });

  it('records why a draft failed', () => {
    const c = syncGroups([group()], [item(1, 'failed', null, 'no GPU')])[0]!.candidates[0]!;
    expect(c).toMatchObject({ status: 'failed', error: 'no GPU' });
  });
});

describe('withModel', () => {
  const model = (key: string, base: ModelConfig['base'], defaultSettings?: ModelConfig['defaultSettings']): ModelConfig => ({
    key,
    name: key,
    base,
    type: 'main',
    format: 'checkpoint',
    description: '',
    path: '',
    size: 0,
    source: '',
    defaultSettings,
  });
  const params = { modelKey: 'a', modelName: 'a', vaeKey: 'vae', loras: [{ key: 'l', weight: 1, isEnabled: true }], steps: 30, cfgScale: 7, scheduler: 'euler', width: 1024, height: 1024 } as unknown as GenerationMetadata;

  it('keeps everything else when the new model is of the same family', () => {
    useModels.setState({ models: [model('a', 'sdxl'), model('b', 'sdxl')] });
    const next = withModel(params, 'b');
    expect(next).toMatchObject({ modelKey: 'b', modelName: 'b', vaeKey: 'vae', steps: 30 });
    expect(next.loras).toHaveLength(1);
  });

  it('drops the VAE and LoRAs and takes the new defaults for another family', () => {
    useModels.setState({ models: [model('a', 'sdxl'), model('c', 'sd-1', { steps: 25, cfgScale: 7.5, scheduler: 'euler_a', width: 512, height: 512 })] });
    const next = withModel(params, 'c');
    expect(next).toMatchObject({ modelKey: 'c', vaeKey: null, steps: 25, cfgScale: 7.5, scheduler: 'euler_a', width: 512, height: 512 });
    expect(next.loras).toEqual([]);
  });

  it('leaves the settings alone without a different known model', () => {
    useModels.setState({ models: [model('a', 'sdxl')] });
    expect(withModel(params, null)).toBe(params);
    expect(withModel(params, 'a')).toBe(params);
    expect(withModel(params, 'gone')).toBe(params);
  });
});

describe('the models that make drafts', () => {
  const m = (key: string, base: ModelConfig['base'], type: ModelConfig['type'], path = `${key}.safetensors`) =>
    ({ key, name: key, base, type, path }) as ModelConfig;
  const installed = [
    m('xl', 'sdxl', 'main'),
    m('one-five', 'sd-1', 'main'),
    m('anima', 'anima', 'diffusion_model', 'D:\\models\\diffusion_models\\nyanyaHarem_anima.safetensors'),
    m('flux-dev', 'flux', 'diffusion_model'),
    m('flux2-klein', 'flux2', 'diffusion_model'),
    m('z-image', 'z-image', 'diffusion_model'),
    m('chroma', 'chroma', 'diffusion_model'),
    m('qwen', 'qwen-image', 'diffusion_model'),
    m('hidream', 'hidream', 'diffusion_model'),
    m('sd3', 'sd-3', 'main'),
    m('aura', 'auraflow', 'diffusion_model'),
    m('hunyuan', 'hunyuan-image', 'diffusion_model'),
    m('kontext', 'flux', 'diffusion_model', 'models/flux1-kontext-dev.safetensors'),
    m('fill', 'flux', 'diffusion_model', 'models/FLUX1-Fill-dev.safetensors'),
    m('qwen-edit', 'qwen-image', 'diffusion_model', 'models/qwen_image_edit_2509.safetensors'),
    m('wan', 'wan', 'diffusion_model'),
    m('ltx', 'ltx-video', 'main'),
    m('lora', 'sdxl', 'lora'),
    m('anima-encoder', 'anima', 'text_encoder' as ModelConfig['type']),
  ];

  it('offers every picture family the Generate tab draws with, diffusion models included, newest family first', () => {
    expect(draftModels(installed).map((x) => x.key)).toEqual([
      'qwen',
      'z-image',
      'anima',
      'hidream',
      'chroma',
      'flux2-klein',
      'flux-dev',
      'aura',
      'hunyuan',
      'sd3',
      'xl',
      'one-five',
    ]);
  });

  it('leaves out the edit models and names them, and no video model or other kind', () => {
    expect(modelsWithoutDrafts(installed).map((x) => x.key)).toEqual(['kontext', 'fill', 'qwen-edit']);
    expect(draftRefusal(m('kontext', 'flux', 'diffusion_model', 'flux1-kontext-dev.gguf'))).toBe('edit');
    // Only the file name counts, not a folder named like an edit model.
    expect(draftRefusal(m('dev', 'flux', 'diffusion_model', 'D:\\fill\\kontext\\flux1-dev.safetensors'))).toBeNull();
    // The words only count for the family whose edit model they name.
    expect(draftRefusal(m('fill-style', 'sdxl', 'main', 'fillStyleXL.safetensors'))).toBeNull();
    expect(draftRefusal(m('edit-mix', 'anima', 'diffusion_model', 'editMix.safetensors'))).toBeNull();
    expect(draftRefusal(m('no-path', 'qwen-image', 'diffusion_model', ''))).toBeNull();
  });

  it('does not start drafts with an edit model', async () => {
    useModels.setState({ models: installed });
    const request = {
      origin: 'generate',
      destination: 'gallery',
      params: { generationMode: 'txt2img', seed: 1, steps: 20, modelKey: 'xl', modelName: 'xl' } as GenerationMetadata,
      iterations: 1,
      randomizeSeed: false,
      prepend: false,
      boardId: null,
    } satisfies EnqueueRequest;
    registerInvokeBuilder('generate', { readiness: () => [], build: async () => request });
    const enqueue = vi.spyOn(backend, 'enqueue').mockImplementation(async (r) => [{ id: 1, params: r.params } as QueueItem]);
    expect(await useDrafts.getState().start(2, 0.35, 'kontext')).toEqual({ error: 'edit-model' });
    expect(enqueue).not.toHaveBeenCalled();
    expect(useDrafts.getState().busy).toBe(false);
    // A diffusion model of a newer family drafts like any other.
    expect(await useDrafts.getState().start(2, 0.35, 'anima')).toBeNull();
    expect(enqueue.mock.calls[0]![0].params).toMatchObject({ modelKey: 'anima', draftAt: 0.35 });
    vi.restoreAllMocks();
  });
});

describe('draft batches with reference images', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends the reference images with the drafts and again when one is finished', async () => {
    const refImages: RefImageInput[] = [
      { imageUrl: 'http://novira-image.localhost/full/r.png', modelKey: 'ipa', clipVisionModel: 'ViT-H', weight: 1, beginEnd: [0, 1], method: 'full' },
    ];
    const request = {
      origin: 'generate',
      destination: 'gallery',
      params: { generationMode: 'txt2img', seed: 1, steps: 20, refImageCount: 1 } as GenerationMetadata,
      iterations: 1,
      randomizeSeed: false,
      prepend: false,
      boardId: null,
      refImages,
    } satisfies EnqueueRequest;
    registerInvokeBuilder('generate', { readiness: () => [], build: async () => request });
    const enqueue = vi.spyOn(backend, 'enqueue').mockImplementation(async (r) => [{ id: 1, params: r.params } as QueueItem]);
    expect(await useDrafts.getState().start(1, 0.35, null)).toBeNull();
    const g = useDrafts.getState().groups.at(-1)!;
    await useDrafts.getState().finish(g.id, [g.candidates[0]!.id]);
    expect(enqueue.mock.calls.map(([r]) => [r.params.draftAt, r.refImages])).toEqual([
      [0.35, refImages],
      [undefined, refImages],
    ]);
  });

  it('draws the drafts without the high-resolution fix and finishes with it', async () => {
    const hiresFix = { scale: 1.5, strength: 0.45 };
    const request = {
      origin: 'generate',
      destination: 'gallery',
      params: { generationMode: 'txt2img', seed: 1, steps: 20, hiresFix } as GenerationMetadata,
      iterations: 1,
      randomizeSeed: false,
      prepend: false,
      boardId: null,
    } satisfies EnqueueRequest;
    registerInvokeBuilder('generate', { readiness: () => [], build: async () => request });
    const enqueue = vi.spyOn(backend, 'enqueue').mockImplementation(async (r) => [{ id: 1, params: r.params } as QueueItem]);
    expect(await useDrafts.getState().start(1, 0.35, null)).toBeNull();
    const g = useDrafts.getState().groups.at(-1)!;
    await useDrafts.getState().finish(g.id, [g.candidates[0]!.id]);
    expect(enqueue.mock.calls.map(([r]) => r.params.hiresFix)).toEqual([undefined, hiresFix]);
  });
});
