// @vitest-environment jsdom
// A picture tool's run belongs to no screen: it goes on when the band closes, shows its picture result beside the
// original when the band still shows it, and only the cancel button cancels it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComfyNodeDefs, ImageDTO, ModelConfig, QueueItem } from '@/backend';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { t } from '@/i18n';
import { useComfyNodes } from '../comfy/comfyNodes';
import { runJob, runTextJob } from '../comfy/runGraph';
import { useGallery } from '../gallery';
import { useModels } from '../models';
import { useParams } from '../params';
import { useQueue } from '../queue';
import { useToasts } from '../toasts';
import { setToolViewer, useToolBand } from './band';
import { applyDescription, cancelToolRun, madeByToolRun, startToolRun, useToolRuns } from './runs';

vi.mock('../comfy/runGraph', () => ({ runJob: vi.fn(), runTextJob: vi.fn() }));

const picture = (name: string) => ({ name, url: `blob:${name}`, thumbnailUrl: '', width: 64, height: 64, boardId: null, mediaType: 'image', metadata: null }) as unknown as ImageDTO;
const main = { key: 'main-xl', name: 'Main XL', base: 'sdxl', type: 'main', format: 'checkpoint', path: '', size: 0 } as unknown as ModelConfig;
const viewer = { showPicture: vi.fn(), showResult: vi.fn() };
const lastToast = () => useToasts.getState().toasts.at(-1);

/** A job that ends when the test says, aborting like the real one when its signal is aborted. */
function pendingJob<T>() {
  let finish!: (value: T) => void;
  let fail!: (e: unknown) => void;
  let signal: AbortSignal | undefined;
  const impl = (_request: unknown, s?: AbortSignal, onQueued?: (id: number) => void) =>
    new Promise<T>((resolve, reject) => {
      signal = s;
      onQueued?.(42);
      finish = resolve;
      fail = reject;
      s?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  return { impl, finish: (v: T) => finish(v), fail: (e: unknown) => fail(e), aborted: () => signal?.aborted ?? false };
}

beforeEach(() => {
  useGallery.getState().setImages([picture('photo.png'), picture('other.png')]);
  useModels.getState().setModels([main]);
  useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS } as ComfyNodeDefs, status: 'ready' });
  useToolRuns.setState({ runs: {} });
  useToolBand.setState({ open: false, imageName: null, tool: 'facefix', mode: 'settings' });
  useToasts.setState({ toasts: [] });
  setToolViewer(viewer);
  vi.mocked(runJob).mockReset();
  vi.mocked(runTextJob).mockReset();
  viewer.showResult.mockReset();
});
afterEach(() => setToolViewer(null));

describe('a picture result', () => {
  it('is shown beside its original while the band shows the tool on that picture', { tags: ['scenario'] }, async () => {
    const job = pendingJob<ImageDTO>();
    vi.mocked(runJob).mockImplementation(job.impl);
    useToolBand.getState().show('cutout', 'photo.png', 'status');
    const run = startToolRun('cutout', 'photo.png');
    expect(useToolRuns.getState().runs.cutout).toMatchObject({ status: 'running', imageName: 'photo.png', queueItemId: 42 });
    job.finish(picture('cut.png'));
    await run;
    expect(useToolRuns.getState().runs.cutout).toMatchObject({ status: 'done', result: { kind: 'picture', image: { name: 'cut.png' } } });
    expect(viewer.showResult).toHaveBeenCalledWith('cut.png', 'photo.png');
    expect(lastToast()).toMatchObject({ status: 'success', title: t('cutout.saved') });
  });

  it('keeps running when the band closes, and then only says it was saved', { tags: ['state-transition', 'condition'] }, async () => {
    const job = pendingJob<ImageDTO>();
    vi.mocked(runJob).mockImplementation(job.impl);
    useToolBand.getState().show('facefix', 'photo.png', 'status');
    const run = startToolRun('facefix', 'photo.png');
    useToolBand.getState().close();
    expect(job.aborted()).toBe(false);
    job.finish(picture('fixed.png'));
    await run;
    expect(useToolRuns.getState().runs.facefix?.status).toBe('done');
    expect(viewer.showResult).not.toHaveBeenCalled();
    expect(lastToast()).toMatchObject({ status: 'success', title: t('facefix.saved') });
  });

  it('is not shown beside its original when the band moved on to another picture', { tags: ['condition'] }, async () => {
    const job = pendingJob<ImageDTO>();
    vi.mocked(runJob).mockImplementation(job.impl);
    useToolBand.getState().show('cutout', 'photo.png', 'status');
    const run = startToolRun('cutout', 'photo.png');
    useToolBand.getState().retarget('other.png');
    job.finish(picture('cut.png'));
    await run;
    expect(viewer.showResult).not.toHaveBeenCalled();
  });
});

describe('ending otherwise', () => {
  it('cancels the job only through cancelToolRun', { tags: ['state-transition'] }, async () => {
    const job = pendingJob<ImageDTO>();
    vi.mocked(runJob).mockImplementation(job.impl);
    useToolBand.getState().show('cutout', 'photo.png', 'status');
    const run = startToolRun('cutout', 'photo.png');
    cancelToolRun('caption');
    expect(job.aborted()).toBe(false);
    cancelToolRun('cutout');
    await run;
    expect(job.aborted()).toBe(true);
    expect(useToolRuns.getState().runs.cutout?.status).toBe('canceled');
  });

  it('keeps the reason of a failure, and makes it a notice when the band does not show it', { tags: ['error-guessing'] }, async () => {
    vi.mocked(runJob).mockRejectedValue(new Error('out of memory'));
    useToolBand.getState().show('facefix', 'photo.png', 'status');
    await startToolRun('facefix', 'photo.png');
    expect(useToolRuns.getState().runs.facefix).toMatchObject({ status: 'failed', error: 'out of memory' });
    expect(useToasts.getState().toasts).toHaveLength(0);
    useToolBand.getState().close();
    await startToolRun('facefix', 'photo.png');
    expect(lastToast()).toMatchObject({ status: 'error', title: t('facefix.failed'), description: 'out of memory' });
  });

  it('starts nothing for a picture that is no longer in the gallery', { tags: ['condition'] }, async () => {
    await startToolRun('cutout', 'gone.png');
    expect(useToolRuns.getState().runs.cutout).toBeUndefined();
    expect(runJob).not.toHaveBeenCalled();
  });
});

describe('text results', () => {
  it('tidies a description, and says it finished when the band does not show it', { tags: ['equivalence'] }, async () => {
    vi.mocked(runTextJob).mockResolvedValue('1girl,  smile, 1girl');
    await startToolRun('caption', 'photo.png');
    expect(useToolRuns.getState().runs.caption?.result).toEqual({ kind: 'text', text: '1girl, smile' });
    expect(lastToast()).toMatchObject({ status: 'success', title: t('gallery.tools.finished', { tool: t('gallery.tools.name.caption') }) });
  });

  it('reads the people of a pose answer, and fails on an answer that is not one', { tags: ['error-guessing'] }, async () => {
    vi.mocked(runTextJob).mockResolvedValue(JSON.stringify([{ canvas_width: 100, canvas_height: 50, people: [] }]));
    useToolBand.getState().show('pose', 'photo.png', 'status');
    await startToolRun('pose', 'photo.png');
    expect(useToolRuns.getState().runs.pose).toMatchObject({ status: 'done', result: { kind: 'poses', poses: { people: [] } } });
    vi.mocked(runTextJob).mockResolvedValue('not json');
    await startToolRun('pose', 'photo.png');
    expect(useToolRuns.getState().runs.pose).toMatchObject({ status: 'failed', error: 'not json' });
  });

  it('puts a description into the prompt in place of it or after it', { tags: ['equivalence'] }, () => {
    useParams.setState({ positivePrompt: 'masterpiece' });
    applyDescription('1girl', 'append');
    expect(useParams.getState().positivePrompt).toBe('masterpiece, 1girl');
    applyDescription(' 1boy ', 'replace');
    expect(useParams.getState().positivePrompt).toBe('1boy');
  });
});

describe('knowing a result picture', () => {
  it(
    'from the queue item as soon as the job completes, and from the run once it has its result',
    { tags: ['state-transition'] },
    async () => {
      const job = pendingJob<ImageDTO>();
      vi.mocked(runJob).mockImplementation(job.impl);
      const run = startToolRun('cutout', 'photo.png');
      expect(madeByToolRun('cut.png')).toBe(false);
      useQueue.setState({ items: [{ id: 42, imageName: 'cut.png' } as QueueItem] });
      expect(madeByToolRun('cut.png')).toBe(true);
      expect(madeByToolRun('other.png')).toBe(false);
      useQueue.setState({ items: [] });
      job.finish(picture('cut.png'));
      await run;
      expect(madeByToolRun('cut.png')).toBe(true);
    },
  );
});

describe('several runs', () => {
  it('shows the newest run of a tool; an older one still ends without taking its place', { tags: ['state-transition'] }, async () => {
    const first = pendingJob<ImageDTO>();
    const second = pendingJob<ImageDTO>();
    vi.mocked(runJob).mockImplementationOnce(first.impl).mockImplementationOnce(second.impl);
    const a = startToolRun('cutout', 'photo.png');
    const b = startToolRun('cutout', 'other.png');
    first.finish(picture('a.png'));
    await a;
    expect(useToolRuns.getState().runs.cutout).toMatchObject({ imageName: 'other.png', status: 'running' });
    second.finish(picture('b.png'));
    await b;
    expect(useToolRuns.getState().runs.cutout).toMatchObject({ imageName: 'other.png', status: 'done' });
  });
});
