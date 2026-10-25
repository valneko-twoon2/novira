// The fingers on the phone's picture viewer: two pinch, one pans a zoomed picture or swipes an unzoomed one to the next,
// a double tap zooms in and out (the math is in gestures.ts). The view goes back to fitted when the picture changes.
import { useRef, useState, type PointerEvent } from 'react';
import { clampView, FITTED, pinchView, swipeOf, tapView, type Point, type View } from './gestures';

/** A tap is a touch that moves less than this and ends quickly; two of them close together are a double tap. */
const TAP_MOVE = 10;
const TAP_TIME = 250;
const DOUBLE_TAP_TIME = 300;
const DOUBLE_TAP_DISTANCE = 30;

type Gesture =
  | { kind: 'pinch'; start: View; from: [Point, Point] }
  | { kind: 'pan'; start: View; from: Point }
  | { kind: 'swipe'; from: Point }
  | null;

interface Options {
  /** The picture's size fitted on the stage, and the stage's: they bound the pan. */
  picture: { width: number; height: number };
  stage: { width: number; height: number };
  /** Changes with the picture: a new one starts fitted. */
  resetKey: string;
  onSwipe: (direction: 'next' | 'previous') => void;
}

export function usePictureGestures({ picture, stage, resetKey, onSwipe }: Options) {
  const [view, setView] = useState<View>(FITTED);
  /** How far an unzoomed picture follows a swiping finger. */
  const [drag, setDrag] = useState(0);
  const [shownKey, setShownKey] = useState(resetKey);
  if (shownKey !== resetKey) {
    setShownKey(resetKey);
    setView(FITTED);
    setDrag(0);
  }
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture>(null);
  const down = useRef<{ at: Point; time: number } | null>(null);
  const lastTap = useRef<{ at: Point; time: number } | null>(null);

  const local = (e: PointerEvent<HTMLElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  };
  const clamp = (v: View) => clampView(v, picture, stage);
  const two = (): [Point, Point] => {
    const [a, b] = [...pointers.current.values()];
    return [a!, b!];
  };
  // Starts what the fingers now on the picture do: two pinch; one pans a zoomed picture and swipes a fitted one.
  const begin = (current: View) => {
    const fingers = [...pointers.current.values()];
    if (fingers.length >= 2) gesture.current = { kind: 'pinch', start: current, from: two() };
    else if (fingers.length === 1) gesture.current = current.scale > 1.01 ? { kind: 'pan', start: current, from: fingers[0]! } : { kind: 'swipe', from: fingers[0]! };
    else gesture.current = null;
  };

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const at = local(e);
    pointers.current.set(e.pointerId, at);
    down.current = pointers.current.size === 1 ? { at, time: e.timeStamp } : null;
    begin(view);
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const at = local(e);
    pointers.current.set(e.pointerId, at);
    const g = gesture.current;
    if (g?.kind === 'pinch' && pointers.current.size >= 2) setView(clamp(pinchView(g.start, g.from, two())));
    else if (g?.kind === 'pan') setView(clamp({ ...g.start, x: g.start.x + at.x - g.from.x, y: g.start.y + at.y - g.from.y }));
    else if (g?.kind === 'swipe') setDrag(at.x - g.from.x);
  };

  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const at = local(e);
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g?.kind === 'swipe') {
      setDrag(0);
      const direction = swipeOf(at.x - g.from.x, at.y - g.from.y);
      if (direction) {
        gesture.current = null;
        onSwipe(direction);
        return;
      }
    }
    // A tap: a second one soon after and near the first zooms in, or back out.
    const d = down.current;
    if (d && pointers.current.size === 0 && Math.hypot(at.x - d.at.x, at.y - d.at.y) < TAP_MOVE && e.timeStamp - d.time < TAP_TIME) {
      const last = lastTap.current;
      if (last && e.timeStamp - last.time < DOUBLE_TAP_TIME && Math.hypot(at.x - last.at.x, at.y - last.at.y) < DOUBLE_TAP_DISTANCE) {
        setView(clamp(tapView(view, at)));
        lastTap.current = null;
      } else lastTap.current = { at, time: e.timeStamp };
    }
    down.current = null;
    // The finger left on the picture after a pinch carries on from the view the pinch made.
    begin(view);
  };

  return {
    view,
    drag,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
