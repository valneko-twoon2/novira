// Which gallery picture the "fix the face" dialog is open on (null when closed). The gallery and the viewer open it
// through here; the facefix feature shows it.
import { create } from 'zustand';

interface FaceFixDialogState {
  imageName: string | null;
  open: (imageName: string) => void;
  close: () => void;
}

export const useFaceFixDialog = create<FaceFixDialogState>()((set) => ({
  imageName: null,
  open: (imageName) => set({ imageName }),
  close: () => set({ imageName: null }),
}));
