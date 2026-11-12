// Which gallery pictures the "export for sharing" dialog is open on (null when closed). The gallery and the viewer
// open it through here; the share feature shows it.
import { create } from 'zustand';
import type { ExportFormat } from '@/backend';

/** Choices to start the form with (the assistant sets them); a choice left out keeps the last one used. */
export interface SharePreset {
  format?: ExportFormat;
  quality?: number;
  /** Longest side in pixels; left out keeps the size choice as it was. */
  maxSide?: number;
  removeInfo?: boolean;
}

interface ShareDialogState {
  names: string[] | null;
  /** The choices of the latest open that set some, with a number that changes on each such open. */
  preset: { choices: SharePreset; seq: number } | null;
  open: (names: string[], preset?: SharePreset) => void;
  close: () => void;
}

export const useShareDialog = create<ShareDialogState>()((set, get) => ({
  names: null,
  preset: null,
  open: (names, preset) => set(preset ? { names, preset: { choices: preset, seq: (get().preset?.seq ?? 0) + 1 } } : { names }),
  close: () => set({ names: null }),
}));
