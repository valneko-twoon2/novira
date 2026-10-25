// "Save Canvas as PSD": the canvas as a layered Photoshop file. The document is the bounding box, the part "Save Canvas to
// Gallery" saves, and its flattened picture is that same picture: the visible raster layers.
//
// Which layers go in, bottom first, in the stage's order:
// - every raster layer, with its name, place, opacity, blend and visibility (a layer switched off, or in a hidden group, is
//   hidden in the file too);
// - every control layer, hidden: it is a guide for generating (a pose, edges, depth), not part of the picture, but is kept
//   so it can be shown and traced over in another program;
// - inpaint masks and regional guidance are left out: they are areas for the generator, and their tinted overlay means
//   nothing as a picture.
// A layer is cut to the bounding box (what lies outside it is not part of the saved picture) and to its drawn pixels; a
// layer with nothing inside the box is left out.
import type { CanvasEntity, CanvasState, EntityType } from '@/state/canvas';
import { croppedLayer, type PsdBlend, type PsdDocument, type PsdLayer } from '@/state/psd';
import { displayName } from '../names';
import { compositeRect } from '@/ui/canvasDraw/composite';
import { visibleEntities } from './composite';

/** One layer of the canvas's file, before it is drawn. */
export interface CanvasPsdLayer {
  entity: CanvasEntity;
  name: string;
  opacity: number;
  /** Normal for every layer but a raster layer with another blend. */
  blend: PsdBlend;
  hidden: boolean;
}

/** The layer types that go into the file, bottom first, and whether they are shown there (see the top of this file). */
const PSD_TYPES: { type: EntityType; shown: boolean }[] = [
  { type: 'raster', shown: true },
  { type: 'control', shown: false },
];

/** The canvas's layers as the file's layers, bottom first (see the top of this file). */
export function canvasPsdLayers(s: Pick<CanvasState, 'entities' | 'groupHidden'>): CanvasPsdLayer[] {
  return PSD_TYPES.flatMap(({ type, shown }) =>
    s.entities
      .filter((e) => e.type === type)
      .map((entity) => ({
        entity,
        name: displayName(entity),
        opacity: entity.opacity,
        blend: (entity.type === 'raster' && entity.blend) || 'normal',
        hidden: !shown || !entity.isEnabled || s.groupHidden[type],
      })),
  );
}

function pixelsOf(canvas: HTMLCanvasElement): Uint8ClampedArray {
  return (canvas.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, canvas.width, canvas.height).data;
}

/** The canvas's file as layers and its flattened picture. */
export async function buildCanvasPsd(s: Pick<CanvasState, 'entities' | 'groupHidden' | 'bbox'>): Promise<PsdDocument> {
  const flat = await compositeRect(visibleEntities(s, ['raster']), s.bbox);
  const { width, height } = flat;
  const layers: PsdLayer[] = [];
  for (const { entity, name, opacity, blend, hidden } of canvasPsdLayers(s)) {
    // Drawn at full strength and normal: the layer's opacity and blend are the file's to apply.
    const alone: CanvasEntity = entity.type === 'raster' ? { ...entity, opacity: 1, blend: 'normal' } : { ...entity, opacity: 1 };
    const drawn = await compositeRect([alone], s.bbox);
    const layer = croppedLayer(name, pixelsOf(drawn), width, height, { opacity, hidden, ...(blend === 'normal' ? {} : { blend }) });
    if (layer) layers.push(layer);
  }
  return { width, height, layers, composite: pixelsOf(flat) };
}
