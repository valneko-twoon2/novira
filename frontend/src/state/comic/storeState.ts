// The shape of the comic store: what it holds and the actions it offers. The implementation is store.ts.
import type { BubbleKind, ComicBubble, ComicCharacter, ComicEffect, ComicImageView, ComicPanel, ComicPlace, ComicPoint, ComicProject, PageSize, ReadingDirection, SheetView } from './document';
import type { ViewPart } from './imageView';
import type { PageCanvas } from './pageCanvasDoc';
import type { Shape } from './shapes';
import type { DrawSettings } from './drawSettings';
import type { ComicStyle } from './style';
import type { ComicRough } from './rough';

/** A view of a character's sheet being drawn: the comic, the character and the view. */
export interface SheetTarget {
  projectId: string;
  characterId: string;
  view: SheetView;
}

/** What the comic screen's draw button draws. */
export type DrawScope = 'panel' | 'page' | 'comic';

/** Where a panel is: its project, its page and the panel itself. */
export interface PanelRef {
  project: ComicProject;
  pageIndex: number;
  panelIndex: number;
  panel: ComicPanel;
}

export interface ComicState {
  projects: ComicProject[];
  activeProjectId: string | null;
  activePageId: string | null;
  selectedPanelId: string | null;
  /** The panel selected last before the selection was let go: the prompt boxes and the draw button keep working on it (see workPanel). */
  lastPanelId: string | null;
  selectedBubbleId: string | null;
  /** Whether the editor of the selected balloon is open beside the page (a double click on a balloon opens it). */
  bubbleEditor: boolean;
  /** Whether the selected balloon's outline shows its points, to be dragged into any shape (see BubbleOutline). */
  bubbleShaping: boolean;
  /**
   * A balloon just added, to be put in the middle of its panel once the screen knows its size (see centerBubble); null when
   * none waits. A balloon given its own place drops out.
   */
  centeringBubbleId: string | null;
  /**
   * Balloons whose words are to be fitted once the screen has laid them out (see fitBubble): shrunk until the words stay
   * inside the balloon and the balloon inside its panel. The assistant's balloons wait here, and so does one the user fits.
   */
  fittingBubbleIds: string[];
  /** Whether the selected panel's picture is selected (its handles show, and Delete takes it out of the panel). */
  imageSelected: boolean;
  /** Whether the page's backdrop is being edited: its handles show over the page, and the panels wait. */
  backdropSelected: boolean;
  /** Whether the page is being cut: a line drawn across a panel splits it in two (see splitPanel). */
  cutting: boolean;
  /** What the Invoke button draws: the selected panel, or every panel of the page that has a prompt. */
  drawScope: DrawScope;
  /** Queue items the screen waits for, by item id: the panel each picture is for. */
  pending: Record<number, string>;
  /** The panels whose last picture job failed, until they are drawn again: the panel list says so. */
  drawFailed: Record<string, true>;
  /** Queue items drawing a view of a character's sheet, by item id: the comic, the character and the view. */
  sheetPending: Record<number, SheetTarget>;
  /** The projects before each change that undo can take back (the last one is undone first). */
  past: ComicProject[][];
  /** The projects that undo took back, so redo can bring them back (the last one is redone first). */
  future: ComicProject[][];

  setProjects: (projects: ComicProject[]) => void;
  /** Puts back the projects as they were (the assistant's undo): one undo step, the changed page opened. */
  restoreProjects: (projects: ComicProject[]) => void;
  createProject: (name: string) => string;
  renameProject: (projectId: string, name: string) => void;
  deleteProject: (projectId: string) => void;
  selectProject: (projectId: string) => void;
  addPage: () => string | null;
  deletePage: (pageId: string) => void;
  selectPage: (pageId: string) => void;
  setPanelCount: (pageId: string, count: number) => void;
  setPageLayout: (
    pageId: string,
    layout: { columns?: number; direction?: ReadingDirection; size?: PageSize; frameMm?: number; insetMm?: number; marginMm?: number; frameColor?: string },
  ) => void;
  /**
   * Sets a page's panel count, columns, reading direction and paper at once (a page template or a built-in layout). A
   * layout with shapes takes its panel count from them, and a layout without shapes is the automatic one.
   */
  applyPageLayout: (
    pageId: string,
    layout: { panelCount: number; columns: number; direction: ReadingDirection; size: PageSize; shapes?: Shape[] | null },
  ) => void;
  /**
   * Changes a panel's place in the stack (a later panel lies over an earlier one; it is also the reading order). Returns the
   * panel's new position, or -1 when it does not move.
   */
  movePanelOrder: (pageId: string, index: number, to: 'front' | 'back' | 'forward' | 'backward') => number;
  /** Puts a panel of a free page back to the automatic layout's shape (`all`), or only turns it upright (`rotation`). */
  resetPanelShape: (pageId: string, index: number, part: 'all' | 'rotation') => boolean;
  /** Puts parts of a panel's picture view back to their defaults. */
  resetPanelImage: (panelId: string, parts: readonly ViewPart[]) => void;
  /** Puts parts of the backdrop's view back to their defaults. */
  resetBackdrop: (pageId: string, parts: readonly ViewPart[]) => void;
  /** The effect of the whole comic. */
  setProjectEffect: (effect: ComicEffect) => void;
  /** Replaces the open comic's cast; panels drop the characters that are gone. */
  setCast: (cast: ComicCharacter[]) => void;
  /** Replaces the open comic's places; a panel set in a place that is gone has no place any more. */
  setPlaces: (places: ComicPlace[]) => void;
  /** The words of the open comic's world (see ComicProject.world); a text with no word takes them out. */
  setWorld: (world: string) => void;
  /** Sets where a panel is (an id of the comic's places), or no place (null). */
  setPanelPlace: (panelId: string, placeId: string | null) => void;
  /** Puts a picture into a view of a character's sheet, or takes it out (null), in any comic; a picture, so not an undo step. */
  setCharacterView: (projectId: string, characterId: string, view: SheetView, imageName: string | null) => void;
  /** Keeps the drawing settings of a comic (not an undo step: they are the form's, not the page's). */
  setDraw: (projectId: string, draw: DrawSettings) => void;
  /** The settings one page changes from the comic's; undefined takes them all back. */
  setPageDraw: (pageId: string, draw: DrawSettings | undefined) => void;
  /** The style words of the comic, or of one page (undefined follows the comic's, or the model family's). */
  setStyle: (projectId: string, style: ComicStyle | undefined) => void;
  /** Turns the comic's character references on at a strength, or off with undefined (see ComicProject.castReference). */
  setCastReference: (projectId: string, weight: number | undefined) => void;
  setPageStyle: (pageId: string, style: ComicStyle | undefined) => void;
  /** Sets who is in a panel (ids of the cast). */
  setPanelCast: (panelId: string, cast: string[]) => void;
  /** Where the panel's animals and other pose-less things stand (see ComicFigure). */
  setPanelFigures: (panelId: string, figures: unknown) => void;
  /** The effect of one page, or null to follow the comic's. */
  setPageEffect: (pageId: string, effect: ComicEffect | null) => void;
  /** Swaps two panels of a page by their positions (0 is the first panel). */
  swapPanels: (pageId: string, a: number, b: number) => void;
  /** Turns a page back to the automatic layout, which its panel count and columns decide. */
  resetPageShapes: (pageId: string) => void;
  /**
   * Turns free placement on or off. On, the panels keep their shapes and are moved one by one; off, the page is laid out
   * automatically again. A change under the same key as the edit that follows it is one undo step with it.
   */
  setPageFree: (pageId: string, free: boolean, key?: string) => void;
  /**
   * Sets the shape of one panel (moved or turned by the screen). A page that is not free yet becomes free first: a panel is
   * carried about any page, and the page's panels stop sharing their edges from then on. Changes under the same key are one
   * undo step. False when it cannot stand.
   */
  setFreeShape: (pageId: string, panelIndex: number, shape: ComicPoint[], key?: string) => boolean;
  setDrawScope: (scope: DrawScope) => void;
  /** Sets whether the page is being cut. */
  setCutting: (cutting: boolean) => void;
  /**
   * Moves a corner of a panel's shape, and the corners the panels share with it. False when the move would leave a
   * panel invalid, in which case nothing changes. The moves of one drag are one undo step.
   */
  moveCorner: (pageId: string, panelIndex: number, corner: number, to: ComicPoint) => boolean;
  /** Adds a corner on an edge of a panel's shape (the edge that starts at corner `edge`). False when it cannot. */
  insertCorner: (pageId: string, panelIndex: number, edge: number, point: ComicPoint) => boolean;
  /** Removes a corner of a panel's shape. False when a panel would be left with too few corners. */
  removeCorner: (pageId: string, panelIndex: number, corner: number) => boolean;
  /**
   * Cuts a panel along the line through a and b, which makes a new empty panel after it. False when the line does not
   * cut the panel in two valid parts (see splitShape).
   */
  splitPanel: (pageId: string, panelIndex: number, a: ComicPoint, b: ComicPoint) => boolean;
  /**
   * Adds an empty panel without changing the others: a rectangle over the middle of the page, at the end, selected. A page
   * laid out automatically becomes free first, its panels keeping the shapes they are drawn with (see setPageFree); the
   * whole addition is one undo step. Returns its id, or null when the page is full.
   */
  addPanel: (pageId: string) => string | null;
  /**
   * Adds a panel by cutting one in half across its longer side: the panel at `panelIndex`, or the largest one when it is
   * null. The new empty panel comes after it and is selected (a free page gets a panel of its own instead, as addPanel).
   * Returns its id, or null when no panel can be cut (the page is full, or the panel is too small).
   */
  halvePanel: (pageId: string, panelIndex: number | null) => string | null;
  /**
   * Deletes a panel with its picture, prompts and balloons. On a page with its own shapes the nearest neighbour it can be
   * joined to takes the freed area (the neighbour keeps its own content); when none can, the page is laid out automatically
   * again. The last panel of a page stays. Returns whether a panel was deleted.
   */
  removePanel: (pageId: string, panelIndex: number) => boolean;
  /**
   * Slides the edge that starts at corner `edge` of a panel's shape by `delta` (fractions of the page), with the corners
   * the panels share; it stops at the page's margin. Returns how far it moved (the slide may be cut short), or null when the
   * move would leave a panel invalid. The moves of one drag are one undo step.
   */
  moveEdge: (pageId: string, panelIndex: number, edge: number, delta: ComicPoint) => ComicPoint | null;
  selectPanel: (panelId: string | null) => void;
  selectBubble: (bubbleId: string | null) => void;
  /** Selects a balloon and opens its editor beside the page. */
  openBubbleEditor: (panelId: string, bubbleId: string) => void;
  closeBubbleEditor: () => void;
  /** Shows or hides the points of the selected balloon's outline. */
  setBubbleShaping: (on: boolean) => void;
  /** Selects a panel and its picture. */
  selectImage: (panelId: string) => void;
  /** Starts or ends editing the page's backdrop. */
  selectBackdrop: (selected: boolean) => void;
  /** Puts a picture over the whole page (a new picture starts covering it), or takes it away with null. */
  setBackdrop: (pageId: string, imageName: string | null) => void;
  /** Changes how the backdrop sits on the page. The moves of one drag are one undo step. */
  setBackdropView: (pageId: string, view: Partial<ComicImageView>) => void;
  setPrompt: (panelId: string, prompt: string) => void;
  setPanelNegative: (panelId: string, negativePrompt: string) => void;
  setPanelNote: (panelId: string, note: string) => void;
  /** Moves, resizes, turns or mirrors the picture in its panel: the fields given change, the rest are kept. */
  setPanelImageView: (panelId: string, view: Partial<ComicImageView>) => void;
  /** Sets the people of a panel's pose (none clears it) and the picture the ControlNet reads. */
  setPanelPose: (panelId: string, poses: ComicPoint[][], poseImageName: string | null) => void;
  /** Puts what a 3D rough baked into a panel: the rough, the people as seen, their pose picture and the depth map (one undo step). */
  setPanelRough: (panelId: string, rough: ComicRough, poses: ComicPoint[][], poseImageName: string, depthImageName: string) => void;
  /** Who each person of the panel's pose is (cast ids or null, in the order of its poses). */
  setPanelPoseCast: (panelId: string, poseCast: (string | null)[]) => void;
  /** What each person of the panel's pose does (English tags, in the order of its poses); all empty removes them. */
  setPanelPoseWords: (panelId: string, poseWords: string[]) => void;
  /**
   * Gives the panel this picture (or none). The picture it had goes to the front of its earlier pictures (`takes`); an earlier
   * picture put back leaves that list and sits as it sat before. Not an undo step, like the pictures' other changes. With
   * `keepView` the picture sits as the old one sat (a part redrawn in place has the same composition).
   */
  setPanelImage: (panelId: string, imageName: string | null, options?: { keepView?: boolean }) => void;
  /** Drops an earlier picture from the panel's list; the picture stays in the gallery. */
  removeTake: (panelId: string, imageName: string) => void;
  /**
   * Puts a balloon waiting to be centred (see centeringBubbleId) in the middle of its panel, given its size as shares of the
   * panel. Part of the step that added it: it makes no undo step of its own.
   */
  centerBubble: (panelId: string, bubbleId: string, width: number, height: number) => void;
  /** Adds a balloon of this shape to a panel, with any other look given (a preset of the balloon list). Returns its id. */
  addBubble: (panelId: string, kind: BubbleKind, look?: Partial<Omit<ComicBubble, 'id' | 'kind'>>) => string | null;
  /** Changes a balloon; every field is kept in its range (see parseBubble). */
  updateBubble: (panelId: string, bubbleId: string, patch: Partial<Omit<ComicBubble, 'id'>>) => void;
  /** Puts balloons in the queue of fittingBubbleIds. */
  fitBubbles: (bubbleIds: string[]) => void;
  /**
   * One step of fitting a balloon (see fittingBubbleIds): its size or place as the screen measured it, joined with the
   * balloon's last change in one undo step. done takes it out of the queue.
   */
  fitBubble: (panelId: string, bubbleId: string, patch: Partial<Pick<ComicBubble, 'scale' | 'x' | 'y'>>, done: boolean) => void;
  removeBubble: (panelId: string, bubbleId: string) => void;
  /** Saves a panel's prompts, pose and balloons as a template of the project. Returns its id. */
  savePanelTemplate: (panelId: string, name: string) => string | null;
  /** Puts a template's prompts, pose and balloons into a panel. The picture of the panel is kept. */
  applyPanelTemplate: (panelId: string, templateId: string) => void;
  deletePanelTemplate: (templateId: string) => void;
  /** Saves a page's layout (panels, columns, reading direction) as a template of the project. Returns its id. */
  savePageTemplate: (pageId: string, name: string) => string | null;
  deletePageTemplate: (templateId: string) => void;
  /**
   * Puts in the layers of a page in any comic (see pageCanvasDoc.ts). It is no undo step of the comic: a page's layers are
   * undone by its own canvas store, and the comic's undo keeps them as they are (history.ts). False when the page
   * is not there or the layers are already these.
   */
  setPageCanvas: (pageId: string, canvas: PageCanvas) => boolean;
  setPending: (itemId: number, panelId: string) => void;
  clearPending: (itemId: number) => void;
  setSheetPending: (itemId: number, target: SheetTarget) => void;
  clearSheetPending: (itemId: number) => void;
  markDrawFailed: (panelId: string) => void;
  /** Takes back the last change to the pages, prompts, poses and balloons (see history.ts for what is kept). */
  undo: () => void;
  /** Brings back the change that undo took back. A new change clears it. */
  redo: () => void;
}

