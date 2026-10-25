// A balloon on its panel: its outline (see BalloonArt) and its words. It is dragged inside its panel by its body, and a
// double click opens its editor. The selected balloon shows a handle at its tail's tip, which turns and stretches the tail.
// While its outline is being shaped (see the balloon editor), the points of the outline show instead: each is dragged to
// change the shape, a double click on one removes it, and a double click on the balloon adds one on the nearest side.
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { t } from '@/i18n';
import { balloonShape, BUBBLE_TEXT_SHARE, fitStep, outlineScale, seedOf } from '@/state/comic/balloon';
import { plainText, textRuns } from '@/state/comic/balloonText';
import { BUBBLE_KIND_DEFAULTS, BUBBLE_OUTLINE_POINTS, type ComicBubble, type ComicPoint } from '@/state/comic/document';
import { stampById, stampUrl, STAMP_HEIGHT_EM } from '@/state/comic/stamps';
import { useComic } from '@/state/comic/store';
import { fontStack, useAppFonts } from '@/state/fonts';
import { useSettings } from '@/state/settings';
import { cx } from '@/ui';
import { BalloonArt } from './BalloonArt';

/** A tail tip may be dragged a little past the balloon, as far as the model's data allows (see the document's limits). */
const clampTail = (v: number) => Math.min(3, Math.max(-2, v));
/** A point of a drawn outline stays near the balloon's box (see the document's limits). */
const clampPoint = (v: number) => Math.min(2, Math.max(-1, v));

/** Where on the side from a to b the point p is nearest, as a share of the side, and how far it is. */
function nearestOnSide(a: ComicPoint, b: ComicPoint, p: ComicPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return { t, distance: Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y) };
}

type BalloonProps = { bubble: ComicBubble; panelId: string; frame: RefObject<HTMLDivElement | null>; selected: boolean };

/**
 * A balloon appears once the app's fonts are loaded (the first time the comic opens they arrive a frame or two later): its
 * words are laid out and measured in their font, so they never show, centre or fit in the fallback font first.
 */
export function ComicBalloon(props: BalloonProps) {
  return useAppFonts() ? <Balloon {...props} /> : null;
}

function Balloon({ bubble, panelId, frame, selected }: BalloonProps) {
  const drag = useRef<{ pointer: number; startX: number; startY: number; x: number; y: number } | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const words = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const centering = useComic((s) => s.centeringBubbleId === bubble.id);
  const fitting = useComic((s) => s.fittingBubbleIds.includes(bubble.id));
  const tailDrag = useRef<number | null>(null);
  const pointDrag = useRef<{ pointer: number; index: number } | null>(null);
  const shaping = useComic((s) => s.bubbleShaping) && selected;
  const shape = useMemo(() => balloonShape(bubble, seedOf(bubble.id)), [bubble]);
  const defaultFont = useSettings((s) => s.comicFont);
  // The outline's box is the words' box stretched about its middle (see balloonOutline); the tail and the points are set in it.
  const sx = outlineScale(bubble.kind) * bubble.width;
  const sy = outlineScale(bubble.kind) * bubble.height;
  const update = (patch: Partial<ComicBubble>) => useComic.getState().updateBubble(panelId, bubble.id, patch);
  // A balloon just added goes to the middle of its panel, once its size is known (its words decide it).
  useLayoutEffect(() => {
    const el = body.current;
    const box = frame.current;
    if (useComic.getState().centeringBubbleId !== bubble.id || !el || !box?.clientWidth || !box.clientHeight) return;
    useComic.getState().centerBubble(panelId, bubble.id, el.offsetWidth / box.clientWidth, el.offsetHeight / box.clientHeight);
  }, [bubble.id, panelId, frame]);
  // Words that run out of the balloon are marked; a balloon waiting to be fitted (see fittingBubbleIds) is shrunk a step at
  // a time, each step laid out and measured again, and then moved inside its panel.
  useLayoutEffect(() => {
    const el = body.current;
    const text = words.current;
    // The panel's ref is set after this effect when the panel and its balloons appear together; the panel is the parent.
    const box = frame.current ?? el?.parentElement;
    if (!el || !text || !box?.clientWidth || !box.clientHeight) return;
    const outer = el.getBoundingClientRect();
    const inner = text.getBoundingClientRect();
    const measured = {
      wordsOverflow: inner.left < outer.left - 1 || inner.right > outer.right + 1 || inner.top < outer.top - 1 || inner.bottom > outer.bottom + 1,
      width: el.offsetWidth / box.clientWidth,
      height: el.offsetHeight / box.clientHeight,
      outlineX: sx,
      outlineY: sy,
    };
    setOverflowing(measured.wordsOverflow);
    if (!fitting || centering) return;
    const step = fitStep(bubble, measured);
    useComic.getState().fitBubble(panelId, bubble.id, step.patch, step.done);
  }, [frame, fitting, centering, bubble, panelId, sx, sy]);
  const style: CSSProperties = {
    left: `${bubble.x * 100}%`,
    top: `${bubble.y * 100}%`,
    // The text's size is a share of the panel's width, the same share the page's picture uses.
    fontSize: `${BUBBLE_TEXT_SHARE * bubble.scale * 100}cqw`,
    // The balloon's own font, else the settings' balloon font, else the app's (see bubbleFonts for the saved page).
    fontFamily: fontStack(bubble.font || defaultFont || null),
    ...(bubble.rotation ? { transform: `rotate(${bubble.rotation}deg)` } : {}),
  };
  // The words in runs of their marks (bold, emphasis dots); a balloon with no words shows the name of its kind.
  const runs = plainText(bubble.text).trim() ? textRuns(bubble.text) : [{ text: t(`comic.bubble.kind.${bubble.kind}`), bold: false, dots: false }];
  const stamp = bubble.kind === 'stamp' ? stampById(bubble.text) : undefined;
  const left = -((sx - 1) / 2) * 100;
  const top = -((sy - 1) / 2) * 100;
  const outline: CSSProperties = { left: `${left}%`, top: `${top}%`, width: `${sx * 100}%`, height: `${sy * 100}%` };
  const placeAt = (p: ComicPoint): CSSProperties => ({ left: `${left + sx * 100 * p.x}%`, top: `${top + sy * 100 * p.y}%` });
  /** The point of the outline's box under the pointer. */
  const outlinePoint = (e: { clientX: number; clientY: number }): ComicPoint | null => {
    const r = body.current?.getBoundingClientRect();
    if (!r?.width || !r.height) return null;
    return { x: ((e.clientX - r.left) / r.width + (sx - 1) / 2) / sx, y: ((e.clientY - r.top) / r.height + (sy - 1) / 2) / sy };
  };
  const hasTail = BUBBLE_KIND_DEFAULTS[bubble.kind].tail && bubble.tail;
  const points = shaping ? bubble.outline?.points : undefined;

  const addPoint = (at: ComicPoint) => {
    const own = bubble.outline;
    if (!own || own.points.length >= BUBBLE_OUTLINE_POINTS.max) return;
    let best = { side: 0, t: 0.5, distance: Infinity };
    own.points.forEach((a, i) => {
      const near = nearestOnSide(a, own.points[(i + 1) % own.points.length]!, at);
      if (near.distance < best.distance) best = { side: i, ...near };
    });
    const next = [...own.points];
    next.splice(best.side + 1, 0, { x: clampPoint(at.x), y: clampPoint(at.y) });
    update({ outline: { ...own, points: next } });
  };

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <div
      ref={body}
      className={cx('comic-bubble', `comic-bubble--${bubble.kind}`, selected && 'is-selected', bubble.vertical && 'is-vertical', bubble.dark && 'is-dark', shaping && 'is-shaping', overflowing && 'is-overflowing')}
      style={style}
      data-testid="comic-bubble"
      // A click on a balloon keeps the balloon selected: the panel's own click would clear the balloon.
      onClick={stop}
      onDoubleClick={(e) => {
        e.stopPropagation();
        const at = outlinePoint(e);
        if (shaping && at) addPoint(at);
        else useComic.getState().openBubbleEditor(panelId, bubble.id);
      }}
      title={overflowing ? t('comic.bubble.overflow') : t(shaping ? 'comic.bubble.shapeHint' : 'comic.bubble.editHint')}
      onPointerDown={(e) => {
        e.stopPropagation();
        const store = useComic.getState();
        // Choosing another panel closes the balloon editor; a balloon of the same panel keeps it open on this balloon.
        if (store.selectedPanelId !== panelId) store.selectPanel(panelId);
        store.selectBubble(bubble.id);
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { pointer: e.pointerId, startX: e.clientX, startY: e.clientY, x: bubble.x, y: bubble.y };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        const box = frame.current?.getBoundingClientRect();
        if (!d || d.pointer !== e.pointerId || !box || !box.width || !box.height) return;
        const x = Math.min(1, Math.max(0, d.x + (e.clientX - d.startX) / box.width));
        const y = Math.min(1, Math.max(0, d.y + (e.clientY - d.startY) / box.height));
        update({ x, y });
      }}
      onPointerUp={(e) => {
        if (drag.current?.pointer === e.pointerId) drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <BalloonArt shape={shape} look={bubble} unit="0.1em" className="comic-bubble__shape" style={outline} />
      {selected && !shaping && <span className="comic-bubble__selection" style={outline} aria-hidden="true" data-testid="comic-bubble-selection" />}
      <span ref={words} className="comic-bubble__text">
        {bubble.kind === 'stamp' ? (
          stamp ? (
            // The picture is STAMP_HEIGHT_EM times the text's size tall, as the saved page draws it (see drawStamp).
            <img className="comic-bubble__stamp" src={stampUrl(stamp.id)} alt={stamp.text} draggable={false} style={{ height: `${STAMP_HEIGHT_EM}em`, aspectRatio: `${stamp.width} / ${stamp.height}` }} />
          ) : (
            t('comic.bubble.kind.stamp')
          )
        ) : (
          runs.map((run, i) => (
            <span key={i} className={cx(run.bold && 'is-bold', run.dots && 'is-dots')}>
              {run.text}
            </span>
          ))
        )}
      </span>
      {selected && hasTail && !shaping && (
        <span
          className="comic-bubble__handle"
          style={placeAt(bubble.tail!)}
          title={t('comic.bubble.tailHandle')}
          data-testid="comic-bubble-tail"
          onClick={stop}
          onPointerDown={(e) => {
            e.stopPropagation();
            tailDrag.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const at = outlinePoint(e);
            if (tailDrag.current !== e.pointerId || !at) return;
            update({ tail: { x: clampTail(at.x), y: clampTail(at.y) } });
          }}
          onPointerUp={(e) => {
            if (tailDrag.current === e.pointerId) tailDrag.current = null;
          }}
          onPointerCancel={() => {
            tailDrag.current = null;
          }}
        />
      )}
      {points?.map((p, i) => (
        <span
          key={i}
          className="comic-bubble__point"
          style={placeAt(p)}
          title={t('comic.bubble.pointHint')}
          data-testid="comic-bubble-point"
          onClick={stop}
          onDoubleClick={(e) => {
            e.stopPropagation();
            const own = bubble.outline;
            if (own && own.points.length > BUBBLE_OUTLINE_POINTS.min) update({ outline: { ...own, points: own.points.filter((_, k) => k !== i) } });
          }}
          onPointerDown={(e: ReactPointerEvent<HTMLSpanElement>) => {
            e.stopPropagation();
            pointDrag.current = { pointer: e.pointerId, index: i };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = pointDrag.current;
            const own = bubble.outline;
            const at = outlinePoint(e);
            if (!d || d.pointer !== e.pointerId || !own || !at) return;
            update({ outline: { ...own, points: own.points.map((q, k) => (k === d.index ? { x: clampPoint(at.x), y: clampPoint(at.y) } : q)) } });
          }}
          onPointerUp={(e) => {
            if (pointDrag.current?.pointer === e.pointerId) pointDrag.current = null;
          }}
          onPointerCancel={() => {
            pointDrag.current = null;
          }}
        />
      ))}
    </div>
  );
}
