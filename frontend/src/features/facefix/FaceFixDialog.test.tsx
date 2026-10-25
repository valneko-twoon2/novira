// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type GenerationMetadata, type ImageDTO, type ModelConfig } from '@/backend';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { runJob } from '@/state/comfy/runGraph';
import { useFaceFixDialog } from '@/state/dialogs/facefix';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { TooltipProvider } from '@/ui';
import { FaceFixDialog } from './FaceFixDialog';

vi.mock('@/state/comfy/runGraph', () => ({ runJob: vi.fn() }));

const metadata: GenerationMetadata = {
  generationMode: 'txt2img',
  positivePrompt: '1girl, brown hair',
  negativePrompt: 'lowres',
  modelKey: 'main-xl',
  modelName: 'Main XL',
  vaeKey: null,
  seed: 1,
  steps: 30,
  cfgScale: 6,
  cfgRescale: 0,
  scheduler: 'dpmpp_2m_k',
  width: 200,
  height: 100,
  clipSkip: 0,
  seamlessX: false,
  seamlessY: false,
  loras: [],
};

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
  metadata,
  workflow: null,
};

const main = { key: 'main-xl', name: 'Main XL', base: 'sdxl', type: 'main', format: 'checkpoint', description: '', path: '', size: 0, source: '' } as ModelConfig;

const mount = () =>
  render(
    <TooltipProvider>
      <FaceFixDialog />
    </TooltipProvider>,
  );

describe('fix the face', () => {
  beforeEach(() => {
    backend.setStepDelay(0);
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    useGallery.getState().setImages([photo]);
    useModels.getState().setModels([main]);
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS }, status: 'ready' });
    // The dialog reads the nodes again when it opens: ComfyUI answers with the packs' nodes unless a test says otherwise.
    vi.spyOn(backend, 'nodeDefs').mockResolvedValue({ ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS } as never);
    useNodePacks.setState({ packs: { available: true, installed: [], comfyVersion: null, restartNeeded: false } });
    useFaceFixDialog.setState({ imageName: null });
    vi.mocked(runJob).mockReset().mockResolvedValue({ ...photo, name: 'fixed.png', url: 'blob:fixed' });
  });
  afterEach(async () => {
    cleanup();
    useFaceFixDialog.getState().close();
    await waitFor(() => expect(useComfyNodes.getState().status).not.toBe('loading'));
    vi.restoreAllMocks();
  });

  it('stays closed until a picture is chosen', () => {
    mount();
    expect(screen.queryByTestId('facefix-dialog')).toBeNull();
  });

  it('offers to install the Impact Pack when ComfyUI does not know its node', async () => {
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS }, status: 'ready' });
    vi.spyOn(backend, 'nodeDefs').mockResolvedValue({ ...MOCK_NODE_DEFS } as never);
    mount();
    useFaceFixDialog.getState().open('photo.png');
    expect(await screen.findByTestId('facefix-needs-impact')).toBeTruthy();
    expect(screen.queryByTestId('facefix-run')).toBeNull();
  });

  it('reads the nodes again when it opens, so a pack that was installed and loaded since shows up', async () => {
    // Read before the pack was there: the old list has no FaceDetailer.
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS }, status: 'ready' });
    const read = vi.spyOn(backend, 'nodeDefs').mockResolvedValue({ ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS } as never);
    mount();
    useFaceFixDialog.getState().open('photo.png');
    expect(await screen.findByTestId('facefix-run')).toBeTruthy();
    expect(read).toHaveBeenCalled();
    expect(screen.queryByTestId('facefix-needs-impact')).toBeNull();
  });

  it('says so when the packs are loaded but no face detector file is found', async () => {
    const noDetector = JSON.parse(JSON.stringify({ ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS }));
    noDetector.UltralyticsDetectorProvider.input.required.model_name = [['segm/person_yolov8m-seg.pt']];
    useComfyNodes.setState({ defs: noDetector, status: 'ready' });
    vi.spyOn(backend, 'nodeDefs').mockResolvedValue(noDetector);
    mount();
    useFaceFixDialog.getState().open('photo.png');
    expect(await screen.findByTestId('facefix-no-detector')).toBeTruthy();
    expect(screen.queryByTestId('facefix-run')).toBeNull();
  });

  it('starts with the picture\'s own prompt and model, and redraws its faces with them on the same board', async () => {
    mount();
    useFaceFixDialog.getState().open('photo.png');
    expect(((await screen.findByTestId('facefix-prompt')) as HTMLTextAreaElement).value).toBe('1girl, brown hair');
    fireEvent.click(screen.getByTestId('facefix-run'));
    await screen.findByTestId('facefix-done');
    const request = vi.mocked(runJob).mock.calls[0]![0];
    expect(request.destination).toBe('gallery');
    expect(request.boardId).toBe('b1');
    const prompt = request.comfyGraph!.prompt;
    expect(prompt.ckpt!.inputs.ckpt_name).toEqual({ $model: 'main-xl' });
    expect(prompt.pos!.inputs.text).toBe('1girl, brown hair');
    expect(prompt.neg!.inputs.text).toBe('lowres');
    expect(prompt.face!.class_type).toBe('FaceDetailer');
    expect(prompt.detector!.inputs.model_name).toMatch(/^bbox\/.*face/);
    expect((screen.getByTestId('facefix-result') as HTMLImageElement).src).toContain('blob:fixed');
  });

  it('finds the model of a picture made elsewhere by its name', async () => {
    const other = { ...main, key: 'other', name: 'Other XL' } as ModelConfig;
    useModels.getState().setModels([other, { ...main, key: 'wai', name: 'waiIllustriousSDXL_v170' } as ModelConfig]);
    useGallery.getState().setImages([{ ...photo, metadata: { ...metadata, modelKey: '', modelName: 'WAI-illustrious-SDXL-v17' } }]);
    mount();
    useFaceFixDialog.getState().open('photo.png');
    fireEvent.click(await screen.findByTestId('facefix-run'));
    await screen.findByTestId('facefix-done');
    expect(vi.mocked(runJob).mock.calls[0]![0].comfyGraph!.prompt.ckpt!.inputs.ckpt_name).toEqual({ $model: 'wai' });
  });

  it('compares the result with the original in the viewer', async () => {
    mount();
    useFaceFixDialog.getState().open('photo.png');
    fireEvent.click(await screen.findByTestId('facefix-run'));
    fireEvent.click(await screen.findByTestId('facefix-open'));
    expect(useGallery.getState().selection).toEqual(['fixed.png']);
    expect(useGallery.getState().compareImageName).toBe('photo.png');
    expect(useFaceFixDialog.getState().imageName).toBeNull();
  });

  it('shows why it failed and lets it be tried again', async () => {
    vi.mocked(runJob).mockRejectedValueOnce(new Error('out of memory'));
    mount();
    useFaceFixDialog.getState().open('photo.png');
    fireEvent.click(await screen.findByTestId('facefix-run'));
    expect((await screen.findByRole('alert')).textContent).toContain('out of memory');
    expect(screen.queryByTestId('facefix-done')).toBeNull();
    fireEvent.click(screen.getByTestId('facefix-run'));
    await screen.findByTestId('facefix-done');
  });
});
