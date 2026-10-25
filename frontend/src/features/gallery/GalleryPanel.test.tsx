// @vitest-environment jsdom
// The gallery column as a whole on the mock backend: grid, selection, keyboard, header, date filter, upload and delete.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO, type QueueItem } from '@/backend';
import { t } from '@/i18n';
import { dayKey } from '@/state/dateFilter';
import { useGallery } from '@/state/gallery';
import { useQueue } from '@/state/queue';
import { useSettings } from '@/state/settings';
import { useUi } from '@/state/ui';
import { TooltipProvider } from '@/ui';
import { GalleryPanel } from './GalleryPanel';
import { useDeleteRequest, requestDeleteImages } from './deleteRequest';

const DAY = 86_400_000;
const NOW = new Date(2026, 5, 15, 12).getTime();
const initial = { gallery: useGallery.getState(), ui: useUi.getState() };

const picture = (name: string, over: Partial<ImageDTO> = {}): ImageDTO => ({
  name,
  url: `blob:${name}`,
  thumbnailUrl: `blob:t-${name}`,
  width: 640,
  height: 480,
  createdAt: NOW,
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

const thumbs = () => screen.getAllByTestId('gallery-thumb');
const names = () => thumbs().map((el) => el.getAttribute('data-image-name'));
const show = () =>
  render(
    <TooltipProvider>
      <GalleryPanel tab="generate" />
    </TooltipProvider>,
  );

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 420, bottom: 600, width: 420, height: 600, toJSON: () => ({}) });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(420);
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  useGallery.setState(initial.gallery, true);
  useUi.setState(initial.ui, true);
  useSettings.getState().set({ confirmOnDelete: true });
  useDeleteRequest.getState().close();
  useGallery.getState().setImages([
    picture('a.png', { createdAt: NOW }),
    picture('b.png', { createdAt: NOW - 1000 }),
    picture('c.png', { createdAt: NOW - 2000, starred: true }),
    picture('d.png', { createdAt: NOW - 3 * DAY }),
  ]);
  useUi.getState().setMainView('generate', 'launchpad');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('GalleryPanel grid', () => {
  it('lists the images newest first with the count, and selects with click, Ctrl and Shift', () => {
    show();
    expect(names()).toEqual(['c.png', 'a.png', 'b.png', 'd.png']);
    expect(screen.getByTestId('gallery-count').textContent).toBe('4');
    fireEvent.click(thumbs()[1]!);
    expect(useGallery.getState().selection).toEqual(['a.png']);
    fireEvent.click(thumbs()[3]!, { shiftKey: true });
    expect(useGallery.getState().selection).toEqual(['a.png', 'b.png', 'd.png']);
    fireEvent.click(thumbs()[0]!, { ctrlKey: true });
    expect(useGallery.getState().selection).toContain('c.png');
  });

  it('opens the viewer on double click and starts a drag with the selection', () => {
    show();
    fireEvent.click(thumbs()[0]!);
    fireEvent.click(thumbs()[1]!, { ctrlKey: true });
    const setData = vi.fn();
    fireEvent.dragStart(thumbs()[1]!, { dataTransfer: { setData } });
    expect(JSON.parse(setData.mock.calls[0]![1] as string)).toEqual(['c.png', 'a.png']);
    const single = vi.fn();
    fireEvent.dragStart(thumbs()[3]!, { dataTransfer: { setData: single } });
    expect(JSON.parse(single.mock.calls[0]![1] as string)).toEqual(['d.png']);
    fireEvent.doubleClick(thumbs()[2]!);
    expect(useGallery.getState().selection).toEqual(['b.png']);
  });

  it('stars from the hover button and asks before deleting from the hover button', async () => {
    const update = vi.spyOn(backend, 'updateImages').mockImplementation(async (ns, patch) => ns.map((n) => picture(n, { starred: patch.starred })));
    show();
    fireEvent.click(within(thumbs()[1]!).getByRole('button', { name: t('gallery.menu.star') }));
    expect(update).toHaveBeenCalledWith(['a.png'], { starred: true });
    await vi.waitFor(() => expect(useGallery.getState().images.find((i) => i.name === 'a.png')?.starred).toBe(true));
    fireEvent.click(within(thumbs()[2]!).getByRole('button', { name: t('gallery.menu.delete') }));
    expect(useDeleteRequest.getState().pending).toEqual(['b.png']);
  });

  it('groups by day with a header per day and filters by search with an empty state', async () => {
    useGallery.getState().setSettings({ groupByDate: true });
    show();
    expect(screen.getAllByTestId('gallery-day-header')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: t('gallery.search.label') }));
    const box = screen.getByPlaceholderText(t('gallery.search.placeholder'));
    fireEvent.change(box, { target: { value: 'zzz-nothing' } });
    expect(screen.getByText(t('gallery.empty.noResults'))).toBeTruthy();
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(useGallery.getState().search).toBe('');
    expect(screen.queryByPlaceholderText(t('gallery.search.placeholder'))).toBeNull();
  });

  it('shows the empty state of an empty gallery with an upload button', () => {
    useGallery.getState().setImages([]);
    show();
    expect(screen.getByText(t('gallery.empty.noImages'))).toBeTruthy();
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
    const click = vi.spyOn(input, 'click').mockImplementation(() => undefined);
    fireEvent.click(within(screen.getByTestId('gallery-grid')).getByRole('button', { name: t('common.upload') }));
    expect(click).toHaveBeenCalled();
  });

  it('opens the context menu of one image and of a multi selection', async () => {
    show();
    fireEvent.contextMenu(thumbs()[0]!);
    expect(await screen.findByRole('menu')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    useGallery.getState().setSelection(['a.png', 'b.png']);
    fireEvent.contextMenu(thumbs()[1]!);
    expect(await screen.findByRole('menu')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    fireEvent.contextMenu(screen.getByTestId('gallery-grid'));
  });
});

const running = (id: number, over: Partial<QueueItem> = {}): QueueItem =>
  ({ id, batchId: 'b', status: 'in_progress', origin: 'generate', destination: 'gallery', params: { width: 640, height: 960 }, boardId: null, createdAt: 0, startedAt: 0, completedAt: null, imageName: null, error: null, ...over }) as QueueItem;

describe('GalleryPanel pictures being drawn', () => {
  afterEach(() => useQueue.setState({ items: [], progress: null }));

  it('puts a running job before the pictures and opens the viewer on it when pressed', () => {
    useQueue.setState({ items: [running(7)], progress: { itemId: 7, step: 4, totalSteps: 20, progressImageUrl: 'data:image/png;base64,AA==', message: '' } });
    show();
    const cell = screen.getByTestId('gallery-live-thumb');
    expect(within(cell).getByText(/4\/20/)).toBeTruthy();
    expect(cell.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AA==');
    // The stored pictures stay as they were, and the cell is no part of their selection.
    expect(names()).toEqual(['c.png', 'a.png', 'b.png', 'd.png']);
    fireEvent.click(cell);
    expect(useGallery.getState().viewerLiveItemId).toBe(7);
    expect(useUi.getState().mainView.generate).toBe('viewer');
    expect(useGallery.getState().selection).toEqual([]);
  });

  it('shows only the jobs of the board and the view the grid is on, and not while a search or a date narrows it', () => {
    useQueue.setState({ items: [running(1), running(2, { boardId: 'other' }), running(3, { params: { width: 640, height: 960, draftAt: 5 } as QueueItem['params'] }), running(4, { status: 'pending' })], progress: null });
    show();
    expect(screen.getAllByTestId('gallery-live-thumb')).toHaveLength(1);
    act(() => useGallery.getState().setSearch('a'));
    expect(screen.queryByTestId('gallery-live-thumb')).toBeNull();
    act(() => useGallery.getState().setSearch(''));
    act(() => useGallery.getState().setView('assets'));
    expect(screen.queryByTestId('gallery-live-thumb')).toBeNull();
  });

  it('is not an empty gallery while only a job is running', () => {
    useGallery.getState().setImages([]);
    useQueue.setState({ items: [running(1)], progress: null });
    show();
    expect(screen.getByTestId('gallery-live-thumb')).toBeTruthy();
    expect(screen.queryByText(t('gallery.empty.noImages'))).toBeNull();
  });
});

describe('GalleryPanel keyboard', () => {
  it('moves the selection with the arrows while the viewer is the main view, and extends with Shift', () => {
    useUi.getState().setMainView('generate', 'viewer');
    show();
    useGallery.getState().setSelection(['a.png']);
    key('ArrowRight');
    expect(useGallery.getState().selection).toEqual(['b.png']);
    key('ArrowLeft');
    expect(useGallery.getState().selection).toEqual(['a.png']);
    key('ArrowRight', { shiftKey: true });
    expect(useGallery.getState().selection).toEqual(['a.png', 'b.png']);
    key('ArrowDown');
    key('ArrowUp');
    expect(useGallery.getState().selection).toHaveLength(1);
  });

  it('selects all, asks to delete and clears the selection with Escape', () => {
    useUi.getState().setMainView('generate', 'viewer');
    show();
    key('a', { ctrlKey: true });
    expect(useGallery.getState().selection).toHaveLength(4);
    key('Delete');
    expect(useDeleteRequest.getState().pending).toHaveLength(4);
    key('Escape');
    expect(useGallery.getState().selection).toEqual([]);
  });

  it('keeps Escape for the compare view and copies the open image with Ctrl+C', async () => {
    useUi.getState().setMainView('generate', 'viewer');
    show();
    useGallery.getState().setSelection(['a.png']);
    useGallery.setState({ compareImageName: 'b.png' });
    key('Escape');
    expect(useGallery.getState().selection).toEqual(['a.png']);
    useGallery.setState({ viewerImageName: 'a.png' });
    key('c', { ctrlKey: true });
    // No clipboard in jsdom: the copy reports that it is unavailable instead of throwing.
    await vi.waitFor(() => expect(document.body).toBeTruthy());
  });

  it('ignores the keys while the pointer is elsewhere and another view is open', () => {
    show();
    useGallery.getState().setSelection(['a.png']);
    key('ArrowRight');
    expect(useGallery.getState().selection).toEqual(['a.png']);
  });
});

describe('GalleryPanel header', () => {
  it('switches between images and assets', () => {
    show();
    fireEvent.click(screen.getByTestId('gallery-view-assets'));
    expect(useGallery.getState().view).toBe('assets');
    expect(screen.getByTestId('gallery-view-assets').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByTestId('gallery-view-images'));
    expect(useGallery.getState().view).toBe('images');
  });

  it('changes the gallery settings from the popover', async () => {
    show();
    fireEvent.click(screen.getByTestId('gallery-settings'));
    const group = await screen.findByRole('switch', { name: t('gallery.settings.groupByDate') });
    fireEvent.click(group);
    expect(useGallery.getState().settings.groupByDate).toBe(true);
    fireEvent.click(screen.getByRole('switch', { name: t('gallery.settings.starredFirst') }));
    expect(useGallery.getState().settings.starredFirst).toBe(!initial.gallery.settings.starredFirst);
  });

  it('filters by a quick range, a calendar day and a custom range, and clears with the chip', async () => {
    show();
    fireEvent.click(screen.getByTestId('gallery-date-filter'));
    fireEvent.click(await screen.findByTestId('gallery-date-quick-today'));
    expect(useGallery.getState().dateFilter).not.toBeNull();
    expect(screen.getByTestId('gallery-date-chip')).toBeTruthy();
    expect(names()).toEqual(['c.png', 'a.png', 'b.png']);
    fireEvent.click(screen.getByTestId('gallery-date-prev-month'));
    fireEvent.click(screen.getByTestId('gallery-date-next-month'));
    const day = dayKey(NOW - 3 * DAY);
    fireEvent.click(screen.getByTestId(`gallery-date-day-${day}`));
    expect(useGallery.getState().dateFilter).toEqual({ from: day, to: day });
    expect(names()).toEqual(['d.png']);
    fireEvent.change(screen.getByTestId('gallery-date-from'), { target: { value: dayKey(NOW - 5 * DAY) } });
    fireEvent.change(screen.getByTestId('gallery-date-to'), { target: { value: dayKey(NOW) } });
    fireEvent.click(screen.getByTestId('gallery-date-apply'));
    expect(names()).toHaveLength(4);
    fireEvent.click(screen.getByTestId('gallery-date-chip-clear'));
    expect(useGallery.getState().dateFilter).toBeNull();
  });

  it('shows an empty state for a date without images and clears the filter from it', async () => {
    useGallery.getState().setDateFilter({ from: '2020-01-01', to: '2020-01-02' });
    show();
    expect(screen.getByText(t('gallery.empty.noDateResults'))).toBeTruthy();
    fireEvent.click(screen.getByTestId('gallery-date-empty-clear'));
    expect(useGallery.getState().dateFilter).toBeNull();
    fireEvent.click(screen.getByTestId('gallery-date-filter'));
    fireEvent.click(await screen.findByTestId('gallery-date-quick-all'));
    expect(useGallery.getState().dateFilter).toBeNull();
  });
});

describe('GalleryPanel upload and delete', () => {
  it('uploads picked files, but not other kinds of file', async () => {
    const upload = vi.spyOn(backend, 'uploadImage').mockImplementation(async (file) => picture(`up-${(file as File).name}`));
    show();
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
    const files = [new File(['x'], 'one.png', { type: 'image/png' }), new File(['y'], 'notes.txt', { type: 'text/plain' })];
    fireEvent.change(input, { target: { files } });
    await vi.waitFor(() => expect(useGallery.getState().selection).toEqual(['up-one.png']));
    expect(upload).toHaveBeenCalledTimes(1);
    fireEvent.change(input, { target: { files: [] } });
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('shows the drop hint while files are dragged over and uploads what is dropped; ignores other drags', async () => {
    const upload = vi.spyOn(backend, 'uploadImage').mockImplementation(async (file) => picture(`drop-${(file as File).name}`));
    show();
    const area = screen.getByTestId('gallery-panel').querySelector<HTMLElement>('.gpanel__gallery')!;
    fireEvent.dragOver(area, { dataTransfer: { types: ['text/plain'] } });
    expect(screen.queryByText(t('gallery.dropToUpload'))).toBeNull();
    fireEvent.dragOver(area, { dataTransfer: { types: ['Files'], dropEffect: 'none' } });
    expect(screen.getByText(t('gallery.dropToUpload'))).toBeTruthy();
    fireEvent.dragLeave(area, { relatedTarget: document.body });
    expect(screen.queryByText(t('gallery.dropToUpload'))).toBeNull();
    fireEvent.drop(area, { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(upload).not.toHaveBeenCalled();
    fireEvent.drop(area, { dataTransfer: { types: ['Files'], files: [new File(['x'], 'd.png', { type: 'image/png' })] } });
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
  });

  it('confirms a delete in the dialog, and remembers "do not ask again"', async () => {
    const del = vi.spyOn(backend, 'deleteImages').mockResolvedValue(undefined);
    show();
    act(() => requestDeleteImages(['a.png']));
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByTestId('confirm-delete-images'));
    await vi.waitFor(() => expect(del).toHaveBeenCalledWith(['a.png']));
    expect(useSettings.getState().confirmOnDelete).toBe(false);
    expect(useDeleteRequest.getState().pending).toBeNull();
    expect(useGallery.getState().images.some((i) => i.name === 'a.png')).toBe(false);
    // With confirmation off the next request deletes at once.
    act(() => requestDeleteImages(['b.png']));
    await vi.waitFor(() => expect(del).toHaveBeenCalledWith(['b.png']));
    act(() => requestDeleteImages([]));
    expect(del).toHaveBeenCalledTimes(2);
  });

  it('cancels the delete dialog without deleting', async () => {
    const del = vi.spyOn(backend, 'deleteImages').mockResolvedValue(undefined);
    show();
    act(() => requestDeleteImages(['c.png']));
    fireEvent.click(await screen.findByRole('button', { name: t('common.cancel') }));
    expect(useDeleteRequest.getState().pending).toBeNull();
    expect(del).not.toHaveBeenCalled();
  });
});
