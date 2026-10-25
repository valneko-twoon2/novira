// Filters that change a raster layer's pixels (blur, grayscale, invert), drawn with the 2D context's own filter on an
// offscreen canvas. A blur reaches past the layer's edge, so the output is larger by `filterMargin`.
import { createCanvas } from '@/ui/canvasDraw/entityRender';

export type RasterFilter = { kind: 'blur'; radius: number } | { kind: 'grayscale' } | { kind: 'invert' };

export type RasterFilterKind = RasterFilter['kind'];

export const RASTER_FILTER_KINDS: readonly RasterFilterKind[] = ['blur', 'grayscale', 'invert'];

/** The blur radii the screen offers are kept between these (pixels). */
export const MIN_BLUR_RADIUS = 1;
export const MAX_BLUR_RADIUS = 100;

export const clampBlurRadius = (v: number): number => Math.max(MIN_BLUR_RADIUS, Math.min(MAX_BLUR_RADIUS, Math.round(v)));

/** How much larger than the layer the output is on every side: a blur spreads about three times its radius. */
export const filterMargin = (f: RasterFilter): number => (f.kind === 'blur' ? Math.ceil(clampBlurRadius(f.radius) * 3) : 0);

/** The CSS filter a context applies for it. */
export function cssFilter(f: RasterFilter): string {
  if (f.kind === 'blur') return `blur(${clampBlurRadius(f.radius)}px)`;
  return f.kind === 'grayscale' ? 'grayscale(1)' : 'invert(1)';
}

/** The picture with the filter applied, in a canvas larger by the margin on every side (transparent stays see-through). */
export function filterCanvas(source: HTMLCanvasElement, f: RasterFilter): HTMLCanvasElement {
  const margin = filterMargin(f);
  const out = createCanvas(source.width + margin * 2, source.height + margin * 2);
  const ctx = out.getContext('2d') as CanvasRenderingContext2D;
  ctx.filter = cssFilter(f);
  ctx.drawImage(source, margin, margin);
  ctx.filter = 'none';
  return out;
}
