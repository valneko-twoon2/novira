// What the keyboard checks (a11yKeyboard.spec.ts) still find on a screen today. The spec fails on anything not listed and on
// a listed entry that no longer happens, so the lists only get shorter: fix the control, then delete its entry. Never add one
// to make a new fault pass.
export const KNOWN_NO_FOCUS_RING: Record<string, string[]> = {
  // React Flow nodes take focus (tabindex 0) and draw nothing for it; only a click draws the selection.
  workflows: ['div[rf__node-compel-2]', 'div[rf__node-compel-3]', 'div[rf__node-denoise_latents-6]', 'div[rf__node-l2i-7]', 'div[rf__node-main_model_loader-1]', 'div[rf__node-noise-5]', 'div[rf__node-rand_int-4]'],
};
export const KNOWN_UNREACHED: Record<string, string[]> = {};
export const KNOWN_TABBED_OUT: Record<string, string[]> = {};
/** Per dialog or menu: 'does not close' (Escape) or 'focus not returned' (to the opener). */
export const KNOWN_ESCAPE: Record<string, string[]> = {
  // The dialog is opened from a menu item; the menu is gone by then, so Radix has no trigger to give focus back to.
  'settings dialog': ['focus not returned'],
  'hotkeys dialog': ['focus not returned'],
  'about dialog': ['focus not returned'],
};
