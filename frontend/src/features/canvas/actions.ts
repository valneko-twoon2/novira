// Canvas commands that touch the backend or the gallery: save, merge, import, staging, filters, clipboard, poses.
import { backend, type ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { isSlot, newId, useCanvas, type CanvasEntity, type CanvasStore, type CanvasImportTarget, type ControlEntity, type EntityType, type PoseObject, type Rect } from '@/state/canvas';
import { findImage, useGallery } from '@/state/gallery';
import { autoAddBoardId, buildRequestFor, readinessOf } from '@/state/invoke';
import { defaultRefModelKey, findModel, useModels } from '@/state/models';
import { useParams } from '@/state/params';
import type { ExtractedPoses } from '@/state/comfy/poseExtract';
import { pickPoseModel, POSE_CONTROL } from '@/state/poseSkeleton';
import { toast } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { objectsBounds } from '@/ui/canvasDraw/bounds';
import { canvasToBlob, canvasToUrl, compositeRect, contentBounds, imageUrlsOf } from '@/ui/canvasDraw/composite';
import { createCanvas, renderEntity } from '@/ui/canvasDraw/entityRender';
import { preloadImages } from '@/ui/canvasDraw/imageCache';
import { rgbaCss } from '@/ui/canvasDraw/rgbaCss';
import { containIn, transformedRect, type LayerTransform } from './geometry';
import { poseLineWidth, transformPose } from '@/state/pose/pose';
import { placePreset, POSE_PRESETS } from '@/state/pose/posePresets';
import { placeExtractedPerson, placePose, poseToSpec, randomPose, readPoseSpec, rerollPose, seededRandom, type PoseSpec } from '@/state/pose/poseSpec';
import { visibleEntities } from './render/composite';
import { buildCanvasPsd } from './render/psdExport';
import { encodePsd } from '@/state/psd';
import { applyFilter } from './render/filters';
import { floodFillRegion, growRegion, regionPixels } from './render/pixelOps';
import { filterCanvas, filterMargin, type RasterFilter } from './render/rasterFilter';

function fail(title: string, err: unknown) {
  toast({ status: 'error', title, description: String(err instanceof Error ? err.message : err) });
}

async function saveCanvasImage(canvas: HTMLCanvasElement): Promise<ImageDTO> {
  const url = await canvasToUrl(canvas);
  const image = await backend.saveImageFromUrl(url, { boardId: autoAddBoardId() });
  useGallery.getState().addImage(image);
  return image;
}

/** Flatten visible raster layers inside the bbox and save the result to the gallery. */
export async function saveCanvasToGallery(store: CanvasStore = useCanvas) {
  try {
    const s = store.getState();
    const canvas = await compositeRect(visibleEntities(s, ['raster']), s.bbox);
    await saveCanvasImage(canvas);
    toast({ status: 'success', title: t('canvas.toast.savedToGallery') });
  } catch (err) {
    fail(t('canvas.toast.saveFailed'), err);
  }
}

/** The raster layers between two slots (bottom first), each band with the slot right above it, or null at the top. */
function rasterBands(entities: CanvasEntity[]): { layers: CanvasEntity[]; under: string | null }[] {
  const bands: { layers: CanvasEntity[]; under: string | null }[] = [];
  let layers: CanvasEntity[] = [];
  for (const e of entities) {
    if (e.type !== 'raster') continue;
    if (isSlot(e)) {
      bands.push({ layers, under: e.id });
      layers = [];
    } else layers.push(e);
  }
  bands.push({ layers, under: null });
  return bands;
}

/**
 * Merge the visible raster layers into one new raster layer on top of them. Slots are never merged: the layers between
 * two slots are merged on their own and stay between them, so the picture looks the same.
 */
export async function mergeVisible(store: CanvasStore = useCanvas) {
  const s = store.getState();
  const visible = new Set(visibleEntities(s, ['raster']).map((e) => e.id));
  const jobs = rasterBands(s.entities)
    .map((b) => ({ under: b.under, layers: b.layers.filter((e) => visible.has(e.id)) }))
    .map((b) => ({ ...b, bounds: contentBounds(b.layers) }))
    .filter((b): b is typeof b & { bounds: Rect } => b.layers.length >= 2 && b.bounds !== null);
  if (!jobs.length) {
    toast({ status: 'info', title: t('canvas.toast.nothingToMerge') });
    return;
  }
  try {
    const pictures: { under: string | null; url: string; bounds: Rect }[] = [];
    for (const job of jobs) {
      const url = await canvasToUrl(await compositeRect(job.layers, job.bounds));
      await preloadImages([url]);
      pictures.push({ under: job.under, url, bounds: job.bounds });
    }
    const merged = new Set(jobs.flatMap((j) => j.layers.map((e) => e.id)));
    const st = store.getState();
    st.replaceEntities(st.entities.filter((e) => !merged.has(e.id)));
    for (const p of pictures) {
      st.addEntity('raster', { objects: [{ kind: 'image', id: newId('img'), url: p.url, imageName: null, ...p.bounds }] }, p.under ? { under: p.under } : undefined);
    }
    toast({ status: 'success', title: t('canvas.toast.merged') });
  } catch (err) {
    fail(t('canvas.toast.mergeFailed'), err);
  }
}

async function entityCanvas(e: CanvasEntity, store: CanvasStore): Promise<HTMLCanvasElement | null> {
  await preloadImages(imageUrlsOf([e]));
  const r = renderEntity(e, { preview: store.getState().filterPreviews[e.id] });
  return r?.canvas ?? null;
}

export async function saveEntityToGallery(id: string, store: CanvasStore = useCanvas) {
  const e = store.getState().entities.find((x) => x.id === id);
  if (!e) return;
  try {
    const canvas = await entityCanvas(e, store);
    if (!canvas) {
      toast({ status: 'warning', title: t('canvas.toast.entityEmpty') });
      return;
    }
    await saveCanvasImage(canvas);
    toast({ status: 'success', title: t('canvas.toast.savedToGallery') });
  } catch (err) {
    fail(t('canvas.toast.saveFailed'), err);
  }
}

/**
 * The layer as a gallery image, for dragging it onto another target: a layer that is just one untouched gallery image
 * gives that image, anything else is flattened and saved. Null when the layer is empty.
 */
export async function entityAsGalleryImage(id: string, store: CanvasStore = useCanvas): Promise<string | null> {
  const e = store.getState().entities.find((x) => x.id === id);
  if (!e) return null;
  const only = e.objects.length === 1 ? e.objects[0] : undefined;
  if (e.type === 'raster' && e.opacity === 1 && only?.kind === 'image' && only.imageName && findImage(only.imageName)) return only.imageName;
  try {
    const canvas = await entityCanvas(e, store);
    if (!canvas) {
      toast({ status: 'warning', title: t('canvas.toast.entityEmpty') });
      return null;
    }
    return (await saveCanvasImage(canvas)).name;
  } catch (err) {
    fail(t('canvas.toast.saveFailed'), err);
    return null;
  }
}

export async function copyEntityToClipboard(id: string, store: CanvasStore = useCanvas) {
  const e = store.getState().entities.find((x) => x.id === id);
  if (!e) return;
  try {
    const canvas = await entityCanvas(e, store);
    if (!canvas) {
      toast({ status: 'warning', title: t('canvas.toast.entityEmpty') });
      return;
    }
    const blob = await canvasToBlob(canvas);
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error(t('canvas.toast.clipboardUnsupported'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast({ status: 'success', title: t('canvas.toast.copied') });
  } catch (err) {
    fail(t('canvas.toast.copyFailed'), err);
  }
}

/** Save the layer as a PNG file through an ordinary download (as the workflow export does). */
export async function exportEntityToFile(id: string, store: CanvasStore = useCanvas) {
  const e = store.getState().entities.find((x) => x.id === id);
  if (!e) return;
  try {
    const canvas = await entityCanvas(e, store);
    if (!canvas) {
      toast({ status: 'warning', title: t('canvas.toast.entityEmpty') });
      return;
    }
    downloadFile(await canvasToBlob(canvas), `${t('canvas.entityMenu.exportFileName')}.png`);
    toast({ status: 'success', title: t('canvas.toast.exported') });
  } catch (err) {
    fail(t('canvas.toast.exportFailed'), err);
  }
}

/** Hands a file to the user through an ordinary download (the desktop app's WebView saves it as a browser does). */
function downloadFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Save the canvas inside the bbox as a layered PSD file (see render/psdExport.ts for which layers go in). */
export async function saveCanvasAsPsd(store: CanvasStore = useCanvas) {
  try {
    const data = encodePsd(await buildCanvasPsd(store.getState()));
    const fileName = `${t('canvas.psd.fileName')}.psd`;
    downloadFile(new Blob([data as BlobPart], { type: 'image/vnd.adobe.photoshop' }), fileName);
    toast({ status: 'success', title: t('canvas.toast.psdSaved', { name: fileName }) });
  } catch (err) {
    fail(t('canvas.toast.exportFailed'), err);
  }
}

/** Add an image as a new entity, fitted into `rect` (the bbox by default). */
function addImageEntity(store: CanvasStore, type: EntityType, image: { url: string; name: string | null; width: number; height: number }, rect?: Rect): string {
  const s = store.getState();
  const fit = containIn(image.width, image.height, rect ?? s.bbox);
  return s.addEntity(type, { objects: [{ kind: 'image', id: newId('img'), url: image.url, imageName: image.name, ...fit }] });
}

/**
 * Implementation of the shared `importImage` action. Importing into the Image tab's store also opens the Canvas tab;
 * another store (a comic page) only gets the layer.
 */
export function importImage(image: ImageDTO, target: CanvasImportTarget, store: CanvasStore = useCanvas) {
  const s = store.getState();
  const img = { url: image.url, name: image.name, width: image.width, height: image.height };
  if (target === 'newCanvasRaster' || target === 'newCanvasControl') {
    s.clearCanvas();
    const bbox = { x: 0, y: 0, width: image.width, height: image.height };
    s.setBbox(bbox, { history: false });
    addImageEntity(store, target === 'newCanvasRaster' ? 'raster' : 'control', img, store.getState().bbox);
  } else if (target === 'regional') {
    s.addEntity('regional', {
      refImages: [{ id: newId('rref'), imageName: image.name, imageUrl: image.url, modelKey: null, weight: 1, method: 'full' }],
    });
  } else {
    addImageEntity(store, target, img);
  }
  if (store === useCanvas) {
    const ui = useUi.getState();
    if (ui.activeTab !== 'canvas') ui.setTab('canvas');
    ui.setMainView('canvas', 'canvas');
  }
  toast({ status: 'success', title: t('canvas.toast.imported') });
}

/** Add a picture from the clipboard as a new raster layer. It is saved to the gallery first, because layers hold gallery images. */
export async function pasteImageBlob(blob: Blob, store: CanvasStore = useCanvas) {
  try {
    const image = await backend.saveImageFromUrl(URL.createObjectURL(blob), { boardId: autoAddBoardId() });
    useGallery.getState().addImage(image);
    importImage(image, 'raster', store);
  } catch (err) {
    fail(t('canvas.toast.pasteFailed'), err);
  }
}

/**
 * Fill the closed shape drawn with the lasso (flat `x, y` points in the layer's space) with the fill color. The shape
 * is kept as a picture the size of its outline, so a mask or a raster layer takes it like any other picture.
 */
export async function fillPolygon(entityId: string, points: readonly number[], store: CanvasStore = useCanvas) {
  if (points.length < 6) return;
  try {
    const xs = points.filter((_, i) => i % 2 === 0);
    const ys = points.filter((_, i) => i % 2 === 1);
    const x = Math.floor(Math.min(...xs));
    const y = Math.floor(Math.min(...ys));
    const width = Math.ceil(Math.max(...xs)) - x;
    const height = Math.ceil(Math.max(...ys)) - y;
    if (width < 1 || height < 1) return;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.fillStyle = rgbaCss(store.getState().fillColor);
    ctx.beginPath();
    ctx.moveTo(points[0]! - x, points[1]! - y);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i]! - x, points[i + 1]! - y);
    ctx.closePath();
    ctx.fill();
    const url = await canvasToUrl(canvas);
    await preloadImages([url]);
    store.getState().addObject(entityId, { kind: 'image', id: newId('img'), url, imageName: null, x, y, width, height });
  } catch (err) {
    fail(t('canvas.toast.transformFailed'), err);
  }
}

/** Add a gallery image as a global reference image (IP-Adapter). */
export function addGlobalRefImage(image: ImageDTO | null) {
  const p = useParams.getState();
  p.addRefImage({ modelKey: defaultRefModelKey(p.modelKey), ...(image ? { imageName: image.name, imageUrl: image.url } : {}) });
}

/** Largest side a layer picture may grow to when scaled up. */
const MAX_LAYER_SIDE = 8192;

/**
 * Turn a raster or control layer by a quarter, or scale it by 2 or 1/2: the layer is flattened into one picture and
 * drawn again, so strokes and rects become pixels (like merging). Masks keep their shape and are left alone.
 */
export async function transformEntity(id: string, op: LayerTransform, store: CanvasStore = useCanvas) {
  const e = store.getState().entities.find((x) => x.id === id);
  if (!e || (e.type !== 'raster' && e.type !== 'control') || e.isLocked || isSlot(e)) return;
  // A layer of poses only stays editable: its joints are turned or scaled instead of its pixels.
  const bounds = objectsBounds(e.objects);
  if (bounds && e.objects.every((o) => o.kind === 'pose')) {
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    store.getState().updateEntity(id, { objects: e.objects.map((o) => (o.kind === 'pose' ? transformPose(o, op, center) : o)) });
    return;
  }
  try {
    await preloadImages(imageUrlsOf([e]));
    const src = renderEntity(e.type === 'control' ? { ...e, withTransparencyEffect: false } : e);
    if (!src) {
      toast({ status: 'warning', title: t('canvas.toast.entityEmpty') });
      return;
    }
    const dest = transformedRect(src, op);
    if (Math.max(dest.width, dest.height) > MAX_LAYER_SIDE) {
      toast({ status: 'warning', title: t('canvas.toast.layerTooLarge') });
      return;
    }
    const out = createCanvas(dest.width, dest.height);
    const ctx = out.getContext('2d') as CanvasRenderingContext2D;
    ctx.translate(out.width / 2, out.height / 2);
    if (op === 'rotateRight') ctx.rotate(Math.PI / 2);
    if (op === 'rotateLeft') ctx.rotate(-Math.PI / 2);
    const k = op === 'scaleUp' ? 2 : op === 'scaleDown' ? 0.5 : 1;
    ctx.drawImage(src.canvas, (-src.width * k) / 2, (-src.height * k) / 2, src.width * k, src.height * k);
    const url = await canvasToUrl(out);
    await preloadImages([url]);
    store.getState().updateEntity(id, { objects: [{ kind: 'image', id: newId('img'), url, imageName: null, ...dest }] });
  } catch (err) {
    fail(t('canvas.toast.transformFailed'), err);
  }
}

/**
 * A new control layer set up to follow poses, with an OpenPose model when one fits the main model. Poses are lines on
 * a transparent layer, so the transparency effect (which fades their dimmed bones) is off.
 */
export function addPoseLayer(store: CanvasStore = useCanvas): string {
  const model = pickPoseModel(useModels.getState().models, findModel(useParams.getState().modelKey)?.base ?? null);
  return store.getState().addEntity('control', {
    ...POSE_CONTROL,
    beginEnd: [...POSE_CONTROL.beginEnd],
    withTransparencyEffect: false,
    ...(model ? { modelKey: model.key } : {}),
  });
}

/**
 * Give every pose of a control layer a new random shape in its place, or add one random pose filling the generation
 * area when the layer has none. When `id` is not a control layer, a new control layer is made. Each call gives a
 * different pose.
 */
export function randomizePoses(id: string | null, rand: () => number = seededRandom(Math.floor(Math.random() * 2 ** 32)), store: CanvasStore = useCanvas) {
  const s = store.getState();
  let e = s.entities.find((x) => x.id === id);
  if (e?.type !== 'control') {
    const created = addPoseLayer(store);
    e = store.getState().entities.find((x) => x.id === created);
  }
  if (!e) return;
  if (e.isLocked) {
    toast({ status: 'warning', title: t('canvas.toast.layerLocked') });
    return;
  }
  const st = store.getState();
  if (e.objects.some((o) => o.kind === 'pose')) {
    st.updateEntity(e.id, { objects: e.objects.map((o) => (o.kind === 'pose' ? rerollPose(o, rand) : o)) });
    return;
  }
  const b = st.bbox;
  const margin = Math.round(Math.min(b.width, b.height) * 0.05);
  const area = { x: b.x - e.x + margin, y: b.y - e.y + margin, width: b.width - margin * 2, height: b.height - margin * 2 };
  st.addObject(e.id, randomPose(newId('pose'), rand, area, poseLineWidth(b)));
}

/** Most pictures one batch of random poses may queue. */
export const MAX_POSE_BATCH = 16;

/**
 * Queue `count` generations, each with a new random pose on the selected control layer (a new layer when none is
 * selected). It uses the canvas's own request builder, so it keeps working if the user switches tabs meanwhile.
 * Stops with one warning when the canvas cannot be invoked, and with one error when a request fails. Image tab only:
 * the request builder reads the global `useCanvas`.
 */
export async function generateWithRandomPoses(count: number) {
  const reasons = readinessOf('canvas');
  if (reasons.length) {
    toast({ status: 'warning', title: t('app.invoke.notReady'), description: reasons.join('\n') });
    return;
  }
  const total = Math.min(MAX_POSE_BATCH, Math.max(1, Math.round(count)));
  let queued = 0;
  try {
    for (let i = 0; i < total; i++) {
      randomizePoses(useCanvas.getState().selectedEntityId);
      const request = await buildRequestFor('canvas');
      if (!request) return;
      queued += (await backend.enqueue(request)).length;
    }
    toast({ status: 'success', title: t('app.invoke.enqueued', { count: queued }) });
  } catch (err) {
    toast({ status: 'error', title: t('app.invoke.failed'), description: String(err instanceof Error ? err.message : err) });
  }
}

/** Most people one assistant answer may place. */
const MAX_POSE_PEOPLE = 4;

/**
 * Put the people the assistant described on a control layer: the selected one (or a new one), replacing its poses
 * unless `add`. One undo step. False when nothing usable was described.
 */
export function setPoses(people: unknown[], add: boolean, store: CanvasStore = useCanvas): boolean {
  const specs = people.map(readPoseSpec).filter((p): p is PoseSpec => p !== null).slice(0, MAX_POSE_PEOPLE);
  if (!specs.length) return false;
  const s = store.getState();
  const selected = s.entities.find((x) => x.id === s.selectedEntityId);
  const id = selected?.type === 'control' && !selected.isLocked ? selected.id : addPoseLayer(store);
  const e = store.getState().entities.find((x) => x.id === id);
  if (!e) return false;
  const b = store.getState().bbox;
  const area = { x: b.x - e.x, y: b.y - e.y, width: b.width, height: b.height };
  const kept = add ? e.objects : e.objects.filter((o) => o.kind !== 'pose');
  const placed = specs.map((spec) => placePose(newId('pose'), spec, area, poseLineWidth(b)));
  store.getState().updateEntity(id, { objects: [...kept, ...placed] });
  store.getState().select(id);
  return true;
}

/**
 * Put a ready-made pose on the selected control layer. A single pose gives the first pose of the layer a new shape in
 * the same place and size (the other poses stay); with no pose there, it fills the middle of the generation box, on a
 * new layer when no control layer is selected. A composition (people with their places and sizes) replaces every pose
 * of the layer. One undo step. False for an unknown preset or a locked layer.
 */
export function applyPosePreset(presetId: string, store: CanvasStore = useCanvas): boolean {
  const preset = POSE_PRESETS.find((p) => p.id === presetId);
  if (!preset) return false;
  const s = store.getState();
  const selected = s.entities.find((x) => x.id === s.selectedEntityId);
  if (selected?.isLocked && selected.type === 'control') {
    toast({ status: 'warning', title: t('canvas.toast.layerLocked') });
    return false;
  }
  const id = selected?.type === 'control' ? selected.id : addPoseLayer(store);
  const e = store.getState().entities.find((x) => x.id === id);
  if (!e) return false;
  const b = store.getState().bbox;
  const area = { x: b.x - e.x, y: b.y - e.y, width: b.width, height: b.height };
  const first = e.objects.find((o): o is PoseObject => o.kind === 'pose');
  const width = first?.width ?? poseLineWidth(b);
  if (preset.composed) {
    const placed = placePreset(preset, area, width, preset.people.map(() => newId('pose')));
    store.getState().updateEntity(id, { objects: [...e.objects.filter((o) => o.kind !== 'pose'), ...placed] });
    store.getState().select(id);
    return true;
  }
  const where: { x?: number; y?: number; size?: number } = first ? (({ x, y, size }) => ({ x, y, size }))(poseToSpec(first, area)) : {};
  const [next] = placePreset(preset, area, width, [first?.id ?? newId('pose')], where);
  if (!next) return false;
  store.getState().updateEntity(id, { objects: first ? e.objects.map((o) => (o === first ? next : o)) : [...e.objects, next] });
  store.getState().select(id);
  return true;
}

/**
 * Put the people found in a picture on a control layer (the selected one, else a new one), the picture fitted inside the
 * generation box. Replaces the layer's poses unless `add`. One undo step. False when the picture held nobody.
 */
export function placeExtractedPoses(found: ExtractedPoses, add: boolean, store: CanvasStore = useCanvas): boolean {
  if (!found.people.length) return false;
  const s = store.getState();
  const selected = s.entities.find((x) => x.id === s.selectedEntityId);
  const id = selected?.type === 'control' && !selected.isLocked ? selected.id : addPoseLayer(store);
  const e = store.getState().entities.find((x) => x.id === id);
  if (!e) return false;
  const b = store.getState().bbox;
  const area = { x: b.x - e.x, y: b.y - e.y, width: b.width, height: b.height };
  const kept = add ? e.objects : e.objects.filter((o) => o.kind !== 'pose');
  const placed = found.people.map((p) => placeExtractedPerson(newId('pose'), p, found.aspect, area, poseLineWidth(b)));
  store.getState().updateEntity(id, { objects: [...kept, ...placed] });
  store.getState().select(id);
  return true;
}

/** What the assistant is told about the poses on the selected control layer (empty when there are none). */
export function posesForAssistant(store: CanvasStore = useCanvas): { poses: PoseSpec[] } {
  const s = store.getState();
  const e = s.entities.find((x) => x.id === s.selectedEntityId);
  if (e?.type !== 'control') return { poses: [] };
  const area = { x: s.bbox.x - e.x, y: s.bbox.y - e.y, width: s.bbox.width, height: s.bbox.height };
  return { poses: e.objects.flatMap((o) => (o.kind === 'pose' ? [poseToSpec(o, area)] : [])) };
}

/**
 * Invert a mask inside the generation area: what was masked becomes clear and the rest becomes masked. The mask is
 * redrawn as one picture the size of the area.
 */
export async function invertMask(id: string, store: CanvasStore = useCanvas) {
  const s = store.getState();
  const e = s.entities.find((x) => x.id === id);
  if (!e || (e.type !== 'inpaint' && e.type !== 'regional') || e.isLocked) return;
  try {
    await preloadImages(imageUrlsOf([e]));
    const area = { x: s.bbox.x - e.x, y: s.bbox.y - e.y, width: s.bbox.width, height: s.bbox.height };
    const out = createCanvas(area.width, area.height);
    const ctx = out.getContext('2d') as CanvasRenderingContext2D;
    const src = renderEntity(e);
    if (src) ctx.drawImage(src.canvas, src.x - area.x, src.y - area.y, src.width, src.height);
    // Painting an opaque layer with "xor" keeps it only where nothing was drawn.
    ctx.globalCompositeOperation = 'xor';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, out.width, out.height);
    const url = await canvasToUrl(out);
    await preloadImages([url]);
    store.getState().updateEntity(id, { objects: [{ kind: 'image', id: newId('img'), url, imageName: null, ...area }] });
  } catch (err) {
    fail(t('canvas.toast.transformFailed'), err);
  }
}

// Staging --------------------------------------------------------------------

function currentStagedImage(store: CanvasStore): ImageDTO | undefined {
  const s = store.getState();
  return findImage(s.stagedImageNames[s.stagedIndex] ?? null);
}

async function deleteIntermediates(names: string[]) {
  const gallery = useGallery.getState();
  const doomed = names.filter((n) => gallery.images.find((i) => i.name === n)?.isIntermediate);
  if (!doomed.length) return;
  try {
    await backend.deleteImages(doomed);
    useGallery.getState().removeImages(doomed);
  } catch {
    // Leftover intermediates are harmless.
  }
}

export function acceptStaged(store: CanvasStore = useCanvas) {
  const s = store.getState();
  const image = currentStagedImage(store);
  if (!image) return;
  const rest = s.stagedImageNames.filter((n) => n !== image.name);
  addImageEntity(store, 'raster', { url: image.url, name: image.name, width: image.width, height: image.height }, s.bbox);
  s.clearStaged();
  void deleteIntermediates(rest);
}

export function discardCurrentStaged(store: CanvasStore = useCanvas) {
  const s = store.getState();
  const name = s.stagedImageNames[s.stagedIndex];
  if (name === undefined) return;
  s.discardStaged(s.stagedIndex);
  void deleteIntermediates([name]);
}

export function discardAllStaged(store: CanvasStore = useCanvas) {
  const s = store.getState();
  const names = s.stagedImageNames;
  s.clearStaged();
  void deleteIntermediates(names);
}

/** The staged result kept in the gallery (it is an intermediate until then), for dragging it onto another target. */
export async function stagedAsGalleryImage(store: CanvasStore = useCanvas): Promise<string | null> {
  const image = currentStagedImage(store);
  if (!image) return null;
  if (!image.isIntermediate) return image.name;
  try {
    const updated = await backend.updateImages([image.name], { isIntermediate: false, boardId: autoAddBoardId() });
    useGallery.getState().upsertImages(updated);
    return image.name;
  } catch (err) {
    fail(t('canvas.toast.saveFailed'), err);
    return null;
  }
}

export async function saveStagedToGallery(store: CanvasStore = useCanvas) {
  const image = currentStagedImage(store);
  if (!image) return;
  try {
    const updated = await backend.updateImages([image.name], { isIntermediate: false, boardId: autoAddBoardId() });
    useGallery.getState().upsertImages(updated);
    toast({ status: 'success', title: t('canvas.toast.savedToGallery') });
  } catch (err) {
    fail(t('canvas.toast.saveFailed'), err);
  }
}

// Control filters ------------------------------------------------------------

export async function processFilter(id: string, store: CanvasStore = useCanvas) {
  const s = store.getState();
  const e = s.entities.find((x): x is ControlEntity => x.id === id && x.type === 'control');
  if (!e) return;
  if (e.filter === 'none') {
    s.setFilterPreview(id, null);
    return;
  }
  await preloadImages(imageUrlsOf([e]));
  const raw = renderEntity({ ...e, withTransparencyEffect: false });
  if (!raw) {
    toast({ status: 'warning', title: t('canvas.toast.entityEmpty') });
    return;
  }
  const flat = createCanvas(raw.width, raw.height);
  (flat.getContext('2d') as CanvasRenderingContext2D).drawImage(raw.canvas, 0, 0);
  const processed = applyFilter(e.filter, flat);
  const url = await canvasToUrl(processed);
  await preloadImages([url]);
  store.getState().setFilterPreview(id, { url, x: raw.x, y: raw.y, width: raw.width, height: raw.height });
}

export function applyFilterPreview(id: string, store: CanvasStore = useCanvas) {
  const s = store.getState();
  const p = s.filterPreviews[id];
  if (!p) return;
  s.updateEntity(id, { objects: [{ kind: 'image', id: newId('img'), url: p.url, imageName: null, x: p.x, y: p.y, width: p.width, height: p.height }], filter: 'none' });
  s.setFilterPreview(id, null);
}

// Raster layer pixels: filters and the bucket ----------------------------------------------------------------------

/** The raster layer a pixel action works on, with the reason in a toast when it cannot: locked, hidden, a slot or no raster. */
function pixelTarget(id: string | null, store: CanvasStore): CanvasEntity | null {
  const s = store.getState();
  const e = s.entities.find((x) => x.id === id);
  if (!e || e.type !== 'raster') {
    toast({ status: 'warning', title: t('canvas.toast.rasterOnly') });
    return null;
  }
  if (isSlot(e)) {
    toast({ status: 'warning', title: t('canvas.toast.slotLayer') });
    return null;
  }
  if (e.isLocked) {
    toast({ status: 'warning', title: t('canvas.toast.layerLocked') });
    return null;
  }
  return e;
}

/** Puts a canvas drawn at `rect` (document space) in place of all of a layer's objects, as one picture: one undo step. */
async function replaceWithPicture(store: CanvasStore, e: CanvasEntity, canvas: HTMLCanvasElement, rect: Rect) {
  const url = await canvasToUrl(canvas);
  await preloadImages([url]);
  store.getState().updateEntity(e.id, { objects: [{ kind: 'image', id: newId('img'), url, imageName: null, x: rect.x - e.x, y: rect.y - e.y, width: rect.width, height: rect.height }] });
}

/**
 * Applies a filter (blur, grayscale, invert) to the pixels of a raster layer, which becomes one picture (a blur spreads past
 * the old edge). The layer's opacity and blend are not part of it. One undo step. False when nothing was changed.
 */
export async function applyRasterFilter(id: string | null, filter: RasterFilter, store: CanvasStore = useCanvas): Promise<boolean> {
  const e = pixelTarget(id, store);
  if (!e) return false;
  try {
    await preloadImages(imageUrlsOf([e]));
    const r = renderEntity(e);
    if (!r) {
      toast({ status: 'warning', title: t('canvas.toast.entityEmpty') });
      return false;
    }
    const margin = filterMargin(filter);
    const out = filterCanvas(r.canvas, filter);
    await replaceWithPicture(store, e, out, { x: e.x + r.x - margin, y: e.y + r.y - margin, width: out.width, height: out.height });
    return true;
  } catch (err) {
    fail(t('canvas.toast.filterFailed'), err);
    return false;
  }
}

/**
 * The bucket: fills the region of a raster layer around the document point `at` whose colours are within the store's
 * tolerance of the pressed pixel's, with the fill colour. The region is read from the layer's own pixels inside `area` (the
 * generation box on the Image tab, the page on a comic page), so an empty part of the layer is filled up to the area's edge.
 * The fill reaches one pixel under the edge of the lines around it and is put under the layer's own pixels; the layer becomes
 * one picture. One undo step. False when nothing was filled.
 */
export async function bucketFill(id: string | null, at: { x: number; y: number }, area: Rect, store: CanvasStore = useCanvas): Promise<boolean> {
  const e = pixelTarget(id, store);
  if (!e) return false;
  const sx = Math.floor(at.x - area.x);
  const sy = Math.floor(at.y - area.y);
  if (sx < 0 || sy < 0 || sx >= area.width || sy >= area.height) return false;
  try {
    await preloadImages(imageUrlsOf([e]));
    const r = renderEntity(e);
    // The layer's own pixels over the area, without its opacity or blend.
    const layer = createCanvas(area.width, area.height);
    const lctx = layer.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    if (r) lctx.drawImage(r.canvas, e.x + r.x - area.x, e.y + r.y - area.y, r.width, r.height);
    const pixels = lctx.getImageData(0, 0, area.width, area.height);
    const region = floodFillRegion(pixels.data, area.width, area.height, sx, sy, store.getState().bucketTolerance);
    if (!region) return false;
    const grown = growRegion(region, area.width, area.height);
    const fill = createCanvas(grown.bounds.width, grown.bounds.height);
    const fctx = fill.getContext('2d') as CanvasRenderingContext2D;
    const data = fctx.createImageData(grown.bounds.width, grown.bounds.height);
    data.data.set(regionPixels(grown, area.width, store.getState().fillColor));
    fctx.putImageData(data, 0, 0);
    // The picture covers what the layer drew and what is filled.
    const filled = { x: area.x + grown.bounds.x, y: area.y + grown.bounds.y, width: grown.bounds.width, height: grown.bounds.height };
    const drawn = r ? { x: e.x + r.x, y: e.y + r.y, width: r.width, height: r.height } : filled;
    const x = Math.min(filled.x, drawn.x);
    const y = Math.min(filled.y, drawn.y);
    const rect = { x, y, width: Math.max(filled.x + filled.width, drawn.x + drawn.width) - x, height: Math.max(filled.y + filled.height, drawn.y + drawn.height) - y };
    const out = createCanvas(rect.width, rect.height);
    const octx = out.getContext('2d') as CanvasRenderingContext2D;
    octx.drawImage(fill, filled.x - x, filled.y - y);
    if (r) octx.drawImage(r.canvas, drawn.x - x, drawn.y - y, r.width, r.height);
    await replaceWithPicture(store, e, out, rect);
    return true;
  } catch (err) {
    fail(t('canvas.toast.bucketFailed'), err);
    return false;
  }
}
