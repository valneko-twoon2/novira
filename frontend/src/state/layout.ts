// Which layout the window shows: the desktop one (side bar and three columns) or the phone one (one column with tabs at
// its foot). A window the size of a phone in a browser gets the phone layout: held upright, or on its side with a short
// screen and touch. The desktop app always shows the desktop layout (its window may be narrow, but it is never a phone).
import { useSyncExternalStore } from 'react';
import { backend } from '@/backend';

/** A phone held upright (narrow), or on its side (short, with touch). */
export const PHONE_QUERY = '(max-width: 767px), (max-height: 500px) and (pointer: coarse)';

const phoneQuery = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(PHONE_QUERY) : null);

function subscribe(onChange: () => void): () => void {
  const query = phoneQuery();
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

const matches = () => phoneQuery()?.matches ?? false;

/** The phone layout, read now (for an event handler or a render that does not follow the window). */
export const isPhoneLayout = (): boolean => matches() && backend.kind !== 'tauri';

/** Whether the phone layout is shown: a phone-sized window in a browser, never the desktop app's. */
export function usePhoneLayout(): boolean {
  const sized = useSyncExternalStore(subscribe, matches, () => false);
  return sized && backend.kind !== 'tauri';
}
