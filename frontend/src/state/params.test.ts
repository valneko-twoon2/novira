import { beforeEach, describe, expect, it } from 'vitest';
import type { GenerationMetadata, ModelConfig } from '@/backend';
import { useModels } from './models';
import { DEFAULT_HIRES, hiresFixInput, hiresSize, useParams } from './params';

const initial = useParams.getState();
const initialModels = useModels.getState();
const main = (key: string, name: string): ModelConfig => ({ key, name, base: 'sdxl', type: 'main', format: 'checkpoint', description: '', path: '', size: 0, source: '' });
beforeEach(() => {
  useParams.setState(initial, true);
  useModels.setState({ ...initialModels, models: [main('m1', 'Model 1'), main('main-df710eb000d0', 'waiIllustriousSDXL_v170')] }, true);
});

const p = () => useParams.getState();

const metadata = (over: Partial<GenerationMetadata> = {}): GenerationMetadata => ({
  generationMode: 'txt2img',
  positivePrompt: 'a cat',
  negativePrompt: 'blurry',
  modelKey: 'm1',
  modelName: 'Model 1',
  vaeKey: 'vae',
  seed: 42,
  steps: 12,
  cfgScale: 4.5,
  cfgRescale: 0.2,
  scheduler: 'euler',
  width: 832,
  height: 1216,
  clipSkip: 2,
  seamlessX: true,
  seamlessY: false,
  loras: [{ key: 'l1', weight: 0.5, isEnabled: true }],
  ...over,
});

describe('image size', () => {
  it('rounds to multiples of 8 with a 64 px minimum and unlocks the aspect ratio', () => {
    p().setDimension('width', 1001);
    expect(p().width).toBe(1000);
    expect(p().aspectRatio).toBe('free');
    p().setDimension('height', 10);
    expect(p().height).toBe(64);
  });

  it('keeps the ratio when it is locked', () => {
    p().set({ aspectRatio: '16:9', aspectLocked: true });
    p().setDimension('width', 1280);
    expect([p().width, p().height]).toEqual([1280, 720]);
    p().setDimension('height', 576);
    expect([p().width, p().height]).toEqual([1024, 576]);
    expect(p().aspectRatio).toBe('16:9');
  });

  it('keeps the area when picking an aspect ratio', () => {
    p().setAspectRatio('16:9');
    expect(p().aspectRatio).toBe('16:9');
    expect([p().width, p().height]).toEqual([1368, 768]);
    p().setAspectRatio('free');
    expect(p().aspectRatio).toBe('free');
    expect([p().width, p().height]).toEqual([1368, 768]);
  });

  it('swaps width and height and flips the ratio', () => {
    p().set({ width: 1216, height: 832, aspectRatio: '3:2' });
    p().swapDimensions();
    expect([p().width, p().height, p().aspectRatio]).toEqual([832, 1216, '2:3']);
    p().set({ aspectRatio: 'free' });
    p().swapDimensions();
    expect(p().aspectRatio).toBe('free');
  });

  it('optimizes the size to the model resolution keeping the ratio', () => {
    p().set({ width: 512, height: 512 });
    p().optimizeSize(1024);
    expect([p().width, p().height]).toEqual([1024, 1024]);
    p().set({ width: 1600, height: 900 });
    p().optimizeSize(1024);
    expect(p().width / p().height).toBeCloseTo(16 / 9, 1);
    expect(p().width * p().height).toBeGreaterThan(1024 * 1024 * 0.95);
    expect(p().width * p().height).toBeLessThan(1024 * 1024 * 1.05);
  });
});

describe('LoRAs and reference images', () => {
  it('adds a LoRA once, updates and removes it', () => {
    p().addLora('l1');
    p().addLora('l1');
    expect(p().loras).toEqual([{ key: 'l1', weight: 0.75, isEnabled: true }]);
    p().updateLora('l1', { weight: 0.3 });
    expect(p().loras[0]!.weight).toBe(0.3);
    p().removeLora('l1');
    expect(p().loras).toEqual([]);
  });

  it('gives each reference image a unique id and defaults', () => {
    const a = p().addRefImage();
    const b = p().addRefImage({ weight: 0.4 });
    expect(a).not.toBe(b);
    expect(p().refImages.map((r) => r.weight)).toEqual([1, 0.4]);
    expect(p().refImages[0]).toMatchObject({ isEnabled: true, method: 'full', beginEnd: [0, 1] });
    p().updateRefImage(a, { isEnabled: false });
    p().removeRefImage(b);
    expect(p().refImages.map((r) => [r.id, r.isEnabled])).toEqual([[a, false]]);
  });
});

describe('recall', () => {
  it('recalls every stored parameter and fixes the seed', () => {
    const m = metadata({ strength: 0.4 });
    p().recallAll(m);
    expect(p()).toMatchObject({
      positivePrompt: 'a cat',
      negativePrompt: 'blurry',
      modelKey: 'm1',
      vaeKey: 'vae',
      seed: 42,
      shouldRandomizeSeed: false,
      steps: 12,
      cfgScale: 4.5,
      scheduler: 'euler',
      width: 832,
      height: 1216,
      aspectRatio: 'free',
      clipSkip: 2,
      seamlessX: true,
      strength: 0.4,
    });
    // The recalled LoRAs are copies, so editing them does not change the image's metadata.
    p().updateLora('l1', { weight: 1 });
    expect(m.loras[0]!.weight).toBe(0.5);
  });

  it('keeps the current scheduler when the picture records the sampling its family fixed', () => {
    p().set({ scheduler: 'dpmpp_2m_k' });
    p().recallAll(metadata({ scheduler: 'euler_a', sampling: { sampler: 'euler', scheduler: 'simple' } }));
    expect(p().scheduler).toBe('dpmpp_2m_k');
    p().recallAll(metadata({ scheduler: 'euler_a' }));
    expect(p().scheduler).toBe('euler_a');
  });

  it('leaves the strength alone when the metadata has none', () => {
    p().set({ strength: 0.9 });
    p().recallAll(metadata());
    expect(p().strength).toBe(0.9);
  });

  it('brings back the reference images a picture was made with, and keeps the existing ones when it had none', () => {
    p().set({ refImages: [] });
    p().recallAll(metadata());
    expect(p().refImages).toEqual([]);
    const ref = { imageUrl: 'http://novira-image.localhost/full/r.png', modelKey: 'ipa', clipVisionModel: 'ViT-H' as const, weight: 0.6, beginEnd: [0, 1] as [number, number], method: 'full' as const };
    p().recallAll(metadata({ refImages: [ref] }));
    expect(p().refImages).toHaveLength(1);
    expect(p().refImages[0]).toMatchObject({ isEnabled: true, imageUrl: ref.imageUrl, modelKey: 'ipa', weight: 0.6 });
    const own = p().addRefImage({ imageUrl: 'x', modelKey: 'k' });
    p().recallAll(metadata());
    expect(p().refImages.some((r) => r.id === own)).toBe(true);
  });

  it('finds the model of an imported picture by its name when it carries no key', () => {
    expect(p().recallAll(metadata({ modelKey: '', modelName: 'WAI-illustrious-SDXL-v17' }))).toMatchObject({ kind: 'name' });
    expect(p().modelKey).toBe('main-df710eb000d0');
  });

  it('keeps the current model when the stored one is not installed', () => {
    p().set({ modelKey: 'm1' });
    expect(p().recallAll(metadata({ modelKey: 'gone', modelName: 'ponyDiffusionV6XL', steps: 33 }))).toEqual({ kind: 'missing', name: 'ponyDiffusionV6XL' });
    expect([p().modelKey, p().steps]).toEqual(['m1', 33]);
    expect(p().remix(metadata({ modelKey: '', modelName: '' }))).toEqual({ kind: 'none' });
    expect(p().modelKey).toBe('m1');
  });

  it('remix keeps the current seed and randomize setting', () => {
    p().set({ seed: 7, shouldRandomizeSeed: true });
    p().remix(metadata());
    expect([p().seed, p().shouldRandomizeSeed, p().positivePrompt]).toEqual([7, true, 'a cat']);
  });

  it('turns the high-resolution fix on with the stored values, and off for a picture without it', () => {
    p().recallAll(metadata({ hiresFix: { scale: 1.75, strength: 0.3, upscaleModelKey: 'up', steps: 10 } }));
    expect(p().hires).toEqual({ enabled: true, scale: 1.75, strength: 0.3, upscaleModelKey: 'up', steps: 10 });
    p().recallAll(metadata({ hiresFix: { scale: 1.5, strength: 0.45 } }));
    expect(p().hires).toMatchObject({ enabled: true, upscaleModelKey: null, steps: 0 });
    p().recallAll(metadata());
    expect(p().hires).toMatchObject({ enabled: false, scale: 1.5 });
  });

  it('recalls a seed or a size alone', () => {
    p().recallSeed(99);
    expect([p().seed, p().shouldRandomizeSeed]).toEqual([99, false]);
    p().recallSize(640, 480);
    expect([p().width, p().height, p().aspectRatio]).toEqual([640, 480, 'free']);
  });
});

describe('high-resolution fix', () => {
  it('is sent only when on, without the optional fields left at their defaults', () => {
    expect(hiresFixInput(DEFAULT_HIRES)).toBeUndefined();
    expect(hiresFixInput({ ...DEFAULT_HIRES, enabled: true })).toEqual({ scale: 1.5, strength: 0.45 });
    expect(hiresFixInput({ ...DEFAULT_HIRES, enabled: true, upscaleModelKey: 'up', steps: 12 })).toEqual({ scale: 1.5, strength: 0.45, upscaleModelKey: 'up', steps: 12 });
  });

  it('computes the second-pass size like the backend (multiples of 8)', () => {
    expect(hiresSize(1024, 768, 1.33)).toEqual({ width: 1360, height: 1024 });
    expect(hiresSize(832, 1216, 1.25)).toEqual({ width: 1040, height: 1520 });
  });

  it('merges partial changes', () => {
    p().setHires({ enabled: true });
    p().setHires({ strength: 0.6 });
    expect(p().hires).toMatchObject({ enabled: true, strength: 0.6, scale: 1.5 });
  });
});
