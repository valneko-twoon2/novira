// The page's raster layers on the screen, in their order (page.canvas, see pageCanvasDoc.ts): the panels and the balloons
// the editor draws at their slots, and the user's rasters drawn by the Canvas's own code where they sit on the page, each
// faded and blended as its layer says; a hidden layer is not drawn, and a locked slot takes no presses. While the page is
// painted on, the layer being painted is drawn by the paint stage instead (the `paint` element the shell gives).
import { useLayoutEffect, useMemo, useReducer, useRef, useEffect, type CSSProperties, type ReactNode } from 'react';
import type { RasterEntity } from '@/state/canvas';
import { pagePixels, type ComicPage } from '@/state/comic/document';
import { BALLOONS_SLOT, PANELS_SLOT, pageRasters, withUrls } from '@/state/comic/pageCanvasDoc';
import { cx } from '@/ui';
import { blendOperation, createCanvas, renderEntity } from '@/ui/canvasDraw/entityRender';
import { onImageLoaded } from '@/ui/canvasDraw/imageCache';

/** The look of a layer's box: its opacity and blend, left out when they are the plain ones. */
function layerStyle(layer: RasterEntity): CSSProperties | undefined {
  const blend = blendOperation(layer);
  if (layer.opacity >= 1 && blend === 'source-over') return undefined;
  return { ...(layer.opacity < 1 ? { opacity: layer.opacity } : {}), ...(blend !== 'source-over' ? { mixBlendMode: layer.blend } : {}) };
}

/** The layer being painted on and what shows it (the paint stage's canvas). */
export interface PaintedLayer {
  layerId: string;
  node: ReactNode;
}

/**
 * The layers of the page bottom first, each in a box of its own: `panels` and `balloons` are what the editor draws for the
 * slots; the user's rasters are drawn here, but for the one being painted, which `paint` shows.
 */
export function PageLayerStack({ page, urls, panels, balloons, paint }: { page: ComicPage; urls: Map<string, string>; panels: ReactNode; balloons: ReactNode; paint?: PaintedLayer | null }) {
  return (
    <>
      {pageRasters(page.canvas).map((layer) => {
        if (!layer.isEnabled) return null;
        const kind = layer.slot === PANELS_SLOT ? 'panels' : layer.slot === BALLOONS_SLOT ? 'balloons' : 'raster';
        const painted = kind === 'raster' && paint?.layerId === layer.id;
        return (
          <div
            key={layer.id}
            className={cx('comic-layer', `comic-layer--${kind}`, layer.isLocked && 'is-locked', painted && 'is-painted')}
            style={layerStyle(layer)}
            data-testid={`comic-layer-${kind}`}
            data-layer-id={layer.id}
          >
            {kind === 'panels' ? panels : kind === 'balloons' ? balloons : painted ? paint.node : <RasterView layer={layer} page={page} urls={urls} />}
          </div>
        );
      })}
    </>
  );
}

/**
 * A user's raster layer drawn once by the Canvas's code and placed over the part of the page it covers. The drawn canvas
 * itself is shown (it is the Canvas's cache of the layer, so nothing is drawn twice); a copy only when it is shown elsewhere.
 */
function RasterView({ layer, page, urls }: { layer: RasterEntity; page: ComicPage; urls: Map<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);
  // A picture that arrives later draws the layer again.
  const [loaded, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => onImageLoaded(bump), []);
  // Only the addresses of this layer's own pictures count: a lookup that changed for other pictures draws nothing again.
  const addresses = useMemo(() => layer.objects.flatMap((o) => (o.kind === 'image' && o.imageName ? [urls.get(o.imageName) ?? ''] : [])).join('|'), [layer, urls]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolved = useMemo(() => withUrls([layer], (name) => urls.get(name))[0]!, [layer, addresses]);
  const rendered = useMemo(() => {
    try {
      return renderEntity(resolved);
    } catch {
      // No canvas here: the layer is not shown.
      return null;
    }
    // `loaded` makes a picture that arrived draw again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, loaded]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!rendered) {
      el.replaceChildren();
      return;
    }
    let shown = rendered.canvas;
    if (shown.isConnected && shown.parentElement !== el) {
      shown = createCanvas(rendered.canvas.width, rendered.canvas.height);
      shown.getContext('2d')?.drawImage(rendered.canvas, 0, 0);
    }
    shown.classList.add('comic-layer__pixels');
    if (el.firstChild !== shown) el.replaceChildren(shown);
  }, [rendered]);
  if (!rendered) return null;
  const { width, height } = pagePixels(page);
  const share = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <div
      ref={ref}
      className="comic-layer__raster"
      aria-hidden="true"
      data-testid="comic-layer-canvas"
      style={{
        left: share(layer.x + rendered.x, width),
        top: share(layer.y + rendered.y, height),
        width: share(rendered.width, width),
        height: share(rendered.height, height),
      }}
    />
  );
}
