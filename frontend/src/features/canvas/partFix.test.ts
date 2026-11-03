// @vitest-environment jsdom
// Erasing and cutting out the part an inpaint mask covers. Drawing goes to recorded canvases (getImageData hands out
// black on the left half and white on the right unless a test says otherwise), so these check what is sent, staged
// and reported, not pixels; the e2e spec `partFix.spec.ts` runs the same steps in a browser.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ComfyNodeDefs, type EnqueueRequest, type ImageDTO } from '@/backend';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { t } from '@/i18n';
import { useCanvas } from '@/state/canvas';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { ERASE_NODE } from '@/state/comfy/erase';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { useGallery } from '@/state/gallery';
import { usePacks } from '@/state/media/packs';
import { useToasts } from '@/state/toasts';
import { cutOutMaskedPart, eraseMaskedPart } from './partFix';

vi.mock('@/ui/canvasDraw/imageCache', () => ({
  getImage: () => null,
  imageVersion: () => 0,
  preloadImages: () => Promise.resolve(),
  onImageLoaded: () => () => {},
}));

const runJob = vi.fn<(r: EnqueueRequest) => Promise<ImageDTO>>();
vi.mock('@/state/comfy/runGraph', () => ({ runJob: (r: EnqueueRequest) => runJob(r) }));

const initial = { canvas: useCanvas.getState(), gallery: useGallery.getState(), toasts: useToasts.getState(), nodes: useComfyNodes.getState(), packs: usePacks.getState() };
const c = () => useCanvas.getState();
const lastToast = () => useToasts.getState().toasts.at(-1);
const picture = (name: string, extra: Partial<ImageDTO> = {}) => ({ name, url: `blob:${name}`, thumbnailUrl: 'blob:t', width: 64, height: 64, isIntermediate: true, ...extra }) as ImageDTO;
const red = { r: 255, g: 0, b: 0, a: 1 };
const defs = (nodes: Record<string, unknown>) => nodes as unknown as ComfyNodeDefs;

let canvases: ReturnType<typeof installRecordingCanvases>;
let uploads: ImageDTO[];

function setUp(pixel?: (x: number, y: number, w: number, h: number) => number[]) {
  canvases = installRecordingCanvases(pixel ? { pixel } : {});
}

/** A raster picture and an inpaint mask with one stroke over it; returns the mask's id. */
function paintedMask(objects = true): string {
  c().addEntity('raster', { objects: [{ kind: 'rect', id: 'r', x: 0, y: 0, width: 64, height: 64, color: red }] });
  return c().addEntity('inpaint', { objects: objects ? [{ kind: 'stroke', id: 's', tool: 'brush', color: red, width: 10, points: [10, 10, 40, 40], clip: null }] : [] });
}

beforeEach(() => {
  useCanvas.setState(initial.canvas, true);
  useGallery.setState(initial.gallery, true);
  useToasts.setState(initial.toasts, true);
  useComfyNodes.setState({ ...initial.nodes, status: 'ready', defs: defs({ [ERASE_NODE]: {} }) }, true);
  usePacks.setState(initial.packs, true);
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['png'], { type: 'image/png' }));
  };
  uploads = [];
  vi.spyOn(backend, 'uploadImage').mockImplementation(async (_blob, opts) => {
    const image = picture(`up${uploads.length}.png`, { isIntermediate: !!opts.isIntermediate, boardId: opts.boardId });
    uploads.push(image);
    return image;
  });
  vi.spyOn(backend, 'deleteImages').mockResolvedValue(undefined as never);
  runJob.mockReset();
});
afterEach(() => {
  canvases.restore();
  vi.restoreAllMocks();
});

describe('erasing the painted part', () => {
  it('sends the picture and the mask, stages the result and removes the two helper pictures', async () => {
    setUp();
    runJob.mockResolvedValue(picture('erased.png'));
    await eraseMaskedPart(paintedMask());
    expect(uploads.map((u) => u.isIntermediate)).toEqual([true, true]);
    const graph = runJob.mock.calls[0]![0].comfyGraph!;
    expect(graph.prompt.source!.inputs.image).toEqual({ $image: 'up0.png' });
    expect(graph.prompt.cover!.inputs.image).toEqual({ $image: 'up1.png' });
    expect(runJob.mock.calls[0]![0].destination).toBe('intermediate');
    expect(c().stagedImageNames).toEqual(['erased.png']);
    expect(backend.deleteImages).toHaveBeenCalledWith(['up0.png', 'up1.png']);
    expect(lastToast()).toMatchObject({ status: 'success', title: t('canvas.partFix.erased') });
  });

  it('offers LaMa with the result while its model is missing, and not once it is there', async () => {
    setUp();
    runJob.mockResolvedValue(picture('erased.png'));
    usePacks.setState({ packs: { ...initial.packs.packs, inpaint: { state: 'missing', totalBytes: 1 } } });
    await eraseMaskedPart(paintedMask());
    expect(lastToast()?.actions?.map((a) => a.label)).toEqual([t('canvas.partFix.lamaGet')]);

    useComfyNodes.setState({ defs: defs({ [ERASE_NODE]: {}, INPAINT_LoadInpaintModel: { input: { required: { model_name: [['big-lama.pt']] } } } }) });
    await eraseMaskedPart(c().selectedEntityId!);
    expect(runJob.mock.calls[1]![0].comfyGraph!.prompt.model!.inputs.model_name).toBe('big-lama.pt');
    expect(lastToast()?.actions).toBeUndefined();
  });

  it('says what to do when nothing is painted, and sends nothing', async () => {
    setUp(() => [0, 0, 0, 255]);
    await eraseMaskedPart(paintedMask());
    expect(lastToast()).toMatchObject({ status: 'warning', title: t('canvas.partFix.empty') });
    expect(uploads).toEqual([]);
    expect(runJob).not.toHaveBeenCalled();
  });

  it('offers to install the extension when the erase node is missing, or to restart when it waits for a restart', async () => {
    setUp();
    useComfyNodes.setState({ defs: defs({}) });
    const install = vi.fn(async () => {});
    useNodePacks.setState({ packs: { available: true, installed: [] } as never, install });
    await eraseMaskedPart(paintedMask());
    const toast = lastToast()!;
    expect(toast.status).toBe('warning');
    expect(toast.actions!.map((a) => a.label)).toEqual([t('canvas.partFix.install')]);
    toast.actions![0]!.run();
    expect(install).toHaveBeenCalledWith('https://github.com/Acly/comfyui-inpaint-nodes');

    useNodePacks.setState({ packs: { available: true, installed: [{ folder: 'comfyui-inpaint-nodes', url: null, version: null }] } as never });
    await eraseMaskedPart(c().selectedEntityId!);
    expect(lastToast()!.actions!.map((a) => a.label)).toEqual([t('canvas.partFix.restart')]);
    expect(runJob).not.toHaveBeenCalled();
  });

  it('reports a failed job and still removes the helper pictures', async () => {
    setUp();
    runJob.mockRejectedValue(new Error('engine stopped'));
    await eraseMaskedPart(paintedMask());
    expect(lastToast()).toMatchObject({ status: 'error', description: 'engine stopped' });
    expect(c().stagedImageNames).toEqual([]);
    expect(backend.deleteImages).toHaveBeenCalledWith(['up0.png', 'up1.png']);
  });

  it('does nothing for a layer that is not an inpaint mask', async () => {
    setUp();
    paintedMask();
    const raster = c().entities.find((e) => e.type === 'raster')!.id;
    await eraseMaskedPart(raster);
    expect(lastToast()?.title).toBe(t('canvas.partFix.empty'));
    expect(runJob).not.toHaveBeenCalled();
  });
});

describe('cutting out the painted part', () => {
  it('saves one picture to the gallery, not hidden, and tells the user', async () => {
    setUp();
    await cutOutMaskedPart(paintedMask());
    expect(uploads).toHaveLength(1);
    expect(uploads[0]!.isIntermediate).toBe(false);
    expect(useGallery.getState().images[0]!.name).toBe('up0.png');
    expect(lastToast()).toMatchObject({ status: 'success', title: t('canvas.partFix.cutOut') });
    // The picture is kept only where the mask is: it is drawn into the mask's shape.
    expect(canvases.all.some((r) => r.sets.some((s) => s.name === 'globalCompositeOperation' && s.value === 'source-in'))).toBe(true);
  });

  it('saves nothing when nothing is painted', async () => {
    setUp(() => [0, 0, 0, 255]);
    await cutOutMaskedPart(paintedMask(false));
    expect(uploads).toEqual([]);
    expect(lastToast()?.status).toBe('warning');
  });

  it('reports a failed upload', async () => {
    setUp();
    vi.mocked(backend.uploadImage).mockRejectedValue(new Error('disk full'));
    await cutOutMaskedPart(paintedMask());
    expect(lastToast()).toMatchObject({ status: 'error', description: 'disk full' });
  });
});
