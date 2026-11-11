import { describe, expect, it } from 'vitest';
import type { ModelConfig } from '../types';
import { MOCK_INSTALLED_VERSION, mockSamples, mockUpdates } from './civitaiSamples';
import { SEED_MODELS } from './seedData';

describe('mockSamples', () => {
  it('gives a complete example, a sparse one and one that names its checkpoint', { tags: ['equivalence'] }, () => {
    const [full, sparse, named] = mockSamples('128713');
    expect(full!.resources.map((r) => r.kind)).toEqual(['checkpoint', 'lora']);
    expect(full!.resources[0]!.versionId).toBe(MOCK_INSTALLED_VERSION);
    expect([sparse!.seed, sparse!.width, sparse!.sampler, sparse!.resources]).toEqual([null, null, null, []]);
    expect(named!.resources[0]!.name).toBe('Dreamshaper 8');
  });

  it('answers the same for the same version, with ids that tell the versions apart', { tags: ['condition'] }, () => {
    expect(mockSamples('5')).toEqual(mockSamples('5'));
    expect(mockSamples('5')[0]!.id).not.toBe(mockSamples('6')[0]!.id);
  });

  it('refuses what is not a version id', { tags: ['error-guessing'] }, () => {
    for (const bad of ['', 'abc', '1 2', '../1', '1234567890123']) expect(() => mockSamples(bad), bad).toThrow();
  });
});

describe('mockUpdates', () => {
  const page = SEED_MODELS.find((m) => m.pageUrl)!;

  it('gives nothing unless asked for', { tags: ['condition'] }, () => {
    expect(mockUpdates(SEED_MODELS, false)).toEqual([]);
  });

  it('names a newer version for each installed model with a versioned Civitai page', { tags: ['condition'] }, () => {
    const found = mockUpdates(SEED_MODELS, true);
    expect(found.map((u) => u.key)).toEqual(SEED_MODELS.filter((m) => m.pageUrl).map((m) => m.key));
    const u = found.find((x) => x.key === page.key)!;
    expect(u.installedVersionId).toBe(MOCK_INSTALLED_VERSION);
    expect(Number(u.latestVersionId)).toBe(Number(MOCK_INSTALLED_VERSION) + 1);
    expect(u.pageUrl).toBe(`https://civitai.com/models/${u.modelId}?modelVersionId=${u.latestVersionId}`);
  });

  it('skips a model whose page names no version, or is not on Civitai', { tags: ['condition'] }, () => {
    const plain = (pageUrl: string): ModelConfig => ({ ...page, key: 'x', pageUrl });
    expect(mockUpdates([plain('https://civitai.com/models/1')], true)).toEqual([]);
    expect(mockUpdates([plain('https://huggingface.co/a/b')], true)).toEqual([]);
    expect(mockUpdates([{ ...page, pageUrl: undefined }], true)).toEqual([]);
  });
});
