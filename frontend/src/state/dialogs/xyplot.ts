// Whether the comparison-grid dialog is open. The Generate controls open it through here; the xyplot feature shows it.
import { create } from 'zustand';

interface XyPlotDialogState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useXyPlotDialog = create<XyPlotDialogState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
