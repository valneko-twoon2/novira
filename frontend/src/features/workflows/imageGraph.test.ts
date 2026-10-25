import { beforeEach, describe, expect, it } from 'vitest';
import type { GenerationMetadata, ImageDTO, ModelConfig } from '@/backend';
import { useModels } from '@/state/models';
import { buildRequest } from './invokeBuilder';
import { canBuildFromImage, graphFromImage } from './imageGraph';

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

const MODELS = [model('wai', 'main', 'sdxl'), model('old', 'main', 'sd-1'), model('flux', 'main', 'flux'), model('detail', 'lora', 'sdxl'), model('vae-x', 'vae', 'sdxl')];

const meta = (over: Partial<GenerationMetadata> = {}): GenerationMetadata => ({
  generationMode: 'txt2img',
  positivePrompt: '1girl, smile',
  negativePrompt: 'blurry',
  modelKey: 'wai',
  modelName: 'wai',
  vaeKey: null,
  seed: 12345,
  steps: 28,
  cfgScale: 6,
  cfgRescale: 0,
  scheduler: 'euler_a',
  width: 832,
  height: 1216,
  clipSkip: 0,
  seamlessX: false,
  seamlessY: false,
  loras: [],
  ...over,
});

const image = (m: GenerationMetadata | null, over: Partial<ImageDTO> = {}): ImageDTO => ({
  name: 'a.png',
  url: '',
  thumbnailUrl: '',
  width: 832,
  height: 1216,
  createdAt: 0,
  boardId: null,
  starred: false,
  isIntermediate: false,
  category: 'general',
  metadata: m,
  workflow: null,
  ...over,
});

beforeEach(() => useModels.setState({ models: MODELS }));

describe('workflow from a generated image', () => {
  it('rebuilds the same request the generation screen sent', () => {
    const m = meta({ vaeKey: 'vae-x', loras: [{ key: 'detail', weight: 0.7, isEnabled: true }, { key: 'detail', weight: 0.2, isEnabled: false }] });
    const built = graphFromImage(image(m), MODELS)!;
    expect(built.lost).toEqual([]);
    const req = buildRequest(built.graph, null, { prepend: false });
    expect(req.params).toMatchObject({
      modelKey: 'wai',
      positivePrompt: '1girl, smile',
      negativePrompt: 'blurry',
      seed: 12345,
      steps: 28,
      cfgScale: 6,
      scheduler: 'euler_a',
      width: 832,
      height: 1216,
      vaeKey: 'vae-x',
      loras: [{ key: 'detail', weight: 0.7, isEnabled: true }],
    });
    expect(req.randomizeSeed).toBe(false);
  });

  it('uses the SD 1.5 nodes for an SD 1.5 model', () => {
    const built = graphFromImage(image(meta({ modelKey: 'old' })), MODELS)!;
    expect(built.graph.nodes.some((n) => n.data.type === 'main_model_loader')).toBe(true);
    expect(built.graph.nodes.some((n) => n.data.type === 'sdxl_model_loader')).toBe(false);
  });

  it('says what the graph does not carry', () => {
    const built = graphFromImage(image(meta({ generationMode: 'img2img', clipSkip: 2, seamlessX: true, refImageCount: 1 })), MODELS)!;
    expect(built.lost).toHaveLength(4);
  });

  it('refuses what it cannot rebuild', () => {
    expect(canBuildFromImage(image(null), MODELS)).toBe(false);
    expect(canBuildFromImage(image(meta({ modelKey: 'flux' })), MODELS)).toBe(false);
    expect(canBuildFromImage(image(meta({ modelKey: 'gone' })), MODELS)).toBe(false);
    expect(canBuildFromImage(image(meta({ generationMode: 'upscale' })), MODELS)).toBe(false);
    expect(canBuildFromImage(image(meta({ generationMode: 'video' })), MODELS)).toBe(false);
    expect(canBuildFromImage(image(meta(), { mediaType: 'video' }), MODELS)).toBe(false);
  });
});
