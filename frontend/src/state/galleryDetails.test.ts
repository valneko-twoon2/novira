// @vitest-environment jsdom
// The gallery holds summaries (no metadata, no workflow) from start-up; the details are read for what is selected, opened,
// searched or shown on the video and audio screens.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type GenerationMetadata, type ImageDTO } from '@/backend';
import { applyCatchUp } from './backendCatchUp';
import { useGallery } from './gallery';
import { DETAILS_CHUNK, ensureAllDetails, ensureDetails, markSummaries, mergeSummaries, summaryCount, watchGalleryDetails } from './galleryDetails';

const meta = (prompt: string) => ({ positivePrompt: prompt, generationMode: 'txt2img' }) as unknown as GenerationMetadata;
const image = (name: string, over: Partial<ImageDTO> = {}): ImageDTO => ({
  name,
  url: `u/${name}`,
  thumbnailUrl: `t/${name}`,
  width: 64,
  height: 64,
  createdAt: 1,
  boardId: null,
  starred: false,
  isIntermediate: false,
  category: 'general',
  metadata: null,
  workflow: null,
  ...over,
});
const full = (name: string) => image(name, { metadata: meta(`prompt of ${name}`), workflow: { nodes: [name] } });

const spyDetails = () => vi.spyOn(backend, 'getImageDetails');
let details: ReturnType<typeof spyDetails>;
beforeEach(() => {
  const names = ['a.png', 'b.png', 'c.png'];
  useGallery.setState({ images: names.map((n) => image(n)), selection: [], viewerImageName: null, compareImageName: null, search: '' });
  markSummaries(useGallery.getState().images);
  details = spyDetails().mockImplementation(async (asked) => asked.map(full));
});
afterEach(() => vi.restoreAllMocks());

const held = (name: string) => useGallery.getState().images.find((i) => i.name === name)!;

describe('ensureDetails', () => {
  it('reads the details of a summary and puts them into the gallery', { tags: ['equivalence'] }, async () => {
    await ensureDetails(['b.png']);
    expect(details).toHaveBeenCalledWith(['b.png']);
    expect(held('b.png').metadata?.positivePrompt).toBe('prompt of b.png');
    expect(held('b.png').workflow).toEqual({ nodes: ['b.png'] });
    expect(held('a.png').metadata).toBeNull();
    expect(summaryCount()).toBe(2);
  });

  it('reads a picture once, also when it is asked for twice at the same time', { tags: ['condition'] }, async () => {
    await Promise.all([ensureDetails(['a.png']), ensureDetails(['a.png', 'a.png'])]);
    await ensureDetails(['a.png']);
    expect(details).toHaveBeenCalledTimes(1);
  });

  it(
    'does not read a picture that arrived whole, and does not ask when nothing is needed',
    { tags: ['condition', 'boundary'] },
    async () => {
      await ensureDetails(['unknown.png']);
      await ensureDetails([]);
      expect(details).not.toHaveBeenCalled();
    },
  );

  it('keeps a star or a board that changed while the details were on their way', { tags: ['error-guessing'] }, async () => {
    let release: (v: ImageDTO[]) => void = () => undefined;
    details.mockImplementation(() => new Promise<ImageDTO[]>((resolve) => (release = resolve)));
    const job = ensureDetails(['a.png']);
    useGallery.getState().upsertImages([image('a.png', { starred: true, boardId: 'board-1' })]);
    release([full('a.png')]);
    await job;
    expect(held('a.png')).toMatchObject({ starred: true, boardId: 'board-1', metadata: { positivePrompt: 'prompt of a.png' } });
  });

  it(
    'reads in chunks that stay within what the backend answers, and logs a failure without throwing',
    { tags: ['boundary', 'error-guessing'] },
    async () => {
      const many = Array.from({ length: DETAILS_CHUNK * 2 + 1 }, (_, i) => image(`m${i}.png`));
      useGallery.setState({ images: many });
      markSummaries(many);
      await ensureDetails(many.map((i) => i.name));
      expect(details.mock.calls.map(([names]) => names.length)).toEqual([DETAILS_CHUNK, DETAILS_CHUNK, 1]);
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      markSummaries(many);
      details.mockRejectedValue(new Error('down'));
      await expect(ensureDetails(['m0.png'])).resolves.toBeUndefined();
      expect(error).toHaveBeenCalled();
      // Still a summary, so the next ask tries again.
      expect(summaryCount()).toBe(many.length);
    },
  );

  it('ensureAllDetails reads every summary', { tags: ['equivalence'] }, async () => {
    await ensureAllDetails();
    expect(useGallery.getState().images.every((i) => i.metadata !== null)).toBe(true);
    expect(summaryCount()).toBe(0);
  });
});

describe('what is read without being asked', () => {
  let stop: () => void;
  afterEach(() => stop());

  it('reads the selected, viewed and compared pictures', { tags: ['state-transition'] }, async () => {
    stop = watchGalleryDetails();
    useGallery.getState().setSelection(['a.png']);
    await vi.waitFor(() => expect(held('a.png').metadata).not.toBeNull());
    useGallery.getState().setCompareImage('c.png');
    await vi.waitFor(() => expect(held('c.png').metadata).not.toBeNull());
    expect(held('b.png').metadata).toBeNull();
  });

  it('reads the video and audio pictures at once (their screens read their settings)', { tags: ['condition'] }, async () => {
    useGallery.setState({ images: [image('v.mp4', { mediaType: 'video' }), image('s.wav', { mediaType: 'audio' }), image('p.png')] });
    markSummaries(useGallery.getState().images);
    stop = watchGalleryDetails();
    await vi.waitFor(() => expect(held('s.wav').metadata).not.toBeNull());
    expect(held('v.mp4').metadata).not.toBeNull();
    expect(held('p.png').metadata).toBeNull();
  });

  it('reads everything when a search is typed, because it looks in the prompts', { tags: ['condition'] }, async () => {
    stop = watchGalleryDetails();
    expect(details).not.toHaveBeenCalled();
    useGallery.getState().setSearch('prompt of b');
    await vi.waitFor(() => expect(summaryCount()).toBe(0));
    expect(held('a.png').metadata).not.toBeNull();
  });
});

describe('a gallery read again (a page over the network coming back)', () => {
  it('keeps the details a picture already has and leaves the others as summaries', { tags: ['equivalence'] }, async () => {
    await ensureDetails(['a.png']);
    const merged = mergeSummaries([image('a.png', { starred: true }), image('b.png'), image('d.png')], useGallery.getState().images);
    expect(merged[0]).toMatchObject({ name: 'a.png', starred: true, metadata: { positivePrompt: 'prompt of a.png' } });
    expect(merged[1]!.metadata).toBeNull();
    expect(merged[2]!.metadata).toBeNull();
    await ensureDetails(['d.png']);
    expect(details).toHaveBeenLastCalledWith(['d.png']);
  });

  it('applyCatchUp does not take the details away from the pictures that have them', { tags: ['condition'] }, async () => {
    await ensureDetails(['a.png']);
    applyCatchUp(
      { boards: [], images: [image('a.png', { starred: true }), image('b.png')], imagesSummary: true, models: [], workflows: [] },
      new Set(['a.png', 'b.png', 'c.png']),
    );
    expect(held('a.png')).toMatchObject({ starred: true, metadata: { positivePrompt: 'prompt of a.png' } });
    expect(held('c.png')).toBeUndefined();
  });
});
