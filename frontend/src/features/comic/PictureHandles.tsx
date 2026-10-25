// The selected picture's handles over the page, as on the canvas: its whole outline (the part outside its panel shows
// faintly under the panels), a handle at each corner that resizes it about its centre, and a handle above it that turns
// it (with Shift, in steps of ROTATION_SNAP degrees). The picture itself is moved by dragging it in its panel.
import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { t } from '@/i18n';
import type { ComicImageView, ComicPoint } from '@/state/comic/document';
import { moveImage, placePicture, resizeImage, rotateImage, type Placement } from '@/state/comic/imageView';
import type { Box } from '@/state/comic/layout';
import { pointInShape } from '@/state/comic/shapes';
import { useCarry } from './useCarry';
import { useImageSize } from './useImageSize';

/** The balloon on the page under a point, if any (the outline lies over the balloons of its panel). */
function balloonAt(x: number, y: number): HTMLElement | null {
  if (typeof document.elementsFromPoint !== 'function') return null;
  for (const el of document.elementsFromPoint(x, y)) {
    const balloon = el.closest<HTMLElement>('.comic-bubble');
    if (balloon) return balloon;
  }
  return null;
}

interface Props {
  url: string;
  view: ComicImageView;
  box: Box;
  aspect: number;
  /** Called with the new view as a corner or the turning handle is dragged (and, with `movable`, as the picture is dragged). */
  onView: (view: ComicImageView) => void;
  /** The picture itself may be dragged to move it (the page's backdrop: nothing else is under the hand). */
  movable?: boolean;
  /**
   * The picture belongs to a panel of a free page: a press on the part of the picture inside that panel's shape carries
   * the panel (these are the panel's own handlers), and only the part outside it, or any part with Alt held, moves the picture.
   */
  carry?: { shape: ComicPoint[]; handlers: ReturnType<typeof useCarry> };
}

/** The picture's rectangle over the page, turned with it. */
function placed(page: Placement, rotation: number): CSSProperties {
  return {
    left: `${page.cx * 100}%`,
    top: `${page.cy * 100}%`,
    width: `${page.width * 100}%`,
    height: `${page.height * 100}%`,
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
  };
}

/** The whole picture, faint, under the panels: what is cut off at the panel's edge stays visible while it is selected. */
export function PictureGhost({ url, view, box, aspect }: Pick<Props, 'url' | 'view' | 'box' | 'aspect'>) {
  const { page } = placePicture(view, useImageSize(url), box, aspect);
  return (
    <img
      className="comic-picture-ghost"
      src={url}
      alt=""
      draggable={false}
      aria-hidden="true"
      style={{ ...placed(page, view.rotation), transform: `translate(-50%, -50%) rotate(${view.rotation}deg) scale(${view.flipX ? -1 : 1}, ${view.flipY ? -1 : 1})` }}
    />
  );
}

const CORNERS = [
  { key: 'nw', x: 0, y: 0 },
  { key: 'ne', x: 1, y: 0 },
  { key: 'se', x: 1, y: 1 },
  { key: 'sw', x: 0, y: 1 },
] as const;

export function PictureHandles({ url, view, box, aspect, onView, movable, carry }: Props) {
  const { page } = placePicture(view, useImageSize(url), box, aspect);
  const outline = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; kind: 'resize' | 'rotate'; start: ComicImageView; centre: { x: number; y: number }; from: { x: number; y: number } } | null>(null);

  const start = (kind: 'resize' | 'rotate') => (e: ReactPointerEvent<HTMLButtonElement>) => {
    const r = outline.current?.getBoundingClientRect();
    if (!r || e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointer: e.pointerId, kind, start: view, centre: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, from: { x: e.clientX, y: e.clientY } };
  };
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const to = { x: e.clientX, y: e.clientY };
    const next = d.kind === 'resize' ? resizeImage(d.start, d.centre, d.from, to) : rotateImage(d.start, d.centre, d.from, to, e.shiftKey);
    onView(next);
  };
  const end = () => {
    drag.current = null;
  };
  // Dragging the picture itself (only where it is movable): it follows the pointer, by how far the page is on screen.
  const body = useRef<{ pointer: number; x: number; y: number; start: ComicImageView } | null>(null);
  // A press that carries the panel instead: its pointer, until it is released.
  const carrying = useRef<number | null>(null);
  const bodyHandlers = movable
    ? {
        onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.button !== 0) return;
          // A balloon under the outline is what the hand meant: the press goes to it (it selects and drags the balloon), and
          // neither the panel nor the picture moves.
          const balloon = balloonAt(e.clientX, e.clientY);
          if (balloon) {
            balloon.dispatchEvent(new PointerEvent('pointerdown', e.nativeEvent));
            return;
          }
          const rect = e.currentTarget.closest<HTMLElement>('.comic-page')?.getBoundingClientRect();
          const inside = !!carry && !!rect?.width && !!rect.height && pointInShape(carry.shape, { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
          if (carry && inside && !e.altKey) {
            carrying.current = e.pointerId;
            carry.handlers.onPointerDown?.(e);
            return;
          }
          e.currentTarget.setPointerCapture(e.pointerId);
          body.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY, start: view };
        },
        onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
          if (carrying.current === e.pointerId) {
            carry?.handlers.onPointerMove?.(e);
            return;
          }
          const d = body.current;
          const rect = e.currentTarget.closest<HTMLElement>('.comic-page')?.getBoundingClientRect();
          if (!d || d.pointer !== e.pointerId || !rect) return;
          onView(moveImage(d.start, e.clientX - d.x, e.clientY - d.y, rect));
        },
        onPointerUp: () => {
          if (carrying.current !== null) carry?.handlers.onPointerUp?.();
          carrying.current = null;
          body.current = null;
        },
        onPointerCancel: () => {
          if (carrying.current !== null) carry?.handlers.onPointerCancel?.();
          carrying.current = null;
          body.current = null;
        },
      }
    : {};
  const handle = { onPointerMove: move, onPointerUp: end, onPointerCancel: end, onClick: (e: { stopPropagation: () => void }) => e.stopPropagation() };

  return (
    <div ref={outline} className={movable ? 'comic-picture is-movable' : 'comic-picture'} style={placed(page, view.rotation)} data-testid="comic-picture-handles" {...bodyHandlers}>
      {CORNERS.map((c) => (
        <button
          key={c.key}
          type="button"
          className={`comic-picture__corner comic-picture__corner--${c.key}`}
          style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
          aria-label={t('comic.image.resize')}
          title={t('comic.image.resize')}
          data-testid="comic-picture-corner"
          onPointerDown={start('resize')}
          {...handle}
        />
      ))}
      <span className="comic-picture__stem" aria-hidden="true" />
      <button
        type="button"
        className="comic-picture__rotate"
        aria-label={t('comic.image.rotate')}
        title={t('comic.image.rotate')}
        data-testid="comic-picture-rotate"
        onPointerDown={start('rotate')}
        {...handle}
      />
    </div>
  );
}
