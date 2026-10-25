// Whether the drawing settings being edited belong to the whole comic or only to the page on screen.
import { create } from 'zustand';

export type DrawScope = 'comic' | 'page';

export const useDrawScope = create<{ scope: DrawScope; setScope: (scope: DrawScope) => void }>()((set) => ({
  scope: 'comic',
  setScope: (scope) => set({ scope }),
}));
