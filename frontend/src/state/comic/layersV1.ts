// The layers of a comic page as version 1 of the comic document kept them, read only to be migrated to
// the Canvas layers of version 2 (migrateLayers.ts). Two built-in layers every page had (the panels and the
// balloons) and the user's layers: a drawing (pen and eraser strokes, points as shares of the page) and a picture placed on
// the page. Every layer had a name, visibility, lock, opacity and blend. The reader keeps the limits version 1 had, so a
// damaged or oversized document cannot grow while it is migrated.
import type { ComicImageView } from './document';
import { clampImageView, DEFAULT_IMAGE_VIEW } from './document';

export const LAYER_KINDS = ['panels', 'balloons', 'drawing', 'image'] as const;
export type LayerKind = (typeof LAYER_KINDS)[number];

/** How a layer's colours met what was under it. */
export const BLEND_MODES = ['normal', 'multiply', 'screen'] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

/** The ids of the built-in layers: one of each on every page. */
export const PANELS_LAYER_ID = 'panels';
export const BALLOONS_LAYER_ID = 'balloons';

/** The most layers a page held, built-in ones included. */
export const MAX_LAYERS_PER_PAGE = 32;
/** The most strokes one drawing layer kept, the most points of one stroke, and the most points of all drawings of a page. */
export const MAX_STROKES_PER_LAYER = 2000;
export const MAX_POINTS_PER_STROKE = 2000;
export const MAX_POINTS_PER_PAGE = 60000;
/** The longest name a layer kept. */
export const LAYER_NAME_MAX = 64;
/** A stroke's width, as a share of the page's width. */
export const STROKE_WIDTH_RANGE = { min: 0.0005, max: 0.05, default: 0.004 } as const;
const DEFAULT_STROKE_COLOR = '#000000';
/** How far a stroke's points could lie off the page (shares of the page). */
const POINT_RANGE = { min: -0.1, max: 1.1 };
/** A picture placed on the page started at half the size that covers the page, in its middle. */
export const IMAGE_LAYER_VIEW: ComicImageView = { cx: 0.5, cy: 0.5, scale: 0.5, rotation: 0, flipX: false, flipY: false };

/** One pen or eraser line: points as flat x, y pairs (x a share of the page's width, y of its height). */
export interface ComicStroke {
  points: number[];
  color: string;
  /** A share of the page's width (STROKE_WIDTH_RANGE). */
  width: number;
  erase: boolean;
}

interface LayerBase {
  id: string;
  /** The name the user gave it; empty for a built-in layer's own name. */
  name: string;
  visible: boolean;
  locked: boolean;
  /** 0 to 1. */
  opacity: number;
  blend: BlendMode;
}

export interface PanelsLayer extends LayerBase {
  kind: 'panels';
}
export interface BalloonsLayer extends LayerBase {
  kind: 'balloons';
}
export interface DrawingLayer extends LayerBase {
  kind: 'drawing';
  strokes: ComicStroke[];
}
/** A picture on the page, placed against the whole page as the backdrop is. */
export interface ImageLayer extends LayerBase {
  kind: 'image';
  imageName: string | null;
  view: ComicImageView;
}
export type ComicLayer = PanelsLayer | BalloonsLayer | DrawingLayer | ImageLayer;

const isUserLayer = (layer: ComicLayer) => layer.kind === 'drawing' || layer.kind === 'image';

const base = (id: string): LayerBase => ({ id, name: '', visible: true, locked: false, opacity: 1, blend: 'normal' });

/** The stack of a page saved without layers: the panels, with the balloons over them. */
export function defaultLayers(): ComicLayer[] {
  return [
    { ...base(PANELS_LAYER_ID), kind: 'panels' },
    { ...base(BALLOONS_LAYER_ID), kind: 'balloons' },
  ];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const between = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** A name as a layer kept it: one line, trimmed, not too long. */
export function cleanName(v: unknown): string {
  if (typeof v !== 'string') return '';
  const oneLine = [...v].map((c) => (c < ' ' || c === '\u007f' ? ' ' : c)).join('');
  return [...oneLine.trim()].slice(0, LAYER_NAME_MAX).join('').trim();
}

/** A colour as #rrggbb in small letters; anything else is black. */
export const cleanColor = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : DEFAULT_STROKE_COLOR);
const clampOpacity = (v: unknown) => between(finite(v, 1), 0, 1);
const clampStrokeWidth = (v: unknown) => between(finite(v, STROKE_WIDTH_RANGE.default), STROKE_WIDTH_RANGE.min, STROKE_WIDTH_RANGE.max);

/** A coordinate rounded to a ten-thousandth of the page, as version 1 saved it. */
const coordinate = (v: number) => Math.round(between(v, POINT_RANGE.min, POINT_RANGE.max) * 10000) / 10000;

/** A stroke with its points in range and no more than `room` points, or null when it is not a stroke. */
export function parseStroke(v: unknown, room = MAX_POINTS_PER_STROKE): ComicStroke | null {
  if (!isObject(v) || !Array.isArray(v.points)) return null;
  const limit = Math.min(MAX_POINTS_PER_STROKE, Math.max(0, Math.floor(room))) * 2;
  const points: number[] = [];
  for (let i = 0; i + 1 < v.points.length && points.length < limit; i += 2) {
    const x = v.points[i];
    const y = v.points[i + 1];
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    points.push(coordinate(x), coordinate(y));
  }
  if (points.length < 2) return null;
  return { points, color: cleanColor(v.color), width: clampStrokeWidth(v.width), erase: v.erase === true };
}

const strokePoints = (layer: ComicLayer) => (layer.kind === 'drawing' ? layer.strokes.reduce((n, s) => n + s.points.length / 2, 0) : 0);

/** One saved layer, every field checked; `room` is how many more points the page may hold. Null when it is not a layer. */
function parseLayer(v: unknown, room: number): ComicLayer | null {
  if (!isObject(v) || typeof v.id !== 'string' || !v.id || v.id.length > 128) return null;
  const kind = LAYER_KINDS.find((k) => k === v.kind);
  if (!kind) return null;
  const common: LayerBase = {
    id: v.id,
    name: cleanName(v.name),
    visible: v.visible !== false,
    locked: v.locked === true,
    opacity: clampOpacity(v.opacity),
    blend: BLEND_MODES.find((b) => b === v.blend) ?? 'normal',
  };
  switch (kind) {
    case 'panels':
    case 'balloons':
      // A built-in layer is known by its kind; its id is the fixed one.
      return { ...common, id: kind === 'panels' ? PANELS_LAYER_ID : BALLOONS_LAYER_ID, kind };
    case 'drawing': {
      const strokes: ComicStroke[] = [];
      let left = room;
      for (const raw of Array.isArray(v.strokes) ? v.strokes : []) {
        if (strokes.length >= MAX_STROKES_PER_LAYER || left < 1) break;
        const stroke = parseStroke(raw, left);
        if (!stroke) continue;
        strokes.push(stroke);
        left -= stroke.points.length / 2;
      }
      return { ...common, kind, strokes };
    }
    case 'image': {
      const view = isObject(v.view) ? v.view : {};
      return {
        ...common,
        kind,
        imageName: typeof v.imageName === 'string' && v.imageName ? v.imageName : null,
        view: clampImageView({
          cx: finite(view.cx, DEFAULT_IMAGE_VIEW.cx),
          cy: finite(view.cy, DEFAULT_IMAGE_VIEW.cy),
          scale: finite(view.scale, IMAGE_LAYER_VIEW.scale),
          rotation: finite(view.rotation, 0),
          flipX: view.flipX === true,
          flipY: view.flipY === true,
        }),
      };
    }
  }
}

/**
 * A page's saved version 1 layers. A page saved before there were layers (no list) has the default stack. Layers that
 * cannot be read, a second layer with an id already used and a second built-in layer of a kind are dropped; a missing
 * built-in layer is put back (the panels at the bottom, the balloons on top); the stack is cut to MAX_LAYERS_PER_PAGE (the
 * built-in layers stay) and the drawings to MAX_POINTS_PER_PAGE.
 */
export function parseLayers(v: unknown): ComicLayer[] {
  if (!Array.isArray(v)) return defaultLayers();
  const layers: ComicLayer[] = [];
  const ids = new Set<string>();
  let room = MAX_POINTS_PER_PAGE;
  for (const raw of v.slice(0, MAX_LAYERS_PER_PAGE * 4)) {
    const layer = parseLayer(raw, room);
    if (!layer || ids.has(layer.id)) continue;
    ids.add(layer.id);
    layers.push(layer);
    room -= strokePoints(layer);
  }
  const [panels, balloons] = defaultLayers();
  if (!ids.has(PANELS_LAYER_ID)) layers.unshift(panels!);
  if (!ids.has(BALLOONS_LAYER_ID)) layers.push(balloons!);
  // Too many: the user layers from the top of the stack go first.
  while (layers.length > MAX_LAYERS_PER_PAGE) {
    let last = layers.length - 1;
    while (!isUserLayer(layers[last]!)) last--;
    layers.splice(last, 1);
  }
  return layers;
}
