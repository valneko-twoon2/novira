// What the Drafts screen's count box, position slider and picture size slider hold. It lives here, not in the screen, so
// it stays as set when another screen is shown and this one comes back. Not saved: after a restart all start again.
import { create } from 'zustand';

/** The picture size of the Candidates view at first, and its bounds (the narrowest a picture of its grid gets, in pixels). */
export const THUMB_SIZE = { min: 96, max: 320, initial: 168 } as const;

interface DraftFormState {
  /** null until the person changes it: the setting applies (also when the setting changes meanwhile). */
  count: number | null;
  percent: number | null;
  thumbSize: number;
  set: (patch: Partial<Pick<DraftFormState, 'count' | 'percent' | 'thumbSize'>>) => void;
}

export const useDraftForm = create<DraftFormState>()((set) => ({
  count: null,
  percent: null,
  thumbSize: THUMB_SIZE.initial,
  set: (patch) => set(patch),
}));
