// @vitest-environment jsdom
// A generation batch of the Candidates view: what one press of Invoke made, held back from the boards until the user moves
// the pictures they want there.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type EnqueueRequest, type GenerationMetadata, type ImageDTO, type QueueItem } from '@/backend';
import { heldPictures, syncGroups, useDrafts, type DraftGroup } from './drafts';
import { useGallery } from './gallery';
import { useGalleryUndo } from './galleryUndo';
import { useToasts } from './toasts';

const item = (id: number, over: Partial<QueueItem> = {}): QueueItem =>
  ({ id, status: 'pending', destination: 'candidates', createdAt: Date.now(), imageName: null, error: null, params: { seed: 100 + id, steps: 20 } as GenerationMetadata, ...over }) as QueueItem;
const picture = (name: string, over: Partial<ImageDTO> = {}): ImageDTO =>
  ({ name, boardId: 'board', isIntermediate: true, createdAt: 1, mediaType: 'image', category: 'general', ...over }) as ImageDTO;
const request = { boardId: 'board', destination: 'candidates' } as EnqueueRequest;
const state = () => useDrafts.getState();
const only = (): DraftGroup => state().groups[0]!;

beforeEach(() => {
  localStorage.clear();
  useDrafts.setState({ groups: [], currentId: null, selection: [], busy: false });
  useGallery.setState({ images: [], boards: [{ id: 'board', name: 'Cats', archived: false, createdAt: 1, parentId: null }] });
  useToasts.setState({ toasts: [] });
  useGalleryUndo.setState({ undo: [], redo: [] });
});
afterEach(() => vi.restoreAllMocks());

describe('registering what one press of Invoke made', () => {
  it('makes one batch whose pictures are waiting to be drawn to the end, with no draft step', () => {
    state().addGeneration([item(1), item(2)], request);
    expect(state().groups).toHaveLength(1);
    expect(state().currentId).toBe(only().id);
    expect(only()).toMatchObject({ kind: 'generation', boardId: 'board', position: 1 });
    expect(only().candidates.map((c) => [c.seed, c.itemId, c.finalItemId, c.finalStatus, c.status])).toEqual([
      [101, null, 1, 'queued', 'ready'],
      [102, null, 2, 'queued', 'ready'],
    ]);
  });

  it('makes nothing from no items', () => {
    state().addGeneration([], request);
    expect(state().groups).toEqual([]);
  });

  it('takes each picture in from its queue item as it runs and finishes', () => {
    state().addGeneration([item(1), item(2)], request);
    const running = syncGroups(state().groups, [item(1, { status: 'in_progress' }), item(2)]);
    expect(running[0]!.candidates.map((c) => c.finalStatus)).toEqual(['running', 'queued']);
    const done = syncGroups(running, [item(1, { status: 'completed', imageName: 'one.png' }), item(2, { status: 'failed', error: 'out of memory' })]);
    expect(done[0]!.candidates.map((c) => [c.finalStatus, c.finalImageName, c.error])).toEqual([
      ['ready', 'one.png', null],
      ['failed', null, 'out of memory'],
    ]);
  });
});

describe('moving pictures to the board', () => {
  const made = (names: string[]) => {
    state().addGeneration(names.map((_, i) => item(i + 1)), request);
    state().setCurrent(only().id);
    useDrafts.setState({ groups: state().groups.map((g) => ({ ...g, candidates: g.candidates.map((c, i) => ({ ...c, finalStatus: 'ready' as const, finalImageName: names[i]! })) })) });
    useGallery.setState({ images: names.map((n) => picture(n)) });
  };

  it('lists the pictures still held back, and not those already on a board', () => {
    made(['a.png', 'b.png']);
    useGallery.setState({ images: [picture('a.png'), picture('b.png', { isIntermediate: false })] });
    expect(heldPictures(only(), useGallery.getState().images).map((i) => i.name)).toEqual(['a.png']);
  });

  it('moves the chosen ones to the board of the batch, shows them there and takes them out of the batch', async () => {
    made(['a.png', 'b.png']);
    const update = vi.spyOn(backend, 'updateImages').mockResolvedValue([picture('a.png', { isIntermediate: false })]);
    await state().adopt(only().id, [only().candidates[0]!.id]);
    expect(update).toHaveBeenCalledWith(['a.png'], { boardId: 'board', isIntermediate: false });
    expect(useGallery.getState().images.find((i) => i.name === 'a.png')?.isIntermediate).toBe(false);
    expect(only().candidates.map((c) => c.finalImageName)).toEqual(['b.png']);
    expect(useToasts.getState().toasts.at(-1)?.status).toBe('success');
  });

  it('closes the batch when its last picture has gone to a board', async () => {
    made(['a.png']);
    vi.spyOn(backend, 'updateImages').mockResolvedValue([picture('a.png', { isIntermediate: false })]);
    await state().adopt(only().id, [only().candidates[0]!.id]);
    expect(state()).toMatchObject({ groups: [], currentId: null });
  });

  it('uses Uncategorized when the board of the batch is gone', async () => {
    made(['a.png']);
    useGallery.setState({ boards: [] });
    const update = vi.spyOn(backend, 'updateImages').mockResolvedValue([picture('a.png', { isIntermediate: false, boardId: null })]);
    await state().adopt(only().id, [only().candidates[0]!.id]);
    expect(update).toHaveBeenCalledWith(['a.png'], { boardId: null, isIntermediate: false });
  });

  it('moves nothing that is not held back, not finished, or not asked for, and keeps the batch when the move fails', async () => {
    made(['a.png', 'b.png']);
    const update = vi.spyOn(backend, 'updateImages').mockRejectedValue(new Error('disk'));
    useGallery.setState({ images: [picture('a.png', { isIntermediate: false }), picture('b.png')] });
    await state().adopt(only().id, [only().candidates[0]!.id]);
    expect(update).not.toHaveBeenCalled();
    await state().adopt(only().id, ['nobody']);
    expect(update).not.toHaveBeenCalled();
    await state().adopt(only().id, [only().candidates[1]!.id]);
    expect(only().candidates).toHaveLength(2);
    expect(state().busy).toBe(false);
    expect(useToasts.getState().toasts.at(-1)?.status).toBe('error');
  });
});

describe('throwing away what is left', () => {
  const held = () => {
    state().addGeneration([item(1), item(2), item(3)], request);
    useDrafts.setState({
      groups: state().groups.map((g) => ({
        ...g,
        candidates: g.candidates.map((c, i) => (i < 2 ? { ...c, finalStatus: 'ready' as const, finalImageName: `p${i}.png` } : { ...c, finalStatus: 'running' as const })),
      })),
    });
    useGallery.setState({ images: [picture('p0.png'), picture('p1.png', { isIntermediate: false })] });
  };

  it('cancels what still runs, makes the held pictures visible and trashes them so the toast can take them back, and closes the batch', async () => {
    held();
    const cancel = vi.spyOn(backend, 'cancelQueueItem').mockResolvedValue();
    const update = vi.spyOn(backend, 'updateImages').mockResolvedValue([]);
    const del = vi.spyOn(backend, 'deleteImages').mockResolvedValue();
    await state().discardRest(only().id);
    expect(state().groups).toEqual([]);
    expect(cancel).toHaveBeenCalledWith(3);
    // Only p0 is held back: p1 is on a board already and stays.
    expect(update).toHaveBeenCalledWith(['p0.png'], { isIntermediate: false });
    expect(del).toHaveBeenCalledWith(['p0.png']);
    expect(useGallery.getState().images.map((i) => i.name)).toEqual(['p1.png']);
    expect(useGalleryUndo.getState().undo).toEqual([['p0.png']]);
  });

  it('closing a generation batch does the same, and closing a batch of drafts only closes it', async () => {
    held();
    const del = vi.spyOn(backend, 'deleteImages').mockResolvedValue();
    vi.spyOn(backend, 'cancelQueueItem').mockResolvedValue();
    vi.spyOn(backend, 'updateImages').mockResolvedValue([]);
    const id = only().id;
    state().closeGroup(id);
    await vi.waitFor(() => expect(del).toHaveBeenCalledWith(['p0.png']));
    expect(state().groups).toEqual([]);

    del.mockClear();
    useDrafts.setState({ groups: [{ ...only2(), id: 'd' }] });
    state().closeGroup('d');
    await Promise.resolve();
    expect(del).not.toHaveBeenCalled();
  });

  it('says so when the pictures could not be thrown away, and the batch is gone either way', async () => {
    held();
    vi.spyOn(backend, 'cancelQueueItem').mockResolvedValue();
    vi.spyOn(backend, 'updateImages').mockRejectedValue(new Error('disk'));
    await state().discardRest(only().id);
    expect(useToasts.getState().toasts.at(-1)?.status).toBe('error');
  });
});

function only2(): DraftGroup {
  return { id: 'x', createdAt: 0, params: {} as GenerationMetadata, boardId: null, position: 0.4, candidates: [] };
}
