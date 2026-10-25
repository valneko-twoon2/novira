// The home network of the page's own server: what it is doing now, read from `GET /lan/state`. The QR item in the
// side bar and the prompt for a phone that asks to pair both read it from here. It is read once when the page starts; while
// the home network is open it is read every few seconds (faster while the item's popover is open), and while it is closed
// it is read only when something here changes it. A page with no home network of its own (the desktop app, a phone, the
// browser mock) gets no state, so nothing shows.
import { create } from 'zustand';
import { getLanApi, type LanApi, type LanState } from '@/backend';

/** How often the state is read while the item's popover is open, and while only a phone could be asking. */
export const FAST_MS = 2000;
export const SLOW_MS = 4000;

interface LanStore {
  api: LanApi | null;
  /** The last state read; null when there is none (or this page has no home network). */
  state: LanState | null;
  popoverOpen: boolean;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  setPopoverOpen: (open: boolean) => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let starting: Promise<void> | undefined;

export const useLan = create<LanStore>()((set, get) => {
  const schedule = () => {
    clearTimeout(timer);
    const { state, popoverOpen } = get();
    const every = popoverOpen ? FAST_MS : state?.open ? SLOW_MS : 0;
    if (every > 0) {
      timer = setTimeout(() => void get().refresh(), every);
    }
  };
  return {
    api: null,
    state: null,
    popoverOpen: false,
    init: () => {
      starting ??= (async () => {
        const api = await getLanApi();
        set({ api });
        await get().refresh();
      })();
      return starting;
    },
    refresh: async () => {
      const { api } = get();
      if (!api) return;
      set({ state: await api.state() });
      schedule();
    },
    setPopoverOpen: (popoverOpen) => {
      set({ popoverOpen });
      if (popoverOpen) void get().refresh();
      else schedule();
    },
  };
});

/** Forgets what was read and stops reading (tests). */
export function resetLan(): void {
  clearTimeout(timer);
  starting = undefined;
  useLan.setState({ api: null, state: null, popoverOpen: false });
}
