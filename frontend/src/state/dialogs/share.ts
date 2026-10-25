// Which gallery pictures the "export for sharing" dialog is open on (null when closed). The gallery and the viewer
// open it through here; the share feature shows it.
import { create } from 'zustand';

interface ShareDialogState {
  names: string[] | null;
  open: (names: string[]) => void;
  close: () => void;
}

export const useShareDialog = create<ShareDialogState>()((set) => ({
  names: null,
  open: (names) => set({ names }),
  close: () => set({ names: null }),
}));
