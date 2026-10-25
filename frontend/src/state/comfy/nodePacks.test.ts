import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ComfyNodeDefs, type NodePacks } from '@/backend';
import { useComfyNodes } from './comfyNodes';
import { packKey, useNodePacks } from './nodePacks';

const initialPacks = useNodePacks.getState();
const initialNodes = useComfyNodes.getState();

const list = (restartNeeded: boolean): NodePacks => ({ available: true, installed: [], comfyVersion: null, restartNeeded });

beforeEach(() => {
  useNodePacks.setState(initialPacks, true);
  useComfyNodes.setState(initialNodes, true);
});
afterEach(() => vi.restoreAllMocks());

describe('packKey', () => {
  it('normalizes a GitHub address the way the backend reports it', () => {
    expect(packKey('  https://github.com/o/r.git/ ')).toBe('https://github.com/o/r');
    expect(packKey('https://github.com/o/r')).toBe('https://github.com/o/r');
  });
});

describe('node packs store', () => {
  it('tracks an install under the normalized address and records a failure to start', async () => {
    vi.spyOn(backend, 'installNodePack').mockRejectedValue(new Error('not a repository'));
    await useNodePacks.getState().install('https://github.com/o/r.git');
    expect(useNodePacks.getState().jobs).toEqual({ 'https://github.com/o/r': { state: 'error', message: 'not a repository' } });
  });

  it('reloads the installed list when an install finishes', async () => {
    const nodePacks = vi.spyOn(backend, 'nodePacks').mockResolvedValue(list(true));
    useNodePacks.getState().setJob('https://github.com/o/r', { state: 'downloading', file: 'r', index: 1, count: 1, bytes: 1, totalBytes: 2 });
    expect(nodePacks).not.toHaveBeenCalled();
    useNodePacks.getState().setJob('https://github.com/o/r', { state: 'ready' });
    await vi.waitFor(() => expect(useNodePacks.getState().packs).toEqual(list(true)));
  });

  it('keeps the error of a failed removal', async () => {
    vi.spyOn(backend, 'removeNodePack').mockRejectedValue(new Error('x is not installed'));
    await useNodePacks.getState().remove('x');
    expect(useNodePacks.getState().error).toBe('x is not installed');
  });

  it('restarts the engine and fetches the node definitions again', async () => {
    vi.spyOn(backend, 'restartEngine').mockResolvedValue(list(false));
    const defs = vi.spyOn(backend, 'nodeDefs').mockResolvedValue({} as ComfyNodeDefs);
    useComfyNodes.setState({ status: 'ready', defs: {} as ComfyNodeDefs });
    await useNodePacks.getState().restart();
    expect(defs).toHaveBeenCalledOnce();
    expect(useNodePacks.getState()).toMatchObject({ restarting: false, error: null, packs: list(false) });
  });

  it('clears the restarting flag when the restart fails', async () => {
    vi.spyOn(backend, 'restartEngine').mockRejectedValue(new Error('a job is running'));
    await useNodePacks.getState().restart();
    expect(useNodePacks.getState()).toMatchObject({ restarting: false, error: 'a job is running' });
  });
});

describe('comfy node definitions', () => {
  it('loads once unless forced', async () => {
    const defs = vi.spyOn(backend, 'nodeDefs').mockResolvedValue({} as ComfyNodeDefs);
    await useComfyNodes.getState().load();
    await useComfyNodes.getState().load();
    expect(defs).toHaveBeenCalledOnce();
    await useComfyNodes.getState().load(true);
    expect(defs).toHaveBeenCalledTimes(2);
    expect(useComfyNodes.getState().status).toBe('ready');
  });

  it('reports a failed load and can try again', async () => {
    vi.spyOn(backend, 'nodeDefs').mockRejectedValueOnce(new Error('engine down')).mockResolvedValue({} as ComfyNodeDefs);
    await useComfyNodes.getState().load();
    expect(useComfyNodes.getState()).toMatchObject({ status: 'error', error: 'engine down' });
    await useComfyNodes.getState().load();
    expect(useComfyNodes.getState()).toMatchObject({ status: 'ready', error: null });
  });
});
