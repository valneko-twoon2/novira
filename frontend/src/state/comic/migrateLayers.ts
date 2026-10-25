// Turns the layers of a version 1 comic page (layersV1.ts) into the Canvas layers of version 2
// (pageCanvasDoc.ts), so a project saved before keeps everything it showed:
// - the built-in panels and balloons become the page's two slots;
// - a drawing becomes a raster layer of brush strokes (an eraser stroke becomes an eraser stroke of the same layer, so it
//   still takes away only its own layer's lines), its points and width from shares of the page to page pixels;
// - a picture becomes a raster layer holding the picture as an image object where the page showed it (the box of
//   imageView.ts's pictureBox against the whole page), mirrored as it was. A turned picture cannot be an image object (they
//   do not turn): it is placed unturned for now and noted, and bakeRotation.ts draws it turned into a new hidden picture.
// Every layer keeps its name, visibility, lock, opacity and blend. The ids are derived from the old ones, so reading the
// same version 1 document twice gives the same layers.
import type { CanvasEntity, CanvasObject, RasterEntity, RGBA } from '../canvas';
import { pagePixels, type PageSize } from './document';
import { pictureBox, type Size } from './imageView';
import { parseLayers, type ComicLayer } from './layersV1';
import { defaultBbox, parsePageCanvas, roundCoordinate, type PageCanvas } from './pageCanvasDoc';

/** The size of a gallery picture by its name; undefined when it is not in the gallery. */
export type ImageSizeOf = (imageName: string) => Size | undefined;

/** A picture of a version 1 layer that was turned: where it sits on the page (page pixels) and how it is turned and mirrored. */
export interface RotationBake {
  pageId: string;
  entityId: string;
  objectId: string;
  imageName: string;
  /** The picture's centre and its unturned size, in page pixels. */
  cx: number;
  cy: number;
  width: number;
  height: number;
  /** Clockwise, in degrees (never 0). */
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}

/** "#rrggbb" as an opaque Canvas colour. */
export function hexToRgba(hex: string): RGBA {
  const n = /^#[0-9a-f]{6}$/i.test(hex) ? parseInt(hex.slice(1), 16) : 0;
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff, a: 1 };
}

/** The objects of one version 1 layer in page pixels, and its turned picture to bake (if any). */
function layerObjects(layer: ComicLayer, page: Size, sizeOf: ImageSizeOf): { objects: CanvasObject[]; bake: Omit<RotationBake, 'pageId'> | null } {
  if (layer.kind === 'drawing') {
    const objects = layer.strokes.map(
      (s, i): CanvasObject => ({
        kind: 'stroke',
        id: `${layer.id}-stroke-${i}`,
        tool: s.erase ? 'eraser' : 'brush',
        color: hexToRgba(s.color),
        width: roundCoordinate(s.width * page.width),
        points: s.points.map((v, k) => roundCoordinate(v * (k % 2 === 0 ? page.width : page.height))),
        clip: null,
      }),
    );
    return { objects, bake: null };
  }
  if (layer.kind !== 'image' || !layer.imageName) return { objects: [], bake: null };
  const picture = sizeOf(layer.imageName);
  // A picture no longer in the gallery was not drawn in version 1 either; its layer stays, empty.
  if (!picture || !(picture.width > 0) || !(picture.height > 0)) return { objects: [], bake: null };
  const { view } = layer;
  const box = pictureBox(view, picture, page);
  const id = `${layer.id}-image`;
  const object: CanvasObject = {
    kind: 'image',
    id,
    url: '',
    imageName: layer.imageName,
    x: box.cx - box.width / 2,
    y: box.cy - box.height / 2,
    width: box.width,
    height: box.height,
    ...(view.flipX ? { flipX: true } : {}),
    ...(view.flipY ? { flipY: true } : {}),
  };
  const bake =
    view.rotation === 0
      ? null
      : { entityId: layer.id, objectId: id, imageName: layer.imageName, cx: box.cx, cy: box.cy, width: box.width, height: box.height, rotation: view.rotation, flipX: view.flipX, flipY: view.flipY };
  return { objects: [object], bake };
}

/**
 * The version 2 layers of a version 1 page (its saved `layers`, read as version 1 read them), and the turned pictures left
 * to bake. Version 1's limits (32 layers, 2000 strokes a layer, 60000 points a page) lie within version 2's, so nothing is
 * cut; the result is read through `parsePageCanvas`, which rounds every coordinate to 0.1 px.
 */
export function migrateLayers(raw: unknown, size: PageSize, sizeOf: ImageSizeOf): { canvas: PageCanvas; bakes: Omit<RotationBake, 'pageId'>[] } {
  const page = pagePixels({ size });
  const bakes: Omit<RotationBake, 'pageId'>[] = [];
  const entities: CanvasEntity[] = parseLayers(raw).map((layer, i): RasterEntity => {
    const look: RasterEntity = {
      id: layer.id,
      type: 'raster',
      seq: i + 1,
      name: layer.name || null,
      isEnabled: layer.visible,
      isLocked: layer.locked,
      opacity: layer.opacity,
      x: 0,
      y: 0,
      objects: [],
      ...(layer.blend !== 'normal' ? { blend: layer.blend } : {}),
    };
    if (layer.kind === 'panels' || layer.kind === 'balloons') return { ...look, slot: layer.kind };
    const { objects, bake } = layerObjects(layer, page, sizeOf);
    if (bake) bakes.push(bake);
    return { ...look, objects };
  });
  return { canvas: parsePageCanvas({ entities, bbox: defaultBbox(size) }, size), bakes };
}
