// Which gallery pictures the "process several at once" dialog is open on (null when closed). The gallery opens it
// through here; the batch feature shows it.
import { create } from 'zustand';

interface BatchState {
  names: string[] | null;
  open: (names: string[]) => void;
  close: () => void;
}

export const useBatch = create<BatchState>()((set) => ({
  names: null,
  open: (names) => set({ names }),
  close: () => set({ names: null }),
}));
