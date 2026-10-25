// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { mockPoseExtract } from '@/backend/mock/poseExtract';
import { newId, useCanvas, type PoseObject } from '@/state/canvas';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { runTextJob } from '@/state/comfy/runGraph';
import { usePoseFromImageDialog } from '@/state/dialogs/poseFromImage';
import { useGallery } from '@/state/gallery';
import { useUi } from '@/state/ui';
import { TooltipProvider } from '@/ui';
import { PoseFromImageDialog } from './PoseFromImageDialog';

vi.mock('@/state/comfy/runGraph', () => ({ runTextJob: vi.fn(), runJob: vi.fn() }));

const photo = { name: 'photo.png', mediaType: 'image', url: 'blob:photo', thumbnailUrl: 'blob:photo', width: 200, height: 100, createdAt: 0, boardId: 'b1', starred: false, isIntermediate: false, category: 'general', metadata: null, workflow: null } as ImageDTO;

const mount = () =>
  render(
    <TooltipProvider>
      <PoseFromImageDialog />
    </TooltipProvider>,
  );

const poses = () => useCanvas.getState().entities.flatMap((e) => e.objects.filter((o): o is PoseObject => o.kind === 'pose'));

describe('make a pose from a picture', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    useGallery.getState().setImages([photo]);
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS }, status: 'ready' });
    useNodePacks.setState({ packs: { available: true, installed: [], comfyVersion: null, restartNeeded: false } });
    useCanvas.setState({ entities: [], selectedEntityId: null });
    useUi.getState().setTab('generate');
    vi.mocked(runTextJob).mockReset().mockResolvedValue(mockPoseExtract());
  });
  afterEach(async () => {
    cleanup();
    usePoseFromImageDialog.getState().close();
    await waitFor(() => expect(useComfyNodes.getState().status).not.toBe('loading'));
  });

  it('offers to install the pack when ComfyUI does not know the node', async () => {
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS }, status: 'ready' });
    mount();
    usePoseFromImageDialog.getState().show('photo.png');
    expect(await screen.findByTestId('pose-from-image-needs')).toBeTruthy();
    expect(screen.getByTestId('pose-from-image-install')).toBeTruthy();
    expect(screen.queryByTestId('pose-from-image-run')).toBeNull();
  });

  it('asks for a picture when opened without one', async () => {
    mount();
    usePoseFromImageDialog.getState().show();
    expect(await screen.findByTestId('pose-from-image-pick')).toBeTruthy();
    expect((screen.getByTestId('pose-from-image-run') as HTMLButtonElement).disabled).toBe(true);
  });

  it('reads the picture as a hidden text job and puts the person on the canvas, then opens the canvas', async () => {
    mount();
    usePoseFromImageDialog.getState().show('photo.png');
    fireEvent.click(await screen.findByTestId('pose-from-image-run'));
    expect(await screen.findByTestId('pose-from-image-result')).toBeTruthy();
    const request = vi.mocked(runTextJob).mock.calls[0]![0];
    expect(request.destination).toBe('intermediate');
    expect(request.comfyGraph!.prompt.pose!.class_type).toBe('DWPreprocessor');
    fireEvent.click(screen.getByTestId('pose-from-image-replace'));
    expect(poses()).toHaveLength(1);
    expect(useUi.getState().activeTab).toBe('canvas');
    expect(usePoseFromImageDialog.getState().open).toBe(false);
  });

  it('adds to the poses of the selected control layer when asked', async () => {
    const id = useCanvas.getState().addEntity('control');
    useCanvas.getState().addObject(id, { kind: 'pose', id: newId('pose'), points: Array(36).fill(5), hidden: [], width: 4 });
    useCanvas.getState().select(id);
    mount();
    usePoseFromImageDialog.getState().show('photo.png');
    fireEvent.click(await screen.findByTestId('pose-from-image-run'));
    fireEvent.click(await screen.findByTestId('pose-from-image-add'));
    expect(poses()).toHaveLength(2);
  });

  it('says so when nobody was found, and shows the error when the job fails', async () => {
    vi.mocked(runTextJob).mockResolvedValueOnce(JSON.stringify([{ people: [], canvas_width: 10, canvas_height: 10 }]));
    mount();
    usePoseFromImageDialog.getState().show('photo.png');
    fireEvent.click(await screen.findByTestId('pose-from-image-run'));
    expect(await screen.findByTestId('pose-from-image-none')).toBeTruthy();
    expect(poses()).toHaveLength(0);
    vi.mocked(runTextJob).mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(screen.getByTestId('pose-from-image-run'));
    expect((await screen.findByRole('alert')).textContent).toContain('boom');
  });
});
