// Canvas tab state: the document (bbox + entities), tools, viewport, history and staging.
// Shared contract used by other features: stagedImageNames, stagedIndex, addStagedImage, importImage.
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ControlMode, ImageDTO } from '@/backend';
import { ASPECT_RATIOS, useParams, type RefImageMethod } from './params';
import { undoLimit } from './settings';
import { POSE_JOINT_NAMES, POSE_MIRROR } from './poseSkeleton';

export type CanvasImportTarget = 'raster' | 'control' | 'inpaint' | 'regional' | 'newCanvasRaster' | 'newCanvasControl';

export type EntityType = 'raster' | 'control' | 'inpaint' | 'regional';
/** Render order, bottom to top. */
export const ENTITY_TYPES: EntityType[] = ['raster', 'control', 'inpaint', 'regional'];

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StrokeObject {
  kind: 'stroke';
  id: string;
  tool: 'brush' | 'eraser' | 'mosaic';
  color: RGBA;
  width: number;
  /** Flat [x0, y0, x1, y1, ...] in entity-local coordinates. */
  points: number[];
  /** Local-space clip rectangle ("clip to bbox"). */
  clip: Rect | null;
  /** Mosaic only: the edge of one block, in entity pixels. */
  block?: number;
}

export interface RectObject {
  kind: 'rect';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: RGBA;
}

export interface ImageObject {
  kind: 'image';
  id: string;
  url: string;
  imageName: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Set when the layer was flipped: the picture is drawn mirrored. */
  flipX?: boolean;
  flipY?: boolean;
}

/** Number of body joints in an OpenPose skeleton (the COCO 18 keypoints). */
export const POSE_JOINTS = POSE_JOINT_NAMES.length;

/** An editable OpenPose body skeleton, drawn in OpenPose's colours for a control layer. */
export interface PoseObject {
  kind: 'pose';
  id: string;
  /** Flat [x0, y0, ..., x17, y17] in entity-local coordinates, in COCO keypoint order. */
  points: number[];
  /** Joints left out of the picture (and the bones that touch them). */
  hidden: number[];
  /** Line width (OpenPose draws 4 px at 512 px). */
  width: number;
  /**
   * How far each joint is towards the viewer, in the units of `points` (18 numbers), set by the 3D editor so a pose can
   * be turned in 3D again. Absent for a flat pose. Drawing and generation use `points` only.
   */
  depth?: number[];
}

export type CanvasObject = StrokeObject | RectObject | ImageObject | PoseObject;

interface EntityBase {
  id: string;
  /** Number used in the default name ("Raster Layer 2"). */
  seq: number;
  /** User-given name; null shows the translated default name. */
  name: string | null;
  isEnabled: boolean;
  isLocked: boolean;
  opacity: number;
  /** Position offset of the entity in document space. */
  x: number;
  y: number;
  objects: CanvasObject[];
}

/** How a raster layer's colours meet the layers under it, as Photoshop's blend modes of the same names. */
export type RasterBlend = 'normal' | 'multiply' | 'screen';
export const RASTER_BLENDS: RasterBlend[] = ['normal', 'multiply', 'screen'];

export interface RasterEntity extends EntityBase {
  type: 'raster';
  /** Normal when absent. */
  blend?: RasterBlend;
  /**
   * Set on a layer the host draws itself (a comic page's panels or balloons), named by the host. It holds no objects and
   * cannot be drawn on, moved, deleted, duplicated, transformed, converted, merged or cleared; it can be reordered,
   * shown, hidden, locked, and given an opacity and a blend.
   */
  slot?: string;
}

/** Whether the layer is a slot the host draws (see `RasterEntity.slot`). */
export const isSlot = (e: CanvasEntity | null | undefined): boolean => e?.type === 'raster' && typeof e.slot === 'string';

export type { ControlMode };
export type FilterType = 'none' | 'canny' | 'hed' | 'lineart' | 'depth' | 'normal' | 'color_map';
export const FILTER_TYPES: FilterType[] = ['none', 'canny', 'hed', 'lineart', 'depth', 'normal', 'color_map'];

export interface ControlEntity extends EntityBase {
  type: 'control';
  modelKey: string | null;
  weight: number;
  beginEnd: [number, number];
  controlMode: ControlMode;
  filter: FilterType;
  withTransparencyEffect: boolean;
}

export type MaskFill = 'solid' | 'diagonal' | 'crosshatch' | 'grid' | 'horizontal' | 'vertical';
export const MASK_FILLS: MaskFill[] = ['solid', 'diagonal', 'crosshatch', 'grid', 'horizontal', 'vertical'];

export interface InpaintEntity extends EntityBase {
  type: 'inpaint';
  color: RGBA;
  fill: MaskFill;
  denoiseLimit: number | null;
  noiseLevel: number | null;
}

export interface RegionalRefImage {
  id: string;
  imageName: string | null;
  imageUrl: string | null;
  modelKey: string | null;
  weight: number;
  method: RefImageMethod;
}

export interface RegionalEntity extends EntityBase {
  type: 'regional';
  color: RGBA;
  fill: MaskFill;
  /** null = not added yet. */
  positivePrompt: string | null;
  negativePrompt: string | null;
  autoNegative: boolean;
  refImages: RegionalRefImage[];
}

export type CanvasEntity = RasterEntity | ControlEntity | InpaintEntity | RegionalEntity;
export type MaskEntity = InpaintEntity | RegionalEntity;

export type Tool = 'brush' | 'eraser' | 'mosaic' | 'rect' | 'lasso' | 'pose' | 'move' | 'bbox' | 'view' | 'colorPicker' | 'bucket';

/** The key that picks each tool; the canvas shortcuts and the hotkeys list are both made from it. */
export const TOOL_HOTKEYS: Record<Tool, string> = {
  brush: 'b',
  eraser: 'e',
  mosaic: 'm',
  rect: 'u',
  lasso: 'l',
  pose: 'o',
  move: 'v',
  bbox: 'c',
  view: 'h',
  colorPicker: 'i',
  // Not `g`: that key shows and hides the right panel everywhere.
  bucket: 'k',
};

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface CanvasSettings {
  showGrid: boolean;
  snapToGrid: boolean;
  showHud: boolean;
  clipToBbox: boolean;
  preserveMask: boolean;
  autoProcess: boolean;
  dimOutsideBbox: boolean;
}

/** Processed filter result shown instead of a control layer until applied. Local coordinates. */
export interface FilterPreview {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Doc {
  entities: CanvasEntity[];
  bbox: Rect;
}

type EntityPatch = Partial<Omit<RasterEntity, 'type' | 'id'>> &
  Partial<Omit<ControlEntity, 'type' | 'id'>> &
  Partial<Omit<InpaintEntity, 'type' | 'id'>> &
  Partial<Omit<RegionalEntity, 'type' | 'id'>>;

const MASK_COLORS: RGBA[] = [
  { r: 121, g: 157, b: 219, a: 1 },
  { r: 131, g: 214, b: 131, a: 1 },
  { r: 250, g: 225, b: 80, a: 1 },
  { r: 220, g: 144, b: 101, a: 1 },
  { r: 224, g: 117, b: 117, a: 1 },
  { r: 213, g: 139, b: 202, a: 1 },
  { r: 161, g: 120, b: 214, a: 1 },
];
const INPAINT_COLOR: RGBA = { r: 224, g: 117, b: 117, a: 1 };

let idSeq = 1;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${idSeq++}`;

export interface CanvasState extends Doc {
  // Shared contract
  stagedImageNames: string[];
  stagedIndex: number;
  addStagedImage: (name: string) => void;
  importImage: (image: ImageDTO, target: CanvasImportTarget) => void;

  selectedEntityId: string | null;
  tool: Tool;
  lastTool: Tool;
  brushWidth: number;
  eraserWidth: number;
  mosaicWidth: number;
  /** Edge of one mosaic block in pixels. */
  mosaicBlock: number;
  /** How far a colour may differ (0 to 255 per channel) from the pressed pixel and still be filled by the bucket. */
  bucketTolerance: number;
  fillColor: RGBA;
  viewport: Viewport;
  settings: CanvasSettings;
  groupHidden: Record<EntityType, boolean>;
  filterPreviews: Record<string, FilterPreview>;
  stagingShowResults: boolean;
  past: Doc[];
  future: Doc[];
  lastHistoryKey: string | null;
  lastHistoryAt: number;

  setTool: (tool: Tool) => void;
  swapTool: () => void;
  setBrushWidth: (w: number) => void;
  setEraserWidth: (w: number) => void;
  setMosaicWidth: (w: number) => void;
  setMosaicBlock: (b: number) => void;
  setBucketTolerance: (v: number) => void;
  setFillColor: (c: RGBA) => void;
  setViewport: (v: Viewport) => void;
  setSettings: (patch: Partial<CanvasSettings>) => void;
  setGroupHidden: (type: EntityType, hidden: boolean) => void;
  select: (id: string | null) => void;

  /** Snapshot the document for undo. Calls with the same key within a second coalesce. */
  pushHistory: (coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;

  /**
   * Adds a layer on top of its group, or right under the layer `under` (of the same type) when given. Past the store's
   * limits nothing is added and the id is empty.
   */
  addEntity: (type: EntityType, init?: EntityPatch, opts?: { under?: string }) => string;
  updateEntity: (id: string, patch: EntityPatch, opts?: { history?: boolean | string }) => void;
  addObject: (id: string, obj: CanvasObject) => void;
  removeEntity: (id: string) => void;
  duplicateEntity: (id: string) => void;
  arrangeEntity: (id: string, where: 'up' | 'down' | 'top' | 'bottom') => void;
  /** Moves a layer to the position of another layer of the same type (the others shift by one). */
  moveEntityTo: (id: string, targetId: string) => void;
  /** Mirrors the layer's objects around `center` (an x for horizontal, a y for vertical). */
  flipEntity: (id: string, axis: FlipAxis, center: number) => void;
  convertEntity: (id: string, to: EntityType) => void;
  replaceEntities: (entities: CanvasEntity[]) => void;
  clearCanvas: () => void;
  setBbox: (rect: Rect, opts?: { history?: boolean | string; syncParams?: boolean }) => void;

  setFilterPreview: (id: string, preview: FilterPreview | null) => void;
  setStagedIndex: (i: number) => void;
  discardStaged: (index: number) => void;
  clearStaged: () => void;
  setStagingShowResults: (v: boolean) => void;
}

const roundTo8 = (v: number) => Math.max(64, Math.round(v / 8) * 8);

function defaults(type: EntityType, seq: number, entities: CanvasEntity[]): CanvasEntity {
  const base = { id: newId(type), seq, name: null, isEnabled: true, isLocked: false, opacity: 1, x: 0, y: 0, objects: [] };
  switch (type) {
    case 'raster':
      return { ...base, type };
    case 'control':
      return {
        ...base,
        type,
        modelKey: null,
        weight: 0.75,
        beginEnd: [0, 0.75],
        controlMode: 'balanced',
        filter: 'none',
        withTransparencyEffect: true,
      };
    case 'inpaint':
      return { ...base, type, opacity: 0.5, color: INPAINT_COLOR, fill: 'diagonal', denoiseLimit: null, noiseLevel: null };
    case 'regional': {
      const n = entities.filter((e) => e.type === 'regional').length;
      return {
        ...base,
        type,
        opacity: 0.5,
        color: MASK_COLORS[n % MASK_COLORS.length] as RGBA,
        fill: 'solid',
        positivePrompt: null,
        negativePrompt: null,
        autoNegative: false,
        refImages: [],
      };
    }
  }
}

function nextSeq(entities: CanvasEntity[], type: EntityType): number {
  return entities.reduce((m, e) => (e.type === type ? Math.max(m, e.seq) : m), 0) + 1;
}

/** Converts an entity to another type, keeping shared fields and objects. */
function convert(e: CanvasEntity, to: EntityType, entities: CanvasEntity[]): CanvasEntity {
  const fresh = defaults(to, nextSeq(entities, to), entities);
  const keep = { id: e.id, isEnabled: e.isEnabled, isLocked: e.isLocked, x: e.x, y: e.y, objects: e.objects };
  if ((e.type === 'inpaint' || e.type === 'regional') && (fresh.type === 'inpaint' || fresh.type === 'regional')) {
    return { ...fresh, ...keep, opacity: e.opacity, color: e.color, fill: e.fill } as CanvasEntity;
  }
  return { ...fresh, ...keep, opacity: fresh.type === 'raster' || fresh.type === 'control' ? e.opacity : fresh.opacity } as CanvasEntity;
}

function syncParamsSize(width: number, height: number) {
  const p = useParams.getState();
  if (p.width === width && p.height === height) return;
  const ratio = width / height;
  const match = ASPECT_RATIOS.find((a) => a.value !== null && Math.abs(a.value - ratio) < 0.01);
  p.set({ width, height, aspectRatio: p.aspectLocked ? p.aspectRatio : (match?.id ?? 'free') });
}

const initialSize = () => {
  const p = useParams.getState();
  return { x: 0, y: 0, width: p.width, height: p.height };
};

/** A canvas store: the Image tab's global `useCanvas`, or a separate instance (one per comic page). */
export type CanvasStore = UseBoundStore<StoreApi<CanvasState>>;

/** How many layers a store holds at most: raster layers (a host's slots included), masks (inpaint and regional), and objects in one layer. */
export interface CanvasLimits {
  rasters: number;
  masks: number;
  objects: number;
}

export type LimitKind = keyof CanvasLimits;

/** Which limit adding one more layer of this type would pass, or null when there is room. */
export function entityLimitHit(entities: CanvasEntity[], type: EntityType, limits: CanvasLimits | undefined): 'rasters' | 'masks' | null {
  if (!limits) return null;
  if (type === 'raster') return entities.filter((e) => e.type === 'raster').length >= limits.rasters ? 'rasters' : null;
  if (type === 'inpaint' || type === 'regional') return entities.filter((e) => e.type === 'inpaint' || e.type === 'regional').length >= limits.masks ? 'masks' : null;
  return null;
}

export interface CanvasStoreOptions {
  /** Storage key for the tool settings; none keeps them in memory only. */
  persistKey?: string;
  /** Whether undo, redo and setBbox write the bbox size into the left form (`useParams`). */
  syncParams: boolean;
  /** Limits the store enforces when a layer or an object is added; none means no limit. */
  limits?: CanvasLimits;
  /** Called with the limit that refused an addition (the host tells the user). */
  onLimit?: (kind: LimitKind) => void;
}

/** The persisted part of the state: tool settings only, never the document. */
const persistedSlice = (s: CanvasState) => ({
  settings: s.settings,
  brushWidth: s.brushWidth,
  eraserWidth: s.eraserWidth,
  mosaicWidth: s.mosaicWidth,
  mosaicBlock: s.mosaicBlock,
  bucketTolerance: s.bucketTolerance,
  fillColor: s.fillColor,
});

/** Makes a canvas store. Subscriptions elsewhere (saving, request building, staging) stay bound to `useCanvas`. */
export function createCanvasStore({ persistKey, syncParams, limits, onLimit }: CanvasStoreOptions): CanvasStore {
  const syncSize = (width: number, height: number) => {
    if (syncParams) syncParamsSize(width, height);
  };
  const init = (set: StoreApi<CanvasState>['setState'], get: () => CanvasState): CanvasState => {
    const doc = (): Doc => ({ entities: get().entities, bbox: get().bbox });
    const withHistory = (opt: boolean | string | undefined) => {
      if (opt === false) return;
      get().pushHistory(typeof opt === 'string' ? opt : undefined);
    };
    const mapEntity = (id: string, fn: (e: CanvasEntity) => CanvasEntity) =>
      set({ entities: get().entities.map((e) => (e.id === id ? fn(e) : e)) });

    return {
      entities: [],
      bbox: initialSize(),

      stagedImageNames: [],
      stagedIndex: 0,
      addStagedImage: (name) => {
        const names = [...get().stagedImageNames, name];
        set({ stagedImageNames: names, stagedIndex: names.length - 1, stagingShowResults: true });
      },
      importImage: () => {
        // Replaced by registerCanvasFeature().
      },

      selectedEntityId: null,
      // A new canvas opens on the hand, so a first press moves the view and paints nothing; the tool is not persisted.
      tool: 'view',
      lastTool: 'move',
      brushWidth: 50,
      eraserWidth: 50,
      mosaicWidth: 80,
      mosaicBlock: 16,
      bucketTolerance: 32,
      fillColor: { r: 63, g: 196, b: 255, a: 1 },
      viewport: { x: 0, y: 0, scale: 0.5 },
      settings: {
        showGrid: true,
        snapToGrid: true,
        showHud: true,
        clipToBbox: false,
        preserveMask: false,
        autoProcess: true,
        dimOutsideBbox: true,
      },
      groupHidden: { raster: false, control: false, inpaint: false, regional: false },
      filterPreviews: {},
      stagingShowResults: true,
      past: [],
      future: [],
      lastHistoryKey: null,
      lastHistoryAt: 0,

      setTool: (tool) => {
        const cur = get().tool;
        if (cur === tool) return;
        set({ tool, lastTool: cur });
      },
      swapTool: () => set({ tool: get().lastTool, lastTool: get().tool }),
      setBrushWidth: (w) => set({ brushWidth: Math.max(1, Math.min(600, Math.round(w))) }),
      setEraserWidth: (w) => set({ eraserWidth: Math.max(1, Math.min(600, Math.round(w))) }),
      setMosaicWidth: (w) => set({ mosaicWidth: Math.max(1, Math.min(600, Math.round(w))) }),
      setMosaicBlock: (b) => set({ mosaicBlock: Math.max(2, Math.min(128, Math.round(b))) }),
      setBucketTolerance: (v) => set({ bucketTolerance: Math.max(0, Math.min(255, Math.round(v))) }),
      setFillColor: (fillColor) => set({ fillColor }),
      setViewport: (viewport) => set({ viewport }),
      setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      setGroupHidden: (type, hidden) => set({ groupHidden: { ...get().groupHidden, [type]: hidden } }),
      select: (selectedEntityId) => set({ selectedEntityId }),

      pushHistory: (key) => {
        const now = Date.now();
        const s = get();
        if (key && s.lastHistoryKey === key && now - s.lastHistoryAt < 1000) {
          set({ lastHistoryAt: now });
          return;
        }
        set({ past: [...s.past, doc()].slice(-undoLimit()), future: [], lastHistoryKey: key ?? null, lastHistoryAt: now });
      },
      undo: () => {
        const s = get();
        const prev = s.past[s.past.length - 1];
        if (!prev) return;
        set({ ...prev, past: s.past.slice(0, -1), future: [doc(), ...s.future], lastHistoryKey: null });
        syncSize(prev.bbox.width, prev.bbox.height);
      },
      redo: () => {
        const s = get();
        const next = s.future[0];
        if (!next) return;
        set({ ...next, past: [...s.past, doc()], future: s.future.slice(1), lastHistoryKey: null });
        syncSize(next.bbox.width, next.bbox.height);
      },
      clearHistory: () => set({ past: [], future: [], lastHistoryKey: null }),

      addEntity: (type, init, opts) => {
        const hit = entityLimitHit(get().entities, type, limits);
        if (hit) {
          onLimit?.(hit);
          return '';
        }
        get().pushHistory();
        const entities = get().entities;
        const entity = { ...defaults(type, nextSeq(entities, type), entities), ...init } as CanvasEntity;
        const at = opts?.under ? entities.findIndex((e) => e.id === opts.under && e.type === type) : -1;
        const next = at < 0 ? [...entities, entity] : [...entities.slice(0, at), entity, ...entities.slice(at)];
        set({ entities: next, selectedEntityId: entity.id });
        if (get().groupHidden[type]) get().setGroupHidden(type, false);
        return entity.id;
      },
      updateEntity: (id, patch, opts) => {
        let next = patch;
        if (isSlot(get().entities.find((e) => e.id === id))) {
          // A slot holds no objects and stays where the host put it.
          const { objects: _objects, x: _x, y: _y, slot: _slot, ...rest } = patch;
          if (!Object.keys(rest).length) return;
          next = rest;
        }
        if (limits && next.objects && next.objects.length > limits.objects && next.objects.length > (get().entities.find((e) => e.id === id)?.objects.length ?? 0)) {
          onLimit?.('objects');
          return;
        }
        withHistory(opts?.history);
        mapEntity(id, (e) => ({ ...e, ...next }) as CanvasEntity);
      },
      addObject: (id, obj) => {
        const target = get().entities.find((e) => e.id === id);
        if (!target || isSlot(target)) return;
        if (limits && target.objects.length >= limits.objects) {
          onLimit?.('objects');
          return;
        }
        get().pushHistory();
        mapEntity(id, (e) => ({ ...e, objects: [...e.objects, obj] }));
      },
      removeEntity: (id) => {
        if (isSlot(get().entities.find((e) => e.id === id))) return;
        get().pushHistory();
        const s = get();
        const idx = s.entities.findIndex((e) => e.id === id);
        const entities = s.entities.filter((e) => e.id !== id);
        const removed = s.entities[idx];
        let selected = s.selectedEntityId;
        if (selected === id) {
          const sameType = entities.filter((e) => e.type === removed?.type);
          selected = (sameType[sameType.length - 1] ?? entities[entities.length - 1])?.id ?? null;
        }
        const { [id]: _drop, ...filterPreviews } = s.filterPreviews;
        set({ entities, selectedEntityId: selected, filterPreviews });
      },
      duplicateEntity: (id) => {
        const s = get();
        const src = s.entities.find((e) => e.id === id);
        if (!src || isSlot(src)) return;
        const hit = entityLimitHit(s.entities, src.type, limits);
        if (hit) {
          onLimit?.(hit);
          return;
        }
        s.pushHistory();
        const copy = { ...src, id: newId(src.type), seq: nextSeq(s.entities, src.type), name: null } as CanvasEntity;
        const idx = s.entities.indexOf(src);
        const entities = [...s.entities];
        entities.splice(idx + 1, 0, copy);
        set({ entities, selectedEntityId: copy.id });
      },
      arrangeEntity: (id, where) => {
        const s = get();
        const e = s.entities.find((x) => x.id === id);
        if (!e) return;
        const group = s.entities.filter((x) => x.type === e.type);
        const others = s.entities.filter((x) => x.type !== e.type);
        const i = group.indexOf(e);
        const rest = group.filter((x) => x !== e);
        const target = where === 'top' ? rest.length : where === 'bottom' ? 0 : where === 'up' ? Math.min(rest.length, i + 1) : Math.max(0, i - 1);
        if (target === i) return;
        s.pushHistory();
        rest.splice(target, 0, e);
        set({ entities: sortByType([...others, ...rest]) });
      },
      moveEntityTo: (id, targetId) => {
        const s = get();
        const e = s.entities.find((x) => x.id === id);
        const target = s.entities.find((x) => x.id === targetId);
        if (!e || !target || e === target || e.type !== target.type) return;
        s.pushHistory();
        const others = s.entities.filter((x) => x.type !== e.type);
        const rest = s.entities.filter((x) => x.type === e.type && x !== e);
        rest.splice(rest.indexOf(target) + (s.entities.indexOf(e) < s.entities.indexOf(target) ? 1 : 0), 0, e);
        set({ entities: sortByType([...others, ...rest]) });
      },
      flipEntity: (id, axis, center) => {
        const s = get();
        const e = s.entities.find((x) => x.id === id);
        if (!e || e.objects.length === 0 || isSlot(e)) return;
        s.pushHistory();
        const objects = e.objects.map((o) => mirrorObject(o, axis, center));
        set({ entities: s.entities.map((x) => (x.id === id ? { ...x, objects } : x)) });
      },
      convertEntity: (id, to) => {
        const s = get();
        const e = s.entities.find((x) => x.id === id);
        if (!e || e.type === to || isSlot(e)) return;
        const hit = entityLimitHit(s.entities, to, limits);
        if (hit) {
          onLimit?.(hit);
          return;
        }
        s.pushHistory();
        const converted = convert(e, to, s.entities);
        set({ entities: sortByType(s.entities.map((x) => (x.id === id ? converted : x))) });
      },
      replaceEntities: (entities) => {
        get().pushHistory();
        set({ entities: sortByType(entities) });
      },
      clearCanvas: () => {
        get().pushHistory();
        // The host's slots stay; only the layers the user made go.
        set({ entities: get().entities.filter(isSlot), selectedEntityId: null, filterPreviews: {} });
      },
      setBbox: (rect, opts) => {
        const next = { x: Math.round(rect.x), y: Math.round(rect.y), width: roundTo8(rect.width), height: roundTo8(rect.height) };
        const cur = get().bbox;
        if (cur.x === next.x && cur.y === next.y && cur.width === next.width && cur.height === next.height) return;
        withHistory(opts?.history);
        set({ bbox: next });
        if (opts?.syncParams !== false) syncSize(next.width, next.height);
      },

      setFilterPreview: (id, preview) => {
        const { [id]: _old, ...rest } = get().filterPreviews;
        set({ filterPreviews: preview ? { ...rest, [id]: preview } : rest });
      },
      setStagedIndex: (i) => {
        const n = get().stagedImageNames.length;
        if (!n) return;
        set({ stagedIndex: ((i % n) + n) % n });
      },
      discardStaged: (index) => {
        const names = get().stagedImageNames.filter((_, i) => i !== index);
        set({ stagedImageNames: names, stagedIndex: Math.max(0, Math.min(get().stagedIndex, names.length - 1)) });
      },
      clearStaged: () => set({ stagedImageNames: [], stagedIndex: 0 }),
      setStagingShowResults: (stagingShowResults) => set({ stagingShowResults }),
    };
  };
  if (!persistKey) return create<CanvasState>()((set, get) => init(set, get));
  return create<CanvasState>()(
    persist((set, get) => init(set, get), {
      name: persistKey,
      partialize: persistedSlice,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<CanvasState>;
        return { ...current, ...p, settings: { ...current.settings, ...p.settings } };
      },
    }),
  );
}

/** The Image tab's canvas: tool settings persisted, bbox size kept in step with the left form. */
export const useCanvas = createCanvasStore({ persistKey: 'novira.canvas', syncParams: true });

export type FlipAxis = 'horizontal' | 'vertical';

function mirrorObject(o: CanvasObject, axis: FlipAxis, center: number): CanvasObject {
  const horizontal = axis === 'horizontal';
  if (o.kind === 'stroke') {
    // The clip rectangle is the bbox, which does not move with the content.
    const parity = horizontal ? 0 : 1;
    return { ...o, points: o.points.map((v, i) => (i % 2 === parity ? 2 * center - v : v)) };
  }
  if (o.kind === 'rect') {
    return horizontal ? { ...o, x: 2 * center - (o.x + o.width) } : { ...o, y: 2 * center - (o.y + o.height) };
  }
  if (o.kind === 'pose') {
    // A mirrored body: positions flip and left and right joints trade places.
    const parity = horizontal ? 0 : 1;
    const flipped = o.points.map((v, i) => (i % 2 === parity ? 2 * center - v : v));
    if (!horizontal) return { ...o, points: flipped };
    const points = flipped.map((_, i) => flipped[(POSE_MIRROR[i >> 1] as number) * 2 + (i % 2)] as number);
    const depth = o.depth?.map((_, j) => o.depth?.[POSE_MIRROR[j] as number] as number);
    return { ...o, points, ...(depth ? { depth } : {}), hidden: o.hidden.map((j) => POSE_MIRROR[j] as number).sort((a, b) => a - b) };
  }
  return horizontal
    ? { ...o, x: 2 * center - (o.x + o.width), flipX: !o.flipX }
    : { ...o, y: 2 * center - (o.y + o.height), flipY: !o.flipY };
}

/** Keeps entities grouped by type in render order while preserving order within each type. */
function sortByType(entities: CanvasEntity[]): CanvasEntity[] {
  return ENTITY_TYPES.flatMap((t) => entities.filter((e) => e.type === t));
}

export function selectedEntity(s: Pick<CanvasState, 'entities' | 'selectedEntityId'>): CanvasEntity | undefined {
  return s.entities.find((e) => e.id === s.selectedEntityId);
}
