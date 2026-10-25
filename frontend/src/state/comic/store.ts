// The comic screen's documents and selection. Every change to a project replaces that project's object, so the
// persistence can tell which projects changed by identity.
import { create } from 'zustand';
import {
  DEFAULT_IMAGE_VIEW,
  emptyPage,
  emptyPanel,
  newBubble,
  newComicId,
  parseBubble,
  newProject,
  type ComicBubble,
  clampFrameMm,
  clampImageView,
  clampInsetMm,
  clampMarginMm,
  cleanFrameColor,
  type ComicPage,
  type ComicPageTemplate,
  type ComicPanel,
  type ComicPanelTemplate,
  type ComicPoint,
  type ComicProject,
  PANEL_NOTE_MAX,
  CAST_MAX,
  parseFigures,
  parsePoseCast,
  parsePoseWords,
  CHARACTER_NAME_MAX,
  CHARACTER_NEGATIVE_MAX,
  CHARACTER_TAGS_MAX,
  nextTakes,
  parseCastReference,
  parsePlaces,
  parseSheet,
  parseWorld,
  pagePixels,
  type PageSize,
} from './document';
import { rescaleCanvasDoc, type PageCanvas } from './pageCanvasDoc';
import { cleanParts } from './characterLook';
import { HISTORY_GAP_MS, historyLimit, restoreProjects } from './history';
import { useSettings } from '../settings';
import { MAX_PANELS_PER_PAGE, clampToPage, frameOutlines, pageAspect, pageShapes } from './layout';
import { resetView } from './imageView';
import { addFreeShape, keepOnPage, rotateShape, shapeTilt, insertCornerFree, moveCornerFree, moveEdgeFree, removeCornerFree } from './freeShapes';
import { halvingLines, insertCorner, isValidShape, mergeShapes, mirrorShapes, moveCorner, moveEdge, removeCorner, shapeArea, splitShape, stitch, type Shape } from './shapes';

import type { ComicState, PanelRef } from './storeState';
export type { ComicState, DrawScope, PanelRef } from './storeState';

/** The panel with this id, in whichever project holds it. */
export function findPanel(projects: ComicProject[], panelId: string): PanelRef | null {
  for (const project of projects) {
    for (const [pageIndex, page] of project.pages.entries()) {
      const panelIndex = page.panels.findIndex((p) => p.id === panelId);
      if (panelIndex >= 0) return { project, pageIndex, panelIndex, panel: page.panels[panelIndex]! };
    }
  }
  return null;
}


export const activeProject = (s: Pick<ComicState, 'projects' | 'activeProjectId'>): ComicProject | null =>
  s.projects.find((p) => p.id === s.activeProjectId) ?? null;

/** The page on screen: the selected one, or the first page when the selection is gone. */
export const activePage = (s: Pick<ComicState, 'projects' | 'activeProjectId' | 'activePageId'>) => {
  const project = activeProject(s);
  if (!project) return null;
  return project.pages.find((p) => p.id === s.activePageId) ?? project.pages[0] ?? null;
};

/**
 * The panel the prompt boxes and the draw button work on: the selected one; with none selected, the one selected last on
 * the page on screen, or else that page's first panel. Letting go of the selection only hides the panel's handles.
 */
export const workPanel = (s: ComicState): PanelRef | null => {
  if (s.selectedPanelId) return findPanel(s.projects, s.selectedPanelId);
  const page = activePage(s);
  const id = page?.panels.some((p) => p.id === s.lastPanelId) ? s.lastPanelId : page?.panels[0]?.id;
  return id ? findPanel(s.projects, id) : null;
};

/** Replaces one project by applying `change` to it. A project that is not there is left alone. */
function withProject(projects: ComicProject[], projectId: string, change: (p: ComicProject) => ComicProject): ComicProject[] {
  return projects.map((p) => (p.id === projectId ? { ...change(p), updatedAt: Date.now() } : p));
}

/** The panel without the depth map of its 3D rough, for a pose put in another way. */
function withoutDepth(panel: ComicPanel): ComicPanel {
  const { depthImageName: _gone, ...rest } = panel;
  return rest;
}

/** Replaces one panel, wherever it is, by applying `change` to it. */
function withPanel(projects: ComicProject[], panelId: string, change: (p: ComicPanel) => ComicPanel): ComicProject[] {
  const ref = findPanel(projects, panelId);
  if (!ref) return projects;
  return withProject(projects, ref.project.id, (project) => ({
    ...project,
    pages: project.pages.map((page) => ({ ...page, panels: page.panels.map((p) => (p.id === panelId ? change(p) : p)) })),
  }));
}

/** A panel count within what a page can hold. */
const clampPanelCount = (count: number) => Math.min(MAX_PANELS_PER_PAGE, Math.max(1, Math.floor(count)));

/** The panels resized to `target`: the first ones are kept, new empty ones are added at the end. */
function resizedPanels(panels: ComicPanel[], target: number): ComicPanel[] {
  const kept = panels.slice(0, target);
  return kept.length < target ? [...kept, ...Array.from({ length: target - kept.length }, emptyPanel)] : kept;
}

/** The last change that may join the next one in one undo step (see HISTORY_GAP_MS). */
let lastEdit: { key: string; at: number } | null = null;

/**
 * The state change of a document change, with the projects before it recorded as an undo step. A change under the same
 * key as the last one, within HISTORY_GAP_MS, joins that step instead of starting one.
 */
function edited(s: ComicState, patch: Partial<ComicState>, key: string | null = null): Partial<ComicState> {
  if (!patch.projects || patch.projects === s.projects) return patch;
  const now = Date.now();
  const joins = key !== null && lastEdit !== null && lastEdit.key === key && now - lastEdit.at < HISTORY_GAP_MS;
  lastEdit = key === null ? null : { key, at: now };
  if (joins) return patch;
  return { ...patch, past: [...s.past, s.projects].slice(-historyLimit()), future: [] };
}

/**
 * The state after an undo or redo step: the projects as the step brings them back. The project and page that changed are
 * opened, so the change can be seen. A panel or balloon that the step removed is no longer selected.
 */
function stepState(s: ComicState, target: ComicProject[]): Partial<ComicState> {
  const projects = restoreProjects(s.projects, target, Date.now());
  const changed = projects.findIndex((p, i) => p !== s.projects[i]);
  const shown = changed >= 0 ? projects[changed]! : (projects.find((p) => p.id === s.activeProjectId) ?? projects[0] ?? null);
  const switched = shown !== null && shown.id !== s.activeProjectId;
  const before = changed >= 0 ? s.projects[changed] : undefined;
  const changedPage = before && shown ? shown.pages.find((pg) => before.pages.find((o) => o.id === pg.id) !== pg) : undefined;
  const keepPage = !switched && shown?.pages.some((pg) => pg.id === s.activePageId);
  const panel = s.selectedPanelId && !switched ? findPanel(projects, s.selectedPanelId) : null;
  return {
    projects,
    activeProjectId: shown?.id ?? null,
    activePageId: changedPage?.id ?? (keepPage ? s.activePageId : (shown?.pages[0]?.id ?? null)),
    selectedPanelId: panel?.panel.id ?? null,
    selectedBubbleId: panel?.panel.bubbles.some((b) => b.id === s.selectedBubbleId) ? s.selectedBubbleId : null,
    bubbleEditor: s.bubbleEditor && !!panel?.panel.bubbles.some((b) => b.id === s.selectedBubbleId),
  };
}

/** The page's layers on another paper: scaled by one factor and centred (see rescaleCanvasDoc). */
function resizedCanvas(page: ComicPage, size: PageSize): PageCanvas {
  return size === page.size ? page.canvas : rescaleCanvasDoc(page.canvas, pagePixels(page), pagePixels({ size }));
}

/** A new page as Settings say pages start: its paper, reading direction, panels, frame line and margin. */
function newPage(): ComicPage {
  const s = useSettings.getState();
  return emptyPage(s.comicPanelCount, { size: s.comicPageSize, direction: s.comicDirection, frameMm: s.comicFrameMm, marginMm: s.comicMarginMm });
}

export const useComic = create<ComicState>()((set, get) => {
  /** The active project, or nothing to change. */
  const activeId = () => get().activeProjectId;

  /**
   * Replaces the shapes of a page by what `change` makes of them (the page's own shapes, or the automatic ones). Null from
   * `change` changes nothing and returns false. Changes under the same key within HISTORY_GAP_MS are one undo step.
   */
  const reshapePage = (pageId: string, change: (shapes: Shape[], aspect: number) => Shape[] | null, key: string | null): boolean => {
    const projectId = activeId();
    const page = get().projects.find((p) => p.id === projectId)?.pages.find((pg) => pg.id === pageId);
    if (!projectId || !page) return false;
    const next = change(pageShapes(page), pageAspect(page.size));
    if (!next) return false;
    set((s) =>
      edited(
        s,
        { projects: withProject(s.projects, projectId, (p) => ({ ...p, pages: p.pages.map((pg) => (pg.id === pageId ? { ...pg, shapes: next } : pg)) })) },
        key,
      ),
    );
    return true;
  };

  /** Whether the page is placed freely. */
  const isFree = (pageId: string) => !!get().projects.find((p) => p.id === activeId())?.pages.find((pg) => pg.id === pageId)?.free;

  return {
    projects: [],
    activeProjectId: null,
    activePageId: null,
    selectedPanelId: null,
    lastPanelId: null,
    selectedBubbleId: null,
    bubbleEditor: false,
    bubbleShaping: false,
    centeringBubbleId: null,
    fittingBubbleIds: [],
    imageSelected: false,
    backdropSelected: false,
    cutting: false,
    drawScope: 'panel',
    pending: {},
    drawFailed: {},
    sheetPending: {},
    past: [],
    future: [],

    restoreProjects: (projects) => {
      lastEdit = null;
      set((s) => ({ ...stepState(s, projects), past: [...s.past, s.projects].slice(-historyLimit()), future: [] }));
    },

    setProjects: (projects) => {
      const first = projects[0];
      lastEdit = null;
      set({
        projects,
        activeProjectId: first?.id ?? null,
        activePageId: first?.pages[0]?.id ?? null,
        selectedPanelId: null,
        lastPanelId: null,
        selectedBubbleId: null, bubbleEditor: false,
        past: [],
        future: [],
      });
    },

    createProject: (name) => {
      const project = newProject(name, Date.now(), newPage());
      set((s) => ({
        projects: [project, ...s.projects],
        activeProjectId: project.id,
        activePageId: project.pages[0]?.id ?? null,
        selectedPanelId: null,
        lastPanelId: null,
        selectedBubbleId: null, bubbleEditor: false,
      }));
      return project.id;
    },

    setPageDraw: (pageId, draw) =>
      set((s) => ({ projects: s.projects.map((p) => (p.pages.some((pg) => pg.id === pageId) ? { ...p, pages: p.pages.map((pg) => (pg.id === pageId ? { ...pg, draw } : pg)), updatedAt: Date.now() } : p)) })),

    setStyle: (projectId, style) => set((s) => ({ projects: withProject(s.projects, projectId, (p) => ({ ...p, style })) })),

    setCastReference: (projectId, weight) =>
      set((s) => ({
        projects: withProject(s.projects, projectId, (p) => {
          const { castReference: _old, ...rest } = p;
          const kept = parseCastReference(weight);
          return kept === undefined ? rest : { ...rest, castReference: kept };
        }),
      })),

    setPageStyle: (pageId, style) =>
      set((s) => ({ projects: s.projects.map((p) => (p.pages.some((pg) => pg.id === pageId) ? { ...p, pages: p.pages.map((pg) => (pg.id === pageId ? { ...pg, style } : pg)), updatedAt: Date.now() } : p)) })),

    setDraw: (projectId, draw) => set((s) => ({ projects: withProject(s.projects, projectId, (p) => ({ ...p, draw })) })),

    renameProject: (projectId, name) => set((s) => ({ projects: withProject(s.projects, projectId, (p) => ({ ...p, name })) })),

    deleteProject: (projectId) =>
      set((s) => {
        const projects = s.projects.filter((p) => p.id !== projectId);
        if (s.activeProjectId !== projectId) return { projects };
        const next = projects[0];
        return { projects, activeProjectId: next?.id ?? null, activePageId: next?.pages[0]?.id ?? null, selectedPanelId: null, selectedBubbleId: null, bubbleEditor: false };
      }),

    selectProject: (projectId) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return;
      set({ activeProjectId: project.id, activePageId: project.pages[0]?.id ?? null, selectedPanelId: null, lastPanelId: null, selectedBubbleId: null, bubbleEditor: false });
    },

    addPage: () => {
      const projectId = activeId();
      if (!projectId) return null;
      const page = newPage();
      set((s) =>
        edited(s, {
          projects: withProject(s.projects, projectId, (p) => ({ ...p, pages: [...p.pages, page] })),
          activePageId: page.id,
          selectedPanelId: null,
          selectedBubbleId: null, bubbleEditor: false,
        }),
      );
      return page.id;
    },

    deletePage: (pageId) => {
      const projectId = activeId();
      if (!projectId) return;
      set((s) => {
        const project = s.projects.find((p) => p.id === projectId);
        const removed = project?.pages.find((p) => p.id === pageId);
        const left = project?.pages.filter((p) => p.id !== pageId) ?? [];
        const removedPanels = new Set(removed?.panels.map((p) => p.id));
        return edited(s, {
          projects: withProject(s.projects, projectId, (p) => ({ ...p, pages: p.pages.filter((page) => page.id !== pageId) })),
          activePageId: s.activePageId === pageId ? (left[0]?.id ?? null) : s.activePageId,
          selectedPanelId: s.selectedPanelId && removedPanels.has(s.selectedPanelId) ? null : s.selectedPanelId,
          selectedBubbleId: null, bubbleEditor: false,
        });
      });
    },

    selectPage: (pageId) => set({ activePageId: pageId, selectedPanelId: null, lastPanelId: null, selectedBubbleId: null, bubbleEditor: false, backdropSelected: false }),

    setPanelCount: (pageId, count) => {
      const projectId = activeId();
      if (!projectId) return;
      const target = clampPanelCount(count);
      set((s) => {
        const project = s.projects.find((p) => p.id === projectId);
        const page = project?.pages.find((p) => p.id === pageId);
        if (!page || page.panels.length === target) return {};
        const panels = resizedPanels(page.panels, target);
        const dropped = new Set(page.panels.slice(target).map((p) => p.id));
        return edited(s, {
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            // The shapes are for the panels there were; a new count is laid out automatically again.
            pages: p.pages.map((pg) => (pg.id === pageId ? { ...pg, panels, shapes: null, free: false } : pg)),
          })),
          selectedPanelId: s.selectedPanelId && dropped.has(s.selectedPanelId) ? null : s.selectedPanelId,
          selectedBubbleId: null, bubbleEditor: false,
        });
      });
    },

    setPageLayout: (pageId, layout) => {
      const projectId = activeId();
      if (!projectId) return;
      set((s) => {
        const page = s.projects.find((p) => p.id === projectId)?.pages.find((pg) => pg.id === pageId);
        if (!page) return {};
        // Columns only shape the automatic layout, so a new count of them lays the page out again. A new reading direction
        // flips the shapes, as it flips the automatic layout.
        const columnsChanged = layout.columns !== undefined && layout.columns !== page.columns;
        const turned = layout.direction !== undefined && layout.direction !== page.direction && page.shapes !== null;
        // The frame line and the inset stay within their ranges.
        const limits: { frameMm?: number; insetMm?: number; marginMm?: number; frameColor?: string } = {};
        if (layout.frameMm !== undefined) limits.frameMm = clampFrameMm(layout.frameMm);
        if (layout.insetMm !== undefined) limits.insetMm = clampInsetMm(layout.insetMm);
        if (layout.marginMm !== undefined) limits.marginMm = clampMarginMm(layout.marginMm);
        if (layout.frameColor !== undefined) limits.frameColor = cleanFrameColor(layout.frameColor);
        const shapes = columnsChanged ? null : turned && page.shapes ? mirrorShapes(page.shapes) : page.shapes;
        const free = shapes !== null && page.free;
        const canvas = layout.size ? resizedCanvas(page, layout.size) : page.canvas;
        return edited(s, {
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            pages: p.pages.map((pg) => (pg.id === pageId ? { ...pg, ...layout, ...limits, shapes, free, canvas } : pg)),
          })),
        }, layout.frameColor !== undefined ? `frameColor:${pageId}` : null);
      });
    },

    applyPageLayout: (pageId, layout) => {
      const projectId = activeId();
      if (!projectId) return;
      const shapes = layout.shapes ?? null;
      const target = shapes ? shapes.length : clampPanelCount(layout.panelCount);
      set((s) => {
        const project = s.projects.find((p) => p.id === projectId);
        const page = project?.pages.find((p) => p.id === pageId);
        if (!page) return {};
        const panels = resizedPanels(page.panels, target);
        const dropped = new Set(page.panels.slice(target).map((p) => p.id));
        return edited(s, {
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            pages: p.pages.map((pg) =>
              pg.id === pageId
                ? { ...pg, panels, columns: layout.columns, direction: layout.direction, size: layout.size, shapes, free: false, canvas: resizedCanvas(pg, layout.size) }
                : pg,
            ),
          })),
          selectedPanelId: s.selectedPanelId && dropped.has(s.selectedPanelId) ? null : s.selectedPanelId,
          selectedBubbleId: null, bubbleEditor: false,
        });
      });
    },

    movePanelOrder: (pageId, index, to) => {
      const projectId = activeId();
      const page = get().projects.find((p) => p.id === projectId)?.pages.find((pg) => pg.id === pageId);
      if (!projectId || !page?.panels[index]) return -1;
      const last = page.panels.length - 1;
      const target = to === 'front' ? last : to === 'back' ? 0 : to === 'forward' ? Math.min(last, index + 1) : Math.max(0, index - 1);
      if (target === index) return -1;
      const move = <T,>(list: T[]): T[] => {
        const next = [...list];
        const [item] = next.splice(index, 1);
        next.splice(target, 0, item!);
        return next;
      };
      set((s) =>
        edited(s, {
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            pages: p.pages.map((pg) => (pg.id === pageId ? { ...pg, panels: move(pg.panels), shapes: pg.shapes ? move(pg.shapes) : pg.shapes } : pg)),
          })),
        }),
      );
      return target;
    },

    resetPanelShape: (pageId, index, part) => {
      const page = get().projects.find((p) => p.id === activeId())?.pages.find((pg) => pg.id === pageId);
      if (!page?.free) return false;
      return reshapePage(
        pageId,
        (shapes, aspect) => {
          const shape = shapes[index];
          if (!shape) return null;
          const next = part === 'all' ? frameOutlines({ ...page, shapes: null, free: false })[index] : rotateShape(shape, -shapeTilt(shape, aspect), aspect);
          return next ? shapes.map((old, i) => (i === index ? next.map((p) => ({ ...p })) : old)) : null;
        },
        null,
      );
    },

    resetPanelImage: (panelId, parts) =>
      // Like the picture's other moves, this is not an undo step (undo leaves the pictures as they are, see history.ts).
      set((s) => ({ projects: withPanel(s.projects, panelId, (p) => ({ ...p, imageView: clampImageView(resetView(p.imageView, parts)) })) })),

    resetBackdrop: (pageId, parts) => {
      const projectId = activeId();
      if (!projectId) return;
      set((s) =>
        edited(s, {
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            pages: p.pages.map((pg) => (pg.id === pageId && pg.backdrop ? { ...pg, backdrop: { ...pg.backdrop, view: clampImageView(resetView(pg.backdrop.view, parts)) } } : pg)),
          })),
        }),
      );
    },

    setProjectEffect: (effect) => {
      const projectId = activeId();
      if (!projectId) return;
      set((s) => edited(s, { projects: withProject(s.projects, projectId, (p) => (p.effect === effect ? p : { ...p, effect })) }, 'effect'));
    },

    setCast: (cast) => {
      const projectId = activeId();
      if (!projectId) return;
      const kept = cast.slice(0, CAST_MAX).map((c) => ({ id: c.id, name: c.name.slice(0, CHARACTER_NAME_MAX), tags: c.tags.slice(0, CHARACTER_TAGS_MAX), ...(cleanParts(c.parts, true) ? { parts: cleanParts(c.parts, true) } : {}), ...(c.nonHuman ? { nonHuman: true } : {}), ...(c.negative ? { negative: c.negative.slice(0, CHARACTER_NEGATIVE_MAX) } : {}), imageName: c.imageName, ...(parseSheet(c.sheet) ? { sheet: parseSheet(c.sheet) } : {}), ...(c.libraryId ? { libraryId: c.libraryId } : {}) }));
      const ids = new Set(kept.map((c) => c.id));
      set((s) =>
        edited(
          s,
          {
            projects: withProject(s.projects, projectId, (p) => ({
              ...p,
              cast: kept,
              // A character that is gone is no longer in any panel.
              pages: p.pages.map((pg) => ({ ...pg, panels: pg.panels.map((pn) => (pn.cast.every((id) => ids.has(id)) ? pn : { ...pn, cast: pn.cast.filter((id) => ids.has(id)) })) })),
            })),
          },
          'cast',
        ),
      );
    },

    setPlaces: (places) => {
      const projectId = activeId();
      if (!projectId) return;
      const kept = parsePlaces(places, true);
      const ids = new Set(kept.map((p) => p.id));
      // A panel set in a place that is gone has no place.
      const unplaced = (pn: ComicPanel): ComicPanel => {
        if (!pn.place || ids.has(pn.place)) return pn;
        const { place: _gone, ...rest } = pn;
        return rest;
      };
      set((s) =>
        edited(s, { projects: withProject(s.projects, projectId, (p) => ({ ...p, places: kept, pages: p.pages.map((pg) => ({ ...pg, panels: pg.panels.map(unplaced) })) })) }, 'places'),
      );
    },

    setWorld: (world) => {
      const projectId = activeId();
      if (!projectId) return;
      const kept = parseWorld(world);
      set((s) =>
        edited(
          s,
          {
            projects: withProject(s.projects, projectId, (p) => {
              const { world: _old, ...rest } = p;
              return kept === undefined ? rest : { ...rest, world: kept };
            }),
          },
          'world',
        ),
      );
    },

    setPanelPlace: (panelId, placeId) =>
      set((s) =>
        edited(
          s,
          {
            projects: withPanel(s.projects, panelId, (p) => {
              const { place: _old, ...rest } = p;
              return placeId ? { ...rest, place: placeId } : rest;
            }),
          },
          `place:${panelId}`,
        ),
      ),

    setCharacterView: (projectId, characterId, view, imageName) =>
      set((s) => {
        const character = s.projects.find((p) => p.id === projectId)?.cast.find((c) => c.id === characterId);
        if (!character || (character.sheet?.[view] ?? null) === imageName) return {};
        const { [view]: _old, ...others } = character.sheet ?? {};
        const sheet = imageName ? { ...others, [view]: imageName } : others;
        const { sheet: _was, ...rest } = character;
        const next = Object.keys(sheet).length ? { ...rest, sheet } : rest;
        return { projects: withProject(s.projects, projectId, (p) => ({ ...p, cast: p.cast.map((c) => (c.id === characterId ? next : c)) })) };
      }),

    setPanelCast: (panelId, cast) =>
      set((s) => edited(s, { projects: withPanel(s.projects, panelId, (p) => ({ ...p, cast: [...new Set(cast)].slice(0, CAST_MAX) })) }, `cast:${panelId}`)),

    setPanelPoseCast: (panelId, poseCast) =>
      set((s) => edited(s, { projects: withPanel(s.projects, panelId, (p) => ({ ...p, poseCast: parsePoseCast(poseCast) })) }, `poseCast:${panelId}`)),

    setPanelPoseWords: (panelId, poseWords) =>
      set((s) =>
        edited(
          s,
          {
            projects: withPanel(s.projects, panelId, (p) => {
              const { poseWords: _old, ...rest } = p;
              const words = parsePoseWords(poseWords);
              return words.some(Boolean) ? { ...rest, poseWords: words } : rest;
            }),
          },
          `poseWords:${panelId}`,
        ),
      ),

    setPanelFigures: (panelId, figures) =>
      set((s) => edited(s, { projects: withPanel(s.projects, panelId, (p) => ({ ...p, figures: parseFigures(figures) })) }, `figures:${panelId}`)),

    setPageEffect: (pageId, effect) => {
      const projectId = activeId();
      if (!projectId) return;
      set((s) =>
        edited(
          s,
          { projects: withProject(s.projects, projectId, (p) => ({ ...p, pages: p.pages.map((pg) => (pg.id === pageId && pg.effect !== effect ? { ...pg, effect } : pg)) })) },
          `effect:${pageId}`,
        ),
      );
    },

    swapPanels: (pageId, a, b) => {
      const projectId = activeId();
      const page = get().projects.find((p) => p.id === projectId)?.pages.find((pg) => pg.id === pageId);
      // Nothing to change: the same position, or a position off the page. Nothing is replaced then, so no listener sees a change.
      if (!projectId || a === b || !page?.panels[a] || !page.panels[b]) return;
      set((s) =>
        edited(s, {
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            pages: p.pages.map((pg) => {
              if (pg.id !== pageId || !pg.panels[a] || !pg.panels[b]) return pg;
              const panels = [...pg.panels];
              [panels[a], panels[b]] = [panels[b]!, panels[a]!];
              // The shapes stay with their places, so the panels trade places as the panels do.
              let shapes = pg.shapes;
              if (shapes && shapes[a] && shapes[b]) {
                shapes = [...shapes];
                [shapes[a], shapes[b]] = [shapes[b]!, shapes[a]!];
              }
              return { ...pg, panels, shapes };
            }),
          })),
        }),
      );
    },

    resetPageShapes: (pageId) => {
      const projectId = activeId();
      if (!projectId) return;
      set((s) => {
        const page = s.projects.find((p) => p.id === projectId)?.pages.find((pg) => pg.id === pageId);
        if (!page?.shapes) return {};
        return edited(s, {
          projects: withProject(s.projects, projectId, (p) => ({ ...p, pages: p.pages.map((pg) => (pg.id === pageId ? { ...pg, shapes: null, free: false } : pg)) })),
        });
      });
    },

    setPageFree: (pageId, free, key) => {
      const projectId = activeId();
      const page = get().projects.find((p) => p.id === projectId)?.pages.find((pg) => pg.id === pageId);
      if (!projectId || !page || page.free === free) return;
      // On: the panels keep the shapes they are drawn with (an automatic page's rectangles, gutters and all, so nothing
      // moves). Off: the page is laid out automatically again.
      const shapes = free ? frameOutlines(page).map((shape) => shape.map((p) => ({ ...p }))) : null;
      set((s) =>
        edited(s, {
          projects: withProject(s.projects, projectId, (p) => ({ ...p, pages: p.pages.map((pg) => (pg.id === pageId ? { ...pg, shapes, free } : pg)) })),
        }, key ?? null),
      );
    },

    setFreeShape: (pageId, panelIndex, shape, key) => {
      const step = key ?? `free:${pageId}:${panelIndex}`;
      if (!isFree(pageId)) get().setPageFree(pageId, true, step);
      if (!isFree(pageId)) return false;
      return reshapePage(
        pageId,
        (shapes) => {
          const fitted = shapes[panelIndex] ? keepOnPage(shape) : null;
          return fitted && isValidShape(fitted) ? shapes.map((old, i) => (i === panelIndex ? fitted : old)) : null;
        },
        step,
      );
    },

    setCutting: (cutting) => set({ cutting }),

    setDrawScope: (drawScope) => set({ drawScope }),

    moveCorner: (pageId, panelIndex, corner, to) => {
      const free = isFree(pageId);
      return reshapePage(
        pageId,
        (shapes, aspect) => (free ? moveCornerFree(shapes, panelIndex, corner, to) : moveCorner(shapes, panelIndex, corner, clampToPage(to, aspect))),
        `shape:${pageId}`,
      );
    },

    insertCorner: (pageId, panelIndex, edge, point) => {
      const free = isFree(pageId);
      return reshapePage(
        pageId,
        (shapes, aspect) => (free ? insertCornerFree(shapes, panelIndex, edge, point) : insertCorner(shapes, panelIndex, edge, clampToPage(point, aspect))),
        null,
      );
    },

    removeCorner: (pageId, panelIndex, corner) => {
      const free = isFree(pageId);
      return reshapePage(pageId, (shapes) => (free ? removeCornerFree(shapes, panelIndex, corner) : removeCorner(shapes, panelIndex, corner)), null);
    },

    splitPanel: (pageId, panelIndex, a, b) => {
      const projectId = activeId();
      const page = get().projects.find((p) => p.id === projectId)?.pages.find((pg) => pg.id === pageId);
      if (!projectId || !page?.panels[panelIndex] || page.panels.length >= MAX_PANELS_PER_PAGE) return false;
      const shapes = pageShapes(page);
      const cut = splitShape(shapes[panelIndex] ?? [], a, b);
      if (!cut) return false;
      const halves = [...shapes.slice(0, panelIndex), cut[0], cut[1], ...shapes.slice(panelIndex + 1)];
      // The halves of a tiled page share their corners with the neighbours; a free panel has no neighbours to share with.
      const next = page.free ? halves : stitch(halves);
      set((s) =>
        edited(s, {
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            pages: p.pages.map((pg) =>
              pg.id === pageId
                ? { ...pg, shapes: next, panels: [...pg.panels.slice(0, panelIndex + 1), emptyPanel(), ...pg.panels.slice(panelIndex + 1)] }
                : pg,
            ),
          })),
          selectedBubbleId: null, bubbleEditor: false,
        }),
      );
      return true;
    },

    addPanel: (pageId) => {
      const page = get().projects.find((p) => p.id === activeId())?.pages.find((pg) => pg.id === pageId);
      if (!page || page.panels.length >= MAX_PANELS_PER_PAGE) return null;
      // The panels stay where they are drawn (an automatic page's rectangles, gutters and all), and the new one lies over them.
      const panel = emptyPanel();
      const drawn = page.free ? pageShapes(page) : frameOutlines(page);
      const shapes = addFreeShape(drawn, pageAspect(page.size));
      set((s) =>
        edited(s, {
          projects: withProject(s.projects, activeId()!, (p) => ({
            ...p,
            pages: p.pages.map((pg) => (pg.id === pageId ? { ...pg, shapes, free: true, panels: [...pg.panels, panel] } : pg)),
          })),
          selectedPanelId: panel.id, selectedBubbleId: null, bubbleEditor: false, imageSelected: false,
        }),
      );
      return panel.id;
    },

    halvePanel: (pageId, panelIndex) => {
      const page = get().projects.find((p) => p.id === activeId())?.pages.find((pg) => pg.id === pageId);
      if (!page || page.panels.length >= MAX_PANELS_PER_PAGE) return null;
      if (page.free) return get().addPanel(pageId);
      const shapes = pageShapes(page);
      const index =
        panelIndex !== null && shapes[panelIndex]
          ? panelIndex
          : shapes.reduce((best, shape, i) => (shapeArea(shape) > shapeArea(shapes[best]!) ? i : best), 0);
      const shape = shapes[index];
      if (!shape) return null;
      for (const [a, b] of halvingLines(shape, pageAspect(page.size))) {
        if (!get().splitPanel(pageId, index, a, b)) continue;
        const added = get().projects.find((p) => p.id === activeId())?.pages.find((pg) => pg.id === pageId)?.panels[index + 1];
        if (added) set({ selectedPanelId: added.id, selectedBubbleId: null, bubbleEditor: false, imageSelected: false });
        return added?.id ?? null;
      }
      return null;
    },

    removePanel: (pageId, panelIndex) => {
      const projectId = activeId();
      const page = get().projects.find((p) => p.id === projectId)?.pages.find((pg) => pg.id === pageId);
      if (!projectId || !page?.panels[panelIndex] || page.panels.length <= 1) return false;
      let shapes: Shape[] | null = null;
      if (page.free && page.shapes) {
        // A free panel simply goes; no neighbour takes its place.
        shapes = page.shapes.filter((_, i) => i !== panelIndex);
      } else if (page.shapes) {
        const all = page.shapes;
        const near = all.map((_, i) => i).filter((i) => i !== panelIndex).sort((a, b) => Math.abs(a - panelIndex) - Math.abs(b - panelIndex) || a - b);
        for (const i of near) {
          const joined = mergeShapes(all[panelIndex]!, all[i]!);
          if (!joined) continue;
          const rest = all.map((shape, k) => (k === i ? joined : shape)).filter((_, k) => k !== panelIndex);
          shapes = stitch(rest);
          break;
        }
      }
      const gone = page.panels[panelIndex]!.id;
      set((s) =>
        edited(s, {
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            pages: p.pages.map((pg) => (pg.id === pageId ? { ...pg, shapes, free: shapes !== null && pg.free, panels: pg.panels.filter((x) => x.id !== gone) } : pg)),
          })),
          selectedPanelId: s.selectedPanelId === gone ? null : s.selectedPanelId,
          selectedBubbleId: null, bubbleEditor: false, imageSelected: false,
        }),
      );
      return true;
    },

    moveEdge: (pageId, panelIndex, edge, delta) => {
      let applied: ComicPoint | null = null;
      if (isFree(pageId)) {
        const before = pageShapes(get().projects.find((p) => p.id === activeId())!.pages.find((pg) => pg.id === pageId)!)[panelIndex]?.[edge];
        const moved = reshapePage(pageId, (shapes) => moveEdgeFree(shapes, panelIndex, edge, delta), `shape:${pageId}`);
        const page = get().projects.find((p) => p.id === activeId())?.pages.find((pg) => pg.id === pageId);
        const after = page?.shapes?.[panelIndex]?.[edge];
        // The slide is cut short at the page's edge, so what was applied is read back from the corner.
        return moved && before && after ? { x: after.x - before.x, y: after.y - before.y } : null;
      }
      const moved = reshapePage(
        pageId,
        (shapes, aspect) => {
          const shape = shapes[panelIndex];
          const a = shape?.[edge];
          const b = shape?.[(edge + 1) % shape.length];
          if (!a || !b) return null;
          // Both corners stay inside the margin: the slide is cut short at the page's edge rather than refused.
          const low = clampToPage({ x: -1, y: -1 }, aspect);
          const high = clampToPage({ x: 2, y: 2 }, aspect);
          const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
          const dx = clamp(delta.x, low.x - Math.min(a.x, b.x), high.x - Math.max(a.x, b.x));
          const dy = clamp(delta.y, low.y - Math.min(a.y, b.y), high.y - Math.max(a.y, b.y));
          applied = { x: dx, y: dy };
          return moveEdge(shapes, panelIndex, edge, applied);
        },
        `shape:${pageId}`,
      );
      return moved ? applied : null;
    },

    selectPanel: (panelId) =>
      set((s) => ({
        selectedPanelId: panelId,
        lastPanelId: panelId ?? s.selectedPanelId ?? s.lastPanelId,
        selectedBubbleId: null,
        bubbleEditor: false,
        bubbleShaping: false,
        imageSelected: false,
        backdropSelected: false,
      })),
    // Another balloon keeps the editor open on that balloon; no balloon closes it.
    selectBubble: (bubbleId) =>
      set((s) => ({
        selectedBubbleId: bubbleId,
        imageSelected: bubbleId ? false : s.imageSelected,
        backdropSelected: bubbleId ? false : s.backdropSelected,
        bubbleEditor: bubbleId ? s.bubbleEditor : false,
        // The points of an outline belong to the balloon they were shown for.
        bubbleShaping: bubbleId !== null && bubbleId === s.selectedBubbleId && s.bubbleShaping,
      })),
    openBubbleEditor: (panelId, bubbleId) =>
      set((s) => ({
        selectedPanelId: panelId,
        selectedBubbleId: bubbleId,
        imageSelected: false,
        backdropSelected: false,
        bubbleEditor: true,
        bubbleShaping: bubbleId === s.selectedBubbleId && s.bubbleShaping,
      })),
    closeBubbleEditor: () => set({ bubbleEditor: false, bubbleShaping: false }),
    setBubbleShaping: (on) => set((s) => ({ bubbleShaping: on && s.selectedBubbleId !== null })),
    selectImage: (panelId) => set({ selectedPanelId: panelId, selectedBubbleId: null, bubbleEditor: false, imageSelected: true, backdropSelected: false }),
    selectBackdrop: (selected) =>
      set((s) => (selected ? { backdropSelected: true, selectedPanelId: null, lastPanelId: s.selectedPanelId ?? s.lastPanelId, selectedBubbleId: null, bubbleEditor: false, imageSelected: false, cutting: false } : s.backdropSelected ? { backdropSelected: false } : {})),

    setBackdrop: (pageId, imageName) => {
      const projectId = activeId();
      if (!projectId) return;
      set((s) =>
        edited(s, {
          projects: withProject(s.projects, projectId, (p) => ({
            ...p,
            pages: p.pages.map((pg) => {
              if (pg.id !== pageId) return pg;
              // A new picture starts as it covers the page: the view of the old picture does not fit the new one.
              const backdrop = imageName ? { imageName, view: pg.backdrop?.imageName === imageName ? pg.backdrop.view : { ...DEFAULT_IMAGE_VIEW } } : null;
              return { ...pg, backdrop };
            }),
          })),
          backdropSelected: imageName ? s.backdropSelected : false,
        }),
      );
    },

    setBackdropView: (pageId, view) => {
      const projectId = activeId();
      if (!projectId) return;
      set((s) =>
        edited(
          s,
          {
            projects: withProject(s.projects, projectId, (p) => ({
              ...p,
              pages: p.pages.map((pg) => (pg.id === pageId && pg.backdrop ? { ...pg, backdrop: { ...pg.backdrop, view: clampImageView({ ...pg.backdrop.view, ...view }) } } : pg)),
            })),
          },
          `backdrop:${pageId}`,
        ),
      );
    },

    setPrompt: (panelId, prompt) =>
      set((s) => edited(s, { projects: withPanel(s.projects, panelId, (p) => ({ ...p, prompt })) }, `prompt:${panelId}`)),

    setPanelNegative: (panelId, negativePrompt) =>
      set((s) => edited(s, { projects: withPanel(s.projects, panelId, (p) => ({ ...p, negativePrompt })) }, `negative:${panelId}`)),

    setPanelNote: (panelId, note) =>
      set((s) => edited(s, { projects: withPanel(s.projects, panelId, (p) => ({ ...p, note: note.slice(0, PANEL_NOTE_MAX) })) }, `note:${panelId}`)),

    setPanelImageView: (panelId, view) =>
      set((s) => ({
        projects: withPanel(s.projects, panelId, (p) => {
          return { ...p, imageView: clampImageView({ ...p.imageView, ...view }) };
        }),
      })),

    // A pose changed another way than through the 3D rough leaves the rough's depth map behind: it shows the people where they were.
    setPanelPose: (panelId, poses, poseImageName) =>
      set((s) => edited(s, { projects: withPanel(s.projects, panelId, (p) => ({ ...withoutDepth(p), poses, poseImageName })) })),

    setPanelRough: (panelId, rough, poses, poseImageName, depthImageName) =>
      set((s) => edited(s, { projects: withPanel(s.projects, panelId, (p) => ({ ...p, rough, poses, poseImageName, depthImageName })) })),

    // A new picture starts as it covers the panel: the view of the old picture does not fit the new one.
    setPanelImage: (panelId, imageName, options) =>
      set((s) => ({
        projects: withPanel(s.projects, panelId, (p) => {
          if (p.imageName === imageName) return p;
          // An earlier picture put back sits as it sat; any other picture starts out covering the panel.
          const earlier = imageName ? p.takes.find((take) => take.imageName === imageName) : undefined;
          return {
            ...p,
            imageName,
            imageView: earlier ? { ...earlier.view } : options?.keepView && p.imageName ? { ...p.imageView } : { ...DEFAULT_IMAGE_VIEW },
            takes: nextTakes(p.takes, p.imageName ? { imageName: p.imageName, view: p.imageView } : null, imageName),
          };
        }),
      })),

    removeTake: (panelId, imageName) =>
      set((s) => ({ projects: withPanel(s.projects, panelId, (p) => ({ ...p, takes: p.takes.filter((take) => take.imageName !== imageName) })) })),

    addBubble: (panelId, kind, look) => {
      if (!findPanel(get().projects, panelId)) return null;
      const made = newBubble(kind, 0.08, 0.08);
      const bubble: ComicBubble = (look && parseBubble({ ...made, ...look, id: made.id, kind })) || made;
      const placed = look !== undefined && ('x' in look || 'y' in look);
      set((s) =>
        edited(s, {
          projects: withPanel(s.projects, panelId, (p) => ({ ...p, bubbles: [...p.bubbles, bubble] })),
          selectedBubbleId: bubble.id,
          centeringBubbleId: placed ? s.centeringBubbleId : bubble.id,
        }),
      );
      return bubble.id;
    },

    centerBubble: (panelId, bubbleId, width, height) => {
      if (get().centeringBubbleId !== bubbleId) return;
      const middle = (size: number) => Math.min(1, Math.max(0, (1 - (Number.isFinite(size) ? size : 0)) / 2));
      set((s) => ({
        projects: withPanel(s.projects, panelId, (p) => ({
          ...p,
          bubbles: p.bubbles.map((b) => (b.id === bubbleId ? { ...b, x: middle(width), y: middle(height) } : b)),
        })),
        centeringBubbleId: null,
      }));
    },

    updateBubble: (panelId, bubbleId, patch) =>
      set((s) =>
        edited(
          s,
          {
            ...(s.centeringBubbleId === bubbleId && ('x' in patch || 'y' in patch) ? { centeringBubbleId: null } : {}),
            projects: withPanel(s.projects, panelId, (p) => ({
              ...p,
              bubbles: p.bubbles.map((b) => (b.id === bubbleId ? (parseBubble({ ...b, ...patch, id: b.id }) ?? b) : b)),
            })),
          },
          `bubble:${bubbleId}`,
        ),
      ),

    fitBubbles: (bubbleIds) => set((s) => ({ fittingBubbleIds: [...new Set([...s.fittingBubbleIds, ...bubbleIds])] })),

    fitBubble: (panelId, bubbleId, patch, done) =>
      set((s) => ({
        ...(Object.keys(patch).length === 0
          ? {}
          : edited(
              s,
              { projects: withPanel(s.projects, panelId, (p) => ({ ...p, bubbles: p.bubbles.map((b) => (b.id === bubbleId ? (parseBubble({ ...b, ...patch, id: b.id }) ?? b) : b)) })) },
              `bubble:${bubbleId}`,
            )),
        ...(done ? { fittingBubbleIds: s.fittingBubbleIds.filter((id) => id !== bubbleId) } : {}),
      })),

    removeBubble: (panelId, bubbleId) =>
      set((s) =>
        edited(s, {
          projects: withPanel(s.projects, panelId, (p) => ({ ...p, bubbles: p.bubbles.filter((b) => b.id !== bubbleId) })),
          selectedBubbleId: s.selectedBubbleId === bubbleId ? null : s.selectedBubbleId,
          bubbleEditor: s.selectedBubbleId === bubbleId ? false : s.bubbleEditor,
        }),
      ),

    savePanelTemplate: (panelId, name) => {
      const ref = findPanel(get().projects, panelId);
      if (!ref) return null;
      const template: ComicPanelTemplate = {
        id: newComicId('panel-template'),
        name,
        prompt: ref.panel.prompt,
        negativePrompt: ref.panel.negativePrompt,
        poses: ref.panel.poses,
        poseImageName: ref.panel.poseImageName,
        bubbles: ref.panel.bubbles,
      };
      set((s) => ({
        projects: withProject(s.projects, ref.project.id, (p) => ({ ...p, panelTemplates: [...p.panelTemplates, template] })),
      }));
      return template.id;
    },

    applyPanelTemplate: (panelId, templateId) => {
      const ref = findPanel(get().projects, panelId);
      const template = ref?.project.panelTemplates.find((t) => t.id === templateId);
      if (!template) return;
      set((s) =>
        edited(s, {
          projects: withPanel(s.projects, panelId, (p) => ({
            ...withoutDepth(p),
            prompt: template.prompt,
            negativePrompt: template.negativePrompt,
            poses: template.poses,
            poseImageName: template.poseImageName,
            // Each balloon gets its own id, so a template applied twice makes two balloons, not one shared one.
            bubbles: template.bubbles.map((b) => ({ ...b, id: newComicId('bubble') })),
          })),
          selectedBubbleId: null, bubbleEditor: false,
        }),
      );
    },

    deletePanelTemplate: (templateId) => {
      const projectId = activeId();
      if (!projectId) return;
      set((s) => ({
        projects: withProject(s.projects, projectId, (p) => ({ ...p, panelTemplates: p.panelTemplates.filter((t) => t.id !== templateId) })),
      }));
    },

    savePageTemplate: (pageId, name) => {
      const projectId = activeId();
      const page = get().projects.find((p) => p.id === projectId)?.pages.find((pg) => pg.id === pageId);
      if (!projectId || !page) return null;
      const template: ComicPageTemplate = {
        id: newComicId('page-template'),
        name,
        panelCount: page.panels.length,
        columns: page.columns,
        direction: page.direction,
        size: page.size,
        shapes: page.shapes,
      };
      set((s) => ({
        projects: withProject(s.projects, projectId, (p) => ({ ...p, pageTemplates: [...p.pageTemplates, template] })),
      }));
      return template.id;
    },

    deletePageTemplate: (templateId) => {
      const projectId = activeId();
      if (!projectId) return;
      set((s) => ({
        projects: withProject(s.projects, projectId, (p) => ({ ...p, pageTemplates: p.pageTemplates.filter((t) => t.id !== templateId) })),
      }));
    },

    setPageCanvas: (pageId, canvas) => {
      const project = get().projects.find((p) => p.pages.some((pg) => pg.id === pageId));
      const page = project?.pages.find((pg) => pg.id === pageId);
      if (!project || !page || page.canvas === canvas) return false;
      // No undo step: the page's own canvas store undoes its layers.
      set((s) => ({ projects: withProject(s.projects, project.id, (p) => ({ ...p, pages: p.pages.map((pg) => (pg.id === pageId ? { ...pg, canvas } : pg)) })) }));
      return true;
    },

    setPending: (itemId, panelId) =>
      set((s) => {
        // A new draw of the panel forgets the failure of the last one.
        const drawFailed = { ...s.drawFailed };
        delete drawFailed[panelId];
        return { pending: { ...s.pending, [itemId]: panelId }, drawFailed };
      }),
    markDrawFailed: (panelId) => set((s) => ({ drawFailed: { ...s.drawFailed, [panelId]: true } })),
    setSheetPending: (itemId, target) => set((s) => ({ sheetPending: { ...s.sheetPending, [itemId]: target } })),

    clearSheetPending: (itemId) =>
      set((s) => {
        if (!(itemId in s.sheetPending)) return {};
        const sheetPending = { ...s.sheetPending };
        delete sheetPending[itemId];
        return { sheetPending };
      }),

    clearPending: (itemId) =>
      set((s) => {
        if (!(itemId in s.pending)) return {};
        const pending = { ...s.pending };
        delete pending[itemId];
        return { pending };
      }),

    undo: () =>
      set((s) => {
        const target = s.past[s.past.length - 1];
        if (!target) return {};
        lastEdit = null;
        return { ...stepState(s, target), past: s.past.slice(0, -1), future: [...s.future, s.projects] };
      }),

    redo: () =>
      set((s) => {
        const target = s.future[s.future.length - 1];
        if (!target) return {};
        lastEdit = null;
        return { ...stepState(s, target), past: [...s.past, s.projects].slice(-historyLimit()), future: s.future.slice(0, -1) };
      }),
  };
});
