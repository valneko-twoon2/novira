// Custom node packs of ComfyUI: what is installed, installs in progress (by GitHub address) and the restart that
// makes ComfyUI load changed packs. After a restart the node definitions are fetched again.
import { create } from 'zustand';
import { backend, type NodePacks, type PackStatus } from '@/backend';
import { useDownloads } from '../downloads';
import { useComfyNodes } from './comfyNodes';

export interface NodePacksState {
  packs: NodePacks | null;
  /** Installs started in this session, by GitHub address (`https://github.com/<owner>/<repo>`). */
  jobs: Record<string, PackStatus>;
  restarting: boolean;
  /** The ComfyUI release being switched to (null when no switch is running). */
  comfySwitching: string | null;
  /** The extensions the last switch could not install again. */
  comfyFailed: string[];
  error: string | null;
  load: () => Promise<void>;
  /** Replaces ComfyUI by a release and installs every extension again; the engine is down while it runs. */
  switchComfy: (version: string) => Promise<void>;
  /** Installs a pack (at the tag `version`, or from the default branch when it is left out). */
  install: (url: string, version?: string) => Promise<void>;
  cancel: (url: string) => Promise<void>;
  remove: (folder: string) => Promise<void>;
  restart: () => Promise<void>;
  setJob: (url: string, status: PackStatus) => void;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** `https://github.com/<owner>/<repo>` as the backend reports it (no `.git`, no trailing slash). */
export function packKey(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\.git$/, '');
}

export const useNodePacks = create<NodePacksState>()((set, get) => ({
  packs: null,
  jobs: {},
  restarting: false,
  comfySwitching: null,
  comfyFailed: [],
  error: null,
  switchComfy: async (version) => {
    set({ comfySwitching: version, comfyFailed: [], error: null });
    try {
      const failed = await backend.switchComfyVersion(version);
      set({ comfyFailed: failed });
      await useComfyNodes.getState().load(true);
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ comfySwitching: null });
      await get().load();
    }
  },
  load: async () => {
    try {
      set({ packs: await backend.nodePacks(), error: null });
    } catch (e) {
      set({ error: message(e) });
    }
  },
  install: async (url, version) => {
    const starting: PackStatus = { state: 'downloading', file: '', index: 1, count: 1, bytes: 0, totalBytes: 0 };
    set({ jobs: { ...get().jobs, [packKey(url)]: starting }, error: null });
    useDownloads.getState().track({ key: `node:${packKey(url)}`, kind: 'node', url: packKey(url), status: starting });
    try {
      await backend.installNodePack(packKey(url), version);
    } catch (e) {
      const status: PackStatus = { state: 'error', message: message(e) };
      set({ jobs: { ...get().jobs, [packKey(url)]: status } });
      useDownloads.getState().track({ key: `node:${packKey(url)}`, kind: 'node', url: packKey(url), status });
    }
  },
  cancel: async (url) => {
    await backend.cancelNodePack(url);
  },
  remove: async (folder) => {
    try {
      set({ packs: await backend.removeNodePack(folder), error: null });
    } catch (e) {
      set({ error: message(e) });
    }
  },
  restart: async () => {
    set({ restarting: true, error: null });
    try {
      set({ packs: await backend.restartEngine() });
      await useComfyNodes.getState().load(true);
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ restarting: false });
    }
  },
  setJob: (url, status) => {
    set({ jobs: { ...get().jobs, [url]: status } });
    // A finished install changes the list (and asks for a restart).
    if (status.state === 'ready') void get().load();
  },
}));
