// The last settings of each picture tool, kept across starts like the other screen settings: a run from the picture
// menu uses them as they are, and the tool band changes them.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_TOOL_SETTINGS, restoreToolSettings, type ImageToolId, type ToolSettings } from './tools';

interface ImageToolSettingsState {
  values: ToolSettings;
  set: <T extends ImageToolId>(tool: T, patch: Partial<ToolSettings[T]>) => void;
}

export const useImageToolSettings = create<ImageToolSettingsState>()(
  persist(
    (set) => ({
      values: DEFAULT_TOOL_SETTINGS,
      set: (tool, patch) => set((s) => ({ values: { ...s.values, [tool]: { ...s.values[tool], ...patch } } })),
    }),
    {
      name: 'novira.imageTools',
      version: 1,
      partialize: (s) => ({ values: s.values }),
      merge: (stored, current) => ({ ...current, values: restoreToolSettings(stored && typeof stored === 'object' ? (stored as { values?: unknown }).values : null) }),
    },
  ),
);
