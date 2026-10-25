// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { runTextJob } from '@/state/comfy/runGraph';
import { useCaptionDialog } from '@/state/dialogs/caption';
import { useGallery } from '@/state/gallery';
import { useParams } from '@/state/params';
import { TooltipProvider } from '@/ui';
import { CaptionDialog } from './CaptionDialog';

vi.mock('@/state/comfy/runGraph', () => ({ runTextJob: vi.fn(), runJob: vi.fn() }));

const photo = { name: 'photo.png', mediaType: 'image', url: 'blob:photo', thumbnailUrl: 'blob:photo', width: 200, height: 100, createdAt: 0, boardId: 'b1', starred: false, isIntermediate: false, category: 'general', metadata: null, workflow: null } as ImageDTO;

const mount = () =>
  render(
    <TooltipProvider>
      <CaptionDialog />
    </TooltipProvider>,
  );

describe('describe as a prompt', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    useGallery.getState().setImages([photo]);
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS }, status: 'ready' });
    useNodePacks.setState({ packs: { available: true, installed: [], comfyVersion: null, restartNeeded: false } });
    useParams.setState({ positivePrompt: 'masterpiece' });
    vi.mocked(runTextJob).mockReset().mockResolvedValue(' 1girl, solo,  blue hair, solo ');
  });
  afterEach(async () => {
    cleanup();
    useCaptionDialog.getState().close();
    await waitFor(() => expect(useComfyNodes.getState().status).not.toBe('loading'));
  });

  it('offers to install the pack when ComfyUI does not know the node', async () => {
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS }, status: 'ready' });
    mount();
    useCaptionDialog.getState().show('photo.png');
    expect(await screen.findByTestId('caption-needs')).toBeTruthy();
    expect(screen.getByTestId('caption-install')).toBeTruthy();
    expect(screen.queryByTestId('caption-run')).toBeNull();
  });

  it('asks for a picture when opened without one', async () => {
    mount();
    useCaptionDialog.getState().show();
    expect(await screen.findByTestId('caption-pick')).toBeTruthy();
    expect((screen.getByTestId('caption-run') as HTMLButtonElement).disabled).toBe(true);
  });

  it('describes the picture as a hidden text job and adds the tidy text to the prompt', async () => {
    mount();
    useCaptionDialog.getState().show('photo.png');
    fireEvent.click(await screen.findByTestId('caption-run'));
    const text = (await screen.findByTestId('caption-text')) as HTMLTextAreaElement;
    expect(text.value).toBe('1girl, solo, blue hair');
    const request = vi.mocked(runTextJob).mock.calls[0]![0];
    expect(request.destination).toBe('intermediate');
    expect(request.comfyGraph!.prompt.caption!.inputs.task).toBe('prompt_gen_tags');
    fireEvent.click(screen.getByTestId('caption-append'));
    expect(useParams.getState().positivePrompt).toBe('masterpiece, 1girl, solo, blue hair');
    expect(useCaptionDialog.getState().open).toBe(false);
  });

  it('replaces the prompt with the edited text', async () => {
    mount();
    useCaptionDialog.getState().show('photo.png');
    fireEvent.click(await screen.findByTestId('caption-run'));
    fireEvent.change(await screen.findByTestId('caption-text'), { target: { value: 'a girl reading' } });
    fireEvent.click(screen.getByTestId('caption-replace'));
    expect(useParams.getState().positivePrompt).toBe('a girl reading');
  });
});
