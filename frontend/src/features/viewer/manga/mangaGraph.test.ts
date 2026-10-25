import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnqueueRequest, ImageDTO } from '@/backend';
import { runJob } from '@/state/comfy/runGraph';
import { buildMangaGraph, runMangaPreview, saveMangaPage } from './mangaGraph';

vi.mock('@/state/comfy/runGraph', () => ({ runJob: vi.fn() }));

const values = { screenLines: 240, whitePoint: 0.85, blackPoint: 0.35, gradation: 0.75, whiteLines: 0.45 };
const source = {
  name: 'a.png',
  width: 200,
  height: 100,
  boardId: 'b1',
  metadata: { positivePrompt: '1girl', negativePrompt: 'lowres', modelKey: 'm1', modelName: 'M1', seed: 7 },
} as unknown as ImageDTO;
const sent = () => vi.mocked(runJob).mock.calls.at(-1)![0] as EnqueueRequest;

beforeEach(() => vi.mocked(runJob).mockReset().mockResolvedValue(source));

describe('the manga finish graph', () => {
  it('runs the picture through the finish node with the values and saves one picture', () => {
    const g = buildMangaGraph('a.png', values);
    expect(g.prompt.source).toEqual({ class_type: 'LoadImage', inputs: { image: { $image: 'a.png' } } });
    expect(g.prompt.finish).toMatchObject({ class_type: 'MangaFinish', inputs: { image: ['source', 0], screen_lines: 240, white_point: 0.85, black_point: 0.35, gradation: 0.75, white_lines: 0.45 } });
    expect(g.prompt.save!.inputs.images).toEqual(['finish', 0]);
    expect(g.outputs).toEqual(['save']);
  });

  it('keeps a try out of the gallery', async () => {
    await runMangaPreview('a.png', values);
    expect(sent().destination).toBe('intermediate');
  });

  it('saves the page as a new gallery picture on the original board, with the original description', async () => {
    await saveMangaPage(source, values, 'Manga page');
    expect(sent()).toMatchObject({
      destination: 'gallery',
      boardId: 'b1',
      params: { generationMode: 'graph', width: 200, height: 100, workflowName: 'Manga page', positivePrompt: '1girl', modelKey: 'm1', seed: 7 },
    });
    expect(sent().comfyGraph).toEqual(buildMangaGraph('a.png', values));
  });

  it('saves a picture without metadata too', async () => {
    await saveMangaPage({ ...source, metadata: null } as ImageDTO, values, 'Manga page');
    expect(sent().params.positivePrompt).toBe('');
  });
});
