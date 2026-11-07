// What the keyboard checks (a11yKeyboard.spec.ts) still find on a screen today. The spec fails on anything not listed and on
// a listed entry that no longer happens, so the lists only get shorter: fix the control, then delete its entry. Never add one
// to make a new fault pass.
export const KNOWN_NO_FOCUS_RING: Record<string, string[]> = {};
export const KNOWN_UNREACHED: Record<string, string[]> = {};
export const KNOWN_TABBED_OUT: Record<string, string[]> = {};
/** Per dialog or menu: 'does not close' (Escape) or 'focus not returned' (to the opener). */
export const KNOWN_ESCAPE: Record<string, string[]> = {};
