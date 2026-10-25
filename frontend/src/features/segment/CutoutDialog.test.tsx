// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { useCutout } from '@/state/dialogs/cutout';
import { useGallery } from '@/state/gallery';
import * as trim from '@/state/trim';
import { TooltipProvider } from '@/ui';
import { CutoutDialog } from './CutoutDialog';
import { runJob } from './segmentJob';

vi.mock('./segmentJob', () => ({ runSegmentation: vi.fn(), runJob: vi.fn() }));

const photo: ImageDTO = {
  name: 'photo.png',
  mediaType: 'image',
  url: 'blob:photo',
  thumbnailUrl: 'blob:photo',
  width: 200,
  height: 100,
  createdAt: 0,
  boardId: 'b1',
  starred: false,
  isIntermediate: false,
  category: 'general',
  metadata: null,
  workflow: null,
};

const mount = () =>
  render(
    <TooltipProvider>
      <CutoutDialog />
    </TooltipProvider>,
  );

describe('remove the background', () => {
  beforeEach(() => {
    backend.setStepDelay(0);
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    useGallery.getState().setImages([photo]);
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS }, status: 'ready' });
    useNodePacks.setState({ packs: { available: true, installed: [], comfyVersion: null, restartNeeded: false } });
    useCutout.setState({ imageName: null });
    vi.mocked(runJob).mockReset().mockResolvedValue({ ...photo, name: 'cut.png', url: 'blob:cut' });
  });
  afterEach(async () => {
    cleanup();
    useCutout.getState().close();
    await waitFor(() => expect(useComfyNodes.getState().status).not.toBe('loading'));
  });

  it('stays closed until a picture is chosen', () => {
    mount();
    expect(screen.queryByTestId('cutout-stage')).toBeNull();
  });

  it('offers to install the pack when ComfyUI does not know its node', async () => {
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS }, status: 'ready' });
    mount();
    useCutout.getState().open('photo.png');
    expect(await screen.findByTestId('seg-needs')).toBeTruthy();
    expect(screen.getByTestId('seg-install-rmbg')).toBeTruthy();
    expect(screen.queryByTestId('cutout-run')).toBeNull();
  });

  it('removes the background on the picture of the gallery and shows the result next to the original on the same board', async () => {
    mount();
    useCutout.getState().open('photo.png');
    fireEvent.click(await screen.findByTestId('cutout-run'));
    await screen.findByTestId('cutout-done');
    const request = vi.mocked(runJob).mock.calls[0]![0];
    expect(request.destination).toBe('gallery');
    expect(request.boardId).toBe('b1');
    expect(Object.values(request.comfyGraph!.prompt).some((n) => n.class_type === 'RMBG')).toBe(true);
    expect((screen.getByTestId('cutout-result') as HTMLImageElement).src).toContain('blob:cut');

    fireEvent.click(screen.getByTestId('cutout-open'));
    expect(useGallery.getState().selection).toEqual(['cut.png']);
    expect(useGallery.getState().compareImageName).toBe('photo.png');
    expect(useCutout.getState().imageName).toBeNull();
  });

  it('offers to trim the transparent margin of a result on a transparent background', async () => {
    const trimming = vi.spyOn(trim, 'trimTransparent').mockResolvedValue(null);
    mount();
    useCutout.getState().open('photo.png');
    fireEvent.click(await screen.findByTestId('cutout-run'));
    fireEvent.click(await screen.findByTestId('cutout-trim'));
    expect(trimming).toHaveBeenCalledWith(expect.objectContaining({ name: 'cut.png' }));
    trimming.mockRestore();
  });

  it('shows why it failed and lets it be tried again', async () => {
    vi.mocked(runJob).mockRejectedValueOnce(new Error('out of memory'));
    mount();
    useCutout.getState().open('photo.png');
    fireEvent.click(await screen.findByTestId('cutout-run'));
    expect((await screen.findByRole('alert')).textContent).toContain('out of memory');
    expect(screen.queryByTestId('cutout-done')).toBeNull();
    fireEvent.click(screen.getByTestId('cutout-run'));
    await screen.findByTestId('cutout-done');
  });
});
