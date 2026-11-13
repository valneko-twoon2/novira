// Which gallery pictures the "process several at once" dialog is open on (null when closed). The gallery opens it
// through here; the batch feature shows it.
import { create } from 'zustand';

/** The operations of the dialog (`features/batch/batchGraph.ts` builds them). */
export type BatchOpName = 'removeBackground' | 'upscale';

interface BatchState {
  names: string[] | null;
  /** The operation the dialog was opened for; null keeps the one chosen last. */
  op: BatchOpName | null;
  open: (names: string[], op?: BatchOpName) => void;
  close: () => void;
}

export const useBatch = create<BatchState>()((set) => ({
  names: null,
  op: null,
  open: (names, op) => set({ names, op: op ?? null }),
  close: () => set({ names: null }),
}));
