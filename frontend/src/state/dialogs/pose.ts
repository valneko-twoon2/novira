// Whether the pose editor dialog is open. The canvas layers panel opens it through here; the pose feature shows it.
// A caller can give a target instead: the editor then draws at that size, starts from the given pose and hands the
// pose and its picture back (the comic panels do this), instead of putting the picture on the canvas.
import { create } from 'zustand';

export interface PoseTarget {
  width: number;
  height: number;
  /** The pose to start from; null starts from the standing preset. */
  initial: { x: number; y: number }[] | null;
  /** Called with the 18 joints (fractions of the picture) and the picture, when the user uses the pose. */
  onUse: (pose: { x: number; y: number }[], picture: Blob) => Promise<void>;
}

interface PoseDialogState {
  isOpen: boolean;
  target: PoseTarget | null;
  open: (target?: PoseTarget) => void;
  close: () => void;
}

export const usePoseDialog = create<PoseDialogState>()((set) => ({
  isOpen: false,
  target: null,
  open: (target) => set({ isOpen: true, target: target ?? null }),
  close: () => set({ isOpen: false, target: null }),
}));
