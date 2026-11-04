// What the mock answers for a model version's example settings and for the update check.
import type { CivitaiSample, ModelConfig, ModelUpdate } from '../types';
import { mockPicture } from './mockPictures';

/** The checkpoint the mock library already holds (its page names this version). */
export const MOCK_INSTALLED_VERSION = '288982';

/** A few examples of every kind: complete, sparse, and one that names its checkpoint without a version. */
export function mockSamples(versionId: string): CivitaiSample[] {
  if (!/^\d{1,12}$/.test(versionId)) throw new Error('not a Civitai version id (mock)');
  return [
    {
      id: `${versionId}01`,
      imageUrl: mockPicture('main-juggernaut-xl'),
      prompt: 'a cozy cafe by the window, warm light, steam rising from a cup, detailed',
      negativePrompt: 'blurry, lowres, watermark',
      seed: 1234,
      steps: 28,
      cfgScale: 6,
      width: 832,
      height: 1216,
      clipSkip: 2,
      sampler: 'DPM++ 2M Karras',
      resources: [
        { kind: 'checkpoint', name: null, versionId: MOCK_INSTALLED_VERSION, weight: null },
        { kind: 'lora', name: null, versionId: '900001', weight: 0.7 },
      ],
    },
    {
      id: `${versionId}02`,
      imageUrl: mockPicture('main-dreamshaper-8'),
      prompt: 'portrait of a knight, dramatic sky',
      negativePrompt: null,
      seed: null,
      steps: 20,
      cfgScale: null,
      width: null,
      height: null,
      clipSkip: null,
      sampler: null,
      resources: [],
    },
    {
      id: `${versionId}03`,
      imageUrl: mockPicture('main-dreamshaper-8'),
      prompt: 'a small village in the mountains, golden hour',
      negativePrompt: 'text',
      seed: 42,
      steps: 25,
      cfgScale: 7,
      width: 512,
      height: 768,
      clipSkip: 1,
      sampler: 'Euler a',
      resources: [{ kind: 'checkpoint', name: 'Dreamshaper 8', versionId: null, weight: null }],
    },
  ];
}

/** `civitai.com/models/<id>?modelVersionId=<version>` of an installed model, or null. */
function idsOf(model: ModelConfig): { modelId: string; versionId: string } | null {
  const m = /^https:\/\/civitai\.com\/models\/(\d{1,12})\?modelVersionId=(\d{1,12})/.exec(model.pageUrl ?? '');
  return m ? { modelId: m[1] as string, versionId: m[2] as string } : null;
}

/** Every installed model with a versioned Civitai page has a newer version when asked for (`?updates` in the address). */
export function mockUpdates(models: ModelConfig[], enabled: boolean): ModelUpdate[] {
  if (!enabled) return [];
  const out: ModelUpdate[] = [];
  for (const model of models) {
    const ids = idsOf(model);
    if (!ids) continue;
    const latest = String(Number(ids.versionId) + 1);
    out.push({
      key: model.key,
      modelId: ids.modelId,
      installedVersionId: ids.versionId,
      latestVersionId: latest,
      latestName: 'v10',
      publishedAt: Date.UTC(2026, 9, 20),
      pageUrl: `https://civitai.com/models/${ids.modelId}?modelVersionId=${latest}`,
    });
  }
  return out;
}
