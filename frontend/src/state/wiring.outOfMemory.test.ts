// A job that runs out of GPU memory: the wiring reports it once, when it turns failed.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backend, type BackendEvent, type Packs, type QueueItem } from '@/backend';
import { useOutOfMemoryNotices } from './outOfMemory';
import { useToasts } from './toasts';
import { startBackend } from './wiring';

type BootstrapData = Awaited<ReturnType<typeof backend.bootstrap>>;

afterEach(() => vi.restoreAllMocks());

const item = (status: QueueItem['status'], errorKind: QueueItem['errorKind'] = null) =>
  ({ id: 5, status, errorKind, params: { generationMode: 'txt2img', width: 512, height: 512 }, origin: 'generate', destination: 'gallery' }) as unknown as QueueItem;

describe('an out-of-memory failure', () => {
  it('is reported once with a notice and a toast', async () => {
    let emit: (e: BackendEvent) => void = () => undefined;
    vi.spyOn(backend, 'subscribe').mockImplementation((listener) => {
      emit = listener;
      return () => undefined;
    });
    vi.spyOn(backend, 'bootstrap').mockResolvedValue({ models: [], boards: [], images: [], workflows: [], engine: { state: 'ready' }, packs: {} as Packs } as BootstrapData);
    vi.spyOn(backend, 'lowMemoryMode').mockResolvedValue({ enabled: false, ownedEngine: true, pendingRestart: false });
    await startBackend();

    emit({ type: 'queue_item_status_changed', item: item('in_progress') });
    emit({ type: 'queue_item_status_changed', item: item('failed', 'out_of_memory') });
    // The same state again (a resync) is not a new failure.
    emit({ type: 'queue_item_status_changed', item: item('failed', 'out_of_memory') });
    expect(useOutOfMemoryNotices.getState().ids).toEqual([5]);
    expect(useToasts.getState().toasts.filter((t) => t.status === 'error')).toHaveLength(1);
  });
});
