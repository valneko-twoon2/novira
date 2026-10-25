// The graphics card and its memory, read once on first use, so screens that offer models can say which ones fit.
import { create } from 'zustand';
import { backend, type HardwareInfo } from '@/backend';

interface HardwareState {
  /** `null` until the first read finishes. */
  info: HardwareInfo | null;
  load: () => Promise<void>;
}

let loading: Promise<void> | null = null;

export const useHardware = create<HardwareState>()((set) => ({
  info: null,
  load: () => {
    loading ??= backend
      .hardwareInfo()
      .then((info) => set({ info }))
      .catch(() => set({ info: { gpuName: '', vramBytes: null } }));
    return loading;
  },
}));
