// The zoom of the comic page view. 100% is the page at its usual size: as wide as the view, up to 720 px. The buttons step
// between stops; Ctrl and the mouse wheel zoom smoothly.
export const COMIC_ZOOM_MIN = 0.5;
export const COMIC_ZOOM_MAX = 4;

const STOPS: readonly number[] = [COMIC_ZOOM_MIN, 0.75, 1, 1.5, 2, 3, COMIC_ZOOM_MAX];
const EPSILON = 1e-9;

/** The next stop up (dir 1) or down (dir -1) from a zoom. A zoom between two stops moves to the stop beyond it; the ends stay. */
export function stepComicZoom(zoom: number, dir: 1 | -1): number {
  if (dir > 0) return STOPS.find((z) => z > zoom + EPSILON) ?? COMIC_ZOOM_MAX;
  return [...STOPS].reverse().find((z) => z < zoom - EPSILON) ?? COMIC_ZOOM_MIN;
}

/** How much one pixel of wheel movement zooms: a usual notch (100 px) zooms by about a fifth. */
const WHEEL_RATE = 0.002;

/** The zoom after the wheel moved by `deltaY` (up, a negative delta, zooms in), within the zoom's range. */
export function wheelComicZoom(zoom: number, deltaY: number): number {
  const next = zoom * Math.exp(-deltaY * WHEEL_RATE);
  return Math.min(COMIC_ZOOM_MAX, Math.max(COMIC_ZOOM_MIN, next));
}
