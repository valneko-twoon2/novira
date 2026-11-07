// The scene each picture saved from the Text tab was made from, so the layers can be opened again from the gallery. Kept
// on this device (like the editor's own scene) for the newest pictures only; a picture whose scene is gone is an ordinary
// picture that can still be used as a background.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Scene } from './textModel';

/** How many saved pictures keep their scene; the oldest are dropped first. */
export const TEXT_SOURCES_MAX = 30;

export interface TextSource {
  /** The gallery name of the saved picture. */
  imageName: string;
  scene: Scene;
}

interface TextSourcesState {
  /** Oldest first. */
  sources: TextSource[];
  remember: (imageName: string, scene: Scene) => void;
  sceneOf: (imageName: string) => Scene | null;
}

export const useTextSources = create<TextSourcesState>()(
  persist(
    (set, get) => ({
      sources: [],
      remember: (imageName, scene) =>
        set({ sources: [...get().sources.filter((s) => s.imageName !== imageName), { imageName, scene: structuredClone(scene) }].slice(-TEXT_SOURCES_MAX) }),
      sceneOf: (imageName) => {
        const found = get().sources.find((s) => s.imageName === imageName);
        return found ? structuredClone(found.scene) : null;
      },
    }),
    { name: 'novira.textSources', version: 1, partialize: (s) => ({ sources: s.sources }) },
  ),
);
