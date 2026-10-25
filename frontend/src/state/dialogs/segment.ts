// Which gallery picture the "select and fix a part" dialog is open on (null when closed). Other features open it
// through here; the segment feature shows it.
import { create } from 'zustand';

interface SegmentState {
  imageName: string | null;
  open: (imageName: string) => void;
  close: () => void;
}

export const useSegment = create<SegmentState>()((set) => ({
  imageName: null,
  open: (imageName) => set({ imageName }),
  close: () => set({ imageName: null }),
}));
