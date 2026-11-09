// "Finish with AI" for a text layer: draws the letters, makes the lit base and the line picture, queues one batch like the Generate
// button does, and as each picture comes back cuts it to the letters and puts it on the layer as its fill. The picture is an
// intermediate (hidden from the boards); the layer keeps its name, so the lettering stays editable and the outlines stay vector.
import { create } from 'zustand';
import { backend, loadImage, randomSeed, type BackendEvent, type EnqueueRequest, type ImageDTO, type QueueItem } from '@/backend';
import { t } from '@/i18n';
import { ensureFont } from '@/state/fonts';
import { useGallery } from '@/state/gallery';
import { modelProfile } from '@/state/modelProfile';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { toast } from '@/state/toasts';
import { useRichForm } from '@/state/text/richForm';
import { useTextEditor } from '@/state/text/textEditor';
import { RICH_CANDIDATES_MAX, richSourceKey, type RichFill, type TextLayer } from '@/state/text/textModel';
import { measureCtx } from './canvasDraw';
import { drawWhiteGlyphs, letterHalfSize } from './render';
import { richFrame, type RichFrame } from './richFrame';
import { alphaOf, bevelBase, cutPicture, lineMap, parseColor } from './richPixels';
import { buildRichRequest, richPlan } from './richRequest';

/** The ground around the letters in the base picture. */
const NEUTRAL_GROUND = '#101014';

interface RunState {
  /** Layers with pictures on the way, and how far those have come. */
  running: Record<string, { done: number; total: number }>;
}

export const useRichRun = create<RunState>()(() => ({ running: {} }));

function addProgress(layerId: string, done: number, total: number): void {
  const running = { ...useRichRun.getState().running };
  const next = { done: (running[layerId]?.done ?? 0) + done, total: (running[layerId]?.total ?? 0) + total };
  if (next.done >= next.total) delete running[layerId];
  else running[layerId] = next;
  useRichRun.setState({ running });
}

/** One press of Generate: what is needed to turn the batch's pictures into fills of the layer. */
interface Run {
  layerId: string;
  frame: RichFrame;
  glyphs: Float32Array;
  spill: number;
  sourceKey: string;
  fontSize: number;
  /** Pictures of this run the gallery does not list: deleted when the run is over. */
  helpers: string[];
  waiting: Set<number>;
  /** Events that came before the queue told the items' ids. */
  early: BackendEvent[] | null;
  first: boolean;
  failed: boolean;
  /** The layer is gone: what is still queued is cancelled and what still arrives is dropped. */
  gone: boolean;
  /** Pictures are finished one at a time, in the order they arrive. */
  chain: Promise<void>;
  off: () => void;
}

const runs = new WeakMap<EnqueueRequest, Run>();

function canvasOf(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no canvas');
  return { canvas, ctx };
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('empty image'))), 'image/png'));
}

/** RGBA pixels as a PNG. */
async function pixelsToBlob(rgba: Uint8ClampedArray, width: number, height: number): Promise<Blob> {
  const { canvas, ctx } = canvasOf(width, height);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  return toBlob(canvas);
}

/**
 * Half size of what the layer draws (the letters, bent or vertical too) around its centre: the larger reach on each side.
 * Measured by drawing, because a bent line leaves the block's box.
 */
function glyphReach(layer: TextLayer): { hw: number; hh: number } {
  const base = letterHalfSize(measureCtx(), layer);
  const fs = layer.style.fontSize;
  const w = Math.min(4096, Math.ceil((base.hw + fs) * 2));
  const h = Math.min(4096, Math.ceil((base.hh + fs + (layer.bend !== 0 ? base.hw : 0)) * 2));
  const { canvas, ctx } = canvasOf(w, h);
  drawWhiteGlyphs(ctx, layer, 1);
  const data = ctx.getImageData(0, 0, w, h).data;
  let x0 = w;
  let x1 = 0;
  let y0 = h;
  let y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((data[(y * w + x) * 4 + 3] as number) > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  canvas.width = 0;
  if (x1 < x0) return base;
  return { hw: Math.max(w / 2 - x0, x1 + 1 - w / 2), hh: Math.max(h / 2 - y0, y1 + 1 - h / 2) };
}

/** Puts a picture on the layer as its fill. The first picture of a run makes one undo step; the later ones join it. */
function applyPicture(layerId: string, stored: ImageDTO, frame: RichFrame, fontSize: number, sourceKey: string, first: boolean): boolean {
  const editor = useTextEditor.getState();
  const layer = editor.scene.layers.find((l) => l.id === layerId);
  if (!layer || layer.type !== 'text') return false;
  const kept = layer.rich && layer.rich.sourceKey === sourceKey ? layer.rich.candidates : [];
  const rich: RichFill = {
    imageName: stored.name,
    candidates: [stored.name, ...kept.filter((n) => n !== stored.name)].slice(0, RICH_CANDIDATES_MAX),
    width: frame.boxWidth,
    height: frame.boxHeight,
    fontSize,
    sourceKey,
  };
  if (first) editor.checkpoint();
  editor.update(layerId, { rich }, { live: true });
  return true;
}

function deleteHelpers(run: Run): void {
  if (run.helpers.length) void backend.deleteImages(run.helpers).catch(() => undefined);
}

function reportFailure(run: Run, err: unknown): void {
  if (run.failed) return;
  run.failed = true;
  toast({ status: 'error', title: t('text.rich.failed'), description: String(err instanceof Error ? err.message : err) });
}

/** One queue item is over, however it ended. The last one ends the run. */
function settle(run: Run, id: number): void {
  if (!run.waiting.delete(id)) return;
  addProgress(run.layerId, 1, 0);
  if (run.waiting.size > 0) return;
  run.off();
  void run.chain.then(() => deleteHelpers(run));
}

/** Cuts a finished picture to the letters and puts it on the layer. */
async function paint(run: Run, result: ImageDTO): Promise<void> {
  run.helpers.push(result.name);
  if (run.gone) return;
  const { width, height } = run.frame;
  const picture = await loadImage(result.url);
  const { canvas: out, ctx } = canvasOf(width, height);
  ctx.drawImage(picture, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const cut = await pixelsToBlob(cutPicture(pixels, run.glyphs, width, height, run.spill), width, height);
  out.width = 0;
  const stored = await backend.uploadImage(cut, { boardId: null, isIntermediate: true, category: 'general' });
  useGallery.getState().upsertImages([stored]);
  if (applyPicture(run.layerId, stored, run.frame, run.fontSize, run.sourceKey, run.first)) {
    run.first = false;
    return;
  }
  void backend.deleteImages([stored.name]).catch(() => undefined);
  run.gone = true;
  for (const id of run.waiting) void backend.cancelQueueItem(id).catch(() => undefined);
}

function onEvent(run: Run, event: BackendEvent): void {
  if (run.early) {
    run.early.push(event);
    return;
  }
  if (event.type === 'image_added' && event.item && run.waiting.has(event.item.id)) {
    const id = event.item.id;
    run.chain = run.chain
      .then(() => paint(run, event.image))
      .catch((err: unknown) => reportFailure(run, err))
      .finally(() => settle(run, id));
  } else if (event.type === 'queue_item_status_changed' && run.waiting.has(event.item.id)) {
    if (event.item.status === 'failed') reportFailure(run, event.item.error ?? 'failed');
    if (event.item.status === 'failed' || event.item.status === 'canceled') settle(run, event.item.id);
  } else if (event.type === 'queue_cleared') {
    // Clearing sends no status per item; pruning sends the same event and leaves what is still to run.
    const live = new Set(backend.listQueue().filter((i) => i.status === 'pending' || i.status === 'in_progress').map((i) => i.id));
    for (const id of [...run.waiting]) if (!live.has(id)) settle(run, id);
  }
}

/** Prepares the pictures of a layer and builds its batch; null when the layer or the models cannot make one. */
async function buildRich(layerId: string, prepend: boolean): Promise<EnqueueRequest | null> {
  const layer = useTextEditor.getState().scene.layers.find((l) => l.id === layerId);
  if (!layer || layer.type !== 'text' || layer.text.trim() === '') return null;
  const form = useRichForm.getState().form;
  const { iterations, modelKey } = useParams.getState();
  const plan = richPlan(useModels.getState().models, form.modelKey, modelKey);
  if (!plan.model) return null;
  const model = plan.model;
  // A random seed is drawn per run and shown in the seed box afterwards, so a picture that pleased can be made again.
  const firstSeed = form.randomSeed ? randomSeed() : form.seed;
  if (form.randomSeed) useRichForm.getState().setForm({ seed: firstSeed });
  const helpers: string[] = [];
  try {
    const fontSize = layer.style.fontSize;
    await ensureFont(layer.style.fontFamily, layer.style.fontWeight, layer.text);
    const profile = modelProfile(model);
    const frame = richFrame(glyphReach(layer), fontSize, profile.width * profile.height);
    const { canvas: shape, ctx: sctx } = canvasOf(frame.width, frame.height);
    drawWhiteGlyphs(sctx, layer, frame.scale);
    const glyphs = alphaOf(sctx.getImageData(0, 0, frame.width, frame.height).data);
    shape.width = 0;

    const fill = layer.style.fill.kind === 'solid' ? layer.style.fill.color : layer.style.fill.top;
    const base = bevelBase(glyphs, frame.width, frame.height, parseColor(fill), parseColor(NEUTRAL_GROUND));
    const upload = async (blob: Blob) => backend.uploadImage(blob, { boardId: null, isIntermediate: true, category: 'control' });
    const source = await upload(await pixelsToBlob(base, frame.width, frame.height));
    helpers.push(source.name);
    let lineUrl: string | null = null;
    if (plan.control) {
      const line = await upload(await pixelsToBlob(lineMap(glyphs, frame.width, frame.height), frame.width, frame.height));
      helpers.push(line.name);
      lineUrl = line.url;
    }
    const request = buildRichRequest({
      model,
      control: plan.control,
      words: form.words,
      negative: form.negative,
      iterations,
      prepend,
      strength: form.strength,
      seed: firstSeed,
      sourceUrl: source.url,
      lineUrl,
      width: frame.width,
      height: frame.height,
    });
    const run: Run = { layerId, frame, glyphs, spill: form.spill, sourceKey: richSourceKey(layer), fontSize, helpers, waiting: new Set(), early: [], first: true, failed: false, gone: false, chain: Promise.resolve(), off: () => undefined };
    run.off = backend.subscribe((event) => onEvent(run, event));
    runs.set(request, run);
    return request;
  } catch (err) {
    if (helpers.length) void backend.deleteImages(helpers).catch(() => undefined);
    throw err;
  }
}

/** The queue took the batch: follows its items and handles what came meanwhile. */
export function attachRich(items: QueueItem[], built: EnqueueRequest): void {
  const run = runs.get(built);
  if (!run) return;
  items.forEach((item) => run.waiting.add(item.id));
  addProgress(run.layerId, 0, items.length);
  const early = run.early ?? [];
  run.early = null;
  early.forEach((event) => onEvent(run, event));
}

/** The queue refused the batch: nothing will come back for it. */
export function dropRich(built: EnqueueRequest): void {
  const run = runs.get(built);
  if (!run) return;
  run.off();
  deleteHelpers(run);
}

function selectedTextLayer(): TextLayer | null {
  const { scene, selectedId } = useTextEditor.getState();
  const layer = scene.layers.find((l) => l.id === selectedId);
  return layer?.type === 'text' ? layer : null;
}

/** Why Generate cannot paint now; shown in the button's tooltip, as on the Generate screen. */
export function richReadiness(): string[] {
  const form = useRichForm.getState().form;
  if (!richPlan(useModels.getState().models, form.modelKey, useParams.getState().modelKey).model) return [t('text.rich.noModel')];
  return selectedTextLayer()?.text.trim() ? [] : [t('text.rich.select')];
}

/** Tells only when the reasons changed: the editor's store changes with every keystroke and every drag. */
export function subscribeRichReadiness(onChange: () => void): () => void {
  let last = richReadiness().join();
  const check = () => {
    const now = richReadiness().join();
    if (now === last) return;
    last = now;
    onChange();
  };
  const offs = [useTextEditor.subscribe(check), useModels.subscribe(check), useParams.subscribe(check), useRichForm.subscribe(check)];
  return () => offs.forEach((off) => off());
}

/** What the Generate button queues: the selected layer's batch. */
export async function buildSelectedRich(prepend: boolean): Promise<EnqueueRequest> {
  const layer = selectedTextLayer();
  const request = layer && (await buildRich(layer.id, prepend));
  if (!request) throw new Error(t('text.rich.select'));
  return request;
}

/** Queues a batch for a layer without the Generate button (making a stale fill again); a failure is a toast. */
export async function runRich(layerId: string): Promise<void> {
  let request: EnqueueRequest | null = null;
  try {
    request = await buildRich(layerId, false);
    if (request) attachRich(await backend.enqueue(request), request);
  } catch (err) {
    if (request) dropRich(request);
    toast({ status: 'error', title: t('text.rich.failed'), description: String(err instanceof Error ? err.message : err) });
  }
}

/** Makes a candidate the layer's fill (one undo step). */
export function pickRichCandidate(layerId: string, imageName: string): void {
  const layer = useTextEditor.getState().scene.layers.find((l) => l.id === layerId);
  if (!layer || layer.type !== 'text' || !layer.rich || layer.rich.imageName === imageName || !layer.rich.candidates.includes(imageName)) return;
  useTextEditor.getState().update(layerId, { rich: { ...layer.rich, imageName } });
}

/** Back to the style's own fill (one undo step). The pictures stay in the gallery, so undo brings the fill back. */
export function clearRich(layerId: string): void {
  const layer = useTextEditor.getState().scene.layers.find((l) => l.id === layerId);
  if (!layer || layer.type !== 'text' || !layer.rich) return;
  useTextEditor.getState().update(layerId, { rich: undefined });
}
