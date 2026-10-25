// Whether the "describe as a prompt" dialog is open, and on which gallery picture (null: the dialog asks for one).
// The gallery, the viewer and the prompt box open it through here; the caption feature shows it.
import { create } from 'zustand';

interface CaptionDialogState {
  open: boolean;
  imageName: string | null;
  /** Opens on a picture, or without one (the dialog then offers to drop or upload one). */
  show: (imageName?: string | null) => void;
  /** Changes the picture while open. */
  setImage: (imageName: string | null) => void;
  close: () => void;
}

export const useCaptionDialog = create<CaptionDialogState>()((set) => ({
  open: false,
  imageName: null,
  show: (imageName = null) => set({ open: true, imageName }),
  setImage: (imageName) => set({ imageName }),
  close: () => set({ open: false, imageName: null }),
}));
