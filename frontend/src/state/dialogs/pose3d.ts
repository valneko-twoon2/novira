// Whether the 3D pose editor is open. The pose tool bar opens it; the canvas feature shows it.
import { create } from 'zustand';

interface Pose3dDialogState {
  open: boolean;
  show: () => void;
  close: () => void;
}

export const usePose3dDialog = create<Pose3dDialogState>()((set) => ({
  open: false,
  show: () => set({ open: true }),
  close: () => set({ open: false }),
}));
