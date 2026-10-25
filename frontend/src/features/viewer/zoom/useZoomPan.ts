// Zoom and pan for still images in the viewer, with the canvas stage's gestures: wheel / Ctrl+wheel / pinch zoom around
// the cursor, drag (or Space+drag, middle-button drag) to pan, double-click to toggle fit and 100%, and the shared zoom
// hotkeys. One state can drive several surfaces (side-by-side compare), so their zoom and pan stay in sync.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useHotkey, ZOOM_HOTKEYS } from '@/ui';
import { canPan, clampPan, fitRect, stepZoom, wheelZoomFactor, zoomAt, type Point, type Size, type ViewTransform } from '@/ui/zoomMath';

/** Space between the fitted image and the stage edges. */
export const FIT_PADDING = 16;

interface Options {
  /** Size of the content in document pixels (the image's natural size). */
  content: Size;
  /** The view returns to fit whenever this changes (e.g. the displayed image's name). */
  resetKey: string;
  /** Plain left-button drags pan (off where the left button does something else, like the compare slider). */
  leftButtonPans?: boolean;
  padding?: number;
}

export interface ZoomPan {
  view: ViewTransform;
  /** Size of the (first) surface in screen pixels; 0×0 until measured. */
  stage: Size;
  /** The view is the automatic fit (it follows stage resizes). */
  fitted: boolean;
  /** A drag would pan: the content overflows, or Space is held. */
  grab: boolean;
  panning: boolean;
  /** Ref callback for each element that shows the content and receives the gestures. */
  surfaceRef: (el: HTMLElement | null) => (() => void) | undefined;
  fit: () => void;
  actualSize: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo: (scale: number, anchor?: Point) => void;
  /** Double-click behaviour: fit -> 100% at the point (200% if fit is already 100%), otherwise back to fit. */
  toggleAt: (anchor: Point) => void;
}

/** Elements inside a surface that keep their own pointer handling. */
const INTERACTIVE = 'button, a, input, select, textarea, video, audio, [role="menu"]';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName);
}

export function useZoomPan({ content, resetKey, leftButtonPans = true, padding = FIT_PADDING }: Options): ZoomPan {
  const [stage, setStage] = useState<Size>({ width: 0, height: 0 });
  // A user-set view, remembered with the key it belongs to: a new key (another image) means "fit" again.
  const [free, setFree] = useState<{ key: string; view: ViewTransform } | null>(null);
  const [panning, setPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  // Forget the user's view as soon as the key changes, so going back to an earlier image starts fitted too.
  const [shownKey, setShownKey] = useState(resetKey);
  if (shownKey !== resetKey) {
    setShownKey(resetKey);
    setFree(null);
  }

  const contentSize = { width: Math.max(1, content.width), height: Math.max(1, content.height) };
  const fitted = !free || free.key !== resetKey;
  const fitView = fitRect({ x: 0, y: 0, ...contentSize }, stage.width, stage.height, padding);
  const view = fitted ? fitView : clampPan(free.view, contentSize, stage);
  const grab = spaceHeld || (leftButtonPans && canPan(view, contentSize, stage));

  const live = useRef({ view, stage, content: contentSize, resetKey, fitted, fitScale: fitView.scale, leftButtonPans, spaceHeld });
  useLayoutEffect(() => {
    live.current = { view, stage, content: contentSize, resetKey, fitted, fitScale: fitView.scale, leftButtonPans, spaceHeld };
  });

  const setView = useCallback((next: ViewTransform) => {
    const l = live.current;
    const clamped = clampPan(next, l.content, l.stage);
    live.current = { ...l, view: clamped, fitted: false };
    setFree({ key: l.resetKey, view: clamped });
  }, []);

  const fit = useCallback(() => {
    live.current = { ...live.current, fitted: true };
    setFree(null);
  }, []);

  const zoomTo = useCallback(
    (scale: number, anchor?: Point) => {
      const l = live.current;
      setView(zoomAt(l.view, anchor ?? { x: l.stage.width / 2, y: l.stage.height / 2 }, scale));
    },
    [setView],
  );

  const zoomIn = useCallback(() => zoomTo(stepZoom(live.current.view.scale, 1)), [zoomTo]);
  const zoomOut = useCallback(() => zoomTo(stepZoom(live.current.view.scale, -1)), [zoomTo]);
  const actualSize = useCallback(() => zoomTo(1), [zoomTo]);
  const toggleAt = useCallback(
    (anchor: Point) => {
      const l = live.current;
      if (!l.fitted) fit();
      else zoomTo(Math.abs(l.fitScale - 1) < 1e-3 ? 2 : 1, anchor);
    },
    [fit, zoomTo],
  );

  // Surfaces in mount order; the first one's size is the stage size.
  const surfaces = useRef<HTMLElement[]>([]);
  const surfaceRef = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return undefined;
      surfaces.current.push(el);
      const measure = () => {
        if (surfaces.current[0] !== el) return;
        setStage((s) => (s.width === el.clientWidth && s.height === el.clientHeight ? s : { width: el.clientWidth, height: el.clientHeight }));
      };
      const local = (e: { clientX: number; clientY: number }): Point => {
        const r = el.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      let drag: { start: Point; view: ViewTransform; pointerId: number } | null = null;

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        zoomTo(live.current.view.scale * wheelZoomFactor(e), local(e));
      };
      const onPointerDown = (e: PointerEvent) => {
        if (drag || (e.target instanceof Element && e.target.closest(INTERACTIVE))) return;
        const l = live.current;
        const pans = e.button === 1 || (e.button === 0 && (l.spaceHeld || (l.leftButtonPans && canPan(l.view, l.content, l.stage))));
        if (!pans) return;
        e.preventDefault();
        el.setPointerCapture?.(e.pointerId);
        drag = { start: local(e), view: l.view, pointerId: e.pointerId };
        setPanning(true);
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!drag || e.pointerId !== drag.pointerId) return;
        const p = local(e);
        setView({ scale: drag.view.scale, x: drag.view.x + p.x - drag.start.x, y: drag.view.y + p.y - drag.start.y });
      };
      const onPointerUp = (e: PointerEvent) => {
        if (!drag || e.pointerId !== drag.pointerId) return;
        if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
        drag = null;
        setPanning(false);
      };
      const onDoubleClick = (e: MouseEvent) => {
        if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
        toggleAt(local(e));
      };
      // Keep the browser's middle-button autoscroll from starting.
      const onAuxDown = (e: MouseEvent) => {
        if (e.button === 1) e.preventDefault();
      };

      el.addEventListener('wheel', onWheel, { passive: false });
      el.addEventListener('pointerdown', onPointerDown);
      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', onPointerUp);
      el.addEventListener('pointercancel', onPointerUp);
      el.addEventListener('dblclick', onDoubleClick);
      el.addEventListener('mousedown', onAuxDown);
      const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
      ro?.observe(el);
      measure();
      return () => {
        ro?.disconnect();
        el.removeEventListener('wheel', onWheel);
        el.removeEventListener('pointerdown', onPointerDown);
        el.removeEventListener('pointermove', onPointerMove);
        el.removeEventListener('pointerup', onPointerUp);
        el.removeEventListener('pointercancel', onPointerUp);
        el.removeEventListener('dblclick', onDoubleClick);
        el.removeEventListener('mousedown', onAuxDown);
        if (drag) setPanning(false);
        surfaces.current = surfaces.current.filter((s) => s !== el);
        const next = surfaces.current[0];
        if (next) setStage({ width: next.clientWidth, height: next.clientHeight });
      };
    },
    [setView, toggleAt, zoomTo],
  );

  // Space held = temporary hand tool, as on the canvas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.key !== ' ' || isTyping(e.target)) return;
      if (down) e.preventDefault();
      setSpaceHeld(down);
    };
    const onDown = (e: KeyboardEvent) => onKey(e, true);
    const onUp = (e: KeyboardEvent) => onKey(e, false);
    const onBlur = () => setSpaceHeld(false);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useHotkey(ZOOM_HOTKEYS.fit, fit);
  useHotkey(ZOOM_HOTKEYS.actualSize, actualSize);
  useHotkey(ZOOM_HOTKEYS.zoomIn, zoomIn);
  useHotkey(ZOOM_HOTKEYS.zoomOut, zoomOut);

  return { view, stage, fitted, grab, panning, surfaceRef, fit, actualSize, zoomIn, zoomOut, zoomTo, toggleAt };
}
