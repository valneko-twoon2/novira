// The ComfyUI Registry list the extension manager browses: read once when the screen opens (the backend keeps it for an hour).
import { create } from 'zustand';
import { backend, type RegistryNode } from '@/backend';

export interface RegistryState {
  nodes: RegistryNode[] | null;
  loading: boolean;
  error: string | null;
  /** Reads the list; `refresh` asks the backend to read it again from the registry. */
  load: (refresh?: boolean) => Promise<void>;
}

export const useRegistry = create<RegistryState>()((set, get) => ({
  nodes: null,
  loading: false,
  error: null,
  load: async (refresh = false) => {
    if (get().loading || (get().nodes && !refresh)) return;
    set({ loading: true, error: null });
    try {
      set({ nodes: await backend.registryNodes(refresh), loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },
}));
