// What an inpaint mask can do to the picture under it besides a generation: erase the painted part (filled from its
// surroundings by ComfyUI, the result lands in staging) or cut it out as a picture of its own in the gallery.
import { backend, type ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { useCanvas, type CanvasStore, type InpaintEntity } from '@/state/canvas';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { ERASE_NODE, ERASE_PACK, buildEraseGraph, lamaModel } from '@/state/comfy/erase';
import { graphRequest } from '@/state/comfy/graphJob';
import { PACK_CATALOG } from '@/state/comfy/packCatalog';
import { catalogPackName, packMissing } from '@/state/comfy/packNeeds';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { runJob } from '@/state/comfy/runGraph';
import { useGallery } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';
import { usePacks } from '@/state/media/packs';
import { toast } from '@/state/toasts';
import { canvasToBlob, compositeRect, imageUrlsOf } from '@/ui/canvasDraw/composite';
import { createCanvas, renderMaskShape } from '@/ui/canvasDraw/entityRender';
import { preloadImages } from '@/ui/canvasDraw/imageCache';
import { visibleEntities } from './render/composite';
import { maskIsEmpty } from './render/maskPixels';

function fail(title: string, err: unknown) {
  toast({ status: 'error', title, description: String(err instanceof Error ? err.message : err) });
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  return c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
}

/** The visible raster layers inside the bbox, and the mask's painted part there (white on black), or null when nothing is painted. */
async function pictureAndMask(store: CanvasStore, id: string): Promise<{ picture: HTMLCanvasElement; mask: HTMLCanvasElement } | null> {
  const s = store.getState();
  const e = s.entities.find((x): x is InpaintEntity => x.id === id && x.type === 'inpaint');
  if (!e) return null;
  await preloadImages(imageUrlsOf([e]));
  const mask = createCanvas(s.bbox.width, s.bbox.height);
  const mctx = ctx2d(mask);
  mctx.fillStyle = '#000000';
  mctx.fillRect(0, 0, mask.width, mask.height);
  const shape = renderMaskShape(e, 255);
  if (shape) mctx.drawImage(shape.canvas, e.x + shape.x - s.bbox.x, e.y + shape.y - s.bbox.y, shape.width, shape.height);
  if (maskIsEmpty(mctx.getImageData(0, 0, mask.width, mask.height).data)) return null;
  const picture = await compositeRect(visibleEntities(s, ['raster']), s.bbox);
  return { picture, mask };
}

function nothingPainted() {
  toast({ status: 'warning', title: t('canvas.partFix.empty') });
}

/** Why the erase node is not there yet, as a toast with the step that fixes it. */
function eraseNeedsPack() {
  const url = PACK_CATALOG.find((p) => p.id === ERASE_PACK)?.url ?? '';
  const installed = !packMissing(ERASE_PACK);
  const packs = useNodePacks.getState();
  toast({
    status: 'warning',
    title: t('canvas.partFix.eraseNeedsPack', { pack: catalogPackName(ERASE_PACK) }),
    actions: [installed ? { label: t('canvas.partFix.restart'), run: () => void packs.restart() } : { label: t('canvas.partFix.install'), run: () => void packs.install(url) }],
  });
}

/** The LaMa model makes the fill natural; without it the result is plainer, so offer it once with the result. */
function lamaOffer(): { description?: string; actions?: { label: string; run: () => void }[] } {
  if (lamaModel(useComfyNodes.getState().defs) || usePacks.getState().packs.inpaint.state !== 'missing') return {};
  return { description: t('canvas.partFix.lamaOffer'), actions: [{ label: t('canvas.partFix.lamaGet'), run: () => void backend.installPack('inpaint') }] };
}

async function upload(canvas: HTMLCanvasElement): Promise<ImageDTO> {
  return backend.uploadImage(await canvasToBlob(canvas), { boardId: null, isIntermediate: true });
}

/** Erases what the mask covers in the visible picture; the result is staged inside the bbox like a generation. */
export async function eraseMaskedPart(id: string, store: CanvasStore = useCanvas): Promise<void> {
  const nodes = useComfyNodes.getState();
  await nodes.load();
  if (!useComfyNodes.getState().defs?.[ERASE_NODE]) {
    eraseNeedsPack();
    return;
  }
  const inputs = await pictureAndMask(store, id);
  if (!inputs) {
    nothingPainted();
    return;
  }
  const helpers: string[] = [];
  try {
    const picture = await upload(inputs.picture);
    helpers.push(picture.name);
    const mask = await upload(inputs.mask);
    helpers.push(mask.name);
    toast({ status: 'info', title: t('canvas.partFix.erasing') });
    const graph = buildEraseGraph(picture.name, mask.name, { lama: lamaModel(useComfyNodes.getState().defs) });
    const result = await runJob(graphRequest(graph, 'intermediate'));
    useGallery.getState().upsertImages([result]);
    store.getState().addStagedImage(result.name);
    toast({ status: 'success', title: t('canvas.partFix.erased'), ...lamaOffer() });
  } catch (err) {
    fail(t('canvas.partFix.failed'), err);
  } finally {
    if (helpers.length) void backend.deleteImages(helpers).catch(() => undefined);
  }
}

/** Saves what the mask covers in the visible picture as a picture of its own (transparent elsewhere) to the gallery. */
export async function cutOutMaskedPart(id: string, store: CanvasStore = useCanvas): Promise<void> {
  try {
    const inputs = await pictureAndMask(store, id);
    if (!inputs) {
      nothingPainted();
      return;
    }
    const out = createCanvas(inputs.picture.width, inputs.picture.height);
    const ctx = ctx2d(out);
    ctx.drawImage(inputs.mask, 0, 0);
    // The mask is white on black; its brightness becomes the cut-out's alpha.
    const data = ctx.getImageData(0, 0, out.width, out.height);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = data.data[i] as number;
      data.data[i] = 255;
      data.data[i + 1] = 255;
      data.data[i + 2] = 255;
      data.data[i + 3] = v;
    }
    ctx.putImageData(data, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(inputs.picture, 0, 0);
    const saved = await backend.uploadImage(await canvasToBlob(out), { boardId: autoAddBoardId() });
    useGallery.getState().addImage(saved);
    toast({ status: 'success', title: t('canvas.partFix.cutOut') });
  } catch (err) {
    fail(t('canvas.partFix.failed'), err);
  }
}
