// Which gallery picture the "remove the background" dialog is open on (null when closed). Other features open it
// through here; the segment feature shows it.
import { create } from 'zustand';

interface CutoutState {
  imageName: string | null;
  open: (imageName: string) => void;
  close: () => void;
}

export const useCutout = create<CutoutState>()((set) => ({
  imageName: null,
  open: (imageName) => set({ imageName }),
  close: () => set({ imageName: null }),
}));
