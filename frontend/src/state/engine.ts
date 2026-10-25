// State of the image engine (ComfyUI) that the backend installs and starts by itself.
import { create } from 'zustand';
import type { EngineStatus } from '@/backend';

interface EngineState {
  status: EngineStatus;
  setStatus: (status: EngineStatus) => void;
}

export const useEngine = create<EngineState>()((set) => ({
  status: { state: 'ready' },
  setStatus: (status) => set({ status }),
}));
