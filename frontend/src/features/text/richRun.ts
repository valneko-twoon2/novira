// "Finish with AI" for a text layer: draws the letters, makes the lit base and the line picture, runs the model once per
// candidate, cuts each result to the letters and puts it on the layer as its fill. The picture is an intermediate (hidden from
// the boards); the layer keeps its name, so the lettering stays editable and the outlines stay vector.
import { create } from 'zustand';
import { backend, loadImage, randomSeed, type ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { ensureFont } from '@/state/fonts';
import { useGallery } from '@/state/gallery';
import { modelProfile } from '@/state/modelProfile';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { runJob } from '@/state/comfy/runGraph';
import { toast } from '@/state/toasts';
import { useRichForm } from '@/state/text/richForm';
import { RICH_LOOKS, RICH_NEUTRAL_BG } from '@/state/text/richLooks';
import { useTextEditor } from '@/state/text/textEditor';
import { RICH_CANDIDATES_MAX, richSourceKey, type RichFill, type TextLayer } from '@/state/text/textModel';
import { measureCtx } from './canvasDraw';
import { drawWhiteGlyphs, letterHalfSize } from './render';
import { richFrame, type RichFrame } from './richFrame';
import { alphaOf, bevelBase, cutPicture, lineMap, parseColor } from './richPixels';
import { buildRichRequest, richPlan } from './richRequest';

interface RunState {
  /** Layers with a run going, and how far each has come. */
  running: Record<string, { done: number; total: number }>;
}

export const useRichRun = create<RunState>()(() => ({ running: {} }));

const controllers = new Map<string, AbortController>();

function setProgress(layerId: string, progress: { done: number; total: number } | null): void {
  const running = { ...useRichRun.getState().running };
  if (progress) running[layerId] = progress;
  else delete running[layerId];
  useRichRun.setState({ running });
}

/** Stops the run of a layer (the job in the queue is cancelled); pictures already made stay. */
export function cancelRich(layerId: string): void {
  controllers.get(layerId)?.abort();
}

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

/** The colour of the letters in the base picture: the look's, else the layer's own fill (a gradient counts as its top colour). */
function letterColour(layer: TextLayer, look: keyof typeof RICH_LOOKS | null): string {
  if (look) return RICH_LOOKS[look].fg;
  return layer.style.fill.kind === 'solid' ? layer.style.fill.color : layer.style.fill.top;
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

/** Makes `count` candidates for the layer from the form's settings; resolves when done, cancelled or failed (a failure is a toast). */
export async function runRich(layerId: string): Promise<void> {
  if (controllers.has(layerId)) return;
  const layer = useTextEditor.getState().scene.layers.find((l) => l.id === layerId);
  if (!layer || layer.type !== 'text' || layer.text.trim() === '') return;
  const form = useRichForm.getState().form;
  const plan = richPlan(useModels.getState().models, form.modelKey, useParams.getState().modelKey);
  if (!plan.model) return;
  const model = plan.model;
  const controller = new AbortController();
  controllers.set(layerId, controller);
  const total = form.count;
  setProgress(layerId, { done: 0, total });
  const helpers: string[] = [];
  const sourceKey = richSourceKey(layer);
  const fontSize = layer.style.fontSize;
  try {
    await ensureFont(layer.style.fontFamily, layer.style.fontWeight, layer.text);
    const profile = modelProfile(model);
    const frame = richFrame(glyphReach(layer), fontSize, profile.width * profile.height);
    const { canvas: shape, ctx: sctx } = canvasOf(frame.width, frame.height);
    drawWhiteGlyphs(sctx, layer, frame.scale);
    const glyphs = alphaOf(sctx.getImageData(0, 0, frame.width, frame.height).data);

    const look = form.look;
    const base = bevelBase(glyphs, frame.width, frame.height, parseColor(letterColour(layer, look)), parseColor(look ? RICH_LOOKS[look].bg : RICH_NEUTRAL_BG));
    const upload = async (blob: Blob, category: ImageDTO['category']) => backend.uploadImage(blob, { boardId: null, isIntermediate: true, category });
    const source = await upload(await pixelsToBlob(base, frame.width, frame.height), 'control');
    helpers.push(source.name);
    let lineUrl: string | null = null;
    if (plan.control) {
      const line = await upload(await pixelsToBlob(lineMap(glyphs, frame.width, frame.height), frame.width, frame.height), 'control');
      helpers.push(line.name);
      lineUrl = line.url;
    }
    shape.width = 0;

    for (let i = 0; i < total; i++) {
      const request = buildRichRequest({
        model,
        control: plan.control,
        look,
        words: form.words,
        strength: form.strength,
        seed: randomSeed(),
        sourceUrl: source.url,
        lineUrl,
        width: frame.width,
        height: frame.height,
      });
      const result = await runJob(request, controller.signal);
      helpers.push(result.name);
      const picture = await loadImage(result.url);
      const { canvas: out, ctx: octx } = canvasOf(frame.width, frame.height);
      octx.drawImage(picture, 0, 0, frame.width, frame.height);
      const pixels = octx.getImageData(0, 0, frame.width, frame.height).data;
      const cut = await pixelsToBlob(cutPicture(pixels, glyphs, frame.width, frame.height, form.spill), frame.width, frame.height);
      out.width = 0;
      const stored = await upload(cut, 'general');
      useGallery.getState().upsertImages([stored]);
      if (!applyPicture(layerId, stored, frame, fontSize, sourceKey, i === 0)) {
        void backend.deleteImages([stored.name]).catch(() => undefined);
        break;
      }
      setProgress(layerId, { done: i + 1, total });
    }
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      toast({ status: 'error', title: t('text.rich.failed'), description: String(err instanceof Error ? err.message : err) });
    }
  } finally {
    controllers.delete(layerId);
    setProgress(layerId, null);
    if (helpers.length) void backend.deleteImages(helpers).catch(() => undefined);
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
