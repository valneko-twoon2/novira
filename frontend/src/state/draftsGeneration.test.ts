// @vitest-environment jsdom
// A generation batch of the Candidates view: what one press of Invoke made, held back from the boards until the user moves
// the pictures they want there.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type EnqueueRequest, type GenerationMetadata, type ImageDTO, type QueueItem } from '@/backend';
import { dropAdopted, heldPictures, syncGroups, useDrafts, type DraftGroup } from './drafts';
import { useGallery } from './gallery';
import { useGalleryUndo } from './galleryUndo';
import { useQueue } from './queue';
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
  useQueue.setState({ items: [] });
});
afterEach(() => vi.restoreAllMocks());

describe('registering what one press of Invoke made', { tags: [] }, () => {
  it('makes one batch whose pictures are waiting to be drawn to the end, with no draft step', { tags: ['equivalence'] }, () => {
    state().addGeneration([item(1), item(2)], request);
    expect(state().groups).toHaveLength(1);
    expect(state().currentId).toBe(only().id);
    expect(only()).toMatchObject({ kind: 'generation', boardId: 'board', position: 1 });
    expect(only().candidates.map((c) => [c.seed, c.itemId, c.finalItemId, c.finalStatus, c.status])).toEqual([
      [101, null, 1, 'queued', 'ready'],
      [102, null, 2, 'queued', 'ready'],
    ]);
  });

  it('shows a picture as being drawn when its job started before the batch was made', { tags: ['regression', 'state-transition'] }, () => {
    // An idle queue starts the job at once: its "in progress" change arrives before the enqueue call returns, and nothing
    // changes in the queue again until the picture is done.
    useQueue.setState({ items: [item(1, { status: 'in_progress' }), item(2)] });
    state().addGeneration([item(1), item(2)], request);
    expect(only().candidates.map((c) => c.finalStatus)).toEqual(['running', 'queued']);
  });

  it('makes nothing from no items', { tags: ['boundary'] }, () => {
    state().addGeneration([], request);
    expect(state().groups).toEqual([]);
  });

  it('takes each picture in from its queue item as it runs and finishes', { tags: ['state-transition'] }, () => {
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

describe('moving pictures to the board', { tags: [] }, () => {
  const made = (names: string[]) => {
    state().addGeneration(names.map((_, i) => item(i + 1)), request);
    state().setCurrent(only().id);
    useDrafts.setState({ groups: state().groups.map((g) => ({ ...g, candidates: g.candidates.map((c, i) => ({ ...c, finalStatus: 'ready' as const, finalImageName: names[i]! })) })) });
    useGallery.setState({ images: names.map((n) => picture(n)) });
  };

  it('lists the pictures still held back, and not those already on a board', { tags: ['condition'] }, () => {
    made(['a.png', 'b.png']);
    useGallery.setState({ images: [picture('a.png'), picture('b.png', { isIntermediate: false })] });
    expect(heldPictures(only(), useGallery.getState().images).map((i) => i.name)).toEqual(['a.png']);
  });

  it(
    'moves the chosen ones to the board of the batch, shows them there and takes them out of the batch',
    { tags: ['scenario'] },
    async () => {
      made(['a.png', 'b.png']);
      const update = vi.spyOn(backend, 'updateImages').mockResolvedValue([picture('a.png', { isIntermediate: false })]);
      await state().adopt(only().id, [only().candidates[0]!.id]);
      expect(update).toHaveBeenCalledWith(['a.png'], { boardId: 'board', isIntermediate: false });
      expect(useGallery.getState().images.find((i) => i.name === 'a.png')?.isIntermediate).toBe(false);
      expect(only().candidates.map((c) => c.finalImageName)).toEqual(['b.png']);
      expect(useToasts.getState().toasts.at(-1)?.status).toBe('success');
    },
  );

  it('closes the batch when its last picture has gone to a board', { tags: ['boundary', 'state-transition'] }, async () => {
    made(['a.png']);
    vi.spyOn(backend, 'updateImages').mockResolvedValue([picture('a.png', { isIntermediate: false })]);
    await state().adopt(only().id, [only().candidates[0]!.id]);
    expect(state()).toMatchObject({ groups: [], currentId: null });
  });

  it('uses Uncategorized when the board of the batch is gone', { tags: ['condition'] }, async () => {
    made(['a.png']);
    useGallery.setState({ boards: [] });
    const update = vi.spyOn(backend, 'updateImages').mockResolvedValue([picture('a.png', { isIntermediate: false, boardId: null })]);
    await state().adopt(only().id, [only().candidates[0]!.id]);
    expect(update).toHaveBeenCalledWith(['a.png'], { boardId: null, isIntermediate: false });
  });

  it(
    'moves nothing that is not held back, not finished, or not asked for, and keeps the batch when the move fails',
    { tags: ['error-guessing', 'condition'] },
    async () => {
      made(['a.png', 'b.png']);
      const update = vi.spyOn(backend, 'updateImages').mockRejectedValue(new Error('disk'));
      // The gallery does not hold a.png (not known, or deleted): it is not held back, so nothing is moved.
      useGallery.setState({ images: [picture('b.png')] });
      await state().adopt(only().id, [only().candidates[0]!.id]);
      expect(update).not.toHaveBeenCalled();
      await state().adopt(only().id, ['nobody']);
      expect(update).not.toHaveBeenCalled();
      await state().adopt(only().id, [only().candidates[1]!.id]);
      expect(only().candidates).toHaveLength(2);
      expect(state().busy).toBe(false);
      expect(useToasts.getState().toasts.at(-1)?.status).toBe('error');
    },
  );
});

describe('throwing away what is left', { tags: [] }, () => {
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

  it(
    'cancels what still runs, makes the held pictures visible and trashes them so the toast can take them back, and closes the batch',
    { tags: ['state-transition'] },
    async () => {
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
    },
  );

  it('closing a generation batch does the same, and closing a batch of drafts only closes it', { tags: ['condition'] }, async () => {
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

  it('says so when the pictures could not be thrown away, and the batch is gone either way', { tags: ['error-guessing'] }, async () => {
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

describe('a held picture taken to a board by hand', { tags: [] }, () => {
  const made = (names: string[]) => {
    state().addGeneration(names.map((_, i) => item(i + 1)), request);
    useDrafts.setState({ groups: state().groups.map((g) => ({ ...g, candidates: g.candidates.map((c, i) => ({ ...c, finalStatus: 'ready' as const, finalImageName: names[i]! })) })) });
    useGallery.setState({ images: names.map((n) => picture(n)) });
  };

  it('leaves the batch when the picture is shown on a board (dragged onto it), the others stay', { tags: ['condition'] }, () => {
    made(['a.png', 'b.png']);
    useGallery.getState().upsertImages([picture('a.png', { isIntermediate: false })]);
    expect(only().candidates.map((c) => c.finalImageName)).toEqual(['b.png']);
  });

  it(
    'closes the batch when its last picture is taken, and keeps the selection of those that remain',
    { tags: ['boundary', 'state-transition'] },
    () => {
      made(['a.png', 'b.png']);
      const [first, second] = only().candidates;
      useDrafts.setState({ selection: [first!.id, second!.id] });
      useGallery.getState().upsertImages([picture('a.png', { isIntermediate: false })]);
      expect(state().selection).toEqual([second!.id]);
      useGallery.getState().upsertImages([picture('b.png', { isIntermediate: false })]);
      expect(state()).toMatchObject({ groups: [], currentId: null, selection: [] });
    },
  );

  it(
    'keeps a picture the gallery does not know yet or still holds back, and batches of drafts',
    { tags: ['condition', 'boundary'] },
    () => {
      made(['a.png']);
      const groups = state().groups;
      expect(dropAdopted(groups, [])).toBe(groups);
      expect(dropAdopted(groups, [picture('a.png')])).toBe(groups);
      const drafts = [{ ...groups[0]!, kind: undefined }];
      expect(dropAdopted(drafts, [picture('a.png', { isIntermediate: false })])).toBe(drafts);
    },
  );
});
