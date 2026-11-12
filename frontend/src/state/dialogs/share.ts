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
  /** The choices of an open that set some, until the dialog takes them; the number changes on each such open. */
  preset: { choices: SharePreset; seq: number } | null;
  open: (names: string[], preset?: SharePreset) => void;
  /** The dialog has put the preset into its form: it is used once. */
  takePreset: () => void;
  close: () => void;
}

/** Counts the opens with a preset, so the same choices given twice still apply again. */
let seq = 0;

export const useShareDialog = create<ShareDialogState>()((set) => ({
  names: null,
  preset: null,
  open: (names, preset) => set(preset ? { names, preset: { choices: preset, seq: ++seq } } : { names, preset: null }),
  takePreset: () => set({ preset: null }),
  close: () => set({ names: null, preset: null }),
}));
