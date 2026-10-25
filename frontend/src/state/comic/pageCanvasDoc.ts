// A comic page's layers as Canvas layers: `page.canvas` holds Canvas entities in the saved shape of the Canvas
// document (a picture by its gallery name only) and the bounding box generation uses. Document space is the drawn page's
// pixels, one to one (`pagePixels`). The panels and the balloons are slot rasters the comic draws itself; every page has one
// of each. Reading a page checks every field and keeps it within limits, so a damaged or oversized document loses only its
// damaged parts. The functions here are pure: they read and return documents, and never touch a store.
//
// Only types come from the canvas store module: it builds a store when it loads, and this module is loaded by the comic
// document, which the settings read early.
import type { CanvasEntity, CanvasObject, InpaintEntity, MaskFill, RasterBlend, RasterEntity, Rect, RegionalEntity, RGBA, StrokeObject } from '../canvas';
import { pagePixels, type PageSize } from './document';

export interface PageCanvas {
  /** Canvas entities, bottom first within each group (rasters, then masks), in page pixels. */
  entities: CanvasEntity[];
  /** The generation box, in page pixels (multiples of 8, at least 64). */
  bbox: Rect;
}

/** The slots of a comic page: the panels with their frames and pictures, and every panel's balloons. */
export const PANELS_SLOT = 'panels';
export const BALLOONS_SLOT = 'balloons';
const PAGE_SLOTS = [PANELS_SLOT, BALLOONS_SLOT] as const;
export type PageSlot = (typeof PAGE_SLOTS)[number];

/** The most raster layers a page holds (its two slots included), the most masks, and the most objects of one layer. */
export const MAX_RASTERS_PER_PAGE = 32;
export const MAX_MASKS_PER_PAGE = 8;
export const MAX_OBJECTS_PER_LAYER = 5000;
/** The most coordinate numbers all objects of a page hold (a stroke's points, a rectangle's or a picture's four numbers). */
export const MAX_COORDINATES_PER_PAGE = 300_000;
/** How far from the page a coordinate may lie, in pixels either way. */
const COORDINATE_LIMIT = 100_000;
const ID_MAX = 128;
const NAME_MAX = 64;
const IMAGE_NAME_MAX = 256;
const PROMPT_MAX = 2000;
const STROKE_WIDTH_MAX = 2000;
const REF_IMAGES_MAX = 4;

const BLENDS: readonly RasterBlend[] = ['normal', 'multiply', 'screen'];
const MASK_FILL_LIST: readonly MaskFill[] = ['solid', 'diagonal', 'crosshatch', 'grid', 'horizontal', 'vertical'];
const STROKE_TOOLS: readonly StrokeObject['tool'][] = ['brush', 'eraser', 'mosaic'];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const between = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** A coordinate as a page keeps it: within reach of the page and rounded to a tenth of a pixel. */
export const roundCoordinate = (v: number) => Math.round(between(v, -COORDINATE_LIMIT, COORDINATE_LIMIT) * 10) / 10 || 0;
/** A box side as the Canvas keeps it: a multiple of 8, at least 64, rounded down so a whole-page box stays on the page. */
const boxSide = (v: number) => Math.max(64, Math.floor(v / 8) * 8);

/** The generation box a page starts with: the whole page. */
export function defaultBbox(size: PageSize): Rect {
  const { width, height } = pagePixels({ size });
  return { x: 0, y: 0, width: boxSide(width), height: boxSide(height) };
}

/** A slot layer: no objects, at the page's corner, named by the host. */
function slotEntity(slot: PageSlot, seq: number): RasterEntity {
  return { id: slot, type: 'raster', seq, name: null, isEnabled: true, isLocked: false, opacity: 1, x: 0, y: 0, objects: [], slot };
}

/** The layers of a new page: the panels, with the balloons over them, and the whole page as the box. */
export function defaultPageCanvas(size: PageSize): PageCanvas {
  return { entities: [slotEntity(PANELS_SLOT, 1), slotEntity(BALLOONS_SLOT, 2)], bbox: defaultBbox(size) };
}

/** Whether a layer is one of the page's slots. */
const isPageSlot = (e: CanvasEntity): e is RasterEntity & { slot: PageSlot } => e.type === 'raster' && PAGE_SLOTS.includes(e.slot as PageSlot);

/** The page's raster layers, bottom first (its slots among them). */
export const pageRasters = (doc: PageCanvas): RasterEntity[] => doc.entities.filter((e): e is RasterEntity => e.type === 'raster');

/** The page's slot of this kind (a page read through `parsePageCanvas` always has one). */
export const slotOf = (doc: PageCanvas, slot: PageSlot): RasterEntity | undefined => doc.entities.find((e): e is RasterEntity => e.type === 'raster' && e.slot === slot);

// Reading ---------------------------------------------------------------------------------------------------------

function cleanRgba(v: unknown): RGBA | null {
  if (!isObject(v) || !isNumber(v.r) || !isNumber(v.g) || !isNumber(v.b)) return null;
  const channel = (n: number) => Math.round(between(n, 0, 255));
  return { r: channel(v.r), g: channel(v.g), b: channel(v.b), a: isNumber(v.a) ? Math.round(between(v.a, 0, 1) * 1000) / 1000 : 1 };
}

function cleanRect(v: unknown): Rect | null {
  if (!isObject(v) || !isNumber(v.x) || !isNumber(v.y) || !isNumber(v.width) || !isNumber(v.height)) return null;
  return { x: roundCoordinate(v.x), y: roundCoordinate(v.y), width: roundCoordinate(v.width), height: roundCoordinate(v.height) };
}

const cleanId = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 && v.length <= ID_MAX ? v : null);

/** A name as a layer keeps it: one line, trimmed, not too long; null for none. */
export function cleanLayerName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const oneLine = [...v].map((c) => (c < ' ' || c === '\u007f' ? ' ' : c)).join('');
  const name = [...oneLine.trim()].slice(0, NAME_MAX).join('').trim();
  return name || null;
}

/** How many coordinate numbers an object holds (what MAX_COORDINATES_PER_PAGE counts). */
export function objectCoordinates(o: CanvasObject): number {
  if (o.kind === 'stroke') return o.points.length + (o.clip ? 4 : 0);
  if (o.kind === 'pose') return o.points.length;
  return 4;
}

/** One saved object with every field checked, or null when it is damaged or of a kind a comic page does not hold. */
function cleanObject(v: unknown): CanvasObject | null {
  if (!isObject(v)) return null;
  const id = cleanId(v.id);
  if (!id) return null;
  switch (v.kind) {
    case 'stroke': {
      const tool = STROKE_TOOLS.find((t) => t === v.tool);
      const color = cleanRgba(v.color);
      if (!tool || !color || !isNumber(v.width) || v.width <= 0 || !Array.isArray(v.points)) return null;
      const points = v.points;
      if (points.length < 2 || points.length % 2 !== 0 || !points.every(isNumber)) return null;
      const clip = v.clip === null || v.clip === undefined ? null : cleanRect(v.clip);
      if (v.clip !== null && v.clip !== undefined && !clip) return null;
      return {
        kind: 'stroke',
        id,
        tool,
        color,
        width: roundCoordinate(Math.min(STROKE_WIDTH_MAX, v.width)) || 0.1,
        points: points.map(roundCoordinate),
        clip,
        ...(tool === 'mosaic' && isNumber(v.block) ? { block: Math.round(between(v.block, 2, 128)) } : {}),
      };
    }
    case 'rect': {
      const color = cleanRgba(v.color);
      const rect = cleanRect(v);
      return color && rect ? { kind: 'rect', id, ...rect, color } : null;
    }
    case 'image': {
      const rect = cleanRect(v);
      const imageName = typeof v.imageName === 'string' && v.imageName && v.imageName.length <= IMAGE_NAME_MAX ? v.imageName : null;
      if (!rect || !imageName || rect.width <= 0 || rect.height <= 0) return null;
      return { kind: 'image', id, url: '', imageName, ...rect, ...(v.flipX === true ? { flipX: true } : {}), ...(v.flipY === true ? { flipY: true } : {}) };
    }
    default:
      return null;
  }
}

/** The objects of a layer: damaged ones dropped, at most MAX_OBJECTS_PER_LAYER, and no more coordinates than `room.left`. */
function cleanObjects(v: unknown, room: { left: number }): CanvasObject[] {
  const out: CanvasObject[] = [];
  const ids = new Set<string>();
  for (const raw of Array.isArray(v) ? v : []) {
    if (out.length >= MAX_OBJECTS_PER_LAYER) break;
    const o = cleanObject(raw);
    if (!o || ids.has(o.id)) continue;
    const cost = objectCoordinates(o);
    if (cost > room.left) continue;
    room.left -= cost;
    ids.add(o.id);
    out.push(o);
  }
  return out;
}

const fraction = (v: unknown, fallback: number) => (isNumber(v) ? Math.round(between(v, 0, 1) * 1000) / 1000 : fallback);
const optionalText = (v: unknown): string | null => (typeof v === 'string' ? v.slice(0, PROMPT_MAX) : null);

/** One saved entity with every field checked, or null when it is damaged or of a kind a comic page does not hold. */
function cleanEntity(v: unknown, room: { left: number }): CanvasEntity | null {
  if (!isObject(v)) return null;
  const id = cleanId(v.id);
  if (!id) return null;
  const base = {
    id,
    seq: isNumber(v.seq) && v.seq >= 1 ? Math.min(9999, Math.floor(v.seq)) : 1,
    name: cleanLayerName(v.name),
    isEnabled: v.isEnabled !== false,
    isLocked: v.isLocked === true,
    opacity: fraction(v.opacity, 1),
    x: isNumber(v.x) ? roundCoordinate(v.x) : 0,
    y: isNumber(v.y) ? roundCoordinate(v.y) : 0,
  };
  switch (v.type) {
    case 'raster': {
      const blend = BLENDS.find((b) => b === v.blend);
      const look = blend && blend !== 'normal' ? { blend } : {};
      if (v.slot !== undefined) {
        // A slot of a kind this page does not have is not a layer of it.
        const slot = PAGE_SLOTS.find((s) => s === v.slot);
        return slot ? { ...base, type: 'raster', ...look, x: 0, y: 0, objects: [], slot } : null;
      }
      return { ...base, type: 'raster', ...look, objects: cleanObjects(v.objects, room) };
    }
    case 'inpaint': {
      const color = cleanRgba(v.color);
      const fill = MASK_FILL_LIST.find((f) => f === v.fill);
      if (!color || !fill) return null;
      const mask: InpaintEntity = {
        ...base,
        type: 'inpaint',
        objects: cleanObjects(v.objects, room),
        color,
        fill,
        denoiseLimit: isNumber(v.denoiseLimit) ? fraction(v.denoiseLimit, 1) : null,
        noiseLevel: isNumber(v.noiseLevel) ? fraction(v.noiseLevel, 0) : null,
      };
      return mask;
    }
    case 'regional': {
      const color = cleanRgba(v.color);
      const fill = MASK_FILL_LIST.find((f) => f === v.fill);
      if (!color || !fill) return null;
      const refImages = (Array.isArray(v.refImages) ? v.refImages : []).flatMap((r): RegionalEntity['refImages'] => {
        const refId = isObject(r) ? cleanId(r.id) : null;
        if (!isObject(r) || !refId || typeof r.method !== 'string') return [];
        const imageName = typeof r.imageName === 'string' && r.imageName && r.imageName.length <= IMAGE_NAME_MAX ? r.imageName : null;
        const modelKey = typeof r.modelKey === 'string' && r.modelKey.length <= IMAGE_NAME_MAX ? r.modelKey : null;
        return [{ id: refId, imageName, imageUrl: null, modelKey, weight: isNumber(r.weight) ? between(r.weight, -1, 2) : 1, method: r.method as RegionalEntity['refImages'][number]['method'] }];
      });
      const mask: RegionalEntity = {
        ...base,
        type: 'regional',
        objects: cleanObjects(v.objects, room),
        color,
        fill,
        positivePrompt: optionalText(v.positivePrompt),
        negativePrompt: optionalText(v.negativePrompt),
        autoNegative: v.autoNegative === true,
        refImages: refImages.slice(0, REF_IMAGES_MAX),
      };
      return mask;
    }
    default:
      // Control layers and unknown kinds are not part of a comic page.
      return null;
  }
}

/** A box as a page keeps it, or null when it is not one. */
function cleanBbox(v: unknown): Rect | null {
  const rect = cleanRect(v);
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  return { x: Math.round(rect.x) || 0, y: Math.round(rect.y) || 0, width: Math.min(8192, boxSide(rect.width)), height: Math.min(8192, boxSide(rect.height)) };
}

/**
 * A page's saved layers. Damaged entities and objects are dropped, ids are kept unique, the entities are ordered by group
 * (rasters, then inpaint masks, then regional guidance) keeping their order within it, each slot is kept once (a missing
 * panels slot goes to the bottom of the rasters, a missing balloons slot to the top), the user's rasters from the top go
 * first past MAX_RASTERS_PER_PAGE, masks past MAX_MASKS_PER_PAGE are dropped, and objects past the per-layer and per-page
 * limits are left out. Pictures keep their gallery name only (an empty address); every coordinate is rounded to 0.1 px.
 * Without a document (or a box) the page gets the defaults for its paper.
 */
export function parsePageCanvas(v: unknown, size: PageSize): PageCanvas {
  if (!isObject(v)) return defaultPageCanvas(size);
  const room = { left: MAX_COORDINATES_PER_PAGE };
  const ids = new Set<string>();
  const slots = new Set<string>();
  const rasters: RasterEntity[] = [];
  const inpaint: CanvasEntity[] = [];
  const regional: CanvasEntity[] = [];
  const list = Array.isArray(v.entities) ? v.entities.slice(0, (MAX_RASTERS_PER_PAGE + MAX_MASKS_PER_PAGE) * 4) : [];
  for (const raw of list) {
    const e = cleanEntity(raw, room);
    if (!e || ids.has(e.id)) continue;
    if (e.type === 'raster' && e.slot) {
      if (slots.has(e.slot)) continue;
      slots.add(e.slot);
    }
    ids.add(e.id);
    if (e.type === 'raster') rasters.push(e);
    else if (e.type === 'inpaint') inpaint.push(e);
    else regional.push(e);
  }
  const freshSlot = (slot: PageSlot): RasterEntity => {
    const seq = rasters.reduce((m, e) => Math.max(m, e.seq), 0) + 1;
    // The slot's own id may be taken by a user's layer; the slot then takes another.
    const slotId = ids.has(slot) ? `${slot}-slot` : slot;
    ids.add(slotId);
    return { ...slotEntity(slot, seq), id: slotId };
  };
  if (!slots.has(PANELS_SLOT)) rasters.unshift(freshSlot(PANELS_SLOT));
  if (!slots.has(BALLOONS_SLOT)) rasters.push(freshSlot(BALLOONS_SLOT));
  // Too many: the user's rasters from the top of the stack go first.
  while (rasters.length > MAX_RASTERS_PER_PAGE) {
    let last = rasters.length - 1;
    while (rasters[last]!.slot) last--;
    rasters.splice(last, 1);
  }
  const masks = [...inpaint, ...regional].slice(0, MAX_MASKS_PER_PAGE);
  const kept = new Set(masks);
  return {
    entities: [...rasters, ...inpaint.filter((e) => kept.has(e)), ...regional.filter((e) => kept.has(e))],
    bbox: cleanBbox(v.bbox) ?? defaultBbox(size),
  };
}

// Saving ----------------------------------------------------------------------------------------------------------

/**
 * The page's layers as they are saved: the same reading as `parsePageCanvas`, so a saved page reads back unchanged. A
 * picture without a gallery name (one that lives only in the page) cannot be saved and is left out: name the pictures first
 * (see `entitiesForSaving` in canvasDocument.ts).
 */
export function serializePageCanvas(doc: PageCanvas, size: PageSize): PageCanvas {
  return parsePageCanvas(doc, size);
}

// Changes ---------------------------------------------------------------------------------------------------------

/** The image objects with their addresses looked up by gallery name; a picture that is gone is left out. */
export function withUrls(entities: CanvasEntity[], urlOf: (imageName: string) => string | undefined): CanvasEntity[] {
  return entities.map((e) => {
    if (!e.objects.some((o) => o.kind === 'image')) return e;
    const objects = e.objects.flatMap((o): CanvasObject[] => {
      if (o.kind !== 'image') return [o];
      const url = o.imageName ? urlOf(o.imageName) : o.url;
      return url ? [{ ...o, url }] : [];
    });
    return { ...e, objects } as CanvasEntity;
  });
}

function scaleObject(o: CanvasObject, s: number): CanvasObject {
  const r = (v: number) => roundCoordinate(v * s);
  switch (o.kind) {
    case 'stroke':
      return {
        ...o,
        width: r(o.width) || 0.1,
        points: o.points.map(r),
        clip: o.clip ? { x: r(o.clip.x), y: r(o.clip.y), width: r(o.clip.width), height: r(o.clip.height) } : null,
        ...(o.block !== undefined ? { block: Math.round(between(o.block * s, 2, 128)) } : {}),
      };
    case 'pose':
      return { ...o, points: o.points.map(r), width: r(o.width), ...(o.depth ? { depth: o.depth.map(r) } : {}) };
    case 'image':
    case 'rect':
    default:
      return { ...o, x: r(o.x), y: r(o.y), width: r(o.width), height: r(o.height) } as CanvasObject;
  }
}

/**
 * The layers of a page whose paper changes from `from` to `to` pixels: everything the user drew is scaled by one factor
 * (the most that fits) and centred, so nothing is stretched or cut. Slots hold nothing and stay at the corner; the box is
 * scaled and centred the same way. The same document when the size does not change.
 */
export function rescaleCanvasDoc(doc: PageCanvas, from: { width: number; height: number }, to: { width: number; height: number }): PageCanvas {
  if ((from.width === to.width && from.height === to.height) || from.width <= 0 || from.height <= 0) return doc;
  const s = Math.min(to.width / from.width, to.height / from.height);
  const dx = (to.width - from.width * s) / 2;
  const dy = (to.height - from.height * s) / 2;
  const entities = doc.entities.map((e): CanvasEntity => {
    if (isPageSlot(e)) return e;
    return { ...e, x: roundCoordinate(e.x * s + dx), y: roundCoordinate(e.y * s + dy), objects: e.objects.map((o) => scaleObject(o, s)) } as CanvasEntity;
  });
  const b = doc.bbox;
  const bbox = { x: Math.round(b.x * s + dx) || 0, y: Math.round(b.y * s + dy) || 0, width: boxSide(b.width * s), height: boxSide(b.height * s) };
  return { entities, bbox };
}

/** The parts of a raster layer that change without changing what it holds. */
export interface RasterLook {
  name?: string | null;
  isEnabled?: boolean;
  isLocked?: boolean;
  opacity?: number;
  blend?: RasterBlend;
}

/** The document with one raster layer's look changed (each field kept in range); null when nothing changes. */
export function updateRasterLook(doc: PageCanvas, id: string, look: RasterLook): PageCanvas | null {
  const e = doc.entities.find((x): x is RasterEntity => x.id === id && x.type === 'raster');
  if (!e) return null;
  const next: RasterEntity = { ...e };
  if (look.name !== undefined) next.name = cleanLayerName(look.name);
  if (look.isEnabled !== undefined) next.isEnabled = look.isEnabled;
  if (look.isLocked !== undefined) next.isLocked = look.isLocked;
  if (look.opacity !== undefined && isNumber(look.opacity)) next.opacity = fraction(look.opacity, e.opacity);
  if (look.blend !== undefined && BLENDS.includes(look.blend)) {
    if (look.blend === 'normal') delete next.blend;
    else next.blend = look.blend;
  }
  const same = next.name === e.name && next.isEnabled === e.isEnabled && next.isLocked === e.isLocked && next.opacity === e.opacity && next.blend === e.blend;
  return same ? null : { ...doc, entities: doc.entities.map((x) => (x.id === id ? next : x)) };
}

/**
 * The document with a raster layer moved one place up (towards the top) or down among the rasters, or to the top or the
 * bottom of them; null when it cannot move.
 */
export function moveRaster(doc: PageCanvas, id: string, to: 'up' | 'down' | 'top' | 'bottom'): PageCanvas | null {
  const rasters = pageRasters(doc);
  const from = rasters.findIndex((e) => e.id === id);
  const target = to === 'top' ? rasters.length - 1 : to === 'bottom' ? 0 : from + (to === 'up' ? 1 : -1);
  if (from < 0 || target < 0 || target >= rasters.length) return null;
  const order = [...rasters];
  const [moved] = order.splice(from, 1);
  order.splice(target, 0, moved!);
  return { ...doc, entities: [...order, ...doc.entities.filter((e) => e.type !== 'raster')] };
}

/** The document without one of the user's raster layers (a slot or a layer that is not there cannot go); null then. */
export function removeRaster(doc: PageCanvas, id: string): PageCanvas | null {
  const e = doc.entities.find((x): x is RasterEntity => x.id === id && x.type === 'raster');
  if (!e || e.slot) return null;
  return { ...doc, entities: doc.entities.filter((x) => x !== e) };
}

let added = 0;

/** The document with a new empty raster layer on top of the rasters; null when the page holds as many as it may. */
export function addRaster(doc: PageCanvas, name: string | null): PageCanvas | null {
  const rasters = pageRasters(doc);
  if (rasters.length >= MAX_RASTERS_PER_PAGE) return null;
  const seq = rasters.reduce((m, e) => Math.max(m, e.seq), 0) + 1;
  const layer: RasterEntity = {
    id: `raster-${Date.now().toString(36)}-${++added}`,
    type: 'raster',
    seq,
    name: cleanLayerName(name),
    isEnabled: true,
    isLocked: false,
    opacity: 1,
    x: 0,
    y: 0,
    objects: [],
  };
  return { ...doc, entities: [...rasters, layer, ...doc.entities.filter((e) => e.type !== 'raster')] };
}

