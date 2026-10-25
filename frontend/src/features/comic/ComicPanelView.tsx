// One panel on the page: its picture (or its pose, or an empty frame) and its balloons and captions. A picture dropped on
// the panel becomes its picture (while the backdrop is selected, it replaces the backdrop instead). A press anywhere on the
// panel carries it about the page (see useCarry). The picture is moved with Alt held, or once it is selected (a double
// click selects it; its handles are drawn over the page, see PictureHandles); it may be shrunk, turned and moved partly out
// of the panel. The balloons are drawn by ComicBalloon.
import { useRef, type CSSProperties, type RefObject } from 'react';
import { t } from '@/i18n';
import type { ComicImageView, ComicPanel, ComicPoint } from '@/state/comic/document';
import type { FrameStrokes } from '@/state/comic/frames';
import { moveImage, placePicture } from '@/state/comic/imageView';
import type { Box } from '@/state/comic/layout';
import { putBackdropFile, putBackdropGalleryImage } from '@/state/comic/backdropImage';
import { putFileImage, putGalleryImage, reportImageFailure } from '@/state/comic/panelImage';
import { useComic } from '@/state/comic/store';
import { toast } from '@/state/toasts';
import { cx, ImageDropZone } from '@/ui';
import { ComicBalloon } from './ComicBalloon';
import { useCarry } from './useCarry';
import { useImageSize } from './useImageSize';

interface Props {
  pageId: string;
  panel: ComicPanel;
  number: number;
  box: Box;
  /** The page's height over its width. */
  aspect: number;
  /** The panel's edge on the page, shaped or automatic: the frame is drawn along it. */
  outline: ComicPoint[];
  /** The strokes of the frame (the page's frame line and inset). */
  strokes: FrameStrokes;
  /** The colour of the frame line. */
  frameColor: string;
  /** The panel's corners on a reshaped page (fractions of the page), or null for its rectangle. */
  shape: ComicPoint[] | null;
  selected: boolean;
  /** The picture's address, when the panel has a picture that can be shown. */
  imageUrl?: string;
  poseUrl?: string;
  drawing: boolean;
  /** The panel's last picture job failed (until it is drawn again). */
  failed?: boolean;
  selectedBubbleId: string | null;
  /** The page's backdrop is selected: a picture dropped on the panel replaces the backdrop. */
  backdropSelected?: boolean;
  /** The panel's balloons are drawn here; false when the balloons layer draws them (see PanelBalloons). */
  showBalloons?: boolean;
}

/** A reshaped panel's corners as a CSS polygon, in percentages of its box (the box is the panel's own rectangle). */
function clipOf(shape: ComicPoint[], box: Box): string {
  const at = (p: ComicPoint) => `${((p.x - box.x) / box.width) * 100}% ${((p.y - box.y) / box.height) * 100}%`;
  return `polygon(${shape.map(at).join(', ')})`;
}

export function ComicPanelView({ pageId, panel, number, box, aspect, outline, strokes, frameColor, shape, selected, imageUrl, poseUrl, drawing, failed, selectedBubbleId, backdropSelected, showBalloons = true }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const select = () => useComic.getState().selectPanel(panel.id);
  const style: CSSProperties = { left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` };
  // A reshaped panel is cut to its corners; its frame and gutter are drawn on the page's overlay (see ComicEditor).
  const clip: CSSProperties | undefined = shape ? { clipPath: clipOf(shape, box) } : undefined;
  // A press anywhere on the panel carries it about the page (the corners and edges, which reshape it, are separate).
  const carry = useCarry(pageId, number - 1);
  return (
    <ImageDropZone
      className="comic-panel-drop"
      style={style}
      label={t('comic.panel.dropHere')}
      // With Alt held, or while the backdrop is selected, the picture goes to the page's backdrop instead of this panel.
      onImages={(names, { alt }) => {
        const done = alt || backdropSelected ? putBackdropGalleryImage(pageId, names) : putGalleryImage(panel.id, names);
        if (!done) toast({ status: 'error', title: t('comic.panel.imageFailed') });
      }}
      onFiles={(files, { alt }) => {
        const file = files[0];
        if (file) void (alt || backdropSelected ? putBackdropFile(pageId, file) : putFileImage(panel.id, file)).catch(reportImageFailure);
      }}
    >
      <div
        ref={frame}
        role="group"
        className={cx('comic-panel', shape && 'is-shaped', selected && 'is-selected', selected && selectedBubbleId && 'has-selected-bubble')}
        style={clip}
        aria-label={t('comic.panel.number', { number })}
        aria-current={selected || undefined}
        data-testid={`comic-panel-${number}`}
        data-comic-panel-index={number - 1}
        onClick={select}
        {...carry}
      >
        {imageUrl ? (
          <PanelPicture url={imageUrl} panelId={panel.id} view={panel.imageView} box={box} aspect={aspect} frame={frame} />
        ) : poseUrl ? (
          <img className="comic-panel__image comic-panel__image--pose" src={poseUrl} alt="" draggable={false} />
        ) : (
          // Before the picture, the panel shows what is to happen in it: the stage direction, else the prompt.
          <span className={cx('comic-panel__empty', panel.note.trim() && 'is-note')}>{panel.note.trim() || panel.prompt.trim() || t('comic.panel.empty')}</span>
        )}
        <PanelFrame outline={outline} strokes={strokes} color={frameColor} box={box} aspect={aspect} />
        {drawing && <span className="comic-panel__drawing">{t('comic.panel.drawing')}</span>}
        {!drawing && failed && <span className="comic-panel__drawing is-failed">{t('comic.draw.failed')}</span>}
        {showBalloons &&
          panel.bubbles.map((bubble) => (
            <ComicBalloon key={bubble.id} bubble={bubble} panelId={panel.id} frame={frame} selected={bubble.id === selectedBubbleId} />
          ))}
      </div>
    </ImageDropZone>
  );
}

/**
 * A panel's balloons on the balloons layer: a box of the panel's place and shape (cut to it, as the panel cuts them) that
 * takes no presses itself, so the panel under it is still carried; the balloons in it are pressed, dragged and edited.
 */
export function PanelBalloons({ panel, number, box, shape, selectedBubbleId }: Pick<Props, 'panel' | 'number' | 'box' | 'shape' | 'selectedBubbleId'>) {
  // The box is there even with no balloon, so a balloon just added finds it to be centred in (see ComicBalloon).
  const frame = useRef<HTMLDivElement>(null);
  const style: CSSProperties = { left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` };
  return (
    <div className="comic-balloons" style={style} data-testid={`comic-panel-balloons-${number}`}>
      <div ref={frame} className="comic-balloons__frame" style={shape ? { clipPath: clipOf(shape, box) } : undefined}>
        {panel.bubbles.map((bubble) => (
          <ComicBalloon key={bubble.id} bubble={bubble} panelId={panel.id} frame={frame} selected={bubble.id === selectedBubbleId} />
        ))}
      </div>
    </div>
  );
}

/**
 * The panel's frame: three rings along the panel's edge, over its picture and under its balloons. Each is a stroke centred on
 * the edge (so only its inner half is inside the panel): the white band between the frame line and the picture, the black
 * line, and the white gutter. The drawing is in page units, cropped to the panel's box.
 */
function PanelFrame({ outline, strokes, color, box, aspect }: { outline: ComicPoint[]; strokes: FrameStrokes; color: string; box: Box; aspect: number }) {
  const points = outline.map((p) => `${p.x},${p.y * aspect}`).join(' ');
  return (
    <svg
      className="comic-panel__frame"
      viewBox={`${box.x} ${box.y * aspect} ${box.width} ${box.height * aspect}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <polygon points={points} className="comic-panel__ring is-deep" style={{ strokeWidth: strokes.deep }} />
      <polygon points={points} className="comic-panel__ring is-line" style={{ strokeWidth: strokes.line, stroke: color }} />
      <polygon points={points} className="comic-panel__ring is-gutter" style={{ strokeWidth: strokes.gutter }} />
    </svg>
  );
}

/** The page's backdrop: its picture under the panels, placed against the whole page as a panel's picture is against its panel. */
export function BackdropPicture({ url, view, aspect }: { url: string; view: ComicImageView; aspect: number }) {
  const shown = placePicture(view, useImageSize(url), { x: 0, y: 0, width: 1, height: 1 }, aspect).panel;
  return (
    <img
      className="comic-backdrop-picture"
      src={url}
      alt=""
      draggable={false}
      data-testid="comic-backdrop-picture"
      style={{
        left: `${shown.cx * 100}%`,
        top: `${shown.cy * 100}%`,
        width: `${shown.width * 100}%`,
        height: `${shown.height * 100}%`,
        transform: `translate(-50%, -50%) rotate(${view.rotation}deg) scale(${view.flipX ? -1 : 1}, ${view.flipY ? -1 : 1})`,
      }}
    />
  );
}

/**
 * The panel's picture, placed, sized, turned and mirrored as its view says. A press on it carries the panel, unless Alt is
 * held or the picture is the one selected: then it selects the picture and dragging moves it. The part outside the panel is
 * cut off, as the saved page cuts it.
 */
function PanelPicture({
  url,
  panelId,
  view,
  box,
  aspect,
  frame,
}: {
  url: string;
  panelId: string;
  view: ComicImageView;
  box: Box;
  aspect: number;
  frame: RefObject<HTMLDivElement | null>;
}) {
  const drag = useRef<{ pointer: number; startX: number; startY: number; start: ComicImageView } | null>(null);
  const picked = useComic((s) => s.imageSelected && s.selectedPanelId === panelId);
  const shown = placePicture(view, useImageSize(url), box, aspect).panel;
  const style: CSSProperties = {
    left: `${shown.cx * 100}%`,
    top: `${shown.cy * 100}%`,
    width: `${shown.width * 100}%`,
    height: `${shown.height * 100}%`,
    transform: `translate(-50%, -50%) rotate(${view.rotation}deg) scale(${view.flipX ? -1 : 1}, ${view.flipY ? -1 : 1})`,
  };
  return (
    <img
      className="comic-panel__image comic-panel__picture"
      src={url}
      alt=""
      draggable={false}
      style={style}
      data-testid="comic-panel-image"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        useComic.getState().selectImage(panelId);
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        // The panel's own press (carrying it) takes this one, unless the picture is selected or Alt is held.
        if (!picked && !e.altKey) return;
        e.stopPropagation();
        useComic.getState().selectImage(panelId);
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { pointer: e.pointerId, startX: e.clientX, startY: e.clientY, start: view };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        const rect = frame.current?.getBoundingClientRect();
        if (!d || d.pointer !== e.pointerId || !rect) return;
        useComic.getState().setPanelImageView(panelId, moveImage(d.start, e.clientX - d.startX, e.clientY - d.startY, rect));
      }}
      onPointerUp={(e) => {
        if (drag.current?.pointer === e.pointerId) drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    />
  );
}
