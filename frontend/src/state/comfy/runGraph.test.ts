// @vitest-environment jsdom
// Waiting for a queued prompt's text: the mock describes a picture by its name and stores no picture.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { buildCaptionGraph } from './caption';
import { graphRequest } from './graphJob';
import { runTextJob } from './runGraph';

vi.mock('@/backend/mock/imageSynth', async (original) => ({
  ...(await original<typeof import('@/backend/mock/imageSynth')>()),
  imageSize: vi.fn(async () => ({ width: 64, height: 48 })),
}));

describe('text jobs', () => {
  beforeAll(() => backend.setStepDelay(0));

  it('resolves with the text of the finished job', async () => {
    const source = await backend.uploadImage(new Blob(['x']), { boardId: null });
    const text = await runTextJob(graphRequest(buildCaptionGraph(source.name, { style: 'tags', model: 'm' }), 'intermediate'));
    expect(text.split(', ').length).toBeGreaterThan(3);
    expect(await runTextJob(graphRequest(buildCaptionGraph(source.name, { style: 'tags', model: 'm' }), 'intermediate'))).toBe(text);
  });

  it('rejects with the reason when the job fails', async () => {
    await expect(runTextJob(graphRequest(buildCaptionGraph('no-such-picture.png', { style: 'tags', model: 'm' }), 'intermediate'))).rejects.toThrow(/deleted/);
  });

  it('cancels the job when aborted', async () => {
    backend.setStepDelay(40);
    const source = await backend.uploadImage(new Blob(['x']), { boardId: null });
    const controller = new AbortController();
    const run = runTextJob(graphRequest(buildCaptionGraph(source.name, { style: 'sentence', model: 'm' }), 'intermediate'), controller.signal);
    setTimeout(() => controller.abort(), 30);
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    backend.setStepDelay(0);
  });
});
