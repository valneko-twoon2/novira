// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ImageDTO, ProgressEvent, QueueItem } from '@/backend';
import { useGallery } from '@/state/gallery';
import { useQueue } from '@/state/queue';
import { useLastWorkflowImageUrl, useWorkflowExecution } from './execution';

const initialQueue = useQueue.getState();
const initialGallery = useGallery.getState();

const item = (id: number, over: Partial<QueueItem>): QueueItem => ({ id, status: 'pending', origin: 'workflows', imageName: null, ...over }) as QueueItem;
const progress = (itemId: number): ProgressEvent => ({ itemId, step: 1, totalSteps: 2, progressImageUrl: null, message: '' });

beforeEach(() => {
  useQueue.setState(initialQueue, true);
  useGallery.setState(initialGallery, true);
});
afterEach(cleanup);

describe('useWorkflowExecution', () => {
  it('is idle when nothing runs', () => {
    expect(renderHook(() => useWorkflowExecution()).result.current).toEqual({ executing: false, progress: null });
  });

  it('ignores a running item of another origin', () => {
    useQueue.getState().setItems([item(1, { status: 'in_progress', origin: 'generate' })]);
    expect(renderHook(() => useWorkflowExecution()).result.current.executing).toBe(false);
  });

  it('is executing with the progress that belongs to the running workflow item', () => {
    useQueue.getState().setItems([item(1, { status: 'in_progress' })]);
    useQueue.getState().setProgress(progress(1));
    const { executing, progress: p } = renderHook(() => useWorkflowExecution()).result.current;
    expect(executing).toBe(true);
    expect(p?.itemId).toBe(1);
  });

  it('drops the progress of another item', () => {
    useQueue.getState().setItems([item(1, { status: 'in_progress' })]);
    useQueue.getState().setProgress(progress(9));
    expect(renderHook(() => useWorkflowExecution()).result.current).toEqual({ executing: true, progress: null });
  });
});

describe('useLastWorkflowImageUrl', () => {
  const image = (name: string, thumbnailUrl: string) => ({ name, thumbnailUrl }) as ImageDTO;

  it('is null when no workflow run completed', () => {
    useQueue.getState().setItems([item(1, { status: 'failed', imageName: 'a' }), item(2, { status: 'completed', origin: 'generate', imageName: 'b' })]);
    expect(renderHook(() => useLastWorkflowImageUrl()).result.current).toBeNull();
  });

  it('returns the thumbnail of the most recent completed workflow run that has an image', () => {
    useGallery.setState({ images: [image('a', 'thumb-a'), image('b', 'thumb-b')] });
    useQueue.getState().setItems([
      item(1, { status: 'completed', imageName: 'a' }),
      item(2, { status: 'completed', imageName: 'b' }),
      item(3, { status: 'completed', imageName: null }),
    ]);
    expect(renderHook(() => useLastWorkflowImageUrl()).result.current).toBe('thumb-b');
  });

  it('is null while the picture is not in the gallery yet', () => {
    useQueue.getState().setItems([item(1, { status: 'completed', imageName: 'missing' })]);
    expect(renderHook(() => useLastWorkflowImageUrl()).result.current).toBeNull();
  });
});
