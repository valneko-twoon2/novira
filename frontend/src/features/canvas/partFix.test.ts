// @vitest-environment jsdom
// Erasing and cutting out the part an inpaint mask covers. Drawing goes to recorded canvases (getImageData hands out
// black on the left half and white on the right unless a test says otherwise), so these check what is sent, staged
// and reported, not pixels; the e2e spec `partFix.spec.ts` runs the same steps in a browser.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ComfyNodeDefs, type EnqueueRequest, type ImageDTO } from '@/backend';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { t } from '@/i18n';
import { useCanvas, type CanvasState } from '@/state/canvas';
import { useParams, type ParamsState } from '@/state/params';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { ERASE_NODE } from '@/state/comfy/erase';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { useGallery } from '@/state/gallery';
import { usePacks } from '@/state/media/packs';
import { useToasts } from '@/state/toasts';
import { cutOutMaskedPart, eraseMaskedPart, redrawMaskedPart } from './partFix';

vi.mock('@/ui/canvasDraw/imageCache', () => ({
  getImage: () => null,
  imageVersion: () => 0,
  preloadImages: () => Promise.resolve(),
  onImageLoaded: () => () => {},
}));

const runJob = vi.fn<(r: EnqueueRequest) => Promise<ImageDTO>>();
vi.mock('@/state/comfy/runGraph', () => ({ runJob: (r: EnqueueRequest) => runJob(r) }));

// The redraw's request is the canvas Invoke's own (tested in request.test.ts); here only what it is given matters.
const buildCanvasRequest = vi.fn(async (_doc: CanvasState, p: ParamsState) => ({ origin: 'canvas', destination: 'canvas', params: { positivePrompt: p.positivePrompt } }) as unknown as EnqueueRequest);
vi.mock('./request', () => ({ buildCanvasRequest: (doc: CanvasState, p: ParamsState) => buildCanvasRequest(doc, p) }));
const readiness = vi.fn((): string[] => []);
vi.mock('./register', () => ({ canvasReadiness: () => readiness() }));

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
  buildCanvasRequest.mockClear();
  readiness.mockReturnValue([]);
  useParams.setState({ positivePrompt: 'a girl in a park' });
  vi.spyOn(backend, 'enqueue').mockResolvedValue([] as never);
});
afterEach(() => {
  canvases.restore();
  vi.restoreAllMocks();
});

describe('erasing the painted part', () => {
  it('sends the picture and the mask, stages the result and removes the two helper pictures', { tags: ['condition'] }, async () => {
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

  it('offers LaMa with the result while its model is missing, and not once it is there', { tags: ['error-guessing'] }, async () => {
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

  it('says what to do when nothing is painted, and sends nothing', { tags: ['condition'] }, async () => {
    setUp(() => [0, 0, 0, 255]);
    await eraseMaskedPart(paintedMask());
    expect(lastToast()).toMatchObject({ status: 'warning', title: t('canvas.partFix.empty') });
    expect(uploads).toEqual([]);
    expect(runJob).not.toHaveBeenCalled();
  });

  it('offers to install the extension when the erase node is missing, or to restart when it waits for a restart', { tags: ['error-guessing'] }, async () => {
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

  it('reports a failed job and still removes the helper pictures', { tags: ['error-guessing'] }, async () => {
    setUp();
    runJob.mockRejectedValue(new Error('engine stopped'));
    await eraseMaskedPart(paintedMask());
    expect(lastToast()).toMatchObject({ status: 'error', description: 'engine stopped' });
    expect(c().stagedImageNames).toEqual([]);
    expect(backend.deleteImages).toHaveBeenCalledWith(['up0.png', 'up1.png']);
  });

  it('does nothing for a layer that is not an inpaint mask', { tags: ['condition'] }, async () => {
    setUp();
    paintedMask();
    const raster = c().entities.find((e) => e.type === 'raster')!.id;
    await eraseMaskedPart(raster);
    expect(lastToast()?.title).toBe(t('canvas.partFix.empty'));
    expect(runJob).not.toHaveBeenCalled();
  });
});

describe('redrawing the painted part', () => {
  it('queues a canvas generation with the instruction as its prompt and only this mask, shown even when hidden', { tags: ['condition'] }, async () => {
    setUp();
    const other = paintedMask();
    const id = c().addEntity('inpaint', { objects: [{ kind: 'stroke', id: 's2', tool: 'brush', color: red, width: 10, points: [5, 5, 20, 20], clip: null }] });
    c().updateEntity(id, { isEnabled: false });
    useCanvas.setState({ groupHidden: { ...c().groupHidden, inpaint: true } });
    await redrawMaskedPart(id, '  a blue ribbon ');
    const [doc, params] = buildCanvasRequest.mock.calls[0]!;
    expect(params.positivePrompt).toBe('a blue ribbon');
    const masks = doc.entities.filter((e) => e.type === 'inpaint');
    expect(masks.map((e) => [e.id, e.isEnabled])).toEqual([[id, true]]);
    expect(masks.some((e) => e.id === other)).toBe(false);
    expect(doc.groupHidden.inpaint).toBe(false);
    expect(backend.enqueue).toHaveBeenCalledTimes(1);
    expect(lastToast()).toMatchObject({ status: 'success', title: t('canvas.partFix.redrawing') });
    // The Generate tab's prompt is left as it was.
    expect(useParams.getState().positivePrompt).toBe('a girl in a park');
  });

  it('uses the Generate tab\'s prompt when the instruction is blank', { tags: ['condition'] }, async () => {
    setUp();
    await redrawMaskedPart(paintedMask(), '   ');
    expect(buildCanvasRequest.mock.calls[0]![1].positivePrompt).toBe('a girl in a park');
  });

  it('queues nothing when nothing is painted or the canvas cannot be invoked, and says why', { tags: ['error-guessing'] }, async () => {
    setUp(() => [0, 0, 0, 255]);
    await redrawMaskedPart(paintedMask(false), 'x');
    expect(lastToast()?.title).toBe(t('canvas.partFix.empty'));
    canvases.restore();

    setUp();
    readiness.mockReturnValue(['no model']);
    await redrawMaskedPart(c().selectedEntityId!, 'x');
    expect(lastToast()).toMatchObject({ status: 'warning', title: t('app.invoke.notReady'), description: 'no model' });
    expect(backend.enqueue).not.toHaveBeenCalled();
  });

  it('reports a failed enqueue', { tags: ['error-guessing'] }, async () => {
    setUp();
    vi.mocked(backend.enqueue).mockRejectedValue(new Error('queue full'));
    await redrawMaskedPart(paintedMask(), 'x');
    expect(lastToast()).toMatchObject({ status: 'error', description: 'queue full' });
  });
});

describe('cutting out the painted part', () => {
  it('saves one picture to the gallery, not hidden, and tells the user', { tags: ['condition'] }, async () => {
    setUp();
    await cutOutMaskedPart(paintedMask());
    expect(uploads).toHaveLength(1);
    expect(uploads[0]!.isIntermediate).toBe(false);
    expect(useGallery.getState().images[0]!.name).toBe('up0.png');
    expect(lastToast()).toMatchObject({ status: 'success', title: t('canvas.partFix.cutOut') });
    // The picture is kept only where the mask is: it is drawn into the mask's shape.
    expect(canvases.all.some((r) => r.sets.some((s) => s.name === 'globalCompositeOperation' && s.value === 'source-in'))).toBe(true);
  });

  it('saves nothing when nothing is painted', { tags: ['condition'] }, async () => {
    setUp(() => [0, 0, 0, 255]);
    await cutOutMaskedPart(paintedMask(false));
    expect(uploads).toEqual([]);
    expect(lastToast()?.status).toBe('warning');
  });

  it('reports a failed upload', { tags: ['error-guessing'] }, async () => {
    setUp();
    vi.mocked(backend.uploadImage).mockRejectedValue(new Error('disk full'));
    await cutOutMaskedPart(paintedMask());
    expect(lastToast()).toMatchObject({ status: 'error', description: 'disk full' });
  });
});
