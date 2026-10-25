// Backend events reach the stores: the queue, models, packs, downloads and the developer log.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { backend, type BackendEvent, type Packs } from '@/backend';
import { useDevLog } from './devLog';
import { useDownloads } from './downloads';
import { usePacks } from './media/packs';
import { useModels } from './models';
import { useNodePacks } from './comfy/nodePacks';
import { useQueue } from './queue';
import { startBackend } from './wiring';

type BootstrapData = Awaited<ReturnType<typeof backend.bootstrap>>;

let emit: (e: BackendEvent) => void = () => undefined;

/** The wiring starts once per module, so every test shares the one listener it registered. */
beforeAll(async () => {
  vi.spyOn(backend, 'subscribe').mockImplementation((listener) => {
    emit = listener;
    return () => undefined;
  });
  vi.spyOn(backend, 'bootstrap').mockResolvedValue({ models: [], boards: [], images: [], workflows: [], engine: { state: 'ready' }, packs: {} as Packs } as BootstrapData);
  await startBackend();
  vi.restoreAllMocks();
});

afterEach(() => vi.restoreAllMocks());

describe('backend events', () => {
  it('reloads the queue when it is cleared and when the processor changes state', async () => {
    const list = vi.spyOn(backend, 'listQueue').mockReturnValue([{ id: 7 } as never]);
    const status = vi.spyOn(backend, 'queueStatus').mockReturnValue({ isPaused: true, total: 1 } as never);
    useQueue.getState().setProgress({ itemId: 1 } as never);
    emit({ type: 'queue_cleared' });
    expect(useQueue.getState().items).toEqual([{ id: 7 }]);
    expect(useQueue.getState().progress).toBeNull();
    status.mockReturnValue({ isPaused: false, total: 1 } as never);
    emit({ type: 'processor_state' } as never);
    expect(useQueue.getState().status.isPaused).toBe(false);
    expect(list).toHaveBeenCalled();
  });

  it('shows the progress of the running item', async () => {
    emit({ type: 'invocation_progress', progress: { itemId: 3, progressImageUrl: 'blob:p' } } as never);
    expect(useQueue.getState().progress).toMatchObject({ itemId: 3 });
  });

  it('keeps the model list and the install jobs up to date', async () => {
    emit({ type: 'model_added', model: { key: 'm9', name: 'New', type: 'main', base: 'sdxl' } } as never);
    expect(useModels.getState().models.some((m) => m.key === 'm9')).toBe(true);
    emit({ type: 'model_install', job: { id: 'j9', source: 's', name: 'n', status: 'downloading', bytes: 1, totalBytes: 2 } } as never);
    expect(useModels.getState().installJobs.some((j) => j.id === 'j9')).toBe(true);
  });

  it('tracks the downloads of model packs and node packs', async () => {
    emit({ type: 'pack', kind: 'video', status: { state: 'downloading', bytes: 1, totalBytes: 10 } } as never);
    expect(usePacks.getState().packs.video.state).toBe('downloading');
    expect(useDownloads.getState().entries.map((e) => e.key)).toContain('model:video');
    emit({ type: 'node_pack', url: 'https://github.com/a/b', status: { state: 'installing' } } as never);
    expect(useNodePacks.getState().jobs['https://github.com/a/b']).toBeTruthy();
    expect(useDownloads.getState().entries.map((e) => e.key)).toContain('node:https://github.com/a/b');
  });

  it('adds log entries to the developer log', async () => {
    const before = useDevLog.getState().entries.length;
    emit({ type: 'log', entry: { id: 1, time: 0, level: 'info', source: 'test', message: 'hello' } } as never);
    expect(useDevLog.getState().entries.length).toBe(before + 1);
  });
});
