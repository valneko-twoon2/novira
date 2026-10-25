// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type EnqueueRequest, type ImageDTO } from '@/backend';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { useBatch } from '@/state/dialogs/batch';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { TooltipProvider } from '@/ui';
import { BatchDialog } from './BatchDialog';
import { removeBackgroundGraph, upscaleGraph } from './batchGraph';

const picture = (name: string, boardId: string | null, mediaType: ImageDTO['mediaType'] = 'image'): ImageDTO => ({
  name,
  mediaType,
  url: `blob:${name}`,
  thumbnailUrl: `blob:${name}`,
  width: 64,
  height: 48,
  createdAt: 0,
  boardId,
  starred: false,
  isIntermediate: false,
  category: 'general',
  metadata: null,
  workflow: null,
});

const mount = () =>
  render(
    <TooltipProvider>
      <BatchDialog />
    </TooltipProvider>,
  );

describe('batch graphs', () => {
  it('cuts out with the background pack and keeps every input the node needs', () => {
    const g = removeBackgroundGraph('a.png');
    expect(g.prompt.source!.inputs.image).toEqual({ $image: 'a.png' });
    expect(g.prompt.cut!.class_type).toBe('RMBG');
    expect(g.prompt.cut!.inputs).toMatchObject({ background: 'Alpha', process_res: 1024, model: 'INSPYRENET' });
    expect(g.outputs).toEqual(['save']);
  });

  it('enlarges with a library upscale model and links every step', () => {
    const g = upscaleGraph('a.png', 'up-1');
    expect(g.prompt.model!.inputs.model_name).toEqual({ $model: 'up-1' });
    expect(g.prompt.scale!.inputs).toEqual({ upscale_model: ['model', 0], image: ['source', 0] });
    expect(g.prompt.save!.inputs.images).toEqual(['scale', 0]);
  });
});

describe('batch dialog', () => {
  beforeEach(() => {
    backend.setStepDelay(0);
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    useGallery.getState().setImages([picture('a.png', 'b1'), picture('b.png', null), picture('c.wav', null, 'audio')]);
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS }, status: 'ready' });
    useModels.setState({ models: [] });
    useBatch.setState({ names: null });
  });
  afterEach(() => {
    cleanup();
    useBatch.getState().close();
    vi.restoreAllMocks();
  });

  it('queues one job per picture on the picture own board, leaving out what is not a picture', async () => {
    const enqueue = vi.spyOn(backend, 'enqueue').mockResolvedValue([]);
    mount();
    useBatch.getState().open(['a.png', 'b.png', 'c.wav']);
    fireEvent.click(await screen.findByTestId('batch-run'));
    await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(2));
    const requests = enqueue.mock.calls.map((c) => c[0] as EnqueueRequest);
    expect(requests.map((r) => r.boardId)).toEqual(['b1', null]);
    expect(requests.map((r) => r.comfyGraph!.prompt.source!.inputs.image)).toEqual([{ $image: 'a.png' }, { $image: 'b.png' }]);
    expect(requests.every((r) => r.destination === 'gallery' && r.comfyGraph!.prompt.cut!.class_type === 'RMBG')).toBe(true);
    await waitFor(() => expect(useBatch.getState().names).toBeNull());
  });

  it('asks for the background pack when ComfyUI lacks it', async () => {
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS }, status: 'ready' });
    mount();
    useBatch.getState().open(['a.png']);
    expect(await screen.findByTestId('batch-needs')).toBeTruthy();
    expect((screen.getByTestId('batch-run') as HTMLButtonElement).disabled).toBe(true);
  });

  it('needs an upscale model to enlarge, and uses it for each picture', async () => {
    const enqueue = vi.spyOn(backend, 'enqueue').mockResolvedValue([]);
    mount();
    useBatch.getState().open(['a.png', 'b.png']);
    fireEvent.click(await screen.findByTestId('batch-op-upscale'));
    expect((screen.getByTestId('batch-run') as HTMLButtonElement).disabled).toBe(true);
    useModels.setState({ models: [{ key: 'up-1', name: 'RealESRGAN x4', base: 'any', type: 'spandrel_image_to_image', format: 'checkpoint', description: '', path: '', size: 1, source: '' }] });
    await waitFor(() => expect((screen.getByTestId('batch-run') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('batch-run'));
    await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(2));
    const graph = (enqueue.mock.calls[0]![0] as EnqueueRequest).comfyGraph!;
    expect(graph.prompt.model!.inputs.model_name).toEqual({ $model: 'up-1' });
  });
});
