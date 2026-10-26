// @vitest-environment jsdom
// Undo and redo of deleting pictures: a deletion is remembered, taken back through the backend's trash, and made again.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { useGallery } from './gallery';
import { recordDeletion, redoDeletion, undoDeletion, useGalleryUndo } from './galleryUndo';
import { useToasts } from './toasts';

const image = (name: string): ImageDTO => ({ name, url: `blob:${name}`, thumbnailUrl: `blob:t-${name}`, width: 8, height: 8, createdAt: 1, workflow: null, metadata: null }) as ImageDTO;
const initial = { gallery: useGallery.getState(), undo: useGalleryUndo.getState(), toasts: useToasts.getState() };

beforeEach(() => {
  useGallery.setState(initial.gallery, true);
  useGalleryUndo.setState({ undo: [], redo: [] });
  useToasts.setState(initial.toasts, true);
});
afterEach(() => vi.restoreAllMocks());

describe('gallery undo of deletes', () => {
  it('remembers a deletion and forgets what could be made again', () => {
    useGalleryUndo.setState({ undo: [], redo: [['x']] });
    recordDeletion(['a']);
    expect(useGalleryUndo.getState()).toEqual({ undo: [['a']], redo: [] });
    recordDeletion([]);
    expect(useGalleryUndo.getState().undo).toHaveLength(1);
  });

  it('keeps only the latest thirty deletions', () => {
    for (let i = 0; i < 35; i++) recordDeletion([`${i}.png`]);
    const { undo } = useGalleryUndo.getState();
    expect(undo).toHaveLength(30);
    expect(undo[0]).toEqual(['5.png']);
  });

  it('brings the latest deletion back into the gallery and moves it to the redo list', async () => {
    useGallery.setState({ images: [image('b')] });
    recordDeletion(['a']);
    vi.spyOn(backend, 'restoreImages').mockResolvedValue([image('a')]);
    expect(await undoDeletion()).toBe(true);
    expect(useGallery.getState().images.map((i) => i.name).sort()).toEqual(['a', 'b']);
    expect(useGalleryUndo.getState()).toEqual({ undo: [], redo: [['a']] });
  });

  it('takes back the deletion a toast names, not the latest one', async () => {
    const first = ['a'];
    recordDeletion(first);
    recordDeletion(['b']);
    const restore = vi.spyOn(backend, 'restoreImages').mockResolvedValue([image('a')]);
    await undoDeletion(first);
    expect(restore).toHaveBeenCalledWith(['a']);
    expect(useGalleryUndo.getState().undo).toEqual([['b']]);
  });

  it('says so when the backend no longer holds the pictures, and does nothing with nothing to undo', async () => {
    expect(await undoDeletion()).toBe(false);
    recordDeletion(['a']);
    vi.spyOn(backend, 'restoreImages').mockResolvedValue([]);
    expect(await undoDeletion()).toBe(false);
    expect(useToasts.getState().toasts.at(-1)?.status).toBe('warning');
    expect(useGalleryUndo.getState().redo).toEqual([]);
  });

  it('reports a failing restore and keeps the deletion to try again', async () => {
    recordDeletion(['a']);
    vi.spyOn(backend, 'restoreImages').mockRejectedValue(new Error('disk'));
    expect(await undoDeletion()).toBe(false);
    expect(useToasts.getState().toasts.at(-1)?.status).toBe('error');
    expect(useGalleryUndo.getState().undo).toEqual([['a']]);
  });

  it('deletes again what was taken back, and puts it on the undo list', async () => {
    useGallery.setState({ images: [image('a'), image('b')] });
    useGalleryUndo.setState({ undo: [], redo: [['a']] });
    const del = vi.spyOn(backend, 'deleteImages').mockResolvedValue(undefined);
    expect(await redoDeletion()).toBe(true);
    expect(del).toHaveBeenCalledWith(['a']);
    expect(useGallery.getState().images.map((i) => i.name)).toEqual(['b']);
    expect(useGalleryUndo.getState()).toEqual({ undo: [['a']], redo: [] });
    expect(await redoDeletion()).toBe(false);
  });
});
