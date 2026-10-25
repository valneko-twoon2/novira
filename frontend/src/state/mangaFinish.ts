// The values of the manga finish (the ComfyUI-MangaScreen pack's Manga Finish node) that the viewer's dialog offers. They are
// kept across starts like the other settings; the finish itself is never part of a drawing request (see the viewer's manga folder).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MangaScreen } from '@/backend';

/** The ranges and defaults the dialog offers; they are the node's own. */
export const MANGA_RANGE = {
  screenLines: { min: 40, max: 600, step: 10, default: 200 },
  whitePoint: { min: 0.3, max: 1, step: 0.01, default: 0.8 },
  blackPoint: { min: 0, max: 0.7, step: 0.01, default: 0.3 },
  gradation: { min: 0, max: 1, step: 0.05, default: 1 },
  whiteLines: { min: 0, max: 1, step: 0.05, default: 0.4 },
} as const;

export const MANGA_KEYS = ['screenLines', 'whitePoint', 'blackPoint', 'gradation', 'whiteLines'] as const satisfies readonly (keyof MangaScreen)[];

export const DEFAULT_MANGA: MangaScreen = {
  screenLines: MANGA_RANGE.screenLines.default,
  whitePoint: MANGA_RANGE.whitePoint.default,
  blackPoint: MANGA_RANGE.blackPoint.default,
  gradation: MANGA_RANGE.gradation.default,
  whiteLines: MANGA_RANGE.whiteLines.default,
};

interface MangaFinishState {
  values: MangaScreen;
  set: (patch: Partial<MangaScreen>) => void;
  reset: () => void;
}

/** Stored values read back: a value that is not a number keeps its default, and each is held to its range. */
export function restoreManga(stored: unknown): MangaScreen {
  const out = { ...DEFAULT_MANGA };
  if (typeof stored !== 'object' || stored === null) return out;
  const values = (stored as { values?: unknown }).values;
  if (typeof values !== 'object' || values === null) return out;
  for (const key of MANGA_KEYS) {
    const v = (values as Record<string, unknown>)[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = Math.min(MANGA_RANGE[key].max, Math.max(MANGA_RANGE[key].min, v));
  }
  return out;
}

export const useMangaFinish = create<MangaFinishState>()(
  persist(
    (set) => ({
      values: DEFAULT_MANGA,
      set: (patch) => set((s) => ({ values: { ...s.values, ...patch } })),
      reset: () => set({ values: DEFAULT_MANGA }),
    }),
    {
      name: 'novira.mangaFinish',
      version: 1,
      partialize: (s) => ({ values: s.values }),
      merge: (stored, current) => ({ ...current, values: restoreManga(stored) }),
    },
  ),
);
