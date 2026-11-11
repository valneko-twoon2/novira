// @vitest-environment jsdom
// A folder in the grid: opens on click, takes pictures and files dropped on it, and shows its cover, name and count.
import { cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { useGallery } from '@/state/gallery';

const actions = vi.hoisted(() => ({ moveImagesToBoard: vi.fn(async () => undefined), uploadFiles: vi.fn(async () => undefined) }));
const dnd = vi.hoisted(() => ({ names: [] as string[] }));
vi.mock('../actions', () => actions);
vi.mock('@/state/dnd', async (original) => ({ ...(await original<typeof import('@/state/dnd')>()), resolveDropImages: vi.fn(async () => dnd.names) }));

import { FolderTile } from './FolderTile';

const cover = { name: 'a.png', url: '/a.png', thumbnailUrl: '/a-thumb.png', width: 10, height: 10 } as ImageDTO;
const tile = () => screen.getByTestId('gallery-folder');
const transfer = (types: string[], files: File[] = []) => ({ dataTransfer: { types, files, dropEffect: 'none' } });

beforeEach(() => {
  vi.clearAllMocks();
  dnd.names = [];
  useGallery.setState({ selectedBoardId: 'none', autoAddBoardId: 'none' } as never);
});
afterEach(cleanup);

describe('FolderTile', () => {
  it('shows the name, the count and the cover, and opens its board on a click', () => {
    render(<FolderTile boardId="b1/sub" name="sub" count={3} cover={cover} size={120} />);
    expect(tile().getAttribute('title')).toBe('sub');
    expect(screen.getByText('3')).toBeTruthy();
    expect(tile().querySelector('img')?.getAttribute('src')).toBe('/a-thumb.png');
    fireEvent.click(tile());
    expect(useGallery.getState().selectedBoardId).toBe('b1/sub');
  });

  it('has an empty cover and no count when it has neither, and the way back is its own tile', () => {
    render(<FolderTile boardId="b1" name="b1" up size={120} />);
    const up = screen.getByTestId('gallery-folder-up');
    expect(up.querySelector('img')).toBeNull();
    expect(up.querySelector('.gfolder__empty')).not.toBeNull();
    expect(up.querySelector('.gfolder__count')).toBeNull();
    expect(up.className).toContain('is-up');
  });

  it('marks itself while a picture is dragged over and clears the mark when the drag leaves it', () => {
    render(<FolderTile boardId="b1/sub" name="sub" size={120} />);
    fireEvent.dragOver(tile(), transfer(['text/plain']));
    expect(tile().className).not.toContain('is-over');
    fireEvent.dragOver(tile(), transfer(['Files']));
    expect(tile().className).toContain('is-over');
    // Moving onto something inside the tile is not leaving it (jsdom's drag event takes no relatedTarget, so it is set by hand).
    const inside = createEvent.dragLeave(tile());
    Object.defineProperty(inside, 'relatedTarget', { value: tile().querySelector('span') });
    fireEvent(tile(), inside);
    expect(tile().className).toContain('is-over');
    fireEvent.dragLeave(tile(), { relatedTarget: null });
    expect(tile().className).not.toContain('is-over');
  });

  it('moves dropped pictures to its board', async () => {
    dnd.names = ['x.png', 'y.png'];
    render(<FolderTile boardId="b1/sub" name="sub" size={120} />);
    fireEvent.drop(tile(), transfer(['Files']));
    await waitFor(() => expect(actions.moveImagesToBoard).toHaveBeenCalledWith(['x.png', 'y.png'], 'b1/sub'));
    expect(actions.uploadFiles).not.toHaveBeenCalled();
    expect(tile().className).not.toContain('is-over');
  });

  it('uploads dropped files into its board when no picture of the app came', async () => {
    const file = new File(['x'], 'p.png', { type: 'image/png' });
    render(<FolderTile boardId="b1/sub" name="sub" size={120} />);
    fireEvent.drop(tile(), transfer(['Files'], [file]));
    await waitFor(() => expect(actions.uploadFiles).toHaveBeenCalledWith([file]));
    expect(useGallery.getState().autoAddBoardId).toBe('b1/sub');
    expect(actions.moveImagesToBoard).not.toHaveBeenCalled();
  });

  it('does nothing for a drop with neither pictures nor files', async () => {
    render(<FolderTile boardId="b1/sub" name="sub" size={120} />);
    fireEvent.drop(tile(), transfer(['Files']));
    await new Promise((r) => setTimeout(r, 0));
    expect(actions.moveImagesToBoard).not.toHaveBeenCalled();
    expect(actions.uploadFiles).not.toHaveBeenCalled();
  });
});
