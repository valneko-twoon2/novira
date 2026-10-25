// @vitest-environment jsdom
// The describe-a-picture dialog beyond the happy path: picking a file, a failed run, cancelling, copying, the pack buttons.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { t } from '@/i18n';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { runTextJob } from '@/state/comfy/runGraph';
import { useCaptionDialog } from '@/state/dialogs/caption';
import { useGallery } from '@/state/gallery';
import { useParams } from '@/state/params';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { CaptionDialog } from './CaptionDialog';

vi.mock('@/state/comfy/runGraph', () => ({ runTextJob: vi.fn(), runJob: vi.fn() }));

const picture = (name: string, mediaType: 'image' | 'video' = 'image') =>
  ({ name, mediaType, url: `blob:${name}`, thumbnailUrl: `blob:${name}`, width: 200, height: 100, createdAt: 0, boardId: null, starred: false, isIntermediate: false, category: 'general', metadata: null, workflow: null }) as ImageDTO;
const mount = () =>
  render(
    <TooltipProvider>
      <CaptionDialog />
    </TooltipProvider>,
  );
const lastToast = () => useToasts.getState().toasts.at(-1);

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useGallery.getState().setImages([picture('photo.png'), picture('clip.mp4', 'video')]);
  useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS }, status: 'ready' });
  useNodePacks.setState({ packs: { available: true, installed: [], comfyVersion: null, restartNeeded: false } });
  useParams.setState({ positivePrompt: 'masterpiece' });
  vi.mocked(runTextJob).mockReset().mockResolvedValue('a girl reading');
});
afterEach(async () => {
  cleanup();
  useCaptionDialog.getState().close();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await waitFor(() => expect(useComfyNodes.getState().status).not.toBe('loading'));
});

describe('picking the picture', () => {
  it('uploads a picked file and shows it, or reports why it could not', async () => {
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue(picture('up.png'));
    mount();
    useCaptionDialog.getState().show();
    await screen.findByTestId('caption-pick');
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    const file = new File(['x'], 'x.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
    await waitFor(() => expect(useCaptionDialog.getState().imageName).toBe('up.png'));
    expect(upload).toHaveBeenCalled();

    upload.mockRejectedValue(new Error('too large'));
    fireEvent.change(input);
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('too large');
  });

  it('takes a dropped file or a dropped gallery picture, but not a video', async () => {
    vi.spyOn(backend, 'uploadImage').mockResolvedValue(picture('up.png'));
    mount();
    useCaptionDialog.getState().show();
    const stage = (await screen.findByTestId('caption-pick')).closest('.cap__stage')!;
    const drop = (names: string[]) => fireEvent.drop(stage, { dataTransfer: { types: ['application/x-novira-images'], files: [], getData: () => JSON.stringify(names) } });
    drop(['clip.mp4']);
    expect(useCaptionDialog.getState().imageName).toBeNull();
    drop(['photo.png']);
    await waitFor(() => expect(useCaptionDialog.getState().imageName).toBe('photo.png'));
    const file = new File(['x'], 'x.png', { type: 'image/png' });
    fireEvent.drop(stage, { dataTransfer: { types: ['Files'], files: [file], getData: () => '' } });
    await waitFor(() => expect(useCaptionDialog.getState().imageName).toBe('up.png'));
  });

  it('lets a picture be swapped for another file', async () => {
    mount();
    useCaptionDialog.getState().show('photo.png');
    const other = await screen.findByText(t('caption.otherPicture'));
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(other);
    expect(click).toHaveBeenCalled();
  });
});

describe('running', () => {
  it('reports a failed description and offers to run it again', async () => {
    vi.mocked(runTextJob).mockRejectedValue(new Error('engine busy'));
    mount();
    useCaptionDialog.getState().show('photo.png');
    fireEvent.click(await screen.findByTestId('caption-run'));
    expect((await screen.findByRole('alert')).textContent).toContain('engine busy');
    vi.mocked(runTextJob).mockResolvedValue('second try');
    fireEvent.click(screen.getByTestId('caption-run'));
    expect(((await screen.findByTestId('caption-text')) as HTMLTextAreaElement).value).toBe('second try');
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByTestId('caption-run'));
    await waitFor(() => expect(runTextJob).toHaveBeenCalledTimes(3));
  });

  it('cancels a running description without an error', async () => {
    let signal!: AbortSignal;
    vi.mocked(runTextJob).mockImplementation(
      (_request, s) =>
        new Promise((_resolve, reject) => {
          signal = s as AbortSignal;
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    mount();
    useCaptionDialog.getState().show('photo.png');
    fireEvent.click(await screen.findByTestId('caption-run'));
    fireEvent.click(await screen.findByTestId('caption-cancel'));
    expect(signal.aborted).toBe(true);
    await waitFor(() => expect(screen.queryByTestId('caption-cancel')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('the result', () => {
  it('copies the text to the clipboard, or says it could not', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    mount();
    useCaptionDialog.getState().show('photo.png');
    fireEvent.click(await screen.findByTestId('caption-run'));
    await screen.findByTestId('caption-text');
    fireEvent.click(screen.getByTestId('caption-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('a girl reading'));
    await waitFor(() => expect(lastToast()?.status).toBe('success'));
    writeText.mockRejectedValue(new Error('no'));
    fireEvent.click(screen.getByTestId('caption-copy'));
    await waitFor(() => expect(lastToast()?.status).toBe('error'));
  });
});

describe('the pack', () => {
  it('shows a spinner while the node list loads, and offers a restart once the pack is installed', async () => {
    useComfyNodes.setState({ defs: null, status: 'loading' });
    vi.spyOn(useComfyNodes.getState(), 'load').mockResolvedValue(undefined as never);
    mount();
    useCaptionDialog.getState().show('photo.png');
    expect(await screen.findByText(t('caption.loading'))).toBeTruthy();
    cleanup();
    useComfyNodes.setState({ defs: { ...MOCK_NODE_DEFS }, status: 'ready' });
    useNodePacks.setState({ packs: { available: true, installed: [{ folder: 'ComfyUI-Florence2', url: null, version: null }], comfyVersion: null, restartNeeded: true } });
    mount();
    useCaptionDialog.getState().show('photo.png');
    expect(await screen.findByTestId('caption-needs')).toBeTruthy();
  });
});
