// Transient notifications shown at the bottom-right.
import { create } from 'zustand';
import { useSettings } from './settings';

export type ToastStatus = 'info' | 'success' | 'warning' | 'error';

/** A button on a toast; pressing it runs `run` and closes the toast. */
export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  status: ToastStatus;
  title: string;
  description?: string;
  actions?: ToastAction[];
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>, durationMs?: number) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (toast, durationMs = useSettings.getState().toastSeconds * 1000) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { ...toast, id }].slice(-5) });
    if (durationMs > 0) setTimeout(() => get().dismiss(id), durationMs);
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = (t: Omit<Toast, 'id'>, durationMs?: number) => useToasts.getState().push(t, durationMs);
