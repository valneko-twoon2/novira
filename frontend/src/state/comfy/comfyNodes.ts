// The nodes ComfyUI can run, as it describes them. Loaded once when the workflow editor needs them; the workflows
// feature turns the ones from custom node packs into editor nodes.
import { create } from 'zustand';
import { backend, type ComfyNodeDefs } from '@/backend';

interface ComfyNodesState {
  defs: ComfyNodeDefs | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  /** Fetches the definitions unless they are loaded or loading; `force` fetches again (after a pack is installed). */
  load: (force?: boolean) => Promise<void>;
}

export const useComfyNodes = create<ComfyNodesState>()((set, get) => ({
  defs: null,
  status: 'idle',
  error: null,
  load: async (force = false) => {
    const { status } = get();
    if (status === 'loading' || (status === 'ready' && !force)) return;
    set({ status: 'loading', error: null });
    try {
      set({ defs: await backend.nodeDefs(), status: 'ready' });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },
}));
