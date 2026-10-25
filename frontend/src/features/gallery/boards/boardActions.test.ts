import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type BoardDTO } from '@/backend';
import { useGallery } from '@/state/gallery';
import { useToasts } from '@/state/toasts';
import { createBoard, deleteBoard, downloadBoard, renameBoard, setBoardArchived } from './boardActions';

const initialGallery = useGallery.getState();
const initialToasts = useToasts.getState();

const board = (id: string, over: Partial<BoardDTO> = {}): BoardDTO => ({ id, name: id, archived: false, createdAt: 0, ...over });
const g = () => useGallery.getState();

beforeEach(() => {
  useGallery.setState(initialGallery, true);
  useToasts.setState(initialToasts, true);
});
afterEach(() => vi.restoreAllMocks());

describe('board actions', () => {
  it('adds a created board to the gallery store', async () => {
    vi.spyOn(backend, 'createBoard').mockResolvedValue(board('b1', { name: 'New' }));
    const created = await createBoard();
    expect(created.id).toBe('b1');
    expect(g().boards.map((b) => b.id)).toEqual(['b1']);
  });

  it('renames with the trimmed name and ignores a blank one without calling the backend', async () => {
    g().setBoards([board('b1')]);
    const update = vi.spyOn(backend, 'updateBoard').mockImplementation(async (id, patch) => board(id, { name: patch.name ?? id }));
    await renameBoard('b1', '   ');
    expect(update).not.toHaveBeenCalled();
    await renameBoard('b1', '  Cats  ');
    expect(update).toHaveBeenCalledWith('b1', { name: 'Cats' });
    expect(g().boards[0]?.name).toBe('Cats');
  });

  it('leaves a board that is archived while archived boards are hidden: selection and auto-add fall back to none', async () => {
    g().setBoards([board('b1')]);
    useGallery.setState({ selectedBoardId: 'b1', autoAddBoardId: 'b1' });
    vi.spyOn(backend, 'updateBoard').mockResolvedValue(board('b1', { archived: true }));
    await setBoardArchived('b1', true);
    expect(g().boards[0]?.archived).toBe(true);
    expect(g().selectedBoardId).toBe('none');
    expect(g().autoAddBoardId).toBe('none');
  });

  it('keeps the selection of an archived board when archived boards are shown, and for other boards', async () => {
    g().setBoards([board('b1'), board('b2')]);
    useGallery.setState({ selectedBoardId: 'b2', autoAddBoardId: 'b2', settings: { ...g().settings, showArchivedBoards: true } });
    vi.spyOn(backend, 'updateBoard').mockResolvedValue(board('b1', { archived: true }));
    await setBoardArchived('b1', true);
    expect(g().selectedBoardId).toBe('b2');
    expect(g().autoAddBoardId).toBe('b2');
    useGallery.setState({ selectedBoardId: 'b1' });
    await setBoardArchived('b1', true);
    expect(g().selectedBoardId).toBe('b1');
  });

  it('does not touch the selection when a board is restored', async () => {
    g().setBoards([board('b1', { archived: true })]);
    useGallery.setState({ selectedBoardId: 'b1' });
    vi.spyOn(backend, 'updateBoard').mockResolvedValue(board('b1', { archived: false }));
    await setBoardArchived('b1', false);
    expect(g().selectedBoardId).toBe('b1');
  });

  it('removes the images the backend deleted along with the board, and reports success', async () => {
    g().setBoards([board('b1')]);
    const remove = vi.spyOn(g(), 'removeImages');
    const detach = vi.spyOn(g(), 'detachBoardImages');
    vi.spyOn(backend, 'deleteBoard').mockResolvedValue({ deletedImages: ['a.png'] });
    await deleteBoard('b1', true);
    expect(remove).toHaveBeenCalledWith(['a.png']);
    expect(detach).not.toHaveBeenCalled();
    expect(g().boards).toEqual([]);
    expect(useToasts.getState().toasts.at(-1)?.status).toBe('success');
  });

  it('detaches the images of a board deleted without its images', async () => {
    g().setBoards([board('b1')]);
    const detach = vi.spyOn(g(), 'detachBoardImages');
    vi.spyOn(backend, 'deleteBoard').mockResolvedValue({ deletedImages: [] });
    await deleteBoard('b1', false);
    expect(detach).toHaveBeenCalledWith('b1');
    expect(g().boards).toEqual([]);
  });

  it('tells the user that downloading a board is not available', () => {
    downloadBoard();
    expect(useToasts.getState().toasts.at(-1)?.status).toBe('info');
  });
});
