// What the Drafts screen's count box and position slider hold. It lives here, not in the screen, so it stays as set when
// another screen is shown and this one comes back. Not saved: after a restart both start from the settings again.
import { create } from 'zustand';

interface DraftFormState {
  /** null until the person changes it: the setting applies (also when the setting changes meanwhile). */
  count: number | null;
  percent: number | null;
  set: (patch: Partial<Pick<DraftFormState, 'count' | 'percent'>>) => void;
}

export const useDraftForm = create<DraftFormState>()((set) => ({
  count: null,
  percent: null,
  set: (patch) => set(patch),
}));
