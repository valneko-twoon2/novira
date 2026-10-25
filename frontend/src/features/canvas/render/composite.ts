// Which layers of the Canvas take part in a composite, and how much of the bbox the visible raster layers cover.
// The drawing itself is the shared ui/canvasDraw/composite.
import type { CanvasEntity, CanvasState, EntityType } from '@/state/canvas';
import { compositeRect } from '@/ui/canvasDraw/composite';
import { classifyCoverage, type Coverage } from '../geometry';

/** Entities of the given types that are currently visible, in render order. */
export function visibleEntities(s: Pick<CanvasState, 'entities' | 'groupHidden'>, types: EntityType[]): CanvasEntity[] {
  return s.entities.filter((e) => types.includes(e.type) && e.isEnabled && !s.groupHidden[e.type]);
}

/** How much of the bbox is covered by visible raster content (analysed at low resolution). */
export async function rasterCoverage(s: Pick<CanvasState, 'entities' | 'groupHidden' | 'bbox'>): Promise<Coverage> {
  const rasters = visibleEntities(s, ['raster']);
  if (!rasters.some((e) => e.objects.length)) return 'empty';
  const scale = Math.min(1, 128 / Math.max(s.bbox.width, s.bbox.height));
  const c = await compositeRect(rasters, s.bbox, scale);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  return classifyCoverage(ctx.getImageData(0, 0, c.width, c.height).data, 8);
}
