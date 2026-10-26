// The first-start commands (backend/src-tauri/src/first_run.rs). They run before the backend exists, so they are not
// part of `BackendClient`. The page never sends a path: the folders are picked in the shell's own dialog.
import { invoke } from '@tauri-apps/api/core';

export type FolderKind = 'data' | 'comfyui';

export interface FirstRunInfo {
  needed: boolean;
  dataDir: string;
  comfyuiDir: string;
  dataIsDefault: boolean;
  comfyuiIsDefault: boolean;
  /** The data is being moved to the folder chosen in the Settings screen; the app restarts when it is done. */
  moving: boolean;
}

export const firstRun = {
  info: () => invoke<FirstRunInfo>('first_run_info'),
  /** Asks for a folder in a native dialog; `null` when the user cancels it. */
  choose: (kind: FolderKind) => invoke<FirstRunInfo | null>('first_run_choose', { kind }),
  reset: (kind: FolderKind) => invoke<FirstRunInfo>('first_run_reset', { kind }),
  /** Saves the choice and restarts the app. */
  finish: () => invoke<void>('first_run_finish'),
};
