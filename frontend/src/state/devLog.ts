// The developer log: the backend's own log lines (`log` events), frontend console warnings and errors, uncaught
// errors and failed renders, newest last. Shown in the developer log panel when it is turned on in Settings.
import { create } from 'zustand';
import type { LogEntry, LogLevel } from '@/backend';
import { t } from '@/i18n';
import { toast } from './toasts';

export const MAX_LOG_ENTRIES = 1000;
/** Longest message kept from the frontend (the backend cuts its own). */
const MAX_MESSAGE_CHARS = 4000;

export interface DevLogEntry extends LogEntry {
  id: number;
}

interface DevLogState {
  entries: DevLogEntry[];
  open: boolean;
  add: (entry: Omit<LogEntry, 'at'> & { at?: number }) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
}

let nextId = 1;

export const useDevLog = create<DevLogState>()((set, get) => ({
  entries: [],
  open: false,
  add: (entry) => {
    const message = entry.message.length > MAX_MESSAGE_CHARS ? `${entry.message.slice(0, MAX_MESSAGE_CHARS)}…` : entry.message;
    const next = { ...entry, message, at: entry.at ?? Date.now(), id: nextId++ };
    set({ entries: [...get().entries, next].slice(-MAX_LOG_ENTRIES) });
  },
  clear: () => set({ entries: [] }),
  setOpen: (open) => set({ open }),
}));

export function devLog(level: LogLevel, source: string, message: string) {
  useDevLog.getState().add({ level, source, message });
}

/** Text of anything thrown: an Error's message (and stack when asked), or the value as a string. */
export function describeError(err: unknown, withStack = false): string {
  if (err instanceof Error) return withStack && err.stack ? err.stack : `${err.name}: ${err.message}`;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Uncaught errors are rare; a burst (one failing render loop) shows one notification, not dozens. */
const TOAST_GAP_MS = 5000;
let lastToast = 0;

function reportUncaught(err: unknown) {
  devLog('error', 'frontend', describeError(err, true));
  const now = Date.now();
  if (now - lastToast < TOAST_GAP_MS) return;
  lastToast = now;
  toast({ status: 'error', title: t('common.error.unexpected'), description: describeError(err) });
}

/**
 * The browser's notice that a ResizeObserver callback changed a layout it then could not report in the same frame
 * ("ResizeObserver loop completed with undelivered notifications", older Chromium: "... loop limit exceeded"). It is
 * raised as an `error` event with no error object, nothing is thrown and the next frame delivers the rest, so it is
 * logged as a warning instead of being reported as an unexpected error.
 */
export function isResizeObserverNotice(message: unknown): boolean {
  return typeof message === 'string' && /^ResizeObserver loop (completed with undelivered notifications|limit exceeded)/.test(message);
}

function onWindowError(e: ErrorEvent) {
  if (!e.error && isResizeObserverNotice(e.message)) {
    devLog('warn', 'frontend', e.message);
    return;
  }
  reportUncaught(e.error ?? e.message);
}

let installed = false;

/**
 * Collects console warnings and errors and catches what nothing else caught (a thrown error in an event handler, a
 * rejected promise nobody awaited), so it is logged and shown instead of failing silently. Call once at start-up.
 */
export function installDevLogCapture() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  for (const level of ['warn', 'error'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      try {
        devLog(level, 'console', args.map((a) => (typeof a === 'string' ? a : describeError(a))).join(' '));
      } catch {
        // Logging must never break the caller.
      }
    };
  }
  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', (e) => reportUncaught(e.reason));
}

/** Test helper: forget the toast throttle. */
export function resetDevLogThrottle() {
  lastToast = 0;
}
