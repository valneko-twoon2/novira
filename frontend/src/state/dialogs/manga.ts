// Which gallery picture the "finish as a manga page" dialog is open on (null when closed). The viewer opens it through
// here; the viewer's manga feature shows it.
import { create } from 'zustand';

interface MangaDialogState {
  imageName: string | null;
  open: (imageName: string) => void;
  close: () => void;
}

export const useMangaDialog = create<MangaDialogState>()((set) => ({
  imageName: null,
  open: (imageName) => set({ imageName }),
  close: () => set({ imageName: null }),
}));
