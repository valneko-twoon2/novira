// Whether the model import dialog is open, and on which tab. The Models screen opens it from its toolbar, and a warning
// that a model is missing (an image encoder, say) opens it straight on the starter models; the models feature shows it.
import { create } from 'zustand';

export type ImportTab = 'source' | 'huggingface' | 'scan' | 'starter';

interface ModelImportState {
  isOpen: boolean;
  tab: ImportTab;
  /** Opens the dialog, on `tab` when given (otherwise on the tab it was last left on). */
  open: (tab?: ImportTab) => void;
  setTab: (tab: ImportTab) => void;
  close: () => void;
}

export const useModelImport = create<ModelImportState>()((set) => ({
  isOpen: false,
  tab: 'source',
  open: (tab) => set((s) => ({ isOpen: true, tab: tab ?? s.tab })),
  setTab: (tab) => set({ tab }),
  close: () => set({ isOpen: false }),
}));
