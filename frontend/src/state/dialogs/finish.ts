// Which finished video the "finish the clip" dialog is open on (null when closed). The video screen opens it through
// here; the finish feature shows it.
import { create } from 'zustand';

interface FinishState {
  name: string | null;
  open: (name: string) => void;
  close: () => void;
}

export const useFinish = create<FinishState>()((set) => ({
  name: null,
  open: (name) => set({ name }),
  close: () => set({ name: null }),
}));
