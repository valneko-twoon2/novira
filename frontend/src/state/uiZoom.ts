// Zoom of the whole UI in the desktop app (Ctrl+= / Ctrl+- / Ctrl+0), where the WebView has no zoom of its own.
// In a browser the browser's own zoom does this, so nothing here runs there.

/** The zoom levels a step moves between (the same ladder as Chromium's). */
export const UI_ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3] as const;

/** The next level up (`dir` 1) or down (-1) from `current`, staying on the ladder's ends. */
export function stepUiZoom(current: number, dir: 1 | -1): number {
  if (dir > 0) return UI_ZOOM_STEPS.find((z) => z > current + 1e-6) ?? UI_ZOOM_STEPS[UI_ZOOM_STEPS.length - 1]!;
  return [...UI_ZOOM_STEPS].reverse().find((z) => z < current - 1e-6) ?? UI_ZOOM_STEPS[0];
}

/** A stored zoom made safe to apply: unknown or broken values fall back to 100 %. */
export function sanitizeUiZoom(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= UI_ZOOM_STEPS[0] && value <= UI_ZOOM_STEPS[UI_ZOOM_STEPS.length - 1]! ? value : 1;
}
