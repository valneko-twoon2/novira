// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { useCanvas } from '@/state/canvas';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { usePacks } from '@/state/media/packs';
import { useSegment } from '@/state/dialogs/segment';
import { useUi } from '@/state/ui';
import { TooltipProvider } from '@/ui';
import { SegmentDialog } from './SegmentDialog';
import { cutoutBlob, loadMask, mosaicBlob, transparentMaskBlob } from './maskImage';
import { runJob, runSegmentation } from './segmentJob';

vi.mock('./segmentJob', () => ({ runSegmentation: vi.fn(), runJob: vi.fn() }));
vi.mock('./maskImage', () => ({
  loadMask: vi.fn(async () => ({ width: 200, height: 100, alpha: new Uint8ClampedArray(200 * 100) })),
  overlayUrl: vi.fn(async () => 'blob:overlay'),
  cutoutBlob: vi.fn(async () => new Blob(['cut'])),
  mosaicBlob: vi.fn(async () => new Blob(['mosaic'])),
  transparentMaskBlob: vi.fn(async () => new Blob(['mask'])),
}));

const photo: ImageDTO = {
  name: 'photo.png',
  mediaType: 'image',
  url: 'blob:photo',
  thumbnailUrl: 'blob:photo',
  width: 200,
  height: 100,
  createdAt: 0,
  boardId: null,
  starred: false,
  isIntermediate: false,
  category: 'general',
  metadata: null,
  workflow: null,
};

const mount = () =>
  render(
    <TooltipProvider>
      <SegmentDialog />
    </TooltipProvider>,
  );

/** A click at a fraction of the picture; the stage is 100 px wide and 50 px tall on screen. */
const click = (at: [number, number], init: object = {}) => {
  const stage = screen.getByTestId('seg-stage');
  stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 50, right: 100, bottom: 50, x: 0, y: 0, toJSON: () => ({}) });
  fireEvent.click(stage, { clientX: at[0] * 100, clientY: at[1] * 50, ...init });
};

describe('select and fix a part', () => {
  beforeEach(() => {
    backend.setStepDelay(0);
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    useGallery.getState().setImages([photo]);
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS }, status: 'ready' });
    useNodePacks.setState({ packs: { available: true, installed: [], comfyVersion: null, restartNeeded: false } });
    useSegment.setState({ imageName: null });
    vi.mocked(runSegmentation).mockReset().mockResolvedValue({ ...photo, name: 'mask.png', url: 'blob:mask', isIntermediate: true });
  });
  afterEach(async () => {
    cleanup();
    useSegment.getState().close();
    // The dialog may refetch the node definitions; let that finish so it cannot overwrite the next test's definitions.
    await waitFor(() => expect(useComfyNodes.getState().status).not.toBe('loading'));
  });

  it('stays closed until a picture is chosen', () => {
    mount();
    expect(screen.queryByTestId('seg-stage')).toBeNull();
  });

  it('offers to install the pack when ComfyUI does not know its node', async () => {
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS }, status: 'ready' });
    mount();
    useSegment.getState().open('photo.png');
    expect(await screen.findByTestId('seg-needs')).toBeTruthy();
    expect(screen.getByTestId('seg-install-sam2')).toBeTruthy();
    expect(screen.queryByTestId('seg-run')).toBeNull();
  });

  it('turns clicks into points in picture pixels, left to include and shift or right-click to leave out', async () => {
    mount();
    useSegment.getState().open('photo.png');
    await screen.findByTestId('seg-stage');
    expect((screen.getByTestId('seg-run') as HTMLButtonElement).disabled).toBe(true);
    click([0.5, 0.5]);
    click([0.25, 0.5], { shiftKey: true });
    fireEvent.contextMenu(screen.getByTestId('seg-stage'), { clientX: 10, clientY: 10 });
    expect(screen.getAllByTestId('seg-point')).toHaveLength(3);
    expect((screen.getByTestId('seg-run') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId('seg-run'));
    await waitFor(() => expect(runSegmentation).toHaveBeenCalled());
    const [name, points] = vi.mocked(runSegmentation).mock.calls[0]!;
    expect(name).toBe('photo.png');
    expect(points[0]).toEqual({ x: 100, y: 50, include: true });
    expect(points[1]).toEqual({ x: 50, y: 50, include: false });
    expect(points[2]!.include).toBe(false);
  });

  it('takes a point back when it is clicked, and a changed selection must be run again', async () => {
    mount();
    useSegment.getState().open('photo.png');
    await screen.findByTestId('seg-stage');
    click([0.5, 0.5]);
    fireEvent.click(screen.getByTestId('seg-run'));
    await screen.findByTestId('seg-result');
    click([0.2, 0.2]);
    expect(screen.queryByTestId('seg-result')).toBeNull();
    fireEvent.click(screen.getAllByTestId('seg-point')[1]!);
    expect(screen.getAllByTestId('seg-point')).toHaveLength(1);
  });

  it('shows why it failed', async () => {
    vi.mocked(runSegmentation).mockRejectedValue(new Error('out of memory'));
    mount();
    useSegment.getState().open('photo.png');
    await screen.findByTestId('seg-stage');
    click([0.5, 0.5]);
    fireEvent.click(screen.getByTestId('seg-run'));
    expect((await screen.findByRole('alert')).textContent).toContain('out of memory');
  });

  it('saves the cut-out to the gallery, inverted when asked', async () => {
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue({ ...photo, name: 'cut.png' });
    mount();
    useSegment.getState().open('photo.png');
    await screen.findByTestId('seg-stage');
    click([0.5, 0.5]);
    fireEvent.click(screen.getByTestId('seg-run'));
    await screen.findByTestId('seg-result');
    expect(loadMask).toHaveBeenCalledWith('blob:mask');
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByTestId('seg-cutout'));
    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect(vi.mocked(cutoutBlob).mock.calls[0]![0]).toBe('blob:photo');
    expect(vi.mocked(cutoutBlob).mock.calls[0]![2]).toBe(true);
    expect(upload.mock.calls[0]![1]).toMatchObject({ boardId: null });
    expect(useGallery.getState().selection).toEqual(['cut.png']);
    expect(useGallery.getState().compareImageName).toBe('photo.png');
    upload.mockRestore();
  });

  it('saves the selection as a mosaic, with a block size that follows the picture until it is changed', async () => {
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue({ ...photo, name: 'mosaic.png' });
    mount();
    useSegment.getState().open('photo.png');
    await screen.findByTestId('seg-stage');
    click([0.5, 0.5]);
    fireEvent.click(screen.getByTestId('seg-run'));
    await screen.findByTestId('seg-result');
    fireEvent.click(screen.getByTestId('seg-mosaic'));
    await waitFor(() => expect(upload).toHaveBeenCalled());
    // The test picture is 200 x 100: a block of a fortieth of its short side, at least 8.
    expect(vi.mocked(mosaicBlob).mock.calls[0]).toEqual(['blob:photo', expect.anything(), false, 8]);
    expect(useGallery.getState().selection).toEqual(['mosaic.png']);
    upload.mockRestore();
  });

  it('erases the selection from the picture with the grown, optionally inverted, mask and shows the result', async () => {
    vi.mocked(runJob).mockResolvedValue({ ...photo, name: 'erased.png' });
    mount();
    useSegment.getState().open('photo.png');
    await screen.findByTestId('seg-stage');
    click([0.5, 0.5]);
    fireEvent.click(screen.getByTestId('seg-run'));
    await screen.findByTestId('seg-result');
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByTestId('seg-erase'));
    await waitFor(() => expect(runJob).toHaveBeenCalled());
    const request = vi.mocked(runJob).mock.calls[0]![0];
    expect(request.destination).toBe('gallery');
    expect(request.comfyGraph!.prompt.source!.inputs.image).toEqual({ $image: 'photo.png' });
    expect(request.comfyGraph!.prompt.cover!.inputs.image).toEqual({ $image: 'mask.png' });
    expect(request.comfyGraph!.prompt.flip).toBeDefined();
    await waitFor(() => expect(useSegment.getState().imageName).toBeNull());
    expect(useGallery.getState().selection).toEqual(['erased.png']);
    expect(useGallery.getState().compareImageName).toBe('photo.png');
  });

  it('redraws only the selection from the typed prompt with the chosen model and shows the result', async () => {
    vi.mocked(runJob).mockResolvedValue({ ...photo, name: 'redrawn.png' });
    useModels.setState({ models: [{ key: 'sdxl-1', name: 'Anime XL', base: 'sdxl', type: 'main', format: 'checkpoint', description: '', path: '', size: 1, source: '' }] });
    mount();
    useSegment.getState().open('photo.png');
    await screen.findByTestId('seg-stage');
    click([0.5, 0.5]);
    fireEvent.click(screen.getByTestId('seg-run'));
    await screen.findByTestId('seg-result');
    expect((screen.getByTestId('seg-redraw-run') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('seg-redraw-prompt'), { target: { value: 'blue hair' } });
    fireEvent.click(screen.getByTestId('seg-redraw-run'));
    await waitFor(() => expect(runJob).toHaveBeenCalled());
    const request = vi.mocked(runJob).mock.calls[0]![0];
    expect(request.destination).toBe('gallery');
    expect(request.comfyGraph!.prompt.ckpt!.inputs.ckpt_name).toEqual({ $model: 'sdxl-1' });
    expect(request.comfyGraph!.prompt.pos!.inputs.text).toBe('blue hair');
    expect(request.params.modelName).toBe('Anime XL');
    expect(request.params.width).toBe(200);
    await waitFor(() => expect(useSegment.getState().imageName).toBeNull());
    expect(useGallery.getState().selection).toEqual(['redrawn.png']);
    expect(useGallery.getState().compareImageName).toBe('photo.png');
    useModels.setState({ models: [] });
  });

  it('offers the LaMa model next to the erase button, downloads it on request and says when it is used', async () => {
    const install = vi.spyOn(backend, 'installPack').mockResolvedValue();
    usePacks.getState().setPack('inpaint', { state: 'missing', totalBytes: 205_669_692 });
    mount();
    useSegment.getState().open('photo.png');
    await screen.findByTestId('seg-stage');
    click([0.5, 0.5]);
    fireEvent.click(screen.getByTestId('seg-run'));
    await screen.findByTestId('seg-result');
    fireEvent.click(await screen.findByTestId('seg-lama-get'));
    expect(install).toHaveBeenCalledWith('inpaint');
    act(() => usePacks.getState().setPack('inpaint', { state: 'downloading', file: 'big-lama.pt', index: 1, count: 1, bytes: 100_000_000, totalBytes: 205_669_692 }));
    expect((await screen.findByText(/100 \/ 206/)).textContent).toContain('LaMa');
    // Once ComfyUI lists the file, the dialog says it will be used.
    act(() => usePacks.getState().setPack('inpaint', { state: 'ready' }));
    act(() => useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS, INPAINT_LoadInpaintModel: { ...PACK_NODE_DEFS.INPAINT_LoadInpaintModel!, input: { required: { model_name: [['big-lama.pt']] } } } } }));
    expect(await screen.findByText(/LaMa のモデルで消します/)).toBeTruthy();
    install.mockRestore();
    usePacks.getState().setPack('inpaint', { state: 'ready' });
  });

  it('asks for the inpaint pack instead of the erase button when it is missing', async () => {
    const { INPAINT_MaskedFill: _gone, ...without } = PACK_NODE_DEFS;
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS, ...without }, status: 'ready' });
    mount();
    useSegment.getState().open('photo.png');
    await screen.findByTestId('seg-stage');
    click([0.5, 0.5]);
    fireEvent.click(screen.getByTestId('seg-run'));
    await screen.findByTestId('seg-result');
    expect(screen.queryByTestId('seg-erase')).toBeNull();
    expect(screen.getByTestId('seg-install-inpaintNodes')).toBeTruthy();
  });

  it('sends the picture and the selection to the canvas as a raster layer and an inpaint mask', async () => {
    const maskDto = { ...photo, name: 'inpaint-mask.png', isIntermediate: true };
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue(maskDto);
    const imported: [string, string][] = [];
    useCanvas.setState({ importImage: (image, target) => void imported.push([image.name, target]) });
    mount();
    useSegment.getState().open('photo.png');
    await screen.findByTestId('seg-stage');
    click([0.5, 0.5]);
    fireEvent.click(screen.getByTestId('seg-run'));
    await screen.findByTestId('seg-result');
    fireEvent.click(screen.getByTestId('seg-canvas'));
    await waitFor(() => expect(imported).toHaveLength(2));
    expect(imported).toEqual([
      ['photo.png', 'newCanvasRaster'],
      ['inpaint-mask.png', 'inpaint'],
    ]);
    expect(transparentMaskBlob).toHaveBeenCalled();
    expect(upload.mock.calls[0]![1]).toMatchObject({ isIntermediate: true });
    expect(useUi.getState().activeTab).toBe('canvas');
    expect(useSegment.getState().imageName).toBeNull();
    upload.mockRestore();
  });
});
