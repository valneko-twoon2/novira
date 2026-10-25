// A workflow file that could not open because custom node packs are missing. It waits here while the user installs
// them; once ComfyUI knows their nodes the workflows feature opens it.
import { create } from 'zustand';

export interface PendingImport {
  /** The file's content, as read. */
  raw: unknown;
  /** The name to open it under when the file has none. */
  name: string;
  packs: { folder: string; url: string | null }[];
  types: string[];
}

interface WorkflowImportState {
  pending: PendingImport | null;
  set: (pending: PendingImport) => void;
  clear: () => void;
}

export const useWorkflowImport = create<WorkflowImportState>()((set) => ({
  pending: null,
  set: (pending) => set({ pending }),
  clear: () => set({ pending: null }),
}));
