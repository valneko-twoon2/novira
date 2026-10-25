// @vitest-environment jsdom
// The viewer's manga finish dialog: values, a try beside the original, the way to the pack while it is missing, and saving a new picture.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { useMangaDialog } from '@/state/dialogs/manga';
import { useGallery } from '@/state/gallery';
import { DEFAULT_MANGA, useMangaFinish } from '@/state/mangaFinish';
import { TooltipProvider } from '@/ui';
import { MangaFinishDialog } from './MangaFinishDialog';
import * as graph from './mangaGraph';

const URL = 'https://github.com/ashukae/ComfyUI-MangaScreen';
const initialPacks = useNodePacks.getState();
const installed = (restartNeeded = false) => ({ available: true, installed: [{ folder: 'ComfyUI-MangaScreen', url: URL, version: null }], comfyVersion: null, restartNeeded });

const photo = { name: 'photo.png', mediaType: 'image', url: 'blob:photo', thumbnailUrl: 'blob:photo', width: 200, height: 100, createdAt: 0, boardId: 'b1', starred: false, isIntermediate: false, category: 'general', metadata: null, workflow: null } as ImageDTO;

const mount = () =>
  render(
    <TooltipProvider>
      <MangaFinishDialog />
    </TooltipProvider>,
  );
const showDialog = () => act(() => useMangaDialog.getState().open('photo.png'));
const disabled = (id: string) => (screen.getByTestId(id) as HTMLButtonElement).disabled;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  localStorage.clear();
  useMangaFinish.getState().reset();
  useGallery.getState().setImages([photo]);
  useNodePacks.setState({ ...initialPacks, packs: installed(), jobs: {}, load: async () => {} }, true);
  useMangaDialog.setState({ imageName: null });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the manga finish dialog', () => {
  it('stays closed until a picture is chosen', () => {
    mount();
    expect(screen.queryByTestId('manga-dialog')).toBeNull();
  });

  it('shows the picture and no try yet, with every value at its default', () => {
    mount();
    showDialog();
    expect(screen.getByTestId('manga-dialog')).toBeTruthy();
    expect(screen.queryByTestId('manga-try-result')).toBeNull();
    expect(screen.queryByTestId('manga-pack-needs')).toBeNull();
    expect(useMangaFinish.getState().values).toEqual(DEFAULT_MANGA);
  });

  it('resets the values', () => {
    useMangaFinish.getState().set({ screenLines: 300, blackPoint: 0.5 });
    mount();
    showDialog();
    fireEvent.click(screen.getByTestId('manga-reset'));
    expect(useMangaFinish.getState().values).toEqual(DEFAULT_MANGA);
  });

  it('tries the values on the picture and shows the result beside it', async () => {
    useMangaFinish.getState().set({ screenLines: 120 });
    const run = vi.spyOn(graph, 'runMangaPreview').mockResolvedValue({ ...photo, name: 'q.png', url: 'blob:after' });
    mount();
    showDialog();
    fireEvent.click(screen.getByTestId('manga-try-run'));
    expect(((await screen.findByTestId('manga-try-result')) as HTMLImageElement).src).toContain('blob:after');
    expect(run).toHaveBeenCalledWith('photo.png', { ...DEFAULT_MANGA, screenLines: 120 }, expect.any(AbortSignal));
  });

  it('saves a new picture with the shown values, leaves the original, and opens it in the viewer', async () => {
    const save = vi.spyOn(graph, 'saveMangaPage').mockResolvedValue({ ...photo, name: 'page.png' });
    mount();
    showDialog();
    expect(screen.queryByTestId('manga-done')).toBeNull();
    fireEvent.click(screen.getByTestId('manga-save'));
    expect(await screen.findByTestId('manga-done')).toBeTruthy();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: 'photo.png' }), DEFAULT_MANGA, t('gallery.manga.title'), expect.any(AbortSignal));
    expect(useGallery.getState().images.map((i) => i.name)).toEqual(['photo.png']);
    fireEvent.click(screen.getByTestId('manga-open'));
    expect(useGallery.getState().selection).toEqual(['page.png']);
    expect(useMangaDialog.getState().imageName).toBeNull();
  });

  it('says why when the finish fails, and lets the user go on', async () => {
    vi.spyOn(graph, 'runMangaPreview').mockRejectedValue(new Error('out of memory'));
    mount();
    showDialog();
    fireEvent.click(screen.getByTestId('manga-try-run'));
    expect((await screen.findByTestId('manga-error')).textContent).toContain('out of memory');
    await waitFor(() => expect(disabled('manga-try-run')).toBe(false));
  });

  it('offers the install while the pack is missing, then the restart, and waits for both', async () => {
    useNodePacks.setState({ packs: { available: true, installed: [], comfyVersion: null, restartNeeded: false } });
    mount();
    showDialog();
    expect(screen.getByText(t('gallery.manga.needsPack', { pack: 'ComfyUI-MangaScreen' }))).toBeTruthy();
    expect(screen.getByTestId('manga-pack-install')).toBeTruthy();
    expect(disabled('manga-try-run')).toBe(true);
    expect(disabled('manga-save')).toBe(true);
    // Installed, but ComfyUI has not loaded it yet.
    act(() => useNodePacks.setState({ packs: installed(true), jobs: { [URL]: { state: 'ready' } } as never }));
    expect(screen.queryByTestId('manga-pack-install')).toBeNull();
    expect(screen.getByTestId('manga-pack-restart')).toBeTruthy();
    expect(disabled('manga-save')).toBe(true);
    // Restarted: the way is free.
    act(() => useNodePacks.setState({ packs: installed(false), jobs: {} }));
    await waitFor(() => expect(screen.queryByTestId('manga-pack-needs')).toBeNull());
    expect(disabled('manga-save')).toBe(false);
  });
});
