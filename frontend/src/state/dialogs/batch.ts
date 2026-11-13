// Which gallery pictures the "process several at once" dialog is open on (null when closed). The gallery opens it
// through here; the batch feature shows it.
import { create } from 'zustand';

/** The operations of the dialog (`features/batch/batchGraph.ts` builds them). */
export type BatchOpName = 'removeBackground' | 'upscale';

interface BatchState {
  names: string[] | null;
  /** The operation the dialog starts on. */
  op: BatchOpName;
  open: (names: string[], op?: BatchOpName) => void;
  close: () => void;
}

export const useBatch = create<BatchState>()((set) => ({
  names: null,
  op: 'removeBackground',
  open: (names, op = 'removeBackground') => set({ names, op }),
  close: () => set({ names: null }),
}));
