// The saved shape of canvas layers, shared by every document that holds them (the Canvas document, a comic page).
// Pictures inside layers are saved as hidden gallery images and referenced by name; stroke, rect and pose objects are
// JSON. Where a name is looked up (`findImage`) and how a live store learns a picture's new address (`onNamed`) are
// the caller's, so this module holds no store of its own.
import { backend, type ImageDTO } from '@/backend';
import { ENTITY_TYPES, POSE_JOINTS, RASTER_BLENDS, type CanvasEntity, type CanvasObject, type EntityType, type ImageObject, type RasterBlend, type Rect } from './canvas';
import { useGallery } from './gallery';

/** Looks a gallery picture up by name; `undefined` when it is gone. */
export type FindImage = (imageName: string) => { url: string } | undefined;

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const isRect = (v: unknown): v is Rect => isObject(v) && isNumber(v.x) && isNumber(v.y) && isNumber(v.width) && isNumber(v.height);

// Saving ---------------------------------------------------------------------------------------------------------

/** Pictures already stored for a page-only address (a `blob:` URL), so each is uploaded once. */
const stored = new Map<string, ImageDTO>();

/** Stores a page-only picture once as a hidden gallery image and returns it (the same one for the same address). */
export async function storeHiddenPicture(url: string): Promise<ImageDTO> {
  let image = stored.get(url);
  if (!image) {
    image = await backend.saveImageFromUrl(url, { boardId: null, isIntermediate: true, category: 'general' });
    useGallery.getState().addImage(image);
    stored.set(url, image);
  }
  return image;
}

/** Gives an image object a gallery name, storing the picture as a hidden image when it only lives in the page. */
async function nameImage(o: ImageObject): Promise<ImageObject> {
  if (o.imageName) return o;
  const image = await storeHiddenPicture(o.url);
  return { ...o, url: image.url, imageName: image.name };
}

/** `entities` with the unnamed image object of `named.id` replaced by `named` (the same array when none matches). */
export function withNamedImage(entities: CanvasEntity[], named: ImageObject): CanvasEntity[] {
  let changed = false;
  const out = entities.map((e) => {
    if (!e.objects.some((x) => x.id === named.id && x.kind === 'image' && x.imageName === null)) return e;
    changed = true;
    return { ...e, objects: e.objects.map((x) => (x.id === named.id ? named : x)) } as CanvasEntity;
  });
  return changed ? out : entities;
}

/**
 * The objects with every picture named. `onNamed` is told about each picture that got a name here, so the caller can
 * swap the address in its live document (the next save then has nothing to upload). A picture that cannot be stored is
 * left out; the caller's next save tries it again.
 */
export async function namedObjects(objects: CanvasObject[], onNamed: (named: ImageObject) => void): Promise<CanvasObject[]> {
  const out: CanvasObject[] = [];
  for (const o of objects) {
    if (o.kind !== 'image') {
      out.push(o);
      continue;
    }
    try {
      const named = await nameImage(o);
      if (named !== o) onNamed(named);
      out.push(named);
    } catch {
      // This picture could not be stored; the rest is still saved.
    }
  }
  return out;
}

/** An entity in its saved shape: pictures keep their name only, and page-only reference addresses are dropped. */
export function forSaving(e: CanvasEntity, objects: CanvasObject[] = e.objects): unknown {
  const kept = objects.map((o) => (o.kind === 'image' ? { ...o, url: '' } : o));
  if (e.type !== 'regional') return { ...e, objects: kept };
  return {
    ...e,
    objects: kept,
    refImages: e.refImages.map((r) => ({ ...r, imageUrl: r.imageName || r.imageUrl?.startsWith('blob:') ? null : r.imageUrl })),
  };
}

/** Entities in their saved shape, with every picture named (see `namedObjects`). */
export async function entitiesForSaving(entities: CanvasEntity[], onNamed: (named: ImageObject) => void): Promise<unknown[]> {
  const out: unknown[] = [];
  for (const e of entities) out.push(forSaving(e, await namedObjects(e.objects, onNamed)));
  return out;
}

// Restoring ------------------------------------------------------------------------------------------------------

function restoreObject(o: unknown, findImage: FindImage): CanvasObject | null {
  if (!isObject(o) || typeof o.id !== 'string') return null;
  if (o.kind === 'stroke') return Array.isArray(o.points) ? (o as unknown as CanvasObject) : null;
  if (o.kind === 'rect') return isNumber(o.x) && isNumber(o.y) && isNumber(o.width) && isNumber(o.height) ? (o as unknown as CanvasObject) : null;
  if (o.kind === 'pose') {
    const ok = Array.isArray(o.points) && o.points.length === POSE_JOINTS * 2 && o.points.every(isNumber) && Array.isArray(o.hidden) && o.hidden.every(isNumber) && isNumber(o.width);
    if (!ok) return null;
    // The depth is optional; a damaged one is dropped and the pose stays flat.
    const depthOk = Array.isArray(o.depth) && o.depth.length === POSE_JOINTS && o.depth.every(isNumber);
    const { depth: _depth, ...rest } = o;
    return (depthOk ? o : rest) as unknown as CanvasObject;
  }
  if (o.kind !== 'image' || typeof o.imageName !== 'string') return null;
  // A picture whose gallery image is gone is dropped.
  const image = findImage(o.imageName);
  return image ? ({ ...o, url: image.url } as unknown as CanvasObject) : null;
}

/** One saved entity made usable again, or `null` when it is not an entity at all. Damaged objects are dropped. */
export function restoreEntity(e: unknown, findImage: FindImage): CanvasEntity | null {
  if (!isObject(e) || typeof e.id !== 'string' || !ENTITY_TYPES.includes(e.type as EntityType) || !Array.isArray(e.objects)) return null;
  const objects = e.objects.map((o) => restoreObject(o, findImage)).filter((o): o is CanvasObject => o !== null);
  if (e.type === 'raster') {
    // An unknown blend is dropped, so the layer draws normally. A slot (named by a string) holds no objects.
    const { blend, slot, ...rest } = e;
    const isSlotLayer = typeof slot === 'string';
    return {
      ...rest,
      ...(RASTER_BLENDS.includes(blend as RasterBlend) ? { blend } : {}),
      ...(isSlotLayer ? { slot } : {}),
      objects: isSlotLayer ? [] : objects,
    } as unknown as CanvasEntity;
  }
  if (e.type !== 'regional') return { ...e, objects } as unknown as CanvasEntity;
  const refs: unknown[] = Array.isArray(e.refImages) ? e.refImages : [];
  const refImages = refs.filter(isObject).map((r) => {
    const image = typeof r.imageName === 'string' ? findImage(r.imageName) : undefined;
    return image ? { ...r, imageUrl: image.url } : { ...r, imageName: null };
  });
  return { ...e, objects, refImages } as unknown as CanvasEntity;
}

/** The usable entities of a saved list. */
export function restoreEntities(list: unknown[], findImage: FindImage): CanvasEntity[] {
  return list.map((e) => restoreEntity(e, findImage)).filter((e): e is CanvasEntity => e !== null);
}
