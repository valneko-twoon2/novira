// Open state of the workflow dialogs: discard confirmation and "Save As".
import { create } from 'zustand';
import { useWorkflows } from '@/state/workflows/workflows';

interface DialogsState {
  pending: (() => void) | null;
  saveAsOpen: boolean;
  ask: (action: () => void) => void;
  resolve: (ok: boolean) => void;
  setSaveAsOpen: (open: boolean) => void;
}

export const useDialogs = create<DialogsState>()((set, get) => ({
  pending: null,
  saveAsOpen: false,
  ask: (pending) => set({ pending }),
  resolve: (ok) => {
    const action = get().pending;
    set({ pending: null });
    if (ok) action?.();
  },
  setSaveAsOpen: (saveAsOpen) => set({ saveAsOpen }),
}));

/** Runs the action now, or after confirmation when the editor has unsaved changes. */
export function confirmDiscard(action: () => void) {
  const s = useWorkflows.getState();
  if (s.isTouched && s.nodes.length) useDialogs.getState().ask(action);
  else action();
}
