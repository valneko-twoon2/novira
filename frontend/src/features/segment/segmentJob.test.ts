// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { runSegmentation } from './segmentJob';

// jsdom has no canvas: the mock's pictures and the mask are plain URLs.
vi.mock('@/backend/mock/imageSynth', async (original) => ({
  ...(await original<typeof import('@/backend/mock/imageSynth')>()),
  synthesize: vi.fn(async () => ({ canvas: document.createElement('canvas'), url: 'blob:picture' })),
  imageSize: vi.fn(async () => ({ width: 64, height: 48 })),
}));
vi.mock('@/backend/mock/maskSynth', async (original) => ({ ...(await original<typeof import('@/backend/mock/maskSynth')>()), synthMask: vi.fn(async () => 'blob:mask') }));

describe('segmentation job', () => {
  beforeAll(() => backend.setStepDelay(0));

  it('resolves with the hidden mask picture the size of the source', async () => {
    const source = await backend.uploadImage(new Blob(['x']), { boardId: null });
    const mask = await runSegmentation(source.name, [{ x: 10, y: 10, include: true }]);
    expect(mask.isIntermediate).toBe(true);
    expect(mask.url).toBe('blob:mask');
    expect([mask.width, mask.height]).toEqual([source.width, source.height]);
  });

  it('rejects with the reason when the job fails', async () => {
    await expect(runSegmentation('no-such-picture.png', [{ x: 1, y: 1, include: true }])).rejects.toThrow(/deleted/);
  });

  it('cancels the job when aborted', async () => {
    backend.setStepDelay(40);
    const source = await backend.uploadImage(new Blob(['x']), { boardId: null });
    const controller = new AbortController();
    const run = runSegmentation(source.name, [{ x: 10, y: 10, include: true }], controller.signal);
    setTimeout(() => controller.abort(), 30);
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    backend.setStepDelay(0);
  });
});
