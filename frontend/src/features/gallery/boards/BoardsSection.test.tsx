// @vitest-environment jsdom
// The boards list of the gallery: search, create, rename, archive, delete, the auto-add board and dropping pictures on a board.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type BoardDTO } from '@/backend';
import { t } from '@/i18n';
import { IMAGE_MIME } from '@/state/dnd';
import { useGallery } from '@/state/gallery';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { moveImagesToBoard, uploadFiles } from '../actions';
import { BoardsSection } from './BoardsSection';

vi.mock('../actions', async (original) => ({
  ...(await original<typeof import('../actions')>()),
  moveImagesToBoard: vi.fn().mockResolvedValue(undefined),
  uploadFiles: vi.fn().mockResolvedValue(undefined),
}));

const initial = { gallery: useGallery.getState(), toasts: useToasts.getState() };
const board = (id: string, name: string, over: Partial<BoardDTO> = {}): BoardDTO => ({ id, name, archived: false, createdAt: Number(id.slice(1)), ...over });
const state = () => useGallery.getState();
const rows = () => screen.getAllByTestId('board-row');
const names = () => rows().map((r) => r.querySelector('.gboard__name')!.textContent);

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useGallery.setState({ ...initial.gallery, boards: [board('b1', 'Alpha'), board('b2', 'Beta'), board('b3', 'Old', { archived: true })], images: [], boardSearch: '' }, true);
  useGallery.getState().setSettings({ boardsListOpen: true, showArchivedBoards: false });
  useToasts.setState(initial.toasts, true);
  vi.mocked(moveImagesToBoard).mockClear();
  vi.mocked(uploadFiles).mockClear();
  render(
    <TooltipProvider>
      <BoardsSection />
    </TooltipProvider>,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the list', () => {
  it('shows uncategorized first, then the newest boards, hiding archived ones until asked', () => {
    expect(names()).toEqual([t('gallery.boards.uncategorized'), 'Beta', 'Alpha']);
    act(() => state().setSettings({ showArchivedBoards: true }));
    expect(names()).toEqual([t('gallery.boards.uncategorized'), 'Old', 'Beta', 'Alpha']);
    expect(screen.getByLabelText(t('gallery.boards.archived'))).toBeTruthy();
  });

  it('collapses and expands with the header', () => {
    fireEvent.click(screen.getByTestId('boards-toggle'));
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(screen.getByTestId('boards-toggle'));
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('selects a board when clicked and marks the auto-add board', () => {
    fireEvent.click(rows()[1]!);
    expect(state().selectedBoardId).toBe('b2');
    expect(rows()[1]!.getAttribute('aria-selected')).toBe('true');
    act(() => state().setAutoAddBoard('b1'));
    expect(within(rows()[2]!).getByText(t('gallery.boards.autoBadge'))).toBeTruthy();
  });

  it('counts the pictures of each board', () => {
    const picture = (name: string, category: string, createdAt: number) => ({ name, boardId: 'b1', category, createdAt, thumbnailUrl: `blob:${name}` }) as never;
    act(() => useGallery.setState({ images: [picture('a.png', 'general', 1), picture('b.png', 'user', 2), picture('c.png', 'general', 3)] }));
    expect(rows()[2]!.querySelector('.gboard__count')!.textContent).toBe('3');
    expect(rows()[2]!.querySelector('img')!.getAttribute('src')).toBe('blob:c.png');
  });

  it('resizes the list by dragging the handle, but never below the minimum', () => {
    const handle = screen.getByRole('separator');
    handle.setPointerCapture = vi.fn();
    const at = (type: string, y: number) => {
      const e = new MouseEvent(type, { clientY: y, bubbles: true });
      Object.defineProperty(e, 'pointerId', { value: 1 });
      fireEvent(handle, e);
    };
    at('pointermove', 5);
    at('pointerdown', 100);
    at('pointermove', 140);
    expect(screen.getByRole('listbox').style.getPropertyValue('--gboards-h')).toBe('216px');
    at('pointermove', -500);
    expect(screen.getByRole('listbox').style.getPropertyValue('--gboards-h')).toBe('64px');
    at('pointerup', 0);
    at('pointermove', 300);
    expect(screen.getByRole('listbox').style.getPropertyValue('--gboards-h')).toBe('64px');
  });
});

describe('search', () => {
  it('filters the boards by name, keeps uncategorized when it matches, and says when nothing does', () => {
    fireEvent.click(screen.getByLabelText(t('gallery.boards.search')));
    const input = screen.getByPlaceholderText(t('gallery.boards.searchPlaceholder'));
    fireEvent.change(input, { target: { value: 'alp' } });
    expect(names()).toEqual(['Alpha']);
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByText(t('gallery.boards.noMatch'))).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(state().boardSearch).toBe('');
    expect(screen.queryByPlaceholderText(t('gallery.boards.searchPlaceholder'))).toBeNull();
    fireEvent.click(screen.getAllByLabelText(t('gallery.boards.search'))[0]!);
    fireEvent.change(screen.getByPlaceholderText(t('gallery.boards.searchPlaceholder')), { target: { value: 'be' } });
    fireEvent.click(screen.getAllByLabelText(t('gallery.boards.search'))[0]!);
    expect(state().boardSearch).toBe('');
  });
});

describe('creating and renaming', () => {
  it('creates a board, selects it and opens its name for renaming', async () => {
    vi.spyOn(backend, 'createBoard').mockResolvedValue(board('b9', 'New board'));
    fireEvent.click(screen.getByTestId('add-board'));
    await waitFor(() => expect(state().selectedBoardId).toBe('b9'));
    const input = await screen.findByLabelText(t('common.rename'));
    const update = vi.spyOn(backend, 'updateBoard').mockResolvedValue(board('b9', 'Renamed'));
    fireEvent.change(input, { target: { value: ' Renamed ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(update).toHaveBeenCalledWith('b9', { name: 'Renamed' }));
    await waitFor(() => expect(screen.queryByLabelText(t('common.rename'))).toBeNull());
  });

  it('renames on double click, and Escape or an empty name keeps the old one', async () => {
    const update = vi.spyOn(backend, 'updateBoard').mockResolvedValue(board('b2', 'x'));
    fireEvent.doubleClick(screen.getByText('Beta'));
    fireEvent.keyDown(await screen.findByLabelText(t('common.rename')), { key: 'Escape' });
    expect(update).not.toHaveBeenCalled();
    fireEvent.doubleClick(screen.getByText('Beta'));
    const input = await screen.findByLabelText(t('common.rename'));
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(update).not.toHaveBeenCalled();
    fireEvent.doubleClick(rows()[0]!.querySelector('.gboard__name')!);
    expect(screen.queryByLabelText(t('common.rename'))).toBeNull();
  });
});

describe('the context menu', () => {
  const menu = async (row: HTMLElement) => {
    fireEvent.contextMenu(row);
    return within(await screen.findByRole('menu'));
  };

  it('makes a board the auto-add board, once', async () => {
    const m = await menu(rows()[1]!);
    fireEvent.click(m.getByText(t('gallery.boards.setAutoAdd')));
    expect(state().autoAddBoardId).toBe('b2');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    const again = await menu(rows()[1]!);
    expect(again.getByText(t('gallery.boards.setAutoAdd')).closest('[role=menuitem]')!.getAttribute('aria-disabled')).toBe('true');
  });

  it('says boards cannot be downloaded in the browser, and offers no rename or delete for uncategorized', async () => {
    const m = await menu(rows()[0]!);
    expect(m.queryByText(t('gallery.boards.delete'))).toBeNull();
    fireEvent.click(m.getByText(t('gallery.boards.download')));
    expect(useToasts.getState().toasts.at(-1)?.status).toBe('info');
  });

  it('archives and restores a board', async () => {
    const update = vi.spyOn(backend, 'updateBoard').mockImplementation(async (id, patch) => board(id, 'Beta', patch as Partial<BoardDTO>));
    fireEvent.click(rows()[1]!);
    const m = await menu(rows()[1]!);
    fireEvent.click(m.getByText(t('gallery.boards.archive')));
    await waitFor(() => expect(update).toHaveBeenCalledWith('b2', { archived: true }));
    await waitFor(() => expect(state().selectedBoardId).toBe('none'));
  });

  it('renames from the menu', async () => {
    const m = await menu(rows()[1]!);
    fireEvent.click(m.getByText(t('common.rename')));
    expect(await screen.findByLabelText(t('common.rename'))).toBeTruthy();
  });

  it('deletes a board after confirmation, with or without its pictures', async () => {
    const del = vi.spyOn(backend, 'deleteBoard').mockResolvedValue({ deletedImages: [] });
    const m = await menu(rows()[1]!);
    fireEvent.click(m.getByText(t('gallery.boards.delete')));
    fireEvent.click(await screen.findByText(t('gallery.boards.deleteBoardOnly')));
    await waitFor(() => expect(del).toHaveBeenCalledWith('b2', false));
    await waitFor(() => expect(state().boards.map((b) => b.id)).not.toContain('b2'));

    const again = await menu(rows()[1]!);
    fireEvent.click(again.getByText(t('gallery.boards.delete')));
    fireEvent.click(await screen.findByTestId('delete-board-and-images'));
    await waitFor(() => expect(del).toHaveBeenLastCalledWith('b1', true));
  });

  it('can cancel the deletion', async () => {
    const m = await menu(rows()[1]!);
    fireEvent.click(m.getByText(t('gallery.boards.delete')));
    fireEvent.click(await screen.findByText(t('common.cancel')));
    expect(state().boards).toHaveLength(3);
  });
});

describe('dropping on a board', () => {
  const dataTransfer = (data: Record<string, string>, files: File[] = []) => ({ types: [...Object.keys(data), ...(files.length ? ['Files'] : [])], getData: (k: string) => data[k] ?? '', files, dropEffect: '' });

  it('moves dropped gallery pictures to the board', async () => {
    const row = rows()[1]!;
    fireEvent.dragOver(row, { dataTransfer: dataTransfer({ [IMAGE_MIME]: JSON.stringify(['a.png']) }) });
    expect(row.className).toContain('is-over');
    fireEvent.drop(row, { dataTransfer: dataTransfer({ [IMAGE_MIME]: JSON.stringify(['a.png']) }) });
    await waitFor(() => expect(moveImagesToBoard).toHaveBeenCalledWith(['a.png'], 'b2'));
    expect(row.className).not.toContain('is-over');
  });

  it('uploads dropped files into the board, which becomes the auto-add board', async () => {
    const file = new File(['x'], 'x.png', { type: 'image/png' });
    fireEvent.drop(rows()[2]!, { dataTransfer: dataTransfer({}, [file]) });
    await waitFor(() => expect(uploadFiles).toHaveBeenCalledWith([file]));
    expect(state().autoAddBoardId).toBe('b1');
  });

  it('ignores drags that carry no pictures, and clears the highlight when the drag leaves', () => {
    const row = rows()[1]!;
    fireEvent.dragOver(row, { dataTransfer: dataTransfer({ 'text/plain': 'x' }) });
    expect(row.className).not.toContain('is-over');
    fireEvent.dragEnter(row, { dataTransfer: dataTransfer({ [IMAGE_MIME]: '[]' }) });
    expect(row.className).toContain('is-over');
    const leave = new Event('dragleave', { bubbles: true });
    Object.defineProperty(leave, 'relatedTarget', { value: null });
    fireEvent(row, leave);
    expect(row.className).not.toContain('is-over');
  });
});
