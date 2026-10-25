// @vitest-environment jsdom
// The less common paths of the segment dialog: failures of each save, cancelling, clearing, the mosaic block size.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { t } from '@/i18n';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { useSegment } from '@/state/dialogs/segment';
import { useGallery } from '@/state/gallery';
import { usePacks } from '@/state/media/packs';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { SegmentDialog } from './SegmentDialog';
import { mosaicBlob, overlayUrl, transparentMaskBlob } from './maskImage';
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
const lastToast = () => useToasts.getState().toasts.at(-1);

const mount = () =>
  render(
    <TooltipProvider>
      <SegmentDialog />
    </TooltipProvider>,
  );
const click = (at: [number, number]) => {
  const stage = screen.getByTestId('seg-stage');
  stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 50, right: 100, bottom: 50, x: 0, y: 0, toJSON: () => ({}) });
  fireEvent.click(stage, { clientX: at[0] * 100, clientY: at[1] * 50 });
};
/** Opens the dialog, marks one point and runs the segmentation until the result tools show. */
const toResult = async () => {
  mount();
  useSegment.getState().open('photo.png');
  await screen.findByTestId('seg-stage');
  click([0.5, 0.5]);
  fireEvent.click(screen.getByTestId('seg-run'));
  await screen.findByTestId('seg-result');
};

beforeEach(() => {
  backend.setStepDelay(0);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useGallery.getState().setImages([photo]);
  useToasts.setState({ toasts: [] });
  useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS }, status: 'ready' });
  useNodePacks.setState({ packs: { available: true, installed: [], comfyVersion: null, restartNeeded: false } });
  useSegment.setState({ imageName: null });
  usePacks.getState().setPack('inpaint', { state: 'ready' });
  vi.mocked(runSegmentation).mockReset().mockResolvedValue({ ...photo, name: 'mask.png', url: 'blob:mask', isIntermediate: true });
  vi.mocked(runJob).mockReset();
  vi.mocked(mosaicBlob).mockClear();
});
afterEach(async () => {
  cleanup();
  useSegment.getState().close();
  vi.restoreAllMocks();
  await waitFor(() => expect(useComfyNodes.getState().status).not.toBe('loading'));
});

describe('failures', () => {
  it('reports a cut-out, a mosaic and a canvas transfer that cannot be saved', async () => {
    vi.spyOn(backend, 'uploadImage').mockRejectedValue(new Error('disk full'));
    await toResult();
    fireEvent.click(screen.getByTestId('seg-cutout'));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'error', title: t('segment.failed'), description: 'disk full' }));
    useToasts.setState({ toasts: [] });
    fireEvent.click(screen.getByTestId('seg-mosaic'));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'error', description: 'disk full' }));
    useToasts.setState({ toasts: [] });
    fireEvent.click(screen.getByTestId('seg-canvas'));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'error', description: 'disk full' }));
    expect(transparentMaskBlob).toHaveBeenCalled();
    expect(useSegment.getState().imageName).toBe('photo.png');
  });

  it('reports an erase that fails and leaves the dialog open', async () => {
    vi.mocked(runJob).mockRejectedValue(new Error('no GPU'));
    await toResult();
    fireEvent.click(screen.getByTestId('seg-erase'));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'error', description: 'no GPU' }));
    expect(useSegment.getState().imageName).toBe('photo.png');
    expect((screen.getByTestId('seg-erase') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('cancelling and clearing', () => {
  it('stops a running segmentation without an error', async () => {
    vi.mocked(runSegmentation).mockImplementation((_name, _points, signal) => new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted')))));
    mount();
    useSegment.getState().open('photo.png');
    await screen.findByTestId('seg-stage');
    click([0.5, 0.5]);
    fireEvent.click(screen.getByTestId('seg-run'));
    fireEvent.click(await screen.findByTestId('seg-cancel'));
    await waitFor(() => expect(screen.queryByTestId('seg-cancel')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('seg-result')).toBeNull();
  });

  it('stops an erase in progress without an error', async () => {
    vi.mocked(runJob).mockImplementation((_request, signal) => new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted')))));
    await toResult();
    fireEvent.click(screen.getByTestId('seg-erase'));
    fireEvent.click(await screen.findByTestId('seg-erase-cancel'));
    await waitFor(() => expect(screen.queryByTestId('seg-erase-cancel')).toBeNull());
    expect(lastToast()).toBeUndefined();
    expect(useSegment.getState().imageName).toBe('photo.png');
  });

  it('clears the points and the result', async () => {
    await toResult();
    fireEvent.click(screen.getByTestId('seg-clear'));
    expect(screen.queryAllByTestId('seg-point')).toHaveLength(0);
    expect(screen.queryByTestId('seg-result')).toBeNull();
    expect((screen.getByTestId('seg-clear') as HTMLButtonElement).disabled).toBe(true);
  });

  it('closes from the dialog close button', async () => {
    mount();
    useSegment.getState().open('photo.png');
    await screen.findByTestId('seg-stage');
    fireEvent.click(screen.getByLabelText(t('common.close')));
    expect(useSegment.getState().imageName).toBeNull();
  });

  it('cancels the LaMa download', async () => {
    const cancel = vi.spyOn(backend, 'cancelPack').mockResolvedValue();
    await toResult();
    act(() => usePacks.getState().setPack('inpaint', { state: 'downloading', file: 'big-lama.pt', index: 1, count: 1, bytes: 0, totalBytes: 0 }));
    const buttons = await screen.findAllByText(t('common.cancel'));
    fireEvent.click(buttons[buttons.length - 1]!);
    expect(cancel).toHaveBeenCalledWith('inpaint');
  });
});

describe('points and the mosaic', () => {
  it('does not let a right-click on a point add another one', async () => {
    mount();
    useSegment.getState().open('photo.png');
    await screen.findByTestId('seg-stage');
    click([0.5, 0.5]);
    fireEvent.contextMenu(screen.getByTestId('seg-point'));
    expect(screen.getAllByTestId('seg-point')).toHaveLength(1);
  });

  it('uses the block size typed for the mosaic, rounded', async () => {
    vi.spyOn(backend, 'uploadImage').mockResolvedValue({ ...photo, name: 'mosaic.png' });
    await toResult();
    const block = screen.getByLabelText(t('segment.mosaicBlock'));
    fireEvent.change(block, { target: { value: '40.4' } });
    fireEvent.blur(block);
    fireEvent.click(screen.getByTestId('seg-mosaic'));
    await waitFor(() => expect(mosaicBlob).toHaveBeenCalled());
    expect(vi.mocked(mosaicBlob).mock.calls[0]![3]).toBe(40);
  });

  it('releases an overlay that arrives after the mask was replaced', async () => {
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { revokeObjectURL: revoke }));
    let finish: (url: string) => void = () => {};
    vi.mocked(overlayUrl).mockImplementationOnce(() => new Promise<string>((resolve) => (finish = resolve)));
    await toResult();
    // A new point drops the mask while its overlay is still being drawn.
    click([0.2, 0.2]);
    await act(async () => finish('blob:late'));
    expect(revoke).toHaveBeenCalledWith('blob:late');
    expect(screen.queryByTestId('seg-overlay')).toBeNull();
  });
});
