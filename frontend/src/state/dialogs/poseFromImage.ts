// Whether the "make a pose from a picture" dialog is open, and on which gallery picture (null: the dialog asks for one).
// The gallery, the viewer and the canvas pose tool open it through here; the canvas feature shows it.
import { create } from 'zustand';

interface PoseFromImageState {
  open: boolean;
  imageName: string | null;
  /** Opens on a picture, or without one (the dialog then offers to drop or upload one). */
  show: (imageName?: string | null) => void;
  /** Changes the picture while open. */
  setImage: (imageName: string | null) => void;
  close: () => void;
}

export const usePoseFromImageDialog = create<PoseFromImageState>()((set) => ({
  open: false,
  imageName: null,
  show: (imageName = null) => set({ open: true, imageName }),
  setImage: (imageName) => set({ imageName }),
  close: () => set({ open: false, imageName: null }),
}));
