// A small drawing of a page: its panels as grey shapes on white paper, with each panel's picture when it is given, over the
// page's backdrop when it has one (a panel with no picture lets it show through, as on the page). The page templates show
// their layout with it, the comic chooser shows each comic's first page, and the page strip under the page each page.
// Given the page, it draws its raster layers in their order: the panels at the panels slot (with the slot's opacity and
// blend), and the user's rasters between the slots composited small into one picture per run (by the Canvas's own drawing,
// with each layer's opacity and blend); a hidden layer is left out. Balloons are too small to show.
import { useEffect, useId, useState, type CSSProperties } from 'react';
import type { RasterEntity } from '@/state/canvas';
import { pagePixels, type ComicPage } from '@/state/comic/document';
import { PANELS_SLOT, pageRasters, withUrls, type PageCanvas } from '@/state/comic/pageCanvasDoc';
import type { Shape } from '@/state/comic/shapes';
import { compositeRect, hasContent } from '@/ui/canvasDraw/composite';

/** The width of the small picture of the user's layers, in pixels (its height follows the page). */
const THUMB_PIXELS = 192;

/** A shape's corners as the points of the drawing (its height is the page's aspect). */
const points = (shape: Shape, aspect: number) => shape.map((p) => `${p.x},${p.y * aspect}`).join(' ');

/** A layer's opacity and blend as the drawing's style (nothing for the plain ones). */
function lookOf(layer: RasterEntity): { opacity?: number; style?: CSSProperties } {
  return { ...(layer.opacity < 1 ? { opacity: layer.opacity } : {}), ...(layer.blend && layer.blend !== 'normal' ? { style: { mixBlendMode: layer.blend } } : {}) };
}

/** The page's shown rasters bottom first, the user's ones gathered into runs between the slots. */
type ThumbPart = { kind: 'slot'; layer: RasterEntity } | { kind: 'run'; layers: RasterEntity[] };

export function thumbParts(canvas: PageCanvas): ThumbPart[] {
  const parts: ThumbPart[] = [];
  for (const layer of pageRasters(canvas)) {
    if (!layer.isEnabled) continue;
    if (layer.slot) {
      parts.push({ kind: 'slot', layer });
      continue;
    }
    if (!hasContent(layer)) continue;
    const last = parts[parts.length - 1];
    if (last?.kind === 'run') last.layers.push(layer);
    else parts.push({ kind: 'run', layers: [layer] });
  }
  return parts;
}

/**
 * The small pictures of a page's runs of user rasters, by run, kept per list of entities (a page that did not change is not
 * drawn again). A data address, so nothing has to be let go when the list is forgotten.
 */
const drawn = new WeakMap<PageCanvas['entities'], Promise<(string | null)[]>>();

async function drawRuns(page: Pick<ComicPage, 'canvas' | 'size'>, urlOf: (imageName: string) => string | undefined): Promise<(string | null)[]> {
  const { width, height } = pagePixels(page);
  const out: (string | null)[] = [];
  for (const part of thumbParts(page.canvas)) {
    if (part.kind !== 'run') continue;
    try {
      const canvas = await compositeRect(withUrls(part.layers, urlOf), { x: 0, y: 0, width, height }, THUMB_PIXELS / width);
      out.push(canvas.toDataURL('image/png'));
    } catch {
      // No canvas here (or a picture that cannot be drawn): the run is left out of the small drawing.
      out.push(null);
    }
  }
  return out;
}

/** The small pictures of the page's runs, once drawn. */
function useRunPictures(page: Pick<ComicPage, 'canvas' | 'size'> | undefined, urlOf: ((imageName: string) => string | undefined) | undefined): (string | null)[] {
  const [pictures, setPictures] = useState<(string | null)[]>([]);
  const entities = page?.canvas.entities;
  useEffect(() => {
    if (!page || !entities || !thumbParts(page.canvas).some((p) => p.kind === 'run')) {
      setPictures([]);
      return;
    }
    let live = true;
    let job = drawn.get(entities);
    if (!job) {
      job = drawRuns(page, urlOf ?? (() => undefined));
      drawn.set(entities, job);
    }
    void job.then((urls) => {
      if (live) setPictures(urls);
    });
    return () => {
      live = false;
    };
    // The pictures follow the page's layers; a new lookup alone does not draw them again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, page?.size]);
  return pictures;
}

export function PageThumb({
  shapes,
  aspect,
  pictures,
  backdrop,
  className,
  page,
  urlOf,
}: {
  shapes: Shape[];
  aspect: number;
  pictures?: (string | undefined)[];
  backdrop?: string;
  className?: string;
  /** The page whose layers are drawn; without it the panels alone are drawn. */
  page?: Pick<ComicPage, 'canvas' | 'size'>;
  /** The address of a layer's picture by its gallery name. */
  urlOf?: (imageName: string) => string | undefined;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const runPictures = useRunPictures(page, urlOf);
  const panels = shapes.map((shape, i) => {
    const url = pictures?.[i];
    const xs = shape.map((p) => p.x);
    const ys = shape.map((p) => p.y * aspect);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return (
      <g key={i}>
        {!backdrop && <polygon className="comic-thumb__panel" points={points(shape, aspect)} />}
        {url && (
          <>
            <clipPath id={`${id}-${i}`}>
              <polygon points={points(shape, aspect)} />
            </clipPath>
            <image href={url} x={x} y={y} width={Math.max(...xs) - x} height={Math.max(...ys) - y} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-${i})`} />
          </>
        )}
        <polygon className="comic-thumb__frame" points={points(shape, aspect)} />
      </g>
    );
  });
  let run = 0;
  const layers = page
    ? thumbParts(page.canvas).map((part) => {
        if (part.kind === 'slot') {
          return part.layer.slot === PANELS_SLOT ? (
            <g key={part.layer.id} {...lookOf(part.layer)} data-thumb-layer="panels">
              {panels}
            </g>
          ) : null;
        }
        const url = runPictures[run++];
        return url ? <image key={part.layers[0]!.id} href={url} x={0} y={0} width={1} height={aspect} preserveAspectRatio="none" data-thumb-layer="raster" /> : null;
      })
    : panels;
  return (
    <svg className={className ?? 'comic-thumb'} viewBox={`0 0 1 ${aspect}`} aria-hidden="true" focusable="false">
      <rect className="comic-thumb__paper" x={0} y={0} width={1} height={aspect} />
      {backdrop && <image href={backdrop} x={0} y={0} width={1} height={aspect} preserveAspectRatio="xMidYMid slice" />}
      {layers}
    </svg>
  );
}
