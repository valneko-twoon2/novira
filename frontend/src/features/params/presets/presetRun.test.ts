// The random preset run: picking a preset per picture, a seed per picture, building from a copy of the form, and queueing.
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { backend, type BackendClient, type ModelConfig, type QueueItem } from '@/backend';
import { useModels } from '@/state/models';
import { DEFAULT_HIRES, useParams } from '@/state/params';
import { useImagePresets, type GenerationPreset } from '@/state/presets/imagePresets';
import { MAX_RUN_COUNT, usePresetRun } from '@/state/presets/presetRun';
import { useToasts } from '@/state/toasts';
import { chosenPresets, presetRunProblems, presetRunRequests, runPresets } from './presetRun';

const model = (key: string, type: ModelConfig['type'], base: ModelConfig['base']): ModelConfig => ({
  key,
  name: key,
  base,
  type,
  format: 'checkpoint',
  description: '',
  path: '',
  size: 0,
  source: '',
});

const lora = (key: string) => ({ id: key, key, name: key, weight: 0.8, isEnabled: true });

const portrait: GenerationPreset = {
  id: 'p-portrait',
  name: 'Portrait',
  data: { positivePrompt: 'a girl in a garden', modelKey: 'anime-xl', width: 832, height: 1216, steps: 28, cfgScale: 5, scheduler: 'euler_a', loras: [lora('style-xl')] },
};
const landscape: GenerationPreset = {
  id: 'p-landscape',
  name: 'Landscape',
  data: { positivePrompt: 'mountains at dawn', negativePrompt: 'people', modelKey: 'photo-xl', width: 1216, height: 832, steps: 40, cfgScale: 7, scheduler: 'dpmpp_2m_k', loras: [] },
};

/** Returns the given numbers in turn, as a random source. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

/** The parts of the form a run must not touch. */
const formFields = () => {
  const { set: _set, ...fields } = useParams.getState();
  return JSON.parse(JSON.stringify(fields)) as unknown;
};

beforeEach(() => {
  useModels.getState().setModels([model('anime-xl', 'main', 'sdxl'), model('photo-xl', 'main', 'sdxl'), model('form-xl', 'main', 'sdxl'), model('style-xl', 'lora', 'sdxl'), model('lora-sd1', 'lora', 'sd-1')]);
  useParams.setState({
    modelKey: 'form-xl',
    positivePrompt: 'my own prompt',
    negativePrompt: 'blurry',
    width: 1024,
    height: 1024,
    steps: 20,
    cfgScale: 6,
    loras: [],
    refImages: [],
    hires: DEFAULT_HIRES,
    initImage: null,
    iterations: 3,
    seed: 42,
    shouldRandomizeSeed: false,
    dynamicPromptMode: 'combinatorial',
  });
  useImagePresets.setState({ presets: [portrait, landscape], selectedId: null });
  usePresetRun.setState({ ids: [], count: 10 });
  useToasts.setState({ toasts: [] });
});

describe('presetRunRequests', () => {
  it('picks each picture\'s preset from the random source, every preset equally likely', () => {
    const requests = presetRunRequests([portrait, landscape], 5, { random: sequence(0, 0.49, 0.5, 0.99, 0.999999), seed: sequence(1) });
    expect(requests.map((r) => r.params.positivePrompt)).toEqual(['a girl in a garden', 'a girl in a garden', 'mountains at dawn', 'mountains at dawn', 'mountains at dawn']);
  });

  it('keeps a random source that reaches 1 on the last preset', () => {
    const [request] = presetRunRequests([portrait, landscape], 1, { random: () => 1, seed: () => 7 });
    expect(request!.params.positivePrompt).toBe('mountains at dawn');
  });

  it('makes one request per picture with its own seed, whatever the form\'s count and seed say', () => {
    const requests = presetRunRequests([portrait], 4, { random: () => 0, seed: sequence(11, 22, 33, 44) });
    expect(requests).toHaveLength(4);
    expect(requests.map((r) => r.params.seed)).toEqual([11, 22, 33, 44]);
    for (const r of requests) expect(r).toMatchObject({ iterations: 1, randomizeSeed: false, prepend: false, origin: 'generate', destination: 'gallery' });
  });

  it('draws with every setting of the preset and takes the rest from the form', () => {
    const [a, b] = presetRunRequests([portrait, landscape], 2, { random: sequence(0, 0.5), seed: () => 1 });
    expect(a!.params).toMatchObject({ positivePrompt: 'a girl in a garden', negativePrompt: 'blurry', modelKey: 'anime-xl', width: 832, height: 1216, steps: 28, cfgScale: 5, scheduler: 'euler_a' });
    expect(a!.params.loras).toEqual([lora('style-xl')]);
    expect(b!.params).toMatchObject({ positivePrompt: 'mountains at dawn', negativePrompt: 'people', modelKey: 'photo-xl', width: 1216, height: 832, steps: 40, cfgScale: 7, scheduler: 'dpmpp_2m_k', loras: [] });
  });

  it('leaves the form exactly as it was', () => {
    const before = formFields();
    const changed = vi.fn();
    const unsubscribe = useParams.subscribe(changed);
    presetRunRequests([portrait, landscape], 6, { random: sequence(0, 0.7), seed: sequence(1, 2) });
    presetRunProblems([portrait, landscape]);
    unsubscribe();
    expect(changed).not.toHaveBeenCalled();
    expect(formFields()).toEqual(before);
  });

  it('keeps the form\'s model for a preset whose model was removed', () => {
    const gone: GenerationPreset = { id: 'p-gone', name: 'Gone', data: { modelKey: 'deleted-xl', steps: 9 } };
    const [request] = presetRunRequests([gone], 1, { random: () => 0, seed: () => 1 });
    expect(request!.params).toMatchObject({ modelKey: 'form-xl', steps: 9, positivePrompt: 'my own prompt' });
  });

  it('draws one prompt per picture from a preset with dynamic prompts, even in every-combination mode', () => {
    const dynamic: GenerationPreset = { id: 'p-dyn', name: 'Dynamic', data: { positivePrompt: 'a {red|blue|green} car', dynamicPromptMode: 'combinatorial' } };
    const requests = presetRunRequests([dynamic], 3, { random: () => 0, seed: sequence(1, 2, 3) });
    expect(requests).toHaveLength(3);
    for (const r of requests) expect(r.params.positivePrompt).toMatch(/^a (red|blue|green) car$/);
  });

  it('makes nothing without presets or pictures', () => {
    expect(presetRunRequests([], 5)).toEqual([]);
    expect(presetRunRequests([portrait], 0)).toEqual([]);
  });
});

describe('chosenPresets and presetRunProblems', () => {
  it('keeps the chosen presets that still exist, in the list\'s order', () => {
    expect(chosenPresets(['p-landscape', 'deleted', 'p-portrait']).map((p) => p.id)).toEqual(['p-portrait', 'p-landscape']);
    expect(chosenPresets([])).toEqual([]);
  });

  it('names the preset that cannot be drawn', () => {
    const broken: GenerationPreset = { id: 'p-broken', name: 'Broken', data: { loras: [lora('lora-sd1')] } };
    expect(presetRunProblems([portrait, landscape])).toEqual([]);
    const problems = presetRunProblems([portrait, broken]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('Broken');
    expect(problems[0]).toContain('lora-sd1');
  });
});

describe('runPresets', () => {
  let enqueue: MockInstance<BackendClient['enqueue']>;
  beforeEach(() => {
    enqueue = vi.spyOn(backend, 'enqueue').mockImplementation(async (r) => [{ id: r.params.seed } as QueueItem]);
  });
  afterEach(() => enqueue.mockRestore());

  it('queues the chosen count from the chosen presets only', async () => {
    usePresetRun.setState({ ids: ['p-landscape', 'deleted'], count: 3 });
    await runPresets();
    expect(enqueue).toHaveBeenCalledTimes(3);
    for (const [r] of enqueue.mock.calls) expect(r.params.positivePrompt).toBe('mountains at dawn');
    expect(useToasts.getState().toasts[0]).toMatchObject({ status: 'success' });
    expect(useParams.getState()).toMatchObject({ positivePrompt: 'my own prompt', modelKey: 'form-xl', width: 1024, steps: 20 });
  });

  it('queues nothing with no preset chosen', async () => {
    await runPresets();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('warns and queues nothing when a chosen preset cannot be drawn', async () => {
    useImagePresets.setState({ presets: [portrait, { id: 'p-broken', name: 'Broken', data: { loras: [lora('lora-sd1')] } }] });
    usePresetRun.setState({ ids: ['p-portrait', 'p-broken'], count: 2 });
    await runPresets();
    expect(enqueue).not.toHaveBeenCalled();
    expect(useToasts.getState().toasts[0]).toMatchObject({ status: 'warning' });
  });

  it('reports a failed enqueue', async () => {
    enqueue.mockRejectedValue(new Error('queue is gone'));
    usePresetRun.setState({ ids: ['p-portrait'], count: 2 });
    await runPresets();
    expect(useToasts.getState().toasts[0]).toMatchObject({ status: 'error', description: 'queue is gone' });
  });
});

describe('usePresetRun', () => {
  it('ticks and unticks a preset', () => {
    usePresetRun.getState().toggle('a');
    usePresetRun.getState().toggle('b');
    usePresetRun.getState().toggle('a');
    expect(usePresetRun.getState().ids).toEqual(['b']);
  });

  it('keeps the count a whole number from 1 to the limit', () => {
    const counts = [0, -3, 2.6, MAX_RUN_COUNT + 1, Number.NaN].map((n) => {
      usePresetRun.getState().setCount(n);
      return usePresetRun.getState().count;
    });
    expect(counts).toEqual([1, 1, 3, MAX_RUN_COUNT, 1]);
  });
});
