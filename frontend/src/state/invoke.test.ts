import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { backend, type BackendClient, type EnqueueRequest, type QueueItem } from '@/backend';
import { useGallery } from './gallery';
import { autoAddBoardId, buildRequestFor, invoke, registerInvokeBuilder, type InvokeBuilder } from './invoke';
import { useToasts } from './toasts';
import { useUi } from './ui';

const initialUi = useUi.getState();
const initialGallery = useGallery.getState();

const request = (destination: EnqueueRequest['destination'] = 'gallery') => ({ destination }) as EnqueueRequest;

const builder = (over: Partial<InvokeBuilder> = {}): InvokeBuilder => ({
  readiness: () => [],
  build: vi.fn(async () => request()),
  ...over,
});

const statuses = () => useToasts.getState().toasts.map((t) => t.status);

let enqueue: MockInstance<BackendClient['enqueue']>;

beforeEach(() => {
  useUi.setState(initialUi, true);
  useGallery.setState(initialGallery, true);
  useToasts.setState({ toasts: [] });
  enqueue = vi.spyOn(backend, 'enqueue').mockResolvedValue([{ id: 1 } as QueueItem, { id: 2 } as QueueItem]);
});
afterEach(() => vi.restoreAllMocks());

describe('invoke', () => {
  it('enqueues the active tab batch and leaves the launchpad for the viewer', async () => {
    const b = builder();
    registerInvokeBuilder('generate', b);
    useUi.setState({ activeTab: 'generate', mainView: { ...initialUi.mainView, generate: 'launchpad' } });
    await invoke({ prepend: true });
    expect(b.build).toHaveBeenCalledWith({ prepend: true });
    expect(enqueue).toHaveBeenCalledOnce();
    expect(useUi.getState().mainView.generate).toBe('viewer');
    expect(statuses()).toEqual(['success']);
  });

  it('stays on the launchpad when the batch goes to the canvas', async () => {
    registerInvokeBuilder('generate', builder({ build: async () => request('canvas') }));
    useUi.setState({ activeTab: 'generate', mainView: { ...initialUi.mainView, generate: 'launchpad' } });
    await invoke();
    expect(useUi.getState().mainView.generate).toBe('launchpad');
  });

  it('warns and enqueues nothing while the builder is not ready', async () => {
    const b = builder({ readiness: () => ['no model'] });
    registerInvokeBuilder('generate', b);
    await invoke();
    expect(b.build).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(useToasts.getState().toasts[0]).toMatchObject({ status: 'warning', description: 'no model' });
  });

  it('reports a failed enqueue with its message', async () => {
    registerInvokeBuilder('generate', builder());
    enqueue.mockRejectedValue(new Error('queue is gone'));
    await invoke();
    expect(useToasts.getState().toasts[0]).toMatchObject({ status: 'error', description: 'queue is gone' });
  });

  it('uses the media panel builder while the Generate tab shows video, music or voice', async () => {
    const image = builder();
    const video = builder();
    registerInvokeBuilder('generate', image);
    registerInvokeBuilder('video', video);
    useUi.setState({ activeTab: 'generate', media: 'video' });
    await invoke();
    expect(video.build).toHaveBeenCalledOnce();
    expect(image.build).not.toHaveBeenCalled();
    // Media panels do not switch the Generate tab to the viewer.
    expect(useUi.getState().mainView.generate).toBe(initialUi.mainView.generate);
  });

  // The text editor has no builder: Ctrl+Enter there once queued the image form hidden behind it.
  it('does not fall back to the image form on a media panel without a builder', async () => {
    const image = builder();
    registerInvokeBuilder('generate', image);
    useUi.setState({ activeTab: 'generate', media: 'text' });
    await invoke();
    expect(image.build).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('does nothing on a tab without a builder', async () => {
    useUi.setState({ activeTab: 'models' });
    await invoke();
    expect(enqueue).not.toHaveBeenCalled();
    expect(useToasts.getState().toasts).toEqual([]);
  });

  it('builds a request without enqueueing it', async () => {
    registerInvokeBuilder('upscaling', builder({ build: async ({ prepend }) => ({ ...request(), prepend }) as EnqueueRequest }));
    await expect(buildRequestFor('upscaling', { prepend: true })).resolves.toMatchObject({ prepend: true });
    expect(buildRequestFor('browse')).toBeNull();
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe('autoAddBoardId', () => {
  it('maps Uncategorized to no board', () => {
    expect(autoAddBoardId()).toBeNull();
    useGallery.getState().setAutoAddBoard('b1');
    expect(autoAddBoardId()).toBe('b1');
  });
});
