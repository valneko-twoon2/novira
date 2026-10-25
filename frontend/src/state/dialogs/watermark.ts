// The "check for a watermark" dialog: open (with a gallery picture to check at once, or none to pick a file) or
// closed. The gallery menu and the export dialog open it through here; the share feature shows it.
import { create } from 'zustand';

interface WatermarkCheckDialogState {
  open: boolean;
  /** The gallery picture to check right away; null: the user picks a file. */
  name: string | null;
  show: (name?: string) => void;
  close: () => void;
}

export const useWatermarkCheckDialog = create<WatermarkCheckDialogState>()((set) => ({
  open: false,
  name: null,
  show: (name) => set({ open: true, name: name ?? null }),
  close: () => set({ open: false, name: null }),
}));
