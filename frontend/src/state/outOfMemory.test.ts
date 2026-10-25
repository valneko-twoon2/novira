import { afterEach, describe, expect, it, vi } from 'vitest';
import { backend, type QueueItem } from '@/backend';
import { useLowMemory } from './lowMemory';
import { isOutOfMemory, reportOutOfMemory, retrySmaller, retrySmallerSize, smallerSize, useOutOfMemoryNotices } from './outOfMemory';
import { useToasts } from './toasts';

const item = (over: Partial<QueueItem> = {}, params: Partial<QueueItem['params']> = {}): QueueItem =>
  ({
    id: 7,
    batchId: 'b',
    status: 'failed',
    origin: 'generate',
    destination: 'gallery',
    params: { generationMode: 'txt2img', width: 1024, height: 1024, ...params },
    boardId: null,
    initImageUrl: null,
    workflow: null,
    createdAt: 0,
    startedAt: 0,
    completedAt: 1,
    imageName: null,
    error: 'ComfyUI KSampler: CUDA out of memory',
    errorKind: 'out_of_memory',
    ...over,
  }) as QueueItem;

afterEach(() => {
  vi.restoreAllMocks();
  useToasts.setState({ toasts: [] });
  useOutOfMemoryNotices.setState({ ids: [] });
  useLowMemory.setState({ mode: null, busy: false });
});

describe('smaller size', () => {
  it('keeps about 75% of the area and the aspect ratio, in multiples of 8', () => {
    for (const [w, h] of [
      [1024, 1024],
      [832, 1216],
      [512, 768],
      [1536, 640],
    ] as const) {
      const s = smallerSize(w, h)!;
      expect(s.width % 8).toBe(0);
      expect(s.height % 8).toBe(0);
      expect((s.width * s.height) / (w * h)).toBeGreaterThan(0.7);
      expect((s.width * s.height) / (w * h)).toBeLessThan(0.8);
      expect(Math.abs(s.width / s.height - w / h)).toBeLessThan(0.03);
    }
    expect(smallerSize(1024, 1024)).toEqual({ width: 888, height: 888 });
  });

  it('never goes below 64 and gives nothing when it cannot shrink', () => {
    expect(smallerSize(64, 512)).toEqual({ width: 64, height: 440 });
    expect(smallerSize(64, 64)).toBeNull();
  });

  it('applies to pictures made at a size only', () => {
    expect(retrySmallerSize(item())).toEqual({ width: 888, height: 888 });
    for (const mode of ['img2img', 'inpaint', 'outpaint'] as const) expect(retrySmallerSize(item({}, { generationMode: mode }))).not.toBeNull();
    for (const mode of ['upscale', 'video', 'music', 'voice', 'graph', 'logo'] as const) expect(retrySmallerSize(item({}, { generationMode: mode }))).toBeNull();
    expect(retrySmallerSize(item({ comfyGraph: { prompt: {}, outputs: [] } }))).toBeNull();
  });

  it('recognises out-of-memory failures by their kind', () => {
    expect(isOutOfMemory(item())).toBe(true);
    expect(isOutOfMemory(item({ errorKind: null }))).toBe(false);
    expect(isOutOfMemory(item({ status: 'completed' }))).toBe(false);
  });
});

describe('retry smaller', () => {
  it('queues the item again at the smaller size and closes its notice', async () => {
    const retry = vi.spyOn(backend, 'retryQueueItem').mockResolvedValue(item({ id: 8, status: 'pending' }));
    useOutOfMemoryNotices.getState().report(7);
    await retrySmaller(item());
    expect(retry).toHaveBeenCalledWith(7, { width: 888, height: 888 });
    expect(useOutOfMemoryNotices.getState().ids).toEqual([]);
    expect(useToasts.getState().toasts.map((t) => t.status)).toEqual(['info']);
  });

  it('says so when the backend refuses, and keeps the notice', async () => {
    vi.spyOn(backend, 'retryQueueItem').mockRejectedValue(new Error('size refused'));
    useOutOfMemoryNotices.getState().report(7);
    await retrySmaller(item());
    expect(useOutOfMemoryNotices.getState().ids).toEqual([7]);
    expect(useToasts.getState().toasts[0]).toMatchObject({ status: 'error', description: 'size refused' });
  });
});

describe('report', () => {
  it('keeps the notice and toasts the two ways out', () => {
    useLowMemory.setState({ mode: { enabled: false, ownedEngine: true, pendingRestart: false } });
    reportOutOfMemory(item());
    expect(useOutOfMemoryNotices.getState().ids).toEqual([7]);
    const [toast] = useToasts.getState().toasts;
    expect(toast?.status).toBe('error');
    expect(toast?.actions).toHaveLength(2);
  });

  it('leaves out what does not apply: no smaller retry for a video, no low-memory mode when it is on', () => {
    useLowMemory.setState({ mode: { enabled: true, ownedEngine: true, pendingRestart: false } });
    reportOutOfMemory(item({}, { generationMode: 'video' }));
    expect(useToasts.getState().toasts[0]?.actions).toEqual([]);
  });

  it('keeps only the three newest notices', () => {
    for (const id of [1, 2, 3, 4, 4]) useOutOfMemoryNotices.getState().report(id);
    expect(useOutOfMemoryNotices.getState().ids).toEqual([2, 3, 4]);
  });
});
