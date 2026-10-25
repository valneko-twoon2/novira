// The finger gestures of the phone's picture viewer, as plain math: a pinch zooms around the point between the fingers,
// one finger pans a zoomed picture, a sideways swipe of an unzoomed one goes to the next or previous picture. Positions
// are relative to the centre of the stage, where the picture sits fitted at scale 1.

export interface Point {
  x: number;
  y: number;
}

export interface View {
  scale: number;
  x: number;
  y: number;
}

export const FITTED: View = { scale: 1, x: 0, y: 0 };
export const MAX_SCALE = 6;
/** The scale a double tap zooms to. */
export const TAP_SCALE = 2.5;
/** How far a finger must move sideways, more than up or down, to count as a swipe. */
export const SWIPE_DISTANCE = 60;

/** Keeps the picture over the stage: it moves only as far as its zoomed size overflows the stage. */
export function clampView(view: View, picture: { width: number; height: number }, stage: { width: number; height: number }): View {
  const scale = Math.min(MAX_SCALE, Math.max(1, view.scale));
  const limit = (size: number, room: number) => Math.max(0, (size * scale - room) / 2);
  // A picture that does not overflow sits in the middle (0, not -0, so a fitted view is always the same).
  const within = (v: number, l: number) => (l === 0 ? 0 : Math.min(l, Math.max(-l, v)));
  return { scale, x: within(view.x, limit(picture.width, stage.width)), y: within(view.y, limit(picture.height, stage.height)) };
}

/**
 * The view while two fingers pinch: the point of the picture that was under the middle of the fingers when they touched
 * stays under their middle now, at the scale the change of their distance gives.
 */
export function pinchView(start: View, from: [Point, Point], to: [Point, Point]): View {
  const d0 = Math.max(1, Math.hypot(from[1].x - from[0].x, from[1].y - from[0].y));
  const d1 = Math.hypot(to[1].x - to[0].x, to[1].y - to[0].y);
  const scale = Math.min(MAX_SCALE, Math.max(1, (start.scale * d1) / d0));
  const m0 = { x: (from[0].x + from[1].x) / 2, y: (from[0].y + from[1].y) / 2 };
  const m1 = { x: (to[0].x + to[1].x) / 2, y: (to[0].y + to[1].y) / 2 };
  // The picture's point under the first middle, in picture units around its centre.
  const qx = (m0.x - start.x) / start.scale;
  const qy = (m0.y - start.y) / start.scale;
  return { scale, x: m1.x - qx * scale, y: m1.y - qy * scale };
}

/** A double tap: fitted zooms in around the tapped point, zoomed goes back to fitted. */
export function tapView(view: View, at: Point): View {
  if (view.scale > 1.01) return FITTED;
  return { scale: TAP_SCALE, x: at.x - (at.x - view.x) * TAP_SCALE, y: at.y - (at.y - view.y) * TAP_SCALE };
}

/** Which way a finger that moved by (dx, dy) swiped, if it did: to the left shows the next picture. */
export function swipeOf(dx: number, dy: number): 'next' | 'previous' | null {
  if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? 'next' : 'previous';
}
