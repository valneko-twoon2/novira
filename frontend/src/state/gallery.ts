// Boards, images, gallery view options, search and date filters, selection, viewer and compare targets.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BoardDTO, ImageDTO } from '@/backend';
import { groupByDay, inRange, type DateRange } from './dateFilter';

/** `'none'` is the built-in "Uncategorized" board. */
export type BoardId = string | 'none';
export type GalleryView = 'images' | 'assets';

export interface GallerySettings {
  thumbnailSize: number;
  autoSwitch: boolean;
  autoAssignBoardOnClick: boolean;
  starredFirst: boolean;
  sortDirection: 'desc' | 'asc';
  alwaysShowImageSizeBadge: boolean;
  showArchivedBoards: boolean;
  boardsListOpen: boolean;
  pageSize: number;
  /** Insert a header before each day's pictures in the grid. */
  groupByDate: boolean;
}

interface GalleryState {
  images: ImageDTO[];
  boards: BoardDTO[];
  selectedBoardId: BoardId;
  autoAddBoardId: BoardId;
  view: GalleryView;
  search: string;
  /** Only images created on these local days; `null` shows every date. Not kept between sessions. */
  dateFilter: DateRange | null;
  boardSearch: string;
  page: number;
  /** Selected image names, in click order. */
  selection: string[];
  /** Image shown in the viewer (usually the last selected). */
  viewerImageName: string | null;
  /** The running job the viewer shows instead of a stored picture (its picture in progress); chosen from the grid, not kept between sessions. */
  viewerLiveItemId: number | null;
  /** Image compared against the viewer image; non-null enables compare mode. */
  compareImageName: string | null;
  compareMode: 'slider' | 'side-by-side' | 'hover';
  showMetadata: boolean;
  settings: GallerySettings;

  setImages: (images: ImageDTO[]) => void;
  addImage: (image: ImageDTO) => void;
  upsertImages: (images: ImageDTO[]) => void;
  removeImages: (names: string[]) => void;
  setBoards: (boards: BoardDTO[]) => void;
  upsertBoard: (board: BoardDTO) => void;
  removeBoard: (id: string) => void;
  /** Move a deleted board's images to Uncategorized locally. */
  detachBoardImages: (boardId: string) => void;
  selectBoard: (id: BoardId) => void;
  setAutoAddBoard: (id: BoardId) => void;
  setView: (view: GalleryView) => void;
  setSearch: (q: string) => void;
  setDateFilter: (range: DateRange | null) => void;
  setBoardSearch: (q: string) => void;
  setPage: (page: number) => void;
  setSelection: (names: string[]) => void;
  setViewerImage: (name: string | null) => void;
  showLiveItem: (itemId: number) => void;
  setCompareImage: (name: string | null) => void;
  setCompareMode: (mode: GalleryState['compareMode']) => void;
  toggleMetadata: () => void;
  setSettings: (patch: Partial<GallerySettings>) => void;
}

export const useGallery = create<GalleryState>()(
  persist(
    (set, get) => ({
      images: [],
      boards: [],
      selectedBoardId: 'none',
      autoAddBoardId: 'none',
      view: 'images',
      search: '',
      dateFilter: null,
      boardSearch: '',
      page: 0,
      selection: [],
      viewerImageName: null,
      viewerLiveItemId: null,
      compareImageName: null,
      compareMode: 'slider',
      showMetadata: false,
      settings: {
        thumbnailSize: 90,
        autoSwitch: true,
        autoAssignBoardOnClick: true,
        starredFirst: true,
        sortDirection: 'desc',
        alwaysShowImageSizeBadge: false,
        showArchivedBoards: false,
        boardsListOpen: true,
        pageSize: 60,
        groupByDate: false,
      },

      setImages: (images) => set({ images }),
      addImage: (image) => set({ images: [image, ...get().images.filter((i) => i.name !== image.name)] }),
      upsertImages: (images) => {
        const byName = new Map(images.map((i) => [i.name, i]));
        set({ images: get().images.map((i) => byName.get(i.name) ?? i) });
      },
      removeImages: (names) => {
        const s = get();
        set({
          images: s.images.filter((i) => !names.includes(i.name)),
          selection: s.selection.filter((n) => !names.includes(n)),
          viewerImageName: s.viewerImageName && names.includes(s.viewerImageName) ? null : s.viewerImageName,
          compareImageName: s.compareImageName && names.includes(s.compareImageName) ? null : s.compareImageName,
        });
      },
      setBoards: (boards) => set({ boards }),
      upsertBoard: (board) => {
        const exists = get().boards.some((b) => b.id === board.id);
        set({ boards: exists ? get().boards.map((b) => (b.id === board.id ? board : b)) : [...get().boards, board] });
      },
      removeBoard: (id) => {
        const s = get();
        set({
          boards: s.boards.filter((b) => b.id !== id),
          selectedBoardId: s.selectedBoardId === id ? 'none' : s.selectedBoardId,
          autoAddBoardId: s.autoAddBoardId === id ? 'none' : s.autoAddBoardId,
        });
      },
      detachBoardImages: (boardId) =>
        set({ images: get().images.map((i) => (i.boardId === boardId ? { ...i, boardId: null } : i)) }),
      selectBoard: (id) => {
        const s = get();
        set({
          selectedBoardId: id,
          page: 0,
          selection: [],
          autoAddBoardId: s.settings.autoAssignBoardOnClick ? id : s.autoAddBoardId,
        });
      },
      setAutoAddBoard: (autoAddBoardId) => set({ autoAddBoardId }),
      setView: (view) => set({ view, page: 0 }),
      setSearch: (search) => set({ search, page: 0 }),
      setDateFilter: (dateFilter) => set({ dateFilter, page: 0 }),
      setBoardSearch: (boardSearch) => set({ boardSearch }),
      setPage: (page) => set({ page }),
      setSelection: (selection) =>
        set({ selection, viewerImageName: selection[selection.length - 1] ?? get().viewerImageName, ...(selection.length ? { viewerLiveItemId: null } : {}) }),
      setViewerImage: (viewerImageName) => set({ viewerImageName, viewerLiveItemId: null }),
      showLiveItem: (viewerLiveItemId) => set({ viewerLiveItemId }),
      setCompareImage: (compareImageName) => set({ compareImageName }),
      setCompareMode: (compareMode) => set({ compareMode }),
      toggleMetadata: () => set({ showMetadata: !get().showMetadata }),
      setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
    }),
    {
      name: 'novira.gallery',
      partialize: persistedPart,
      // Settings saved by an older version lack newer keys: keep their defaults.
      merge: (persisted, current) => mergePersisted(persisted, current),
    },
  ),
);

/** What is kept between sessions: preferences only, never the filters or the selection. */
export function persistedPart(s: GalleryState): Pick<GalleryState, 'settings' | 'compareMode' | 'showMetadata'> {
  return { settings: s.settings, compareMode: s.compareMode, showMetadata: s.showMetadata };
}

export function mergePersisted(persisted: unknown, current: GalleryState): GalleryState {
  const saved = (persisted ?? {}) as Partial<Pick<GalleryState, 'settings' | 'compareMode' | 'showMetadata'>>;
  return { ...current, ...saved, settings: { ...current.settings, ...saved.settings } };
}

type BoardImagesInput = Pick<GalleryState, 'images' | 'selectedBoardId' | 'view' | 'search'>;

/** Images of the selected board and view that match the search, in no particular order. The date filter is not applied. */
export function filterBoardImages(s: BoardImagesInput): ImageDTO[] {
  const boardId = s.selectedBoardId === 'none' ? null : s.selectedBoardId;
  const q = s.search.trim().toLowerCase();
  return s.images.filter((i) => {
    if (i.isIntermediate || i.boardId !== boardId) return false;
    const isAsset = i.category !== 'general';
    if ((s.view === 'assets') !== isAsset) return false;
    if (!q) return true;
    return i.name.toLowerCase().includes(q) || (i.metadata?.positivePrompt.toLowerCase().includes(q) ?? false);
  });
}

/**
 * Images of the selected board and view, filtered by search and date and sorted like InvokeAI.
 * With `groupByDate` the list runs day by day (in the sort direction), which is the order the grid shows them in.
 */
export function selectBoardImages(s: BoardImagesInput & Pick<GalleryState, 'dateFilter' | 'settings'>): ImageDTO[] {
  const range = s.dateFilter;
  const list = range ? filterBoardImages(s).filter((i) => inRange(i.createdAt, range)) : filterBoardImages(s);
  list.sort((a, b) => {
    if (s.settings.starredFirst && a.starred !== b.starred) return a.starred ? -1 : 1;
    return s.settings.sortDirection === 'desc' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt;
  });
  return s.settings.groupByDate ? groupByDay(list, s.settings.sortDirection).flatMap((g) => g.items) : list;
}

export function findImage(name: string | null): ImageDTO | undefined {
  if (!name) return undefined;
  return useGallery.getState().images.find((i) => i.name === name);
}
