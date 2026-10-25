import { beforeEach, describe, expect, it } from 'vitest';
import type { BoardDTO, ImageDTO } from '@/backend';
import { filterBoardImages, findImage, mergePersisted, persistedPart, selectBoardImages, useGallery } from './gallery';

const initial = useGallery.getState();

const image = (name: string, over: Partial<ImageDTO> = {}): ImageDTO => ({
  name,
  url: `blob:${name}`,
  thumbnailUrl: `blob:${name}`,
  width: 64,
  height: 64,
  createdAt: 0,
  boardId: null,
  starred: false,
  isIntermediate: false,
  category: 'general',
  metadata: null,
  workflow: null,
  ...over,
});

const board = (id: string): BoardDTO => ({ id, name: id, archived: false, createdAt: 0 });

beforeEach(() => useGallery.setState(initial, true));

describe('gallery store', () => {
  it('adds a new image at the front and replaces an existing one without duplicating it', () => {
    const g = useGallery.getState();
    g.setImages([image('a'), image('b')]);
    g.addImage(image('c'));
    expect(useGallery.getState().images.map((i) => i.name)).toEqual(['c', 'a', 'b']);
    useGallery.getState().addImage(image('b', { starred: true }));
    const images = useGallery.getState().images;
    expect(images.map((i) => i.name)).toEqual(['b', 'c', 'a']);
    expect(images[0]!.starred).toBe(true);
  });

  it('upserts only images it already holds', () => {
    useGallery.getState().setImages([image('a'), image('b')]);
    useGallery.getState().upsertImages([image('b', { starred: true }), image('unknown')]);
    const images = useGallery.getState().images;
    expect(images.map((i) => i.name)).toEqual(['a', 'b']);
    expect(images[1]!.starred).toBe(true);
  });

  it('clears selection, viewer and compare targets that point at removed images', () => {
    useGallery.setState({ images: [image('a'), image('b'), image('c')], selection: ['a', 'b'], viewerImageName: 'b', compareImageName: 'a' });
    useGallery.getState().removeImages(['a', 'b']);
    const s = useGallery.getState();
    expect(s.images.map((i) => i.name)).toEqual(['c']);
    expect(s.selection).toEqual([]);
    expect(s.viewerImageName).toBeNull();
    expect(s.compareImageName).toBeNull();
  });

  it('keeps the viewer image when an unrelated image is removed', () => {
    useGallery.setState({ images: [image('a'), image('b')], selection: ['a'], viewerImageName: 'a' });
    useGallery.getState().removeImages(['b']);
    expect(useGallery.getState().viewerImageName).toBe('a');
    expect(useGallery.getState().selection).toEqual(['a']);
  });

  it('falls back to Uncategorized when the selected or auto-add board is removed', () => {
    useGallery.setState({ boards: [board('x'), board('y')], selectedBoardId: 'x', autoAddBoardId: 'x' });
    useGallery.getState().removeBoard('x');
    const s = useGallery.getState();
    expect(s.boards.map((b) => b.id)).toEqual(['y']);
    expect(s.selectedBoardId).toBe('none');
    expect(s.autoAddBoardId).toBe('none');
  });

  it('upserts boards by id', () => {
    useGallery.getState().upsertBoard(board('x'));
    useGallery.getState().upsertBoard({ ...board('x'), name: 'renamed' });
    useGallery.getState().upsertBoard(board('y'));
    expect(useGallery.getState().boards.map((b) => [b.id, b.name])).toEqual([
      ['x', 'renamed'],
      ['y', 'y'],
    ]);
  });

  it('moves the images of a deleted board to Uncategorized', () => {
    useGallery.getState().setImages([image('a', { boardId: 'x' }), image('b', { boardId: 'y' })]);
    useGallery.getState().detachBoardImages('x');
    expect(useGallery.getState().images.map((i) => i.boardId)).toEqual([null, 'y']);
  });

  it('selecting a board resets the page and selection and follows auto-assign', () => {
    useGallery.setState({ page: 3, selection: ['a'] });
    useGallery.getState().selectBoard('x');
    let s = useGallery.getState();
    expect([s.selectedBoardId, s.page, s.selection, s.autoAddBoardId]).toEqual(['x', 0, [], 'x']);

    useGallery.getState().setSettings({ autoAssignBoardOnClick: false });
    useGallery.getState().selectBoard('y');
    s = useGallery.getState();
    expect(s.selectedBoardId).toBe('y');
    expect(s.autoAddBoardId).toBe('x');
  });

  it('changing the view or the search goes back to the first page', () => {
    useGallery.getState().setPage(4);
    useGallery.getState().setView('assets');
    expect(useGallery.getState().page).toBe(0);
    useGallery.getState().setPage(2);
    useGallery.getState().setSearch('cat');
    expect(useGallery.getState().page).toBe(0);
  });

  it('starts without a date filter, sets and clears it, and goes back to the first page', () => {
    expect(useGallery.getState().dateFilter).toBeNull();
    useGallery.getState().setPage(2);
    useGallery.getState().setDateFilter({ from: '2026-10-01', to: '2026-10-05' });
    expect(useGallery.getState().dateFilter).toEqual({ from: '2026-10-01', to: '2026-10-05' });
    expect(useGallery.getState().page).toBe(0);
    useGallery.getState().setDateFilter(null);
    expect(useGallery.getState().dateFilter).toBeNull();
  });

  it('keeps the date filter when another board is selected', () => {
    useGallery.getState().setDateFilter({ from: '2026-10-05', to: '2026-10-05' });
    useGallery.getState().selectBoard('x');
    expect(useGallery.getState().dateFilter).toEqual({ from: '2026-10-05', to: '2026-10-05' });
  });

  it('does not save the date filter between sessions', () => {
    useGallery.getState().setDateFilter({ from: '2026-10-05', to: null });
    const saved = persistedPart(useGallery.getState());
    expect(Object.keys(saved).sort()).toEqual(['compareMode', 'settings', 'showMetadata']);
  });

  it('fills settings missing from an older saved copy with their defaults', () => {
    const merged = mergePersisted({ settings: { thumbnailSize: 120 }, showMetadata: true }, useGallery.getState());
    expect(merged.settings.thumbnailSize).toBe(120);
    expect(merged.settings.groupByDate).toBe(false);
    expect(merged.settings.pageSize).toBe(initial.settings.pageSize);
    expect(merged.showMetadata).toBe(true);
    expect(mergePersisted(undefined, useGallery.getState()).settings).toEqual(initial.settings);
  });

  it('shows the last selected image in the viewer and keeps the viewer when the selection empties', () => {
    useGallery.getState().setSelection(['a', 'b']);
    expect(useGallery.getState().viewerImageName).toBe('b');
    useGallery.getState().setSelection([]);
    expect(useGallery.getState().viewerImageName).toBe('b');
  });

  it('shows a running job in the viewer until a picture is picked, and an empty selection does not end it', () => {
    const g = useGallery.getState();
    g.setSelection(['a']);
    g.showLiveItem(9);
    expect(useGallery.getState().viewerLiveItemId).toBe(9);
    useGallery.getState().setSelection([]);
    expect(useGallery.getState().viewerLiveItemId).toBe(9);
    expect(useGallery.getState().viewerImageName).toBe('a');
    useGallery.getState().setSelection(['b']);
    expect(useGallery.getState().viewerLiveItemId).toBeNull();
    useGallery.getState().showLiveItem(9);
    useGallery.getState().setViewerImage('c');
    expect(useGallery.getState().viewerLiveItemId).toBeNull();
    // Not kept between sessions.
    expect(persistedPart({ ...useGallery.getState(), viewerLiveItemId: 9 })).not.toHaveProperty('viewerLiveItemId');
  });

  it('merges settings patches', () => {
    useGallery.getState().setSettings({ thumbnailSize: 120 });
    expect(useGallery.getState().settings.thumbnailSize).toBe(120);
    expect(useGallery.getState().settings.pageSize).toBe(initial.settings.pageSize);
  });

  it('finds images by name', () => {
    useGallery.getState().setImages([image('a')]);
    expect(findImage('a')?.name).toBe('a');
    expect(findImage('b')).toBeUndefined();
    expect(findImage(null)).toBeUndefined();
  });
});

describe('selectBoardImages', () => {
  const images = [
    image('old', { createdAt: 1 }),
    image('new', { createdAt: 3 }),
    image('starred-old', { createdAt: 0, starred: true }),
    image('hidden', { createdAt: 5, isIntermediate: true }),
    image('other-board', { createdAt: 6, boardId: 'x' }),
    image('upload', { createdAt: 7, category: 'user' }),
    image('prompted', { createdAt: 2, metadata: { positivePrompt: 'A Red Fox' } as ImageDTO['metadata'] }),
  ];
  const state = (over: Partial<Parameters<typeof selectBoardImages>[0]> = {}) => ({
    images,
    selectedBoardId: 'none' as const,
    view: 'images' as const,
    search: '',
    dateFilter: null,
    settings: initial.settings,
    ...over,
  });

  it('lists the board images newest first with starred images on top, leaving out helpers and assets', () => {
    expect(selectBoardImages(state()).map((i) => i.name)).toEqual(['starred-old', 'new', 'prompted', 'old']);
  });

  it('sorts oldest first and ignores stars when asked', () => {
    const settings = { ...initial.settings, sortDirection: 'asc' as const, starredFirst: false };
    expect(selectBoardImages(state({ settings })).map((i) => i.name)).toEqual(['starred-old', 'old', 'prompted', 'new']);
  });

  it('shows uploads in the assets view and the chosen board only', () => {
    expect(selectBoardImages(state({ view: 'assets' })).map((i) => i.name)).toEqual(['upload']);
    expect(selectBoardImages(state({ selectedBoardId: 'x' })).map((i) => i.name)).toEqual(['other-board']);
  });

  it('searches names and prompts case-insensitively', () => {
    expect(selectBoardImages(state({ search: '  red fox ' })).map((i) => i.name)).toEqual(['prompted']);
    expect(selectBoardImages(state({ search: 'OLD' })).map((i) => i.name)).toEqual(['starred-old', 'old']);
  });
});

describe('selectBoardImages with dates', () => {
  // Local times, so the expectations hold in any time zone.
  const at = (day: number, hour: number, minute = 0, ms = 0) => new Date(2026, 9, day, hour, minute, 0, ms).getTime();
  const images = [
    image('oct4-late', { createdAt: at(4, 23, 59) + 59_999 }),
    image('oct5-midnight', { createdAt: at(5, 0) }),
    image('oct5-noon', { createdAt: at(5, 12) }),
    image('oct5-starred', { createdAt: at(5, 8), starred: true }),
    image('oct6', { createdAt: at(6, 9) }),
    image('oct7-starred', { createdAt: at(7, 9), starred: true }),
  ];
  const state = (over: Partial<Parameters<typeof selectBoardImages>[0]> = {}) => ({
    images,
    selectedBoardId: 'none' as const,
    view: 'images' as const,
    search: '',
    dateFilter: null,
    settings: initial.settings,
    ...over,
  });
  const names = (over: Partial<Parameters<typeof selectBoardImages>[0]> = {}) => selectBoardImages(state(over)).map((i) => i.name);

  it('keeps only the images of one local day, split exactly at local midnight', () => {
    expect(names({ dateFilter: { from: '2026-10-05', to: '2026-10-05' } })).toEqual(['oct5-starred', 'oct5-noon', 'oct5-midnight']);
    expect(names({ dateFilter: { from: '2026-10-04', to: '2026-10-04' } })).toEqual(['oct4-late']);
  });

  it('includes both ends of a range and supports open ends', () => {
    expect(names({ dateFilter: { from: '2026-10-05', to: '2026-10-06' } })).toEqual(['oct5-starred', 'oct6', 'oct5-noon', 'oct5-midnight']);
    expect(names({ dateFilter: { from: '2026-10-06', to: null } })).toEqual(['oct7-starred', 'oct6']);
    expect(names({ dateFilter: { from: null, to: '2026-10-04' } })).toEqual(['oct4-late']);
  });

  it('is empty when no image falls in the range', () => {
    expect(names({ dateFilter: { from: '2026-11-01', to: '2026-11-30' } })).toEqual([]);
  });

  it('runs day by day when grouped, newest day first, starred first within each day', () => {
    const settings = { ...initial.settings, groupByDate: true };
    expect(names({ settings })).toEqual(['oct7-starred', 'oct6', 'oct5-starred', 'oct5-noon', 'oct5-midnight', 'oct4-late']);
    const asc = { ...settings, sortDirection: 'asc' as const };
    expect(names({ settings: asc })).toEqual(['oct4-late', 'oct5-starred', 'oct5-midnight', 'oct5-noon', 'oct6', 'oct7-starred']);
  });

  it('leaves the date filter out of filterBoardImages (the calendar counts every day)', () => {
    expect(filterBoardImages(state({ dateFilter: { from: '2026-10-07', to: '2026-10-07' } }))).toHaveLength(images.length);
  });
});
