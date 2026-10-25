// @vitest-environment jsdom
// The Video screen of the Generate tab: the form on the left and the finished clips in the middle.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO, type ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { useFinish } from '@/state/dialogs/finish';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { usePacks } from '@/state/media/packs';
import { useVideo } from '@/state/media/video';
import { useToasts } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { TooltipProvider } from '@/ui';
import { registerVideoFeature } from './register';
import { VideoPanel, VideoResults } from './VideoView';

const initial = { video: useVideo.getState(), gallery: useGallery.getState(), toasts: useToasts.getState() };
const form = () => useVideo.getState().form;
const lastToast = () => useToasts.getState().toasts.at(-1);
const picture = (name: string, over: Partial<ImageDTO> = {}): ImageDTO => ({ name, url: `blob:${name}`, thumbnailUrl: `blob:t-${name}`, width: 832, height: 480, mediaType: 'image', createdAt: 1, ...over }) as ImageDTO;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  registerVideoFeature();
  useUi.setState({ activeTab: 'generate', media: 'video' });
  usePacks.getState().setPack('video', { state: 'ready' });
  usePacks.getState().setPack('turbo', { state: 'ready' });
  useVideo.setState({ ...initial.video, form: { ...initial.video.form } }, true);
  useGallery.setState({ ...initial.gallery, images: [], selection: [] }, true);
  useToasts.setState(initial.toasts, true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const panel = () =>
  render(
    <TooltipProvider>
      <VideoPanel />
    </TooltipProvider>,
  );
const num = (label: string) => screen.getAllByLabelText(label).find((e) => (e as HTMLInputElement).type === 'number') as HTMLInputElement;
const setNum = (label: string, value: number) => {
  fireEvent.change(num(label), { target: { value: String(value) } });
  fireEvent.blur(num(label));
};

describe('VideoPanel form', () => {
  it('switches between text and image mode', () => {
    panel();
    expect(screen.queryByText(t('video.pickFromGallery'))).toBeNull();
    fireEvent.click(screen.getByTestId('video-mode-image'));
    expect(form().mode).toBe('image');
    expect(screen.getByText(t('video.sourceHint'))).toBeTruthy();
    fireEvent.click(screen.getByTestId('video-mode-text'));
    expect(form().mode).toBe('text');
  });

  it('edits the prompts and the numbers', () => {
    panel();
    fireEvent.change(screen.getByTestId('video-prompt'), { target: { value: 'a sunrise' } });
    expect(form().positivePrompt).toBe('a sunrise');
    fireEvent.change(screen.getAllByRole('textbox')[1]!, { target: { value: 'ugly' } });
    expect(form().negativePrompt).toBe('ugly');
    setNum(t('video.fps'), 12);
    setNum(t('video.steps'), 30);
    setNum(t('video.cfg'), 7.5);
    setNum(t('video.lengthLabel'), 4);
    expect(form()).toMatchObject({ fps: 12, steps: 30, cfgScale: 7.5, seconds: 4 });
  });

  it('turns on the light settings, and grays out the seed box and the roll button while a new seed is drawn each time', () => {
    panel();
    const light = within(screen.getByTestId('video-light'));
    fireEvent.click(light.getByLabelText(t('video.light.fp8')));
    fireEvent.click(light.getByLabelText(t('video.light.tiled')));
    expect(form()).toMatchObject({ fp8: true, tiledDecode: true });
    const box = () => screen.getByLabelText(t('params.seed.label')) as HTMLInputElement;
    const roll = () => screen.getByRole('button', { name: t('params.seed.shuffle') }) as HTMLButtonElement;
    expect(form().randomizeSeed).toBe(true);
    expect([box().disabled, roll().disabled]).toEqual([true, true]);
    fireEvent.click(screen.getByTestId('seed-fixed'));
    expect(form().randomizeSeed).toBe(false);
    expect([box().disabled, roll().disabled]).toEqual([false, false]);
    setNum(t('params.seed.label'), 99);
    expect(form().seed).toBe(99);
    fireEvent.click(roll());
    expect(form().seed).not.toBe(99);
  });

  it('chooses the model with its pack card while a model is missing', () => {
    usePacks.getState().setPack('video', { state: 'missing', totalBytes: 1e9 });
    usePacks.getState().setPack('turbo', { state: 'missing', totalBytes: 1e9 });
    panel();
    fireEvent.click(within(screen.getByTestId('video-pack')).getByText(t('video.model.fast')));
    expect(form().model).toBe('fast');
    fireEvent.click(within(screen.getByTestId('video-pack')).getByText(t('video.model.standard')));
    expect(form().model).toBe('standard');
  });
});

describe('an installed video model', () => {
  const wan = { key: 'wan-1', name: 'wan2.1_t2v_1.3B', base: 'wan', type: 'diffusion_model', format: 'checkpoint', description: '', path: 'p', size: 1, source: 'local' } as ModelConfig;

  it('needs no download card and no pack, and says which family it is', () => {
    usePacks.getState().setPack('video', { state: 'missing', totalBytes: 1e9 });
    usePacks.getState().setPack('turbo', { state: 'missing', totalBytes: 1e9 });
    useModels.setState({ models: [wan] });
    useVideo.getState().setForm({ modelKey: 'wan-1', positivePrompt: 'a wave' });
    panel();
    expect(screen.queryByTestId('video-pack')).toBeNull();
    expect(screen.getByText(t('video.model.ownHint', { family: 'Wan' }))).toBeTruthy();
    expect(screen.queryByText(t('video.problem.pack'))).toBeNull();
  });

  it('is reported when the model it names is gone', () => {
    useModels.setState({ models: [] });
    useVideo.getState().setForm({ modelKey: 'wan-1', positivePrompt: 'a wave' });
    panel();
    expect(screen.getByTestId('video-problems').textContent).toBe(t('video.problem.model'));
  });
});

describe('the source picture', () => {
  beforeEach(() => useVideo.getState().setForm({ mode: 'image' }));

  it('takes the picture selected in the gallery, but not a video or nothing', () => {
    useGallery.setState({ images: [picture('a.png'), picture('v.mp4', { mediaType: 'video' })], selection: [] });
    panel();
    fireEvent.click(screen.getByText(t('video.pickFromGallery')));
    expect(lastToast()?.status).toBe('warning');
    act(() => useGallery.setState({ selection: ['v.mp4'] }));
    fireEvent.click(screen.getByText(t('video.pickFromGallery')));
    expect(form().sourceImageName).toBeNull();
    act(() => useGallery.setState({ selection: ['a.png'] }));
    fireEvent.click(screen.getByText(t('video.pickFromGallery')));
    expect(form().sourceImageName).toBe('a.png');
    expect(document.querySelector('.vv-source__preview img')!.getAttribute('src')).toBe('blob:t-a.png');
    fireEvent.click(screen.getByLabelText(t('video.clearImage')));
    expect(form().sourceImageName).toBeNull();
  });

  it('uploads a dropped file as the source, or reports why it could not', async () => {
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue(picture('up.png'));
    panel();
    const zone = screen.getByText(t('video.sourceHint')).closest('.vv-source')!;
    const file = new File(['x'], 'x.png', { type: 'image/png' });
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [file], getData: () => '' } });
    await waitFor(() => expect(form().sourceImageName).toBe('up.png'));
    expect(upload).toHaveBeenCalled();
    expect(useGallery.getState().images.some((i) => i.name === 'up.png')).toBe(true);

    upload.mockRejectedValue(new Error('too large'));
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [file], getData: () => '' } });
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'error', description: 'too large' }));
  });

  it('takes a picture dragged from the gallery, but not a video', () => {
    useGallery.setState({ images: [picture('a.png'), picture('v.mp4', { mediaType: 'video' })] });
    panel();
    const zone = screen.getByText(t('video.sourceHint')).closest('.vv-source')!;
    const drop = (names: string[]) => fireEvent.drop(zone, { dataTransfer: { types: ['application/x-novira-images'], files: [], getData: () => JSON.stringify(names) } });
    drop(['v.mp4']);
    expect(form().sourceImageName).toBeNull();
    drop(['a.png']);
    return waitFor(() => expect(form().sourceImageName).toBe('a.png'));
  });
});

describe('VideoResults', () => {
  const results = () =>
    render(
      <TooltipProvider>
        <VideoResults />
      </TooltipProvider>,
    );

  it('shows the empty state until there is a clip', () => {
    results();
    expect(screen.getByText(t('video.empty.title'))).toBeTruthy();
  });

  it('lists the clips newest first with their length and seed, opens the finishing dialog and deletes a clip', async () => {
    const clip = (name: string, createdAt: number, meta = true) =>
      picture(name, { mediaType: 'video', createdAt, metadata: meta ? ({ positivePrompt: `prompt ${name}`, seed: 5, videoFrames: 48, videoFps: 24 } as never) : null });
    useGallery.setState({ images: [clip('old.mp4', 1), clip('new.mp4', 2), clip('bare.mp4', 0, false), picture('still.png')] });
    const del = vi.spyOn(backend, 'deleteImages').mockResolvedValue(undefined);
    results();
    const clips = screen.getAllByTestId('video-clip');
    expect(clips.map((c) => c.querySelector('.vv-clip__prompt')?.textContent)).toEqual(['prompt new.mp4', 'prompt old.mp4', '']);
    expect(clips[0]!.querySelector('.vv-clip__info')!.textContent).toContain('seed 5');
    expect(clips[0]!.querySelector('.vv-clip__info')!.textContent).toContain('832×480');
    fireEvent.click(within(clips[0]!).getByTestId('video-finish'));
    expect(useFinish.getState().name).toBe('new.mp4');
    fireEvent.click(within(clips[1]!).getByLabelText(t('video.delete')));
    await waitFor(() => expect(del).toHaveBeenCalledWith(['old.mp4']));
    await waitFor(() => expect(useGallery.getState().images.some((i) => i.name === 'old.mp4')).toBe(false));
  });
});
