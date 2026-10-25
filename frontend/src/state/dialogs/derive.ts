// Which gallery picture the "redo with a chosen strength" dialog is open on (null when closed). The gallery and the
// viewer open it through here; the derive feature shows it.
import { create } from 'zustand';

interface DeriveDialogState {
  imageName: string | null;
  open: (imageName: string) => void;
  close: () => void;
}

export const useDeriveDialog = create<DeriveDialogState>()((set) => ({
  imageName: null,
  open: (imageName) => set({ imageName }),
  close: () => set({ imageName: null }),
}));
