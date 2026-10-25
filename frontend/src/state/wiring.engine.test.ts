// When ComfyUI comes back after a restart, the node definitions read before are read again (a pack installed since
// then adds nodes the features wait for).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backend, type BackendEvent, type Packs } from '@/backend';
import { useComfyNodes } from './comfy/comfyNodes';
import { useEngine } from './engine';
import { startBackend } from './wiring';

type BootstrapData = Awaited<ReturnType<typeof backend.bootstrap>>;

afterEach(() => vi.restoreAllMocks());

describe('the engine restarting', () => {
  it('reads the node definitions again once it is ready, but only when they were read before', async () => {
    let emit: (e: BackendEvent) => void = () => undefined;
    vi.spyOn(backend, 'subscribe').mockImplementation((listener) => {
      emit = listener;
      return () => undefined;
    });
    vi.spyOn(backend, 'bootstrap').mockResolvedValue({ models: [], boards: [], images: [], workflows: [], engine: { state: 'ready' }, packs: {} as Packs } as BootstrapData);
    const defs = vi.spyOn(backend, 'nodeDefs').mockResolvedValue({ FaceDetailer: {} } as never);
    await startBackend();

    // Never read: nothing to refresh.
    useComfyNodes.setState({ defs: null, status: 'idle' });
    emit({ type: 'engine_status', status: { state: 'starting' } });
    emit({ type: 'engine_status', status: { state: 'ready' } });
    expect(defs).not.toHaveBeenCalled();

    // Read before the restart: stale once the engine is back.
    useComfyNodes.setState({ defs: {}, status: 'ready' });
    emit({ type: 'engine_status', status: { state: 'starting' } });
    expect(defs).not.toHaveBeenCalled();
    emit({ type: 'engine_status', status: { state: 'ready' } });
    await vi.waitFor(() => expect(useComfyNodes.getState().defs).toHaveProperty('FaceDetailer'));
    expect(defs).toHaveBeenCalledTimes(1);
    expect(useEngine.getState().status.state).toBe('ready');
  });
});
