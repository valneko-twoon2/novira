import { beforeEach, describe, expect, it } from 'vitest';
import type { ModelConfig, ModelInstallJob } from '@/backend';
import { BASE_LABELS, BASE_ORDER, checkpointModels, drawableModels, findModel, isDrawable, isVideoModel, modelsOfType, useModels } from './models';

const initial = useModels.getState();
beforeEach(() => useModels.setState(initial, true));

const model = (key: string, over: Partial<ModelConfig> = {}): ModelConfig => ({
  key,
  name: key,
  base: 'sdxl',
  type: 'main',
  format: 'checkpoint',
  description: '',
  path: key,
  size: 0,
  source: key,
  ...over,
});

const job = (id: string, status: ModelInstallJob['status']): ModelInstallJob => ({ id, source: id, name: id, status, bytes: 0, totalBytes: 1 });

describe('models store', () => {
  it('upserts models by key and clears the detail panel when its model is removed', () => {
    const m = useModels.getState();
    m.setModels([model('a'), model('b')]);
    m.upsertModel(model('a', { name: 'A2' }));
    m.upsertModel(model('c'));
    expect(useModels.getState().models.map((x) => x.name)).toEqual(['A2', 'b', 'c']);
    useModels.getState().setSelectedKey('b');
    useModels.getState().removeModel('a');
    expect(useModels.getState().selectedKey).toBe('b');
    useModels.getState().removeModel('b');
    expect(useModels.getState().selectedKey).toBeNull();
  });

  it('toggles favorites', () => {
    useModels.getState().toggleFavorite('a');
    useModels.getState().toggleFavorite('b');
    useModels.getState().toggleFavorite('a');
    expect(useModels.getState().favorites).toEqual(['b']);
  });

  it('puts new install jobs first and clears only finished ones', () => {
    const statuses: [string, ModelInstallJob['status']][] = [
      ['w', 'waiting'],
      ['d', 'downloading'],
      ['r', 'running'],
      ['c', 'completed'],
      ['e', 'error'],
      ['x', 'cancelled'],
    ];
    for (const [id, status] of statuses) useModels.getState().upsertInstallJob(job(id, status));
    expect(useModels.getState().installJobs.map((j) => j.id)).toEqual(['x', 'e', 'c', 'r', 'd', 'w']);
    useModels.getState().upsertInstallJob(job('w', 'downloading'));
    expect(useModels.getState().installJobs.at(-1)?.status).toBe('downloading');
    useModels.getState().clearFinishedJobs();
    expect(useModels.getState().installJobs.map((j) => j.id)).toEqual(['r', 'd', 'w']);
  });

  it('filters models by type and base, including base-independent models', () => {
    const list = [model('xl'), model('sd1', { base: 'sd-1' }), model('any', { base: 'any' }), model('lora', { type: 'lora' })];
    expect(modelsOfType(list, 'main', 'sdxl').map((m) => m.key)).toEqual(['xl', 'any']);
    expect(modelsOfType(list, 'main').map((m) => m.key)).toEqual(['xl', 'sd1', 'any']);
    expect(modelsOfType(list, 'lora', 'sdxl').map((m) => m.key)).toEqual(['lora']);
  });

  it('finds a model by key', () => {
    useModels.getState().setModels([model('a')]);
    expect(findModel('a')?.key).toBe('a');
    expect(findModel('zz')).toBeUndefined();
    expect(findModel(null)).toBeUndefined();
  });
});

describe('drawable models', () => {
  it('counts main models and diffusion models of the families that load in parts, and nothing else', () => {
    expect(isDrawable(model('a', { type: 'main' }))).toBe(true);
    expect(isDrawable(model('b', { type: 'diffusion_model', base: 'anima' }))).toBe(true);
    expect(isDrawable(model('c', { type: 'diffusion_model', base: 'qwen-image' }))).toBe(true);
    // A video model has no image recipe; a text encoder or a LoRA is never drawn with.
    expect(isDrawable(model('g', { type: 'diffusion_model', base: 'hidream' }))).toBe(true);
    expect(isDrawable(model('d', { type: 'diffusion_model', base: 'wan' }))).toBe(false);
    // A video family's checkpoint (LTX-Video) is a main model, but the picture graph does not run it.
    expect(isDrawable(model('h', { type: 'main', base: 'ltx-video' }))).toBe(false);
    expect(isVideoModel(model('h', { type: 'main', base: 'ltx-video' }))).toBe(true);
    expect(isVideoModel(model('i', { type: 'main', base: 'sdxl' }))).toBe(false);
    expect(isDrawable(model('e', { type: 'diffusion_model', base: 'any' }))).toBe(false);
    expect(isDrawable(model('f', { type: 'text_encoder', base: 'anima' }))).toBe(false);
    expect(drawableModels([model('a'), model('b', { type: 'lora' }), model('c', { type: 'diffusion_model', base: 'flux' })]).map((m) => m.key)).toEqual([
      'a',
      'c',
    ]);
  });

  it('gives a whole-checkpoint graph the drawable main models only: no diffusion model, no video checkpoint', () => {
    const models = [model('a'), model('b', { type: 'diffusion_model', base: 'anima' }), model('h', { type: 'main', base: 'ltx-video' }), model('l', { type: 'lora' })];
    expect(checkpointModels(models).map((m) => m.key)).toEqual(['a']);
  });
});

describe('base order', () => {
  it('lists every base model once, so a model list drops none of them', () => {
    expect([...BASE_ORDER].sort()).toEqual(Object.keys(BASE_LABELS).sort());
  });
});
