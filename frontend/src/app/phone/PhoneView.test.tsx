// @vitest-environment jsdom
// The phone layout's Images tab and the picture opened full screen: the board's pictures, the jobs drawn for it, the
// picture's place, its info, star, use its settings, delete, and the job that turns into the picture it made.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type BoardDTO, type GenerationMetadata, type ImageDTO, type QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useParams } from '@/state/params';
import { useQueue } from '@/state/queue';
import { useSettings } from '@/state/settings';
import { TooltipProvider } from '@/ui';
import { PAGE } from './PhoneImages';
import { PhoneShell } from './PhoneShell';
import { usePhone } from './phoneStore';

const initial = { gallery: useGallery.getState(), queue: useQueue.getState(), params: useParams.getState() };
const meta = { positivePrompt: 'a red fox', negativePrompt: 'blurry', modelName: 'Model X', modelKey: 'mx', seed: 42, width: 640, height: 480, loras: [] } as unknown as GenerationMetadata;
const picture = (name: string, over: Partial<ImageDTO> = {}): ImageDTO => ({
  name,
  url: `blob:${name}`,
  thumbnailUrl: `blob:t-${name}`,
  width: 640,
  height: 480,
  createdAt: 0,
  boardId: null,
  starred: false,
  isIntermediate: false,
  category: 'general',
  metadata: null,
  workflow: null,
  ...over,
});
const board = (id: string, name: string): BoardDTO => ({ id, name, archived: false, createdAt: 0 });
const running = (id: number, over: Partial<QueueItem> = {}): QueueItem =>
  ({ id, batchId: 'b', status: 'in_progress', origin: 'generate', destination: 'gallery', params: { width: 640, height: 480 }, boardId: null, createdAt: 0, startedAt: 0, completedAt: null, imageName: null, error: null, ...over }) as QueueItem;

const mount = () =>
  render(
    <TooltipProvider>
      <PhoneShell />
    </TooltipProvider>,
  );
const openImages = () => fireEvent.click(screen.getByTestId('phone-nav-images'));
const thumbs = () => screen.queryAllByTestId('phone-thumb').map((b) => b.getAttribute('aria-label'));

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useGallery.setState(initial.gallery, true);
  useQueue.setState(initial.queue, true);
  useParams.setState(initial.params, true);
  usePhone.setState({ tab: 'generate', view: null });
  useSettings.getState().set({ confirmOnDelete: false });
  useGallery.getState().setBoards([board('b1', 'Foxes')]);
  useGallery.getState().setImages([
    picture('new.png', { createdAt: 3, metadata: meta }),
    picture('mid.png', { createdAt: 2 }),
    picture('old.png', { createdAt: 1, starred: true }),
    picture('fox.png', { createdAt: 4, boardId: 'b1' }),
    picture('mask.png', { createdAt: 5, isIntermediate: true }),
    picture('logo.png', { createdAt: 6, category: 'other' }),
  ]);
  vi.spyOn(backend, 'updateImages').mockImplementation(async (names, patch) =>
    names.map((n) => ({ ...useGallery.getState().images.find((i) => i.name === n)!, ...patch })),
  );
  vi.spyOn(backend, 'deleteImages').mockResolvedValue();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('phone Images tab', () => {
  it('lists the pictures of the board in the gallery order, without helper pictures or assets', () => {
    mount();
    openImages();
    expect(screen.getByRole('heading', { name: t('phone.gallery') })).toBeTruthy();
    // Starred first, then newest first, as the desktop gallery sorts them.
    expect(thumbs()).toEqual(['old.png', 'new.png', 'mid.png']);
    expect(screen.getByTestId('phone-images-count').textContent).toBe('3');
  });

  it('shows another board when picked, and says when a board is empty', async () => {
    mount();
    openImages();
    act(() => useGallery.getState().selectBoard('b1'));
    expect(thumbs()).toEqual(['fox.png']);
    act(() => useGallery.getState().setImages([]));
    expect(screen.getByText(t('gallery.empty.noImages'))).toBeTruthy();
  });

  it('puts the jobs drawn for the board first and opens one full screen', () => {
    useQueue.setState({ items: [running(5), running(6, { boardId: 'b1' })], progress: { itemId: 5, step: 2, totalSteps: 8, progressImageUrl: 'data:image/png;base64,AA==', message: '' } });
    mount();
    openImages();
    const cells = screen.getAllByTestId('phone-live-thumb');
    expect(cells).toHaveLength(1);
    expect(cells[0]!.textContent).toContain('2/8');
    fireEvent.click(cells[0]!);
    expect(usePhone.getState().view).toEqual({ kind: 'live', itemId: 5 });
  });

  it('builds a page of cells at a time on a large board', () => {
    useGallery.getState().setImages(Array.from({ length: PAGE + 5 }, (_, i) => picture(`p${i}.png`, { createdAt: i })));
    mount();
    openImages();
    expect(thumbs()).toHaveLength(PAGE);
    expect(screen.getByTestId('phone-images-count').textContent).toBe(String(PAGE + 5));
  });
});

describe('a picture full screen', () => {
  const openPicture = (name: string) => {
    mount();
    openImages();
    fireEvent.click(screen.getByRole('button', { name }));
    return screen.getByTestId('phone-view');
  };

  it('shows its place in the board and steps to its neighbours', () => {
    const view = openPicture('new.png');
    expect(within(view).getByTestId('phone-view-place').textContent).toBe(t('phone.place', { index: 2, count: 3 }));
    expect(within(view).getByTestId('phone-view-image').getAttribute('src')).toBe('blob:new.png');
    fireEvent.click(screen.getByRole('button', { name: t('gallery.viewer.next') }));
    expect(usePhone.getState().view).toEqual({ kind: 'image', name: 'mid.png' });
    // The last one has no next.
    expect(screen.queryByRole('button', { name: t('gallery.viewer.next') })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t('gallery.viewer.prev') }));
    fireEvent.click(screen.getByRole('button', { name: t('gallery.viewer.prev') }));
    expect(usePhone.getState().view).toEqual({ kind: 'image', name: 'old.png' });
    expect(screen.queryByRole('button', { name: t('gallery.viewer.prev') })).toBeNull();
    fireEvent.click(screen.getByTestId('phone-view-close'));
    expect(screen.queryByTestId('phone-view')).toBeNull();
  });

  it('shows a picture outside the board (a draft) without a place or neighbours', () => {
    act(() => useGallery.getState().addImage(picture('draft.png', { isIntermediate: true })));
    mount();
    act(() => usePhone.getState().show({ kind: 'image', name: 'draft.png' }));
    expect(screen.getByTestId('phone-view-image').getAttribute('src')).toBe('blob:draft.png');
    expect(screen.getByTestId('phone-view-place').textContent).toBe('');
    expect(screen.queryByRole('button', { name: t('gallery.viewer.next') })).toBeNull();
    expect(screen.queryByRole('button', { name: t('gallery.viewer.prev') })).toBeNull();
  });

  it('shows what it was made with, or says it has no record of it', () => {
    openPicture('new.png');
    fireEvent.click(screen.getByTestId('phone-view-info'));
    const info = screen.getByTestId('phone-view-meta');
    expect(info.textContent).toContain('a red fox');
    expect(info.textContent).toContain('blurry');
    expect(info.textContent).toContain('Model X');
    expect(info.textContent).toContain('42');
    act(() => usePhone.getState().show({ kind: 'image', name: 'mid.png' }));
    expect(screen.getByTestId('phone-view-meta').textContent).toContain(t('gallery.toast.noMetadata'));
  });

  it('stars and unstars it', async () => {
    openPicture('mid.png');
    fireEvent.click(screen.getByTestId('phone-view-star'));
    await waitFor(() => expect(useGallery.getState().images.find((i) => i.name === 'mid.png')?.starred).toBe(true));
    expect(screen.getByTestId('phone-view-star').getAttribute('aria-pressed')).toBe('true');
  });

  it('takes its settings to the Generate tab, or cannot without a record of them', () => {
    openPicture('mid.png');
    expect((screen.getByTestId('phone-view-use') as HTMLButtonElement).disabled).toBe(true);
    act(() => usePhone.getState().show({ kind: 'image', name: 'new.png' }));
    fireEvent.click(screen.getByTestId('phone-view-use'));
    expect(useParams.getState().positivePrompt).toBe('a red fox');
    expect(usePhone.getState()).toMatchObject({ tab: 'generate', view: null });
  });

  it('gives way to the next picture when it is deleted, and closes after the last', async () => {
    openPicture('mid.png');
    fireEvent.click(screen.getByTestId('phone-view-delete'));
    await waitFor(() => expect(usePhone.getState().view).toEqual({ kind: 'image', name: 'new.png' }));
    expect(backend.deleteImages).toHaveBeenCalledWith(['mid.png']);
    act(() => useGallery.getState().setImages([]));
    await waitFor(() => expect(usePhone.getState().view).toBeNull());
  });

  it('opens the desktop picture menu from its button, without the items that go to screens a phone has not', async () => {
    openPicture('new.png');
    fireEvent.click(screen.getByTestId('phone-view-menu'));
    const items = (await screen.findAllByRole('menuitem')).map((e) => e.textContent ?? '');
    const has = (key: Parameters<typeof t>[0]) => items.some((text) => text.startsWith(t(key)));
    for (const key of ['gallery.menu.remix', 'gallery.menu.star', 'caption.menu', 'gallery.menu.useAsReference', 'gallery.menu.changeBoard', 'gallery.menu.delete'] as const) expect(has(key), key).toBe(true);
    for (const key of ['gallery.menu.openInViewer', 'gallery.menu.compare', 'gallery.menu.loadWorkflow', 'gallery.menu.sendToCanvas', 'gallery.menu.upscale', 'gallery.menu.segment'] as const) expect(has(key), key).toBe(false);
  });

  it('asks before deleting when the setting says so', () => {
    useSettings.getState().set({ confirmOnDelete: true });
    openPicture('mid.png');
    fireEvent.click(screen.getByTestId('phone-view-delete'));
    expect(screen.getByText(t('gallery.delete.title'))).toBeTruthy();
    expect(backend.deleteImages).not.toHaveBeenCalled();
  });
});

describe('a job full screen', () => {
  it('turns into the picture it made when it ends', () => {
    useQueue.setState({ items: [running(7)], progress: null });
    mount();
    act(() => usePhone.getState().show({ kind: 'live', itemId: 7 }));
    expect(screen.getByTestId('viewer-live')).toBeTruthy();
    act(() => useQueue.setState({ items: [running(7, { status: 'completed', imageName: 'new.png' })] }));
    expect(usePhone.getState().view).toEqual({ kind: 'image', name: 'new.png' });
    expect(screen.getByTestId('phone-view-image').getAttribute('src')).toBe('blob:new.png');
  });

  it('closes when it fails or is cancelled', () => {
    useQueue.setState({ items: [running(7)], progress: null });
    mount();
    act(() => usePhone.getState().show({ kind: 'live', itemId: 7 }));
    act(() => useQueue.setState({ items: [running(7, { status: 'canceled' })] }));
    expect(usePhone.getState().view).toBeNull();
  });
});
