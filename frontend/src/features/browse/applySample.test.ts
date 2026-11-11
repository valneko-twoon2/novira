import { describe, expect, it } from 'vitest';
import type { CivitaiSample, ModelConfig } from '@/backend';
import { installedFor, sampleUse, schedulerOf, versionOf } from './applySample';

const model = (over: Partial<ModelConfig>): ModelConfig => ({
  key: 'k',
  name: 'Name',
  base: 'sdxl',
  type: 'main',
  format: 'checkpoint',
  description: '',
  path: 'a/b.safetensors',
  size: 1,
  source: 'https://civitai.com/models/1',
  ...over,
});
const sample = (over: Partial<CivitaiSample> = {}): CivitaiSample => ({
  id: '1',
  imageUrl: 'https://image.civitai.com/x.jpeg',
  prompt: 'a prompt',
  negativePrompt: null,
  seed: null,
  steps: null,
  cfgScale: null,
  width: null,
  height: null,
  clipSkip: null,
  sampler: null,
  resources: [],
  ...over,
});
const checkpoint = model({ key: 'main-1', name: 'Juggernaut XL', pageUrl: 'https://civitai.com/models/133005?modelVersionId=288982' });
const lora = model({ key: 'lora-1', name: 'Detail Tweaker', type: 'lora', pageUrl: 'https://civitai.com/models/58390?modelVersionId=62833' });

describe('schedulerOf', { tags: [] }, () => {
  it("maps the sampler names of the common tools to this app's schedulers", { tags: ['equivalence'] }, () => {
    expect(schedulerOf('DPM++ 2M Karras')).toBe('dpmpp_2m_k');
    expect(schedulerOf('Euler a')).toBe('euler_a');
    expect(schedulerOf('  euler_a ')).toBe('euler_a');
    expect(schedulerOf('DPM++ 2M SDE Karras')).toBe('dpmpp_2m_sde_k');
    expect(schedulerOf('UniPC')).toBe('unipc');
    expect(schedulerOf('Uni PC')).toBe('unipc');
  });
  it('gives null for a sampler it has no setting for, and for nothing', { tags: ['boundary'] }, () => {
    expect(schedulerOf('DPM++ 3M SDE Exponential')).toBeNull();
    expect(schedulerOf('')).toBeNull();
    expect(schedulerOf(null)).toBeNull();
  });
});

describe('versionOf', { tags: [] }, () => {
  it('reads the version a page names', { tags: ['equivalence'] }, () => {
    expect(versionOf(checkpoint)).toBe('288982');
    expect(versionOf(model({ pageUrl: 'https://civitai.com/models/1?modelVersionId=5&x=1' }))).toBe('5');
  });
  it('gives null without a versioned page', { tags: ['error-guessing'] }, () => {
    expect(versionOf(model({}))).toBeNull();
    expect(versionOf(model({ pageUrl: 'https://civitai.com/models/1' }))).toBeNull();
    expect(versionOf(model({ pageUrl: 'https://civitai.com/models/1?modelVersionId=abc' }))).toBeNull();
  });
});

describe('installedFor', { tags: [] }, () => {
  it('finds a model by the Civitai version first', { tags: ['condition'] }, () => {
    expect(installedFor({ kind: 'checkpoint', name: null, versionId: '288982', weight: null }, [lora, checkpoint])).toBe(checkpoint);
    expect(installedFor({ kind: 'lora', name: null, versionId: '62833', weight: 1 }, [lora, checkpoint])).toBe(lora);
  });
  it('falls back to the name, ignoring case and punctuation', { tags: ['condition'] }, () => {
    expect(installedFor({ kind: 'lora', name: 'detail-tweaker', versionId: null, weight: null }, [lora])).toBe(lora);
    expect(installedFor({ kind: 'checkpoint', name: 'JUGGERNAUT xl', versionId: '999', weight: null }, [checkpoint])).toBe(checkpoint);
  });
  it('does not mix kinds: a checkpoint never finds a LoRA of the same name', { tags: ['decision-table'] }, () => {
    expect(installedFor({ kind: 'checkpoint', name: 'Detail Tweaker', versionId: null, weight: null }, [lora])).toBeNull();
    expect(installedFor({ kind: 'lora', name: 'Juggernaut XL', versionId: null, weight: null }, [checkpoint])).toBeNull();
  });
  it('gives null when nothing or several match', { tags: ['boundary'] }, () => {
    expect(installedFor({ kind: 'lora', name: null, versionId: '1', weight: null }, [lora])).toBeNull();
    expect(installedFor({ kind: 'lora', name: 'x', versionId: null, weight: null }, [])).toBeNull();
    const twin = { ...lora, key: 'lora-2' };
    expect(installedFor({ kind: 'lora', name: null, versionId: '62833', weight: null }, [lora, twin])).toBeNull();
  });
});

describe('sampleUse', { tags: [] }, () => {
  it('always puts the prompt in, and leaves every setting the picture did not record', { tags: ['condition'] }, () => {
    const use = sampleUse(sample(), []);
    expect(use.patch).toEqual({ positivePrompt: 'a prompt' });
    expect(use.missing).toEqual([]);
    expect(use.unknownSampler).toBeNull();
  });

  it('puts in every recorded setting, fixes the seed and counts clip skip as layers skipped', { tags: ['equivalence', 'boundary'] }, () => {
    const use = sampleUse(
      sample({ negativePrompt: 'blurry', seed: 7, steps: 28, cfgScale: 6.5, width: 832, height: 1216, clipSkip: 2, sampler: 'DPM++ 2M Karras' }),
      [],
    );
    expect(use.patch).toEqual({
      positivePrompt: 'a prompt',
      negativePrompt: 'blurry',
      seed: 7,
      shouldRandomizeSeed: false,
      steps: 28,
      cfgScale: 6.5,
      width: 832,
      height: 1216,
      aspectRatio: 'free',
      clipSkip: 1,
      scheduler: 'dpmpp_2m_k',
    });
  });

  it("maps Civitai's clip skip 1 (no skipping) to 0", { tags: ['boundary'] }, () => {
    expect(sampleUse(sample({ clipSkip: 1 }), []).patch.clipSkip).toBe(0);
  });

  it('does not touch the size when the picture recorded only one side of it', { tags: ['condition'] }, () => {
    const patch = sampleUse(sample({ width: 512, height: null }), []).patch;
    expect('width' in patch || 'height' in patch || 'aspectRatio' in patch).toBe(false);
  });

  it('names a sampler it cannot map and keeps the current scheduler', { tags: ['error-guessing'] }, () => {
    const use = sampleUse(sample({ sampler: 'DPM++ 3M SDE Exponential' }), []);
    expect(use.unknownSampler).toBe('DPM++ 3M SDE Exponential');
    expect('scheduler' in use.patch).toBe(false);
  });

  it('sets the installed checkpoint and replaces the LoRAs with the installed ones', { tags: ['scenario'] }, () => {
    const use = sampleUse(
      sample({
        resources: [
          { kind: 'checkpoint', name: null, versionId: '288982', weight: null },
          { kind: 'lora', name: null, versionId: '62833', weight: 0.65 },
        ],
      }),
      [checkpoint, lora],
    );
    expect(use.patch.modelKey).toBe('main-1');
    expect(use.patch.loras).toEqual([{ key: 'lora-1', weight: 0.65, isEnabled: true }]);
    expect(use.missing).toEqual([]);
  });

  it(
    'names what is not installed, keeps the current model, and clears the LoRAs the picture used but are missing',
    { tags: ['error-guessing'] },
    () => {
      const lost = { kind: 'lora', name: 'Gone', versionId: null, weight: 0.5 };
      const gone = { kind: 'checkpoint', name: 'Gone Model', versionId: null, weight: null };
      const use = sampleUse(sample({ resources: [gone, lost] }), [checkpoint, lora]);
      expect('modelKey' in use.patch).toBe(false);
      expect(use.patch.loras).toEqual([]);
      expect(use.missing).toEqual([gone, lost]);
    },
  );

  it('leaves the LoRAs alone when the picture recorded none', { tags: ['condition'] }, () => {
    const use = sampleUse(sample({ resources: [{ kind: 'checkpoint', name: null, versionId: '288982', weight: null }] }), [checkpoint]);
    expect('loras' in use.patch).toBe(false);
  });

  it('uses the default weight for a LoRA with none, adds a LoRA once, and ignores embeddings and VAEs', { tags: ['boundary'] }, () => {
    const use = sampleUse(
      sample({
        resources: [
          { kind: 'lora', name: null, versionId: '62833', weight: null },
          { kind: 'lora', name: 'Detail Tweaker', versionId: null, weight: 1 },
          { kind: 'embed', name: 'neg', versionId: '5', weight: null },
          { kind: 'vae', name: 'vae', versionId: null, weight: null },
        ],
      }),
      [lora],
    );
    expect(use.patch.loras).toEqual([{ key: 'lora-1', weight: 0.75, isEnabled: true }]);
    expect(use.missing).toEqual([]);
  });
});
