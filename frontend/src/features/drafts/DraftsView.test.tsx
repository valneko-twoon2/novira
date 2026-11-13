// @vitest-environment jsdom
// The Candidates view: the flow of batches with their header, the cells with ✓ and ×, choosing with click, Ctrl and Shift,
// the selection bar, the board to move to, the picture size and the history.
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t, tCount } from '@/i18n';
import { useDraftForm } from '@/state/draftForm';
import { useDrafts, type DraftCandidate } from '@/state/drafts';
import { useGallery } from '@/state/gallery';
import { useParams } from '@/state/params';
import { useQueue } from '@/state/queue';
import { batch, candidate, cleanupDrafts, group, lastToast, made, picture, resetDrafts, show } from './drafts.testkit';

beforeEach(resetDrafts);
afterEach(cleanupDrafts);

const cells = () => screen.getAllByTestId('draft-cell');
const pick = (i: number, mods: { ctrlKey?: boolean; shiftKey?: boolean } = {}) => fireEvent.click(within(cells()[i]!).getByRole('button', { name: /seed/ }), mods);
const badge = (cell: HTMLElement) => cell.querySelector('.dv-badge')?.textContent ?? null;

describe('the flow', { tags: [] }, () => {
  it('shows every batch with something to decide in one list, newest first, each with its header', { tags: ['scenario'] }, () => {
    useDrafts.setState({ groups: [group('a', [candidate(1)]), batch('b', [made(2), made(3)])] });
    useGallery.setState({ images: [picture('d1.png'), picture('g2.png'), picture('g3.png')] });
    show();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    const groups = screen.getAllByTestId('drafts-group');
    expect(groups).toHaveLength(2);
    expect(groups[0]!.textContent).toContain('Model b');
    expect(groups[0]!.textContent).toContain('prompt of b');
    expect(groups[0]!.textContent).toContain(tCount('drafts.history.pictures', 2));
    expect(groups[1]!.textContent).toContain(tCount('drafts.history.drafts', 1));
    expect(within(groups[0]!).getAllByTestId('draft-cell')).toHaveLength(2);
  });

  it('leaves out a batch of drafts whose every draft is finished, until it is opened from the history', { tags: ['condition', 'scenario'] }, () => {
    const done = candidate(1, { finalItemId: 5, finalImageName: 'f1.png', finalStatus: 'ready' });
    useDrafts.setState({ groups: [group('a', [done]), group('b', [candidate(2)])], currentId: 'b' });
    useGallery.setState({ images: [picture('d1.png'), picture('f1.png', false), picture('d2.png')] });
    show();
    expect(screen.getAllByTestId('drafts-group')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('drafts-history-button'));
    const card = screen.getAllByTestId('drafts-history-card').find((c) => c.textContent?.includes('Model a'))!;
    fireEvent.click(within(card).getByTestId('drafts-history-open'));
    expect(screen.queryByTestId('drafts-history')).toBeNull();
    expect(screen.getAllByTestId('drafts-group')).toHaveLength(2);
    expect(badge(screen.getAllByTestId('drafts-group')[1]!.querySelector('[data-testid="draft-cell"]')!)).toBe(t('drafts.badge.finished'));
  });

  it('shows a bounded number of batches and more on request', { tags: ['boundary'] }, () => {
    useDrafts.setState({ groups: Array.from({ length: 10 }, (_, i) => group(`g${i + 1}`, [candidate(i + 1)])) });
    show();
    expect(screen.getAllByTestId('drafts-group')).toHaveLength(8);
    expect(screen.getAllByTestId('drafts-group')[0]!.textContent).toContain('Model g10');
    fireEvent.click(screen.getByTestId('drafts-more'));
    expect(screen.getAllByTestId('drafts-group')).toHaveLength(10);
    expect(screen.queryByTestId('drafts-more')).toBeNull();
  });

  it('keeps a batch past the limit listed after its picture was shown large and the view was closed', { tags: ['state-transition', 'regression'] }, () => {
    // the view came back (a screen switch) showing a picture of the oldest batch, past the first 8
    useDrafts.setState({ groups: Array.from({ length: 10 }, (_, i) => group(`g${i + 1}`, [candidate(i + 1)])), viewing: 'c1' });
    useGallery.setState({ images: Array.from({ length: 10 }, (_, i) => picture(`d${i + 1}.png`)) });
    show();
    expect(screen.queryByTestId('drafts-group')).toBeNull();
    fireEvent.click(screen.getByTestId('drafts-large-back'));
    expect(screen.getAllByTestId('drafts-group').map((g) => g.dataset.groupId)).toContain('g1');
  });

  it('accepts a whole batch from its header: a generation batch to the board, a batch of drafts finished', { tags: ['decision-table'] }, () => {
    const adopt = vi.fn().mockResolvedValue(undefined);
    const finish = vi.fn().mockResolvedValue(undefined);
    useDrafts.setState({ adopt, finish, groups: [group('d', [candidate(1), candidate(2, { status: 'queued', imageName: null })]), batch('g', [made(3), made(4, { finalImageName: null, finalStatus: 'running' })])] });
    useGallery.setState({ images: [picture('d1.png'), picture('g3.png')] });
    show();
    const [gen, drafts] = screen.getAllByTestId('drafts-group');
    expect(within(gen!).getByTestId('drafts-group-accept').getAttribute('aria-label')).toBe(t('drafts.acceptAll.generation'));
    expect(within(drafts!).getByTestId('drafts-group-accept').getAttribute('aria-label')).toBe(t('drafts.acceptAll.draft'));
    fireEvent.click(within(gen!).getByTestId('drafts-group-accept'));
    expect(adopt).toHaveBeenCalledWith('g', ['c3']);
    fireEvent.click(within(drafts!).getByTestId('drafts-group-accept'));
    expect(finish).toHaveBeenCalledWith('d', ['c1']);
  });

  it('cannot accept a batch with nothing ready, and throws a batch away from its header', { tags: ['boundary', 'state-transition'] }, () => {
    useDrafts.setState({ groups: [group('a', [candidate(1, { status: 'queued', imageName: null })]), group('b', [candidate(2)])] });
    show();
    const [b, a] = screen.getAllByTestId('drafts-group');
    expect((within(a!).getByTestId('drafts-group-accept') as HTMLButtonElement).disabled).toBe(true);
    expect((within(b!).getByTestId('drafts-group-accept') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(within(b!).getByTestId('drafts-group-discard'));
    expect(useDrafts.getState().groups.map((g) => g.id)).toEqual(['a']);
    expect(screen.getAllByTestId('drafts-group')).toHaveLength(1);
  });

  it('names the trash on the header × of a generation batch', { tags: ['condition'] }, () => {
    useDrafts.setState({ groups: [batch('g', [made(1)]), group('d', [candidate(2)])] });
    useGallery.setState({ images: [picture('g1.png')] });
    show();
    const [drafts, gen] = screen.getAllByTestId('drafts-group');
    expect(within(gen!).getByTestId('drafts-group-discard').getAttribute('aria-label')).toBe(t('drafts.closeGroupHeld'));
    expect(within(drafts!).getByTestId('drafts-group-discard').getAttribute('aria-label')).toBe(t('drafts.closeGroup'));
  });

  it('offers to retry the failed drafts from the header', { tags: ['error-guessing'] }, () => {
    const retryFailed = vi.fn().mockResolvedValue(undefined);
    useDrafts.setState({ retryFailed, groups: [group('a', [candidate(1, { status: 'failed', imageName: null }), candidate(2, { status: 'failed', imageName: null })])] });
    show();
    fireEvent.click(screen.getByRole('button', { name: tCount('drafts.retry', 2) }));
    expect(retryFailed).toHaveBeenCalledWith('a');
  });

  it('shows the empty state with no batch', { tags: ['boundary'] }, () => {
    show();
    expect(screen.getByText(t('drafts.empty.title'))).toBeTruthy();
    expect(screen.queryByTestId('drafts-history-button')).toBeNull();
  });
});

describe('a candidate', { tags: [] }, () => {
  it('shows its state on the picture, and no word for a drawn draft or a drawn picture', { tags: ['equivalence'] }, () => {
    useGallery.setState({ images: ['d1.png', 'd5.png', 'f6.png'].map((n) => picture(n)) });
    useDrafts.setState({
      groups: [
        group('a', [
          candidate(1),
          candidate(2, { status: 'queued', imageName: null }),
          candidate(3, { status: 'running', imageName: null }),
          candidate(4, { status: 'failed', imageName: null, error: 'out of memory' }),
          candidate(5, { finalStatus: 'queued', finalItemId: 9 }),
          candidate(6, { finalImageName: 'f6.png', finalStatus: 'ready', finalItemId: 8 }),
          candidate(7, { finalStatus: 'failed', finalItemId: 7 }),
        ]),
      ],
    });
    show();
    expect(cells().map(badge)).toEqual([
      null,
      t('drafts.badge.queued'),
      t('drafts.badge.drawing'),
      t('drafts.badge.failed'),
      t('drafts.badge.finishing'),
      t('drafts.badge.finished'),
      t('drafts.badge.failed'),
    ]);
    // The draft's position and the seed are in the tooltip, not printed.
    expect(within(cells()[0]!).getByRole('button', { name: /seed/ }).getAttribute('title')).toContain(t('drafts.badge.draft', { percent: 35, steps: 28, step: 10 }));
    expect(cells()[0]!.textContent).not.toContain('seed');
    expect(cells()[3]!.querySelector('.dv-badge')!.getAttribute('title')).toBe('out of memory');
    expect(cells()[5]!.querySelector('img')!.getAttribute('src')).toBe('blob:t-f6.png');
    expect(cells()[4]!.querySelector('.dv-busy')).toBeTruthy();
  });

  it('shows a generation batch picture as waiting or generating, and nothing once drawn', { tags: ['equivalence'] }, () => {
    useDrafts.setState({ groups: [batch('g', [made(1), made(2, { finalImageName: null, finalStatus: 'running' }), made(3, { finalImageName: null, finalStatus: 'queued' })])] });
    useGallery.setState({ images: [picture('g1.png')] });
    show();
    expect(cells().map(badge)).toEqual([null, t('drafts.badge.generating'), t('drafts.badge.queued')]);
  });

  it('has ✓ and × on the picture: ✓ moves a held picture, finishes a draft, and is absent when there is nothing to do', { tags: ['decision-table'] }, () => {
    const adopt = vi.fn().mockResolvedValue(undefined);
    const finish = vi.fn().mockResolvedValue(undefined);
    useDrafts.setState({ adopt, finish, groups: [group('d', [candidate(1), candidate(2, { status: 'running', imageName: null })]), batch('g', [made(3)])] });
    useGallery.setState({ images: [picture('d1.png'), picture('g3.png')] });
    show();
    const [held, draft, drawing] = cells();
    expect(within(held!).getByTestId('draft-accept').getAttribute('aria-label')).toBe(t('drafts.accept.generation'));
    expect(within(draft!).getByTestId('draft-accept').getAttribute('aria-label')).toBe(t('drafts.accept.draft'));
    expect(within(drawing!).queryByTestId('draft-accept')).toBeNull();
    fireEvent.click(within(held!).getByTestId('draft-accept'));
    expect(adopt).toHaveBeenCalledWith('g', ['c3']);
    fireEvent.click(within(draft!).getByTestId('draft-accept'));
    expect(finish).toHaveBeenCalledWith('d', ['c1']);
    // × throws the one away, whatever its state.
    fireEvent.click(within(drawing!).getByTestId('draft-discard'));
    expect(useDrafts.getState().groups.find((g) => g.id === 'd')!.candidates.map((c) => c.id)).toEqual(['c1']);
  });

  it('lets a drawn picture be dragged onto a board, and a waiting one not', { tags: ['condition'] }, () => {
    useDrafts.setState({ groups: [batch('g', [made(1), made(2, { finalImageName: null, finalStatus: 'queued' })])] });
    useGallery.setState({ images: [picture('g1.png')] });
    show();
    const [done, waiting] = screen.getAllByRole('button', { name: /seed/ });
    expect(done!.getAttribute('draggable')).toBe('true');
    expect(waiting!.getAttribute('draggable')).not.toBe('true');
  });

  it('shows no picture that is already on a board (it was taken there by a drag)', { tags: ['condition'] }, () => {
    useDrafts.setState({ groups: [batch('g', [made(1), made(2)])] });
    useGallery.setState({ images: [picture('g1.png'), picture('g2.png', false)] });
    show();
    expect(screen.getAllByRole('button', { name: /seed/ })).toHaveLength(1);
  });
});

describe('choosing', { tags: [] }, () => {
  const four = () => {
    useDrafts.setState({ groups: [group('a', [candidate(1), candidate(2, { status: 'queued', imageName: null })]), group('b', [candidate(3), candidate(4)])] });
    show();
  };

  it('picks one by a click, adds by Ctrl click and Space, and ignores one not drawn yet', { tags: ['equivalence', 'condition'] }, () => {
    four();
    // Newest first: b's 3 and 4, then a's 1 and 2.
    pick(0);
    expect(useDrafts.getState().selection).toEqual(['c3']);
    pick(1);
    expect(useDrafts.getState().selection).toEqual(['c4']);
    pick(0, { ctrlKey: true });
    expect(useDrafts.getState().selection).toEqual(['c4', 'c3']);
    pick(0, { ctrlKey: true });
    expect(useDrafts.getState().selection).toEqual(['c4']);
    fireEvent.keyDown(within(cells()[2]!).getByRole('button', { name: /seed/ }), { key: ' ' });
    expect(useDrafts.getState().selection).toEqual(['c4', 'c1']);
    pick(3);
    fireEvent.keyDown(within(cells()[3]!).getByRole('button', { name: /seed/ }), { key: ' ' });
    expect(useDrafts.getState().selection).toEqual(['c4', 'c1']);
    // A click on the only chosen one lets it go.
    pick(1);
    pick(1);
    expect(useDrafts.getState().selection).toEqual([]);
  });

  it('chooses a range across batches with Shift, leaving out what is not drawn', { tags: ['boundary'] }, () => {
    four();
    pick(0);
    // A Shift click on one not drawn yet does nothing; on the one before it, the range ends there.
    pick(3, { shiftKey: true });
    expect(useDrafts.getState().selection).toEqual(['c3']);
    pick(2, { shiftKey: true });
    expect(useDrafts.getState().selection).toEqual(['c3', 'c4', 'c1']);
    pick(1, { shiftKey: true });
    expect(useDrafts.getState().selection).toEqual(['c3', 'c4']);
  });

  it('shows the selection bar only with something chosen: count, ✓, × and letting go', { tags: ['state-transition'] }, () => {
    const finish = vi.fn().mockResolvedValue(undefined);
    useDrafts.setState({ finish });
    four();
    expect(screen.queryByTestId('drafts-selection-bar')).toBeNull();
    pick(0);
    pick(1, { ctrlKey: true });
    expect(screen.getByTestId('drafts-selection-bar').textContent).toContain(tCount('drafts.selected', 2));
    expect(screen.getByTestId('drafts-selection-accept').getAttribute('aria-label')).toBe(t('drafts.accept.draft'));
    fireEvent.click(screen.getByTestId('drafts-selection-accept'));
    expect(finish).toHaveBeenCalledWith('b', ['c3', 'c4']);
    fireEvent.click(screen.getByTestId('drafts-selection-clear'));
    expect(screen.queryByTestId('drafts-selection-bar')).toBeNull();
    pick(0);
    pick(2, { ctrlKey: true });
    fireEvent.click(screen.getByTestId('drafts-selection-discard'));
    expect(useDrafts.getState().groups.flatMap((g) => g.candidates.map((c) => c.id))).toEqual(['c2', 'c4']);
    expect(screen.queryByTestId('drafts-selection-bar')).toBeNull();
  });

  it('moves the chosen pictures of every batch, and names both actions when drafts are chosen too', { tags: ['decision-table'] }, () => {
    const adopt = vi.fn().mockResolvedValue(undefined);
    const finish = vi.fn().mockResolvedValue(undefined);
    useDrafts.setState({ adopt, finish, groups: [group('d', [candidate(1)]), batch('g', [made(2), made(3)])] });
    useGallery.setState({ images: [picture('d1.png'), picture('g2.png'), picture('g3.png')] });
    show();
    pick(0);
    pick(1, { ctrlKey: true });
    expect(screen.getByTestId('drafts-selection-accept').getAttribute('aria-label')).toBe(t('drafts.accept.generation'));
    pick(2, { ctrlKey: true });
    expect(screen.getByTestId('drafts-selection-accept').getAttribute('aria-label')).toBe(t('drafts.accept.mixed'));
    fireEvent.click(screen.getByTestId('drafts-selection-accept'));
    expect(adopt).toHaveBeenCalledWith('g', ['c2', 'c3']);
    expect(finish).toHaveBeenCalledWith('d', ['c1']);
  });
});

describe('the top bar', { tags: [] }, () => {
  it('shows the board the pictures go to under the word Board, and changes the board selected in the gallery', { tags: ['scenario'] }, () => {
    useGallery.setState({
      boards: [
        { id: 'b1', name: 'Cats', archived: false, createdAt: 1, parentId: null },
        { id: 'b2', name: 'Old', archived: true, createdAt: 1, parentId: null },
      ] as never,
      selectedBoardId: 'b1',
    });
    show();
    expect(screen.getByText(t('gallery.boards.title'))).toBeTruthy();
    expect(screen.getByTestId('drafts-target').textContent).toContain('Cats');
    fireEvent.click(screen.getByTestId('drafts-target'));
    const items = () => screen.getAllByTestId('drafts-target-item');
    expect(items().map((i) => i.dataset.boardId)).toEqual(['none', 'b1']);
    expect(items()[1]!.getAttribute('aria-current')).toBe('true');
    fireEvent.click(items()[0]!);
    expect(useGallery.getState().selectedBoardId).toBe('none');
    expect(screen.queryByTestId('drafts-target-list')).toBeNull();
  });

  it('lists the boards as a tree with the latest picture and the counts of each board, and finds a subfolder by its path', { tags: ['scenario', 'equivalence'] }, () => {
    const pic = (name: string, boardId: string | null, createdAt: number, category = 'general') => ({ ...(picture(name, false) as object), boardId, createdAt, category });
    useGallery.setState({
      boards: [
        { id: 'p', name: 'Ganyu', archived: false, createdAt: 2, parentId: null },
        { id: 'c', name: 'Originals', archived: false, createdAt: 3, parentId: 'p' },
        { id: 'q', name: 'Empty', archived: false, createdAt: 1, parentId: null },
      ] as never,
      images: [pic('old.png', 'c', 1), pic('new.png', 'c', 5), pic('ref.png', 'c', 2, 'user')] as never,
      selectedBoardId: 'c',
    });
    show();
    const trigger = screen.getByTestId('drafts-target');
    expect(trigger.textContent).toContain('Ganyu / Originals');
    expect(trigger.querySelector('img')?.getAttribute('src')).toBe('blob:t-new.png');
    fireEvent.click(trigger);
    const items = () => screen.getAllByTestId('drafts-target-item');
    expect(items().map((i) => i.dataset.boardId)).toEqual(['none', 'p', 'c', 'q']);
    const sub = items()[2]!;
    expect(sub.style.getPropertyValue('--dv-board-depth')).toBe('1');
    expect(sub.querySelector('img')?.getAttribute('src')).toBe('blob:t-new.png');
    expect(sub.textContent).toContain(t('gallery.boards.counts', { images: 2, assets: 1 }));
    // a board with no picture shows a folder, not an empty picture
    expect(items()[3]!.querySelector('img')).toBeNull();
    fireEvent.change(screen.getByLabelText(t('gallery.boards.searchPlaceholder')), { target: { value: 'ganyu / orig' } });
    expect(items().map((i) => i.dataset.boardId)).toEqual(['c']);
  });

  it('shows Uncategorized when the selected board is gone', { tags: ['error-guessing'] }, () => {
    useGallery.setState({ boards: [], selectedBoardId: 'gone' });
    show();
    expect(screen.getByTestId('drafts-target').textContent).toContain(t('gallery.boards.uncategorized'));
  });

  it('sizes the pictures with the slider', { tags: ['boundary'] }, () => {
    useDrafts.setState({ groups: [group('a', [candidate(1)])] });
    show();
    const slider = screen.getByRole('slider', { name: t('gallery.settings.thumbnailSize') });
    expect(slider.getAttribute('aria-valuemin')).toBe('96');
    expect(slider.getAttribute('aria-valuemax')).toBe('320');
    expect(screen.getByTestId('drafts-grid').style.getPropertyValue('--dv-thumb')).toBe('168px');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(useDraftForm.getState().thumbSize).toBe(176);
    expect(screen.getByTestId('drafts-grid').style.getPropertyValue('--dv-thumb')).toBe('176px');
  });
});

describe('history', { tags: [] }, () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => group(`g${i + 1}`, [candidate(i + 1)]));

  it('is an icon button with the count of batches, and opens every batch on one screen', { tags: ['boundary'] }, () => {
    useDrafts.setState({ groups: many(8), currentId: 'g8' });
    show();
    expect(screen.getByTestId('drafts-history-button').textContent).toBe('8');
    expect(screen.getByTestId('drafts-history-button').getAttribute('aria-label')).toBe(t('drafts.history.title'));
    fireEvent.click(screen.getByTestId('drafts-history-button'));
    const cards = screen.getAllByTestId('drafts-history-card');
    expect(cards).toHaveLength(8);
    expect(cards[0]!.textContent).toContain('8.');
    fireEvent.click(within(cards[7]!).getByTestId('drafts-history-open'));
    expect(useDrafts.getState().currentId).toBe('g1');
    expect(screen.queryByTestId('drafts-history')).toBeNull();
  });

  it('shows the pictures drawn then on each card, and narrows by model and by words of the prompt', { tags: ['scenario'] }, () => {
    const with2 = (id: string, model: string, prompt: string, n: number) => ({ ...group(id, [candidate(n), candidate(n + 50)]), params: { ...group(id, []).params, modelName: model, positivePrompt: prompt } });
    useDrafts.setState({ groups: [with2('a', 'Anima', 'a cat on a roof', 1), with2('b', 'SDXL', 'a dog in the rain', 2), with2('c', 'Anima', 'a cat in the snow', 3)], currentId: 'c' });
    useGallery.setState({ images: [picture('d1.png'), picture('d51.png'), picture('d2.png')] });
    show();
    fireEvent.click(screen.getByTestId('drafts-history-button'));
    const cardOf = (n: string) => screen.getAllByTestId('drafts-history-card').find((c) => c.textContent?.includes(n))!;
    expect(cardOf('1.').querySelectorAll('img')).toHaveLength(2);
    expect(cardOf('2.').querySelectorAll('img')).toHaveLength(1);
    fireEvent.click(screen.getAllByTestId('drafts-history-model').find((b) => b.textContent?.startsWith('Anima'))!);
    expect(screen.getAllByTestId('drafts-history-card')).toHaveLength(2);
    fireEvent.change(screen.getByTestId('drafts-history-search'), { target: { value: 'snow' } });
    expect(screen.getAllByTestId('drafts-history-card')).toHaveLength(1);
    fireEvent.change(screen.getByTestId('drafts-history-search'), { target: { value: 'horse' } });
    expect(screen.queryAllByTestId('drafts-history-card')).toHaveLength(0);
  });

  it('puts the settings of a batch back in the Generate form', { tags: ['scenario'] }, () => {
    const g = { ...group('a', [candidate(1)]), params: { ...group('a', []).params, positivePrompt: 'a lighthouse', negativePrompt: '', steps: 33, seed: 7, cfgScale: 5, scheduler: 'euler', loras: [] } as never };
    useDrafts.setState({ groups: [g], currentId: 'a' });
    show();
    fireEvent.click(screen.getByTestId('drafts-history-button'));
    fireEvent.click(screen.getByTestId('drafts-history-reuse'));
    expect(useParams.getState()).toMatchObject({ positivePrompt: 'a lighthouse', steps: 33 });
    expect(lastToast()?.title).toBe(t('drafts.history.reused'));
  });

  it('closes all the older ones at once from the history screen and leaves the latest', { tags: ['boundary', 'scenario'] }, () => {
    useDrafts.setState({ groups: many(7), currentId: 'g1' });
    show();
    fireEvent.click(screen.getByTestId('drafts-history-button'));
    fireEvent.click(screen.getByTestId('drafts-close-older'));
    expect(useDrafts.getState().groups.map((g) => g.id)).toEqual(['g3', 'g4', 'g5', 'g6', 'g7']);
    expect(useDrafts.getState().currentId).toBe('g7');
    expect(screen.queryByTestId('drafts-close-older')).toBeNull();
  });
});

describe('a picture being drawn', { tags: [] }, () => {
  const setup = (over: Partial<DraftCandidate>, kind: 'draft' | 'generation' = 'draft') => {
    useDrafts.setState({ groups: [kind === 'draft' ? group('g', [candidate(1, over)]) : batch('g', [made(1, over)])] });
    useGallery.setState({ images: [picture('d1.png')] as never });
    show();
    return () => screen.getByTestId('draft-cell');
  };
  afterEach(() => act(() => useQueue.getState().setProgress(null)));

  it('shows the draft being drawn with its step, and ignores the progress of other jobs', { tags: ['condition'] }, () => {
    const cell = setup({ imageName: null, status: 'running', itemId: 4 });
    expect(cell().querySelector('img')).toBeNull();
    act(() => useQueue.getState().setProgress({ itemId: 4, step: 3, totalSteps: 8, progressImageUrl: 'blob:draft-live' } as never));
    expect(cell().querySelector('img')?.getAttribute('src')).toBe('blob:draft-live');
    expect(badge(cell())).toBe(`${t('drafts.badge.drawing')} 3/8`);
    act(() => useQueue.getState().setProgress({ itemId: 5, step: 1, totalSteps: 8, progressImageUrl: 'blob:other' } as never));
    expect(cell().querySelector('img')).toBeNull();
  });

  it('shows the picture being finished in place of its draft, and the draft again once it is done', { tags: ['state-transition'] }, () => {
    const cell = setup({ finalItemId: 9, finalStatus: 'running' });
    expect(cell().querySelector('img')?.getAttribute('src')).toBe('blob:t-d1.png');
    act(() => useQueue.getState().setProgress({ itemId: 9, step: 10, totalSteps: 30, progressImageUrl: 'blob:final-live' } as never));
    expect(cell().querySelector('img')?.getAttribute('src')).toBe('blob:final-live');
    expect(badge(cell())).toBe(`${t('drafts.badge.finishing')} 10/30`);
    act(() => useQueue.getState().setProgress(null));
    expect(cell().querySelector('img')?.getAttribute('src')).toBe('blob:t-d1.png');
  });

  it('shows a generation batch picture being drawn with its step', { tags: ['condition'] }, () => {
    const cell = setup({ finalImageName: null, finalStatus: 'running', finalItemId: 7 }, 'generation');
    act(() => useQueue.getState().setProgress({ itemId: 7, step: 12, totalSteps: 30, progressImageUrl: 'blob:live' } as never));
    expect(cell().querySelector('img')?.getAttribute('src')).toBe('blob:live');
    expect(badge(cell())).toBe(`${t('drafts.badge.generating')} 12/30`);
  });
});
