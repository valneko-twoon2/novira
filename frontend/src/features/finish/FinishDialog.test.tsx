// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type EnqueueRequest, type ImageDTO } from '@/backend';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { useFinish } from '@/state/dialogs/finish';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { TooltipProvider } from '@/ui';
import { FinishDialog } from './FinishDialog';
import { finishGraph } from './finishGraph';

const clip: ImageDTO = {
  name: 'clip.mp4',
  mediaType: 'video',
  url: 'blob:clip',
  thumbnailUrl: 'blob:thumb',
  width: 832,
  height: 480,
  createdAt: 0,
  boardId: 'b1',
  starred: false,
  isIntermediate: false,
  category: 'general',
  metadata: { videoFps: 24, videoFrames: 49, positivePrompt: 'a cat' } as ImageDTO['metadata'],
  workflow: null,
};

const mount = () =>
  render(
    <TooltipProvider>
      <FinishDialog />
    </TooltipProvider>,
  );

describe('finish graph', () => {
  it('doubles the frames and the rate, then brings the enlarged frames to twice the clip', () => {
    const g = finishGraph({ name: 'clip.mp4', width: 832, height: 480, fps: 24 }, { smooth: true, upscale: { modelKey: 'up-1' } });
    expect(g.prompt.load!.inputs.file).toEqual({ $image: 'clip.mp4' });
    expect(g.prompt.smooth!.inputs).toMatchObject({ frames: ['parts', 0], multiplier: 2 });
    expect(g.prompt.enlarge!.inputs.image).toEqual(['smooth', 0]);
    expect(g.prompt.fit!.inputs).toMatchObject({ width: 1664, height: 960 });
    expect(g.prompt.video!.inputs).toEqual({ images: ['fit', 0], fps: 48 });
    expect(g.outputs).toEqual(['save']);
    expect(g.thumbnail).toBe('thumb');
    expect(g.prompt.first!.inputs.image).toEqual(['fit', 0]);
  });

  it('leaves a step out when it is not asked for, and drops inputs an older pack does not have', () => {
    const only = finishGraph({ name: 'clip.mp4', width: 64, height: 64, fps: 12 }, { smooth: false, upscale: { modelKey: 'u' } });
    expect(only.prompt.smooth).toBeUndefined();
    expect(only.prompt.video!.inputs.fps).toBe(12);
    const defs = { ...PACK_NODE_DEFS, 'RIFE VFI': { ...PACK_NODE_DEFS['RIFE VFI']!, input: { required: { ckpt_name: [['rife49.pth']], frames: ['IMAGE'], multiplier: ['INT'] } } } };
    const g = finishGraph({ name: 'clip.mp4', width: 64, height: 64, fps: 12 }, { smooth: true, upscale: null }, defs as never);
    expect(Object.keys(g.prompt.smooth!.inputs).sort()).toEqual(['ckpt_name', 'frames', 'multiplier']);
  });
});

describe('finish dialog', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    useGallery.getState().setImages([clip]);
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS }, status: 'ready' });
    useModels.setState({ models: [] });
    useFinish.setState({ name: null });
  });
  afterEach(() => {
    cleanup();
    useFinish.getState().close();
    vi.restoreAllMocks();
  });

  it('queues the finished clip on the source board with the doubled rate', async () => {
    const enqueue = vi.spyOn(backend, 'enqueue').mockResolvedValue([]);
    mount();
    useFinish.getState().open('clip.mp4');
    fireEvent.click(await screen.findByTestId('finish-run'));
    await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(1));
    const request = enqueue.mock.calls[0]![0] as EnqueueRequest;
    expect(request.boardId).toBe('b1');
    expect(request.destination).toBe('gallery');
    expect(request.params).toMatchObject({ videoFps: 48, videoFrames: 98, positivePrompt: 'a cat', width: 832 });
    expect(request.comfyGraph!.thumbnail).toBe('thumb');
  });

  it('asks for the interpolation pack when ComfyUI lacks it', async () => {
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS }, status: 'ready' });
    mount();
    useFinish.getState().open('clip.mp4');
    expect(await screen.findByTestId('finish-needs')).toBeTruthy();
    expect((screen.getByTestId('finish-run') as HTMLButtonElement).disabled).toBe(true);
  });
});
