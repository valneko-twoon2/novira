// The random preset run of the Generate tab: which image presets take part and how many pictures one press queues.
// Kept with the presets so the choice is there the next time; ids of presets deleted since are ignored when it runs.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** The most pictures one run queues: the same limit as the Invoke count box (and the backend's MAX_ITERATIONS). */
export const MAX_RUN_COUNT = 1000;

export const clampRunCount = (n: number) => (Number.isFinite(n) ? Math.min(MAX_RUN_COUNT, Math.max(1, Math.round(n))) : 1);

interface PresetRunState {
  /** The presets each picture is picked from, in the order they were ticked. */
  ids: string[];
  /** How many pictures one run queues. */
  count: number;
  toggle: (id: string) => void;
  setCount: (count: number) => void;
}

export const usePresetRun = create<PresetRunState>()(
  persist(
    (set, get) => ({
      ids: [],
      count: 10,
      toggle: (id) => set({ ids: get().ids.includes(id) ? get().ids.filter((x) => x !== id) : [...get().ids, id] }),
      setCount: (count) => set({ count: clampRunCount(count) }),
    }),
    {
      name: 'novira.presetRun',
      version: 1,
      partialize: (s) => ({ ids: s.ids, count: s.count }),
    },
  ),
);
