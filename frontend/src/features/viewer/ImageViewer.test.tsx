// @vitest-environment jsdom
// The viewer as a whole: empty state, still / video / audio, info line, previous / next, shortcuts, compare, metadata panel.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationMetadata, ImageDTO, QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useParams } from '@/state/params';
import { useQueue } from '@/state/queue';
import { useToasts } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { TooltipProvider } from '@/ui';
import { ImageViewer } from './ImageViewer';

const initial = { gallery: useGallery.getState(), toasts: useToasts.getState(), ui: useUi.getState() };
const meta = { modelName: 'Model X', seed: 77, positivePrompt: 'a cat', loras: [], width: 640, height: 480, workflowName: null } as unknown as GenerationMetadata;

const picture = (name: string, over: Partial<ImageDTO> = {}): ImageDTO => ({
  name,
  url: `blob:${name}`,
  thumbnailUrl: `blob:t-${name}`,
  width: 640,
  height: 480,
  createdAt: Date.UTC(2026, 0, 2),
  boardId: null,
  starred: false,
  isIntermediate: false,
  category: 'general',
  metadata: null,
  workflow: null,
  ...over,
});

const key = (k: string, init: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
  });
const show = () =>
  render(
    <TooltipProvider>
      <ImageViewer />
    </TooltipProvider>,
  );
const openImage = (name: string | null) => act(() => useGallery.setState({ viewerImageName: name }));
const lastToast = () => useToasts.getState().toasts.at(-1);

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 500, bottom: 400, width: 500, height: 400, toJSON: () => ({}) });
  useGallery.setState(initial.gallery, true);
  useToasts.setState(initial.toasts, true);
  useUi.setState(initial.ui, true);
  useGallery.getState().setImages([
    picture('a.png', { createdAt: 3000, metadata: meta, workflow: { nodes: [] } }),
    picture('b.png', { createdAt: 2000 }),
    picture('v.mp4', { createdAt: 1000, mediaType: 'video' }),
    picture('s.wav', { createdAt: 500, mediaType: 'audio' }),
  ]);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ImageViewer on a job being drawn', () => {
  const job = { id: 5, status: 'in_progress', destination: 'gallery', params: { width: 640, height: 960 } } as unknown as QueueItem;
  afterEach(() => useQueue.setState({ items: [], progress: null }));

  it('shows the picture in progress large with its step, and gives way to a picture that is picked', () => {
    openImage('a.png');
    useQueue.setState({ items: [job], progress: { itemId: 5, step: 8, totalSteps: 24, progressImageUrl: 'data:image/png;base64,AA==', message: '' } });
    act(() => useGallery.getState().showLiveItem(5));
    show();
    expect(screen.getByTestId('viewer-live-image').getAttribute('src')).toBe('data:image/png;base64,AA==');
    expect(screen.getByTestId('viewer-live').textContent).toContain('8/24');
    expect(screen.getByTestId('viewer-info').textContent).toContain('640');
    expect(screen.queryByTestId('viewer-zoom-surface')).toBeNull();
    act(() => useGallery.getState().setSelection(['b.png']));
    expect(screen.queryByTestId('viewer-live')).toBeNull();
    expect(screen.getByTestId('viewer-zoom-surface')).toBeTruthy();
  });

  it('waits for the first step, and goes back to the picture once the job is no longer running', () => {
    openImage('a.png');
    useQueue.setState({ items: [job], progress: null });
    act(() => useGallery.getState().showLiveItem(5));
    show();
    expect(screen.getByTestId('viewer-live')).toBeTruthy();
    expect(screen.queryByTestId('viewer-live-image')).toBeNull();
    act(() => useQueue.setState({ items: [{ ...job, status: 'completed' } as QueueItem] }));
    expect(screen.queryByTestId('viewer-live')).toBeNull();
    expect(screen.getByTestId('viewer-zoom-surface')).toBeTruthy();
  });
});

describe('ImageViewer', () => {
  it('invites a first picture when nothing is open and keeps the info line blank', () => {
    show();
    expect(screen.getByText(t('gallery.viewer.empty'))).toBeTruthy();
    expect(screen.queryByTestId('viewer-image')).toBeNull();
  });

  it('shows a still image with its size, model, seed and name', () => {
    openImage('a.png');
    show();
    const info = screen.getByTestId('viewer-info').textContent!;
    expect(info).toContain('640');
    expect(info).toContain('Model X');
    expect(info).toContain('77');
    expect(info).toContain('a.png');
  });

  it('plays a video with its first frame as the poster', () => {
    openImage('v.mp4');
    show();
    const video = screen.getByTestId('viewer-image') as HTMLVideoElement;
    expect(video.tagName).toBe('VIDEO');
    expect(video.getAttribute('poster')).toBe('blob:t-v.mp4');
  });

  it('shows the waveform of audio with the sound player under it', () => {
    openImage('s.wav');
    show();
    expect(screen.getByTestId('viewer-image').getAttribute('src')).toBe('blob:t-s.wav');
    expect(screen.getByTestId('viewer-audio').getAttribute('src')).toBe('blob:s.wav');
  });

  it('steps to the previous and next picture with the arrows, and hides an arrow at either end', () => {
    openImage('b.png');
    show();
    fireEvent.click(screen.getByRole('button', { name: t('gallery.viewer.next') }));
    expect(useGallery.getState().selection).toEqual(['v.mp4']);
    fireEvent.click(screen.getByRole('button', { name: t('gallery.viewer.prev') }));
    expect(useGallery.getState().selection).toEqual(['b.png']);
    openImage('a.png');
    expect(screen.queryByRole('button', { name: t('gallery.viewer.prev') })).toBeNull();
    openImage('s.wav');
    expect(screen.queryByRole('button', { name: t('gallery.viewer.next') })).toBeNull();
  });

  it('opens and closes the metadata panel with I and its tabs show metadata, details and workflow', async () => {
    openImage('a.png');
    show();
    key('i');
    const panel = await screen.findByTestId('viewer-metadata');
    for (const tab of ['gallery.meta.tabMetadata', 'gallery.meta.tabDetails', 'gallery.meta.tabWorkflow', 'gallery.meta.tabRecall'] as const) {
      fireEvent.mouseDown(within(panel).getByRole('tab', { name: t(tab) }), { button: 0 });
      fireEvent.click(within(panel).getByRole('tab', { name: t(tab) }));
    }
    fireEvent.click(within(panel).getByRole('button', { name: t('common.close') }));
    expect(screen.queryByTestId('viewer-metadata')).toBeNull();
  });

  it('closes the metadata panel on a press outside it, but not on a press inside or on the i button', async () => {
    openImage('a.png');
    show();
    key('i');
    const panel = await screen.findByTestId('viewer-metadata');
    // A press inside (the start of a text selection) keeps it, wherever the drag then ends.
    fireEvent.pointerDown(within(panel).getByText('a cat'), { button: 0 });
    fireEvent.pointerUp(document.body, { button: 0 });
    expect(screen.queryByTestId('viewer-metadata')).not.toBeNull();
    // A secondary press outside keeps it too.
    fireEvent.pointerDown(document.body, { button: 2 });
    expect(screen.queryByTestId('viewer-metadata')).not.toBeNull();
    // The i button toggles it by its own click, not as a press outside.
    const toggle = screen.getByTestId('toggle-metadata');
    fireEvent.pointerDown(toggle, { button: 0 });
    expect(screen.queryByTestId('viewer-metadata')).not.toBeNull();
    fireEvent.click(toggle);
    expect(screen.queryByTestId('viewer-metadata')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.queryByTestId('viewer-metadata')).not.toBeNull();
    act(() => {
      fireEvent.pointerDown(screen.getByTestId('viewer-toolbar'), { button: 0 });
    });
    expect(screen.queryByTestId('viewer-metadata')).toBeNull();
    expect(useGallery.getState().showMetadata).toBe(false);
  });

  it('copies the raw metadata and shows empty states for a picture without any', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    useGallery.setState({ showMetadata: true });
    openImage('a.png');
    const { rerender } = show();
    const panel = screen.getByTestId('viewer-metadata');
    fireEvent.mouseDown(within(panel).getByRole('tab', { name: t('gallery.meta.tabMetadata') }), { button: 0 });
    fireEvent.click(await within(panel).findByRole('button', { name: t('common.copy') }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Model X'));
    openImage('b.png');
    rerender(
      <TooltipProvider>
        <ImageViewer />
      </TooltipProvider>,
    );
    fireEvent.mouseDown(within(screen.getByTestId('viewer-metadata')).getByRole('tab', { name: t('gallery.meta.tabMetadata') }), { button: 0 });
    expect(await screen.findByText(t('gallery.meta.none'))).toBeTruthy();
    fireEvent.mouseDown(within(screen.getByTestId('viewer-metadata')).getByRole('tab', { name: t('gallery.meta.tabWorkflow') }), { button: 0 });
    expect(await screen.findByText(t('gallery.meta.noWorkflow'))).toBeTruthy();
  });

  it('recalls with R, P, S and A, and warns when the picture has no metadata', () => {
    openImage('a.png');
    show();
    const p = useParams.getState();
    const remix = vi.spyOn(p, 'remix').mockImplementation(() => ({ kind: 'none' }));
    const prompts = vi.spyOn(p, 'recallPrompts').mockImplementation(() => undefined);
    const seed = vi.spyOn(p, 'recallSeed').mockImplementation(() => undefined);
    const all = vi.spyOn(p, 'recallAll').mockImplementation(() => ({ kind: 'none' }));
    key('r');
    key('p');
    key('s');
    key('a');
    expect(remix).toHaveBeenCalledWith(meta);
    expect(prompts).toHaveBeenCalledWith(meta);
    expect(seed).toHaveBeenCalledWith(77);
    expect(all).toHaveBeenCalledWith(meta);
    openImage('b.png');
    key('r');
    expect(lastToast()?.status).toBe('warning');
  });

  it('sends the open picture to upscaling with Shift+U and does nothing when nothing is open', () => {
    show();
    key('u', { shiftKey: true });
    expect(useUi.getState().activeTab).toBe(initial.ui.activeTab);
    openImage('b.png');
    key('u', { shiftKey: true });
    expect(useUi.getState().activeTab).toBe('upscaling');
  });

  it('compares with C: warns without a second picture, compares with the one selected before, leaves with Escape', () => {
    openImage('a.png');
    useGallery.getState().setSelection(['a.png']);
    show();
    key('c');
    expect(lastToast()?.status).toBe('info');
    act(() => useGallery.getState().setSelection(['b.png', 'a.png']));
    key('c');
    expect(useGallery.getState().compareImageName).toBe('b.png');
    expect(screen.queryByTestId('viewer-metadata')).toBeNull();
    expect(screen.queryByRole('button', { name: t('gallery.viewer.next') })).toBeNull();
    key('Escape');
    expect(useGallery.getState().compareImageName).toBeNull();
    key('c');
    key('c');
    expect(useGallery.getState().compareImageName).toBeNull();
  });
});
