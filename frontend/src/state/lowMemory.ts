// ComfyUI's low-memory mode (a backend setting): read once, switched from Settings or after running out of memory.
import { create } from 'zustand';
import { backend, type LowMemoryMode } from '@/backend';
import { t } from '@/i18n';
import { devLog } from './devLog';
import { toast } from './toasts';

interface LowMemoryState {
  /** `null` until read from the backend. */
  mode: LowMemoryMode | null;
  /** A switch (and the ComfyUI restart it may bring) is under way. */
  busy: boolean;
  load: () => Promise<void>;
  /** Saves the setting; the backend restarts ComfyUI unless a job runs. Tells the user how it went. */
  setEnabled: (enabled: boolean) => Promise<void>;
}

let loading: Promise<void> | null = null;

export const useLowMemory = create<LowMemoryState>()((set, get) => ({
  mode: null,
  busy: false,
  load: () => {
    loading ??= backend
      .lowMemoryMode()
      .then((mode) => set({ mode }))
      .catch((err: unknown) => {
        loading = null;
        devLog('warn', 'engine', `low-memory mode not read: ${err instanceof Error ? err.message : String(err)}`);
      });
    return loading;
  },
  setEnabled: async (enabled) => {
    if (get().busy) return;
    set({ busy: true });
    try {
      const mode = await backend.setLowMemoryMode(enabled);
      set({ mode });
      toast({
        status: 'success',
        title: t(enabled ? 'settings.lowMemory.toast.on' : 'settings.lowMemory.toast.off'),
        description: mode.pendingRestart ? t('settings.lowMemory.pending') : undefined,
      });
    } catch (err) {
      toast({ status: 'error', title: t('settings.lowMemory.toast.failed'), description: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ busy: false });
    }
  },
}));

/** Low-memory mode is off on a ComfyUI that novira starts itself, so turning it on would help. */
export const canTurnOnLowMemory = (mode: LowMemoryMode | null) => mode !== null && mode.ownedEngine && !mode.enabled;
