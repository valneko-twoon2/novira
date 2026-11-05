// Notifications: the toasts shown for a while at the bottom-right, and the history behind the bell (app/NotificationBell)
// that keeps every one of them for the session, with a count of those not seen yet.
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
  /**
   * Goes only into the bell's history, without popping up, while a bell is on screen: for notices that come in runs while
   * the user works (deleting pictures one after another), where a stack of toasts would cover what they work on.
   */
  quiet?: boolean;
}

/** A notification kept in the history: the toast and when it came. Its actions are dropped once one of them has run. */
export interface Notice extends Toast {
  at: number;
}

/** How many notifications the history keeps; the oldest go first. */
export const HISTORY_LIMIT = 100;

interface ToastState {
  toasts: Toast[];
  /** Every notification of the session, newest first. */
  history: Notice[];
  /** Notifications that came since the history was last opened. */
  unread: number;
  /** How many bells are mounted; quiet notifications pop up as toasts when there is none (the phone layout). */
  bells: number;
  push: (toast: Omit<Toast, 'id'>, durationMs?: number) => number;
  dismiss: (id: number) => void;
  /** Runs an action of a notification, from its toast or from the history, once: it closes the toast and drops the actions. */
  runAction: (id: number, index: number) => void;
  markRead: () => void;
  /** Drops one notification from the history (and its toast), or all of them. */
  forget: (id?: number) => void;
  /** Registers a mounted bell; returns its unregister. */
  attachBell: () => () => void;
}

let nextId = 1;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  history: [],
  unread: 0,
  bells: 0,
  push: (toast, durationMs = useSettings.getState().toastSeconds * 1000) => {
    const id = nextId++;
    const pops = !(toast.quiet && get().bells > 0);
    set((s) => ({
      history: [{ ...toast, id, at: Date.now() }, ...s.history].slice(0, HISTORY_LIMIT),
      unread: s.unread + 1,
      toasts: pops ? [...s.toasts, { ...toast, id }].slice(-5) : s.toasts,
    }));
    if (pops && durationMs > 0) setTimeout(() => get().dismiss(id), durationMs);
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  runAction: (id, index) => {
    const action = (get().history.find((n) => n.id === id) ?? get().toasts.find((t) => t.id === id))?.actions?.[index];
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
      history: s.history.map((n) => (n.id === id ? { ...n, actions: undefined } : n)),
    }));
    action?.run();
  },
  markRead: () => set({ unread: 0 }),
  forget: (id) =>
    set((s) => (id === undefined ? { history: [], unread: 0 } : { history: s.history.filter((n) => n.id !== id), toasts: s.toasts.filter((t) => t.id !== id) })),
  attachBell: () => {
    set((s) => ({ bells: s.bells + 1 }));
    return () => set((s) => ({ bells: s.bells - 1 }));
  },
}));

export const toast = (t: Omit<Toast, 'id'>, durationMs?: number) => useToasts.getState().push(t, durationMs);
