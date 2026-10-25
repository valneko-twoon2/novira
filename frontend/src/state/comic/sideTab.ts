// Which tab the comic screen's right column shows: the assistant or the gallery (the page's layers are always shown below them).
import { create } from 'zustand';

export type ComicRightTab = 'assistant' | 'gallery';

interface ComicSideTabState {
  right: ComicRightTab;
  setRight: (right: ComicRightTab) => void;
}

export const useComicSideTab = create<ComicSideTabState>()((set) => ({
  right: 'assistant',
  setRight: (right) => set({ right }),
}));
