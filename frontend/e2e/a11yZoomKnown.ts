// What the zoom checks (a11yZoom.spec.ts) still find at a zoom level: `problems` are exact messages, `most` the most controls
// that may report an `overflow` or `offscreen` fault of the layout scan. Fix the layout, then lower or delete the entry; never
// raise one to make a new fault pass.
export const KNOWN_ZOOM: Record<string, { problems?: string[]; most?: { overflow?: number; offscreen?: number } }> = {
  // 800x480 CSS pixels: the options panel of the Generate tab is narrower than its controls (46 stick out), and the side bar
  // (9 tabs, no scrolling) is taller than the window, so the Extensions tab cannot be reached.
  'zoom 2 of the default window': { problems: ['tab-extensions lies outside the window'], most: { overflow: 46 } },
  // 240x200 CSS pixels (the smallest window at the largest zoom): the size row and the Invoke button stick out of their box.
  'zoom 3 of the smallest window': { most: { overflow: 5 } },
};
