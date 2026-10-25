// Keeps the canvas document (layers, masks, bounding box) across restarts in the backend's database.
// Saving is debounced and starts only after the restore, so nothing is written before the saved document was read.
// The layers' saved shape (pictures as hidden gallery images, referenced by name) is in canvasDocument.ts.
import { backend } from '@/backend';
import { ENTITY_TYPES, useCanvas, type CanvasState, type EntityType, type ImageObject, type Rect, type Viewport } from './canvas';
import { entitiesForSaving, isNumber, isObject, isRect, restoreEntities, withNamedImage } from './canvasDocument';
import { findImage } from './gallery';

const VERSION = 1;
const SAVE_DELAY_MS = 1000;

/** The document as saved: image objects carry their gallery `imageName` only (the address is looked up on restore). */
interface SavedCanvas {
  version: number;
  entities: unknown[];
  selectedEntityId: string | null;
  bbox: Rect;
  groupHidden: Record<EntityType, boolean>;
  viewport: Viewport;
}

type Slice = Pick<CanvasState, 'entities' | 'selectedEntityId' | 'bbox' | 'groupHidden'>;

// Saving ---------------------------------------------------------------------------------------------------------

/** Swaps a picture's new address into the live canvas, so the next save has nothing to upload. */
const swapNamed = (named: ImageObject) => useCanvas.setState((s) => ({ entities: withNamedImage(s.entities, named) }));

/** The document for the current canvas, with every picture named. */
export async function serializeCanvas(): Promise<string> {
  const s = useCanvas.getState();
  const entities = await entitiesForSaving(s.entities, swapNamed);
  const doc: SavedCanvas = {
    version: VERSION,
    entities,
    selectedEntityId: s.selectedEntityId,
    bbox: s.bbox,
    groupHidden: s.groupHidden,
    viewport: s.viewport,
  };
  return JSON.stringify(doc);
}

// Restoring ------------------------------------------------------------------------------------------------------

/** The parts of the saved document that are still usable, or `null` when it is not a canvas document at all. */
export function parseCanvas(text: string): (Slice & { viewport: Viewport | null }) | null {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(doc) || doc.version !== VERSION || !Array.isArray(doc.entities) || !isRect(doc.bbox)) return null;
  const entities = restoreEntities(doc.entities, findImage);
  const hidden = isObject(doc.groupHidden) ? doc.groupHidden : {};
  const groupHidden = { ...useCanvas.getState().groupHidden };
  for (const t of ENTITY_TYPES) if (typeof hidden[t] === 'boolean') groupHidden[t] = hidden[t];
  const selected = typeof doc.selectedEntityId === 'string' && entities.some((e) => e.id === doc.selectedEntityId) ? doc.selectedEntityId : null;
  const v = doc.viewport;
  const viewport = isObject(v) && isNumber(v.x) && isNumber(v.y) && isNumber(v.scale) && v.scale > 0 ? { x: v.x, y: v.y, scale: v.scale } : null;
  return { entities, selectedEntityId: selected, bbox: doc.bbox, groupHidden, viewport };
}

// Wiring ---------------------------------------------------------------------------------------------------------

let timer: ReturnType<typeof setTimeout> | undefined;
let saving = false;
let again = false;

async function save() {
  if (saving) {
    again = true;
    return;
  }
  saving = true;
  try {
    await backend.saveCanvas(await serializeCanvas());
  } catch {
    // Kept in the page; the next change saves again.
  } finally {
    saving = false;
  }
  if (again) {
    again = false;
    schedule();
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => void save(), SAVE_DELAY_MS);
}

let watching = false;

/**
 * Reads the saved canvas into the store, then starts saving changes. Called once after the gallery is loaded (the
 * pictures are looked up there). If the saved document cannot be read, saving does not start, so it is not overwritten.
 */
export async function restoreAndWatchCanvas(): Promise<void> {
  if (watching) return;
  let text: string | null;
  try {
    text = await backend.loadCanvas();
  } catch {
    return;
  }
  const doc = text === null ? null : parseCanvas(text);
  if (doc) {
    const { viewport, ...slice } = doc;
    useCanvas.setState({ ...slice, ...(viewport ? { viewport } : {}) });
    useCanvas.getState().clearHistory();
  }
  watching = true;
  useCanvas.subscribe((s, prev) => {
    if (s.entities !== prev.entities || s.bbox !== prev.bbox || s.selectedEntityId !== prev.selectedEntityId || s.groupHidden !== prev.groupHidden) schedule();
  });
}
