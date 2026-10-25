// The comic page on the centre of the screen, worked on as on the canvas. The toolbar above it holds the page's settings
// and templates, the cut tool, the selected panel's balloons, pose and templates, its picture tools, one trash button for
// what is selected, and saving the page as a picture. Under the page are undo and redo, its pages, and the zoom (Ctrl and
// the mouse wheel zoom about the pointer too; Alt and the wheel scale the picture under the pointer).
//
// On the page, a panel is carried by a press anywhere on it, and a balloon by its body; the selected picture shows its
// handles (see PictureHandles). A press on the page outside the panels selects the page's backdrop when it has one, and
// lets go of the selection otherwise, as a press anywhere else in the view does. A reshaped page marks the selected panel
// on top of the panels. The selected panel shows its corners, which are dragged to reshape it (a double click on an edge
// adds a corner, on a corner removes it), the bar in the middle of each edge slides that edge (with its neighbours, until a
// panel of the page has been carried), and the handle above it turns it. While the page is being cut, a line drawn across
// a panel splits it in two; the add-panel button cuts the selected (or the largest) panel in half. The page is drawn layer
// by layer (see layers/): the panels, the balloons and the user's raster layers, in the order of the page's stack.
//
// The toolbar's switch between the page and painting: in paint mode (see paintMode.ts) the page's own tools are out of
// reach, no panel shows its handles, and the shell's paint parts take over (features do not import each other, so the shell
// gives them: `paintSurface` over the page, `paintLayer` in the layer stack where the painted layer lies, `paintToolbar` in
// the toolbar). Escape goes back to the page; so do another page and leaving the comic.
import { createPortal } from 'react-dom';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import {
  ArrowClockwise,
  ArrowDown,
  ArrowLineDown,
  ArrowLineUp,
  ArrowUp,
  ArrowsClockwise,
  ArrowCounterClockwise,
  FileArrowDown,
  FloppyDisk,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  PaintBrush,
  Plus,
  PlusSquare,
  Scissors,
  SquaresFour,
  Trash,
} from '@phosphor-icons/react';
import { t } from '@/i18n';
import type { ComicPoint } from '@/state/comic/document';
import { effectOf, EFFECT_LOOK } from '@/state/comic/effects';
import { zoomImageAt } from '@/state/comic/imageView';
import { frameStrokes } from '@/state/comic/frames';
import { rotateShape, shapeCentre } from '@/state/comic/freeShapes';
import { clampToPage, frameOutlines, pageAspect, pageShapes, panelGeometry } from '@/state/comic/layout';
import { nearestEdge, pointInShape, samePoint, type Shape } from '@/state/comic/shapes';
import { putFileImage, reportImageFailure } from '@/state/comic/panelImage';
import { startPainting, stopPainting, usePageHasStaged, usePagePaint } from '@/state/comic/paintMode';
import { activePage, activeProject, useComic } from '@/state/comic/store';
import { useGallery } from '@/state/gallery';
import { toast } from '@/state/toasts';
import { Button, cx, EmptyState, IconButton, TOOLBAR_BUTTON_SIZE, useHotkey } from '@/ui';
import { BackdropTools, PAGE_BOX } from './BackdropTools';
import { BookExport } from './BookExport';
import { BubbleEditor } from './BubbleEditor';
import { BackdropPicture, ComicPanelView, PanelBalloons } from './ComicPanelView';
import { PageLayerStack } from './layers/PageLayers';
import { PANELS_SLOT, slotOf } from '@/state/comic/pageCanvasDoc';
import { PagePager } from './PagePager';
import { PageSettings } from './PageSettings';
import { PageTemplates } from './PageTemplates';
import { PanelFixBar, PanelFixButton, PanelFixLayer } from './PanelFix';
import { PanelTakes } from './PanelTakes';
import { PanelTools } from './PanelTools';
import { COMIC_ZOOM_MAX, COMIC_ZOOM_MIN, stepComicZoom, wheelComicZoom } from './pageZoom';
import { pictureResetItems, ResetMenu } from './ResetMenu';
import { PageDropLayer } from './PageDropLayer';
import { PanelPictureHandles } from './PanelPictureHandles';
import { PictureGhost, PictureHandles } from './PictureHandles';
import { PictureTools, SCALE_STEP, usePageKeys } from './PictureTools';
import { deleteLabel, deleteSelection, deleteTarget } from './deleteSelection';
import { savePage, savePagePsd } from './savePage';
import { useBoardDock } from './useBoardDock';

/** The icon of each step of the stack order. */
const ORDER_ICON = { front: <ArrowLineUp />, forward: <ArrowUp />, backward: <ArrowDown />, back: <ArrowLineDown /> } as const;

/** A point of the page (fractions of its width and height) under a pointer, or null when the page is not laid out. */
function pagePoint(clientX: number, clientY: number, page: HTMLElement | null): ComicPoint | null {
  const box = page?.getBoundingClientRect();
  if (!box || !box.width || !box.height) return null;
  return { x: (clientX - box.left) / box.width, y: (clientY - box.top) / box.height };
}

/** A shape's corners as the points of an SVG drawn over the page (its viewBox is the page's width by its height times the aspect). */
const svgPoints = (shape: Shape, aspect: number) =>
  shape.map((p) => `${p.x},${p.y * aspect}`).join(' ');

/**
 * Ctrl (or Cmd) and the mouse wheel over the page view zoom it about the pointer: the point under the pointer stays under
 * it. The listener is not passive, so the browser's own page zoom does not happen as well.
 */
function useWheelZoom(
  view: RefObject<HTMLDivElement | null>,
  zoom: number,
  setZoom: (zoom: number) => void,
  active: boolean,
) {
  const current = useRef(zoom);
  current.current = zoom;
  useEffect(() => {
    const el = view.current;
    if (!el || !active) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const before = current.current;
      const after = wheelComicZoom(before, e.deltaY);
      if (after === before) return;
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const x = el.scrollLeft + px;
      const y = el.scrollTop + py;
      current.current = after;
      setZoom(after);
      // After the page is laid out at its new size, scroll so the same point of it is under the pointer.
      requestAnimationFrame(() => {
        const f = after / before;
        el.scrollLeft = x * f - px;
        el.scrollTop = y * f - py;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [view, setZoom, active]);
}

/** What a press on is not "blank": a panel, a handle of the selection, a control, or the balloon editor. */
const NOT_BLANK = '.comic-panel-drop, .comic-picture, .comic-vertex, .comic-edge, .comic-rotate, .comic-bubble-editor, .comic-cut, button, input, select, textarea, a, [role="slider"], [role="dialog"], [role="menu"], [role="listbox"], [role="option"]';

/**
 * A press on the page outside the panels (the paper between and around them) selects the page's backdrop when there is
 * one. A press on anything else in the view (the toolbars' empty space, the background around the page) lets go of the
 * selection.
 */
function pressOnBlank(e: ReactPointerEvent<HTMLElement>) {
  const target = e.target as HTMLElement;
  // While the page is painted on, a press paints; nothing of the page is chosen or let go.
  if (e.button !== 0 || target.closest(NOT_BLANK) || usePagePaint.getState().painting) return;
  const s = useComic.getState();
  if (target.closest('.comic-page') && activePage(s)?.backdrop) {
    if (!s.backdropSelected) s.selectBackdrop(true);
    return;
  }
  if (s.selectedPanelId || s.backdropSelected) s.selectPanel(null);
}

/** The point of an element's box under the pointer, as fractions of its width and height. */
function boxPoint(e: { clientX: number; clientY: number }, el: Element): ComicPoint | null {
  const r = el.getBoundingClientRect();
  return r.width && r.height ? { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } : null;
}

/**
 * Alt and the mouse wheel over the page scale a picture about the pointer: over the selected picture's handles, that
 * picture (or the backdrop while it is selected); over a panel, its picture; elsewhere on the page, the backdrop. The
 * picture becomes the selected one, so its handles show how far it reaches.
 */
function useAltWheelScale(view: RefObject<HTMLDivElement | null>, active: boolean) {
  useEffect(() => {
    const el = view.current;
    if (!el || !active) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || !e.deltaY) return;
      const target = e.target as HTMLElement;
      const pageEl = target.closest('.comic-page');
      const s = useComic.getState();
      const page = activePage(s);
      if (!pageEl || !page) return;
      const factor = e.deltaY < 0 ? SCALE_STEP : 1 / SCALE_STEP;
      const onHandles = !!target.closest('.comic-picture');
      const scaleBackdrop = () => {
        const at = boxPoint(e, pageEl);
        if (!page.backdrop || !at) return;
        e.preventDefault();
        s.setBackdropView(page.id, zoomImageAt(page.backdrop.view, factor, at));
        if (!s.backdropSelected) s.selectBackdrop(true);
      };
      if (s.backdropSelected && onHandles) {
        scaleBackdrop();
        return;
      }
      const index =
        onHandles && s.imageSelected
          ? page.panels.findIndex((p) => p.id === s.selectedPanelId)
          : Number(target.closest<HTMLElement>('[data-comic-panel-index]')?.dataset.comicPanelIndex ?? -1);
      const panel = page.panels[index];
      const panelEl = pageEl.querySelector(`[data-comic-panel-index="${index}"]`);
      if (!panel || !panelEl) {
        scaleBackdrop();
        return;
      }
      const at = boxPoint(e, panelEl);
      if (!panel.imageName || !at) return;
      e.preventDefault();
      s.setPanelImageView(panel.id, zoomImageAt(panel.imageView, factor, at));
      if (!s.imageSelected || s.selectedPanelId !== panel.id) s.selectImage(panel.id);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [view, active]);
}

/** The paint parts the shell gives the editor (see the top of this file); without them the page cannot be painted on. */
export interface ComicEditorProps {
  /** Whether the shell can paint on the page; it gives the parts below once painting starts. */
  canPaint?: boolean;
  /** Laid over the page while it is painted on; it takes every press there. */
  paintSurface?: ReactNode;
  /** Shown in the page's layer stack in place of the painted layer (`paintLayerId`). */
  paintLayer?: ReactNode;
  /** The id of the raster layer being painted on, or null when none is. */
  paintLayerId?: string | null;
  /** The painting tools, in the toolbar while the page is painted on. */
  paintToolbar?: ReactNode;
}

export function ComicEditor({ canPaint = false, paintSurface, paintLayer, paintLayerId = null, paintToolbar }: ComicEditorProps = {}) {
  // The balloon editor lies over the board panel when there is room, so it never covers the page; otherwise it sits in the page view.
  const dock = useBoardDock();
  const project = useComic((s) => activeProject(s));
  const page = useComic((s) => activePage(s));
  const selectedPanelId = useComic((s) => s.selectedPanelId);
  const selectedBubbleId = useComic((s) => s.selectedBubbleId);
  const bubbleEditor = useComic((s) => s.bubbleEditor);
  const imageSelected = useComic((s) => s.imageSelected);
  const backdropSelected = useComic((s) => s.backdropSelected);
  const pending = useComic((s) => s.pending);
  const drawFailed = useComic((s) => s.drawFailed);
  const toDelete = useComic(deleteTarget);
  const cutting = useComic((s) => s.cutting);
  const canUndo = useComic((s) => s.past.length > 0);
  const canRedo = useComic((s) => s.future.length > 0);
  const painting = usePagePaint((s) => s.painting) && canPaint && !!paintSurface;
  const images = useGallery((s) => s.images);
  const [zoom, setZoom] = useState(1);
  const [cut, setCut] = useState<{ panel: number; from: ComicPoint; to: ComicPoint } | null>(null);
  const viewEl = useRef<HTMLDivElement>(null);
  const pageEl = useRef<HTMLDivElement>(null);
  // The corner being dragged: its panel, and where the corner is now (it is found again by that place on each move).
  const corner = useRef<{ pointer: number; panelId: string; at: ComicPoint } | null>(null);
  // The edge being dragged: its panel, where its two corners are now, and the page point the pointer was last at.
  // The panel being turned: its shape when the turn began, and the angle of the pointer about its middle then.
  const turn = useRef<{ pointer: number; panelId: string; start: ComicPoint[]; angle: number } | null>(null);
  const edgeDrag = useRef<{ pointer: number; panelId: string; a: ComicPoint; b: ComicPoint; last: ComicPoint } | null>(null);
  const urls = useMemo(() => new Map(images.map((i) => [i.name, i.url])), [images]);
  const geometry = page ? panelGeometry(page) : [];
  const outlines = page ? frameOutlines(page) : [];
  const aspect = pageAspect(page?.size);
  // Undo and redo belong to the comic while its page is on screen; typing in a field keeps the field's own undo. While the
  // page is painted on they belong to the page's layers (the shell's canvas keys).
  useHotkey('mod+z', () => useComic.getState().undo(), { enabled: !painting });
  useHotkey(['mod+shift+z', 'mod+y'], () => useComic.getState().redo(), { enabled: !painting });
  const hasStaged = usePageHasStaged(page?.id ?? null);
  useHotkey('escape', () => stopPainting(page?.id), { enabled: painting && !hasStaged });
  usePageKeys((panelId) => {
    const i = page?.panels.findIndex((p) => p.id === panelId) ?? -1;
    return geometry[i]?.box ?? null;
  }, aspect, !painting);
  useWheelZoom(viewEl, zoom, setZoom, !!page);
  useAltWheelScale(viewEl, !!page && !painting);
  // Painting belongs to one page: another page, or leaving the comic, goes back to the page tools.
  const pageId = page?.id ?? null;
  useEffect(() => () => stopPainting(pageId), [pageId]);

  if (!project) {
    return (
      <div className="comic comic--empty" data-testid="comic-editor">
        <EmptyState title={t('comic.editor.emptyTitle')} description={t('comic.editor.emptyText')}>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Plus />}
            onClick={() => useComic.getState().createProject(t('comic.project.newName'))}
            data-testid="comic-new-empty"
          >
            {t('comic.project.new')}
          </Button>
        </EmptyState>
      </div>
    );
  }
  if (!page) return <div className="comic comic--empty" data-testid="comic-editor" />;

  // A hidden or locked panels layer shows no panel's handles (its panels take no presses either, see PageLayerStack).
  const panelsSlot = slotOf(page.canvas, PANELS_SLOT);
  const panelsShown = panelsSlot?.isEnabled !== false;
  const panelsOpen = panelsShown && !panelsSlot?.isLocked;
  const reshaped = page.shapes !== null && panelsShown;
  const look = EFFECT_LOOK[effectOf(project, page)];
  const strokes = frameStrokes(page);
  const selectedIndex = page.panels.findIndex((p) => p.id === selectedPanelId);
  const selected = selectedIndex >= 0 ? page.panels[selectedIndex] : undefined;
  const selectedBox = selectedIndex >= 0 ? geometry[selectedIndex]?.box : undefined;
  const selectedUrl = selected?.imageName ? urls.get(selected.imageName) : undefined;
  const editedBubble = bubbleEditor ? selected?.bubbles.find((b) => b.id === selectedBubbleId) : undefined;
  const editorCard = selected && editedBubble ? <BubbleEditor panelId={selected.id} bubble={editedBubble} /> : null;
  const pictureSelected = imageSelected && !!selected && !!selectedUrl && !!selectedBox && !cutting && panelsOpen && !painting;
  // The corners of the selected panel: its shape, or the rectangle it has in the automatic layout. A selected picture shows its
  // own handles instead, and a selected balloon none, so it is plain that the balloon (not its panel) is what is chosen.
  const selectedShape =
    selectedIndex >= 0 && !pictureSelected && !selectedBubbleId && panelsOpen && !painting ? (pageShapes(page)[selectedIndex] ?? null) : null;
  const drawing = new Set(Object.values(pending));

  const dragCorner = (e: ReactPointerEvent<HTMLButtonElement>, at: ComicPoint) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    corner.current = { pointer: e.pointerId, panelId: page.panels[selectedIndex]?.id ?? '', at };
  };
  const moveCorner = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = corner.current;
    const at = pagePoint(e.clientX, e.clientY, pageEl.current);
    if (!d || d.pointer !== e.pointerId || !at) return;
    // The page as the store has it now: the move may follow a change made a moment ago.
    const state = useComic.getState();
    const current = activePage(state);
    const index = current?.panels.findIndex((p) => p.id === d.panelId) ?? -1;
    if (!current || index < 0) return;
    const to = current.free ? at : clampToPage(at, aspect);
    const cornerIndex = pageShapes(current)[index]?.findIndex((q) => samePoint(q, d.at)) ?? -1;
    if (cornerIndex < 0) return;
    if (state.moveCorner(current.id, index, cornerIndex, to)) d.at = to;
  };
  const turnAngle = (at: ComicPoint, centre: ComicPoint) => Math.atan2((at.y - centre.y) * aspect, at.x - centre.x);
  const startTurn = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const at = pagePoint(e.clientX, e.clientY, pageEl.current);
    // The panel as it is drawn: a page that turns free on this turn keeps its panels where they are drawn (see setPageFree).
    const start = frameOutlines(page)[selectedIndex];
    if (!at || !start || !selected) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    turn.current = { pointer: e.pointerId, panelId: selected.id, start, angle: turnAngle(at, shapeCentre(start)) };
  };
  const moveTurn = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = turn.current;
    const at = pagePoint(e.clientX, e.clientY, pageEl.current);
    if (!d || d.pointer !== e.pointerId || !at) return;
    const current = activePage(useComic.getState());
    const index = current?.panels.findIndex((p) => p.id === d.panelId) ?? -1;
    if (!current || index < 0) return;
    let delta = turnAngle(at, shapeCentre(d.start)) - d.angle;
    // Shift turns in steps of 15 degrees.
    if (e.shiftKey) delta = Math.round(delta / (Math.PI / 12)) * (Math.PI / 12);
    const turned = rotateShape(d.start, delta, aspect);
    if (turned) useComic.getState().setFreeShape(current.id, index, turned, `turn:${d.panelId}`);
  };
  const endTurn = () => {
    turn.current = null;
  };
  const endCorner = () => {
    corner.current = null;
  };
  const dragEdge = (e: ReactPointerEvent<HTMLButtonElement>, a: ComicPoint, b: ComicPoint) => {
    const at = pagePoint(e.clientX, e.clientY, pageEl.current);
    if (!at) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    edgeDrag.current = { pointer: e.pointerId, panelId: page.panels[selectedIndex]?.id ?? '', a, b, last: at };
  };
  const moveEdge = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = edgeDrag.current;
    const at = pagePoint(e.clientX, e.clientY, pageEl.current);
    if (!d || d.pointer !== e.pointerId || !at) return;
    const state = useComic.getState();
    const current = activePage(state);
    const index = current?.panels.findIndex((p) => p.id === d.panelId) ?? -1;
    const shape = current && index >= 0 ? pageShapes(current)[index] : undefined;
    // The edge is found again by where its corners are (a corner added on another panel may have moved the numbers).
    const edge = shape?.findIndex((q, i) => samePoint(q, d.a) && samePoint(shape[(i + 1) % shape.length]!, d.b)) ?? -1;
    if (!current || edge < 0) return;
    const moved = state.moveEdge(current.id, index, edge, { x: at.x - d.last.x, y: at.y - d.last.y });
    if (!moved) return;
    d.a = { x: d.a.x + moved.x, y: d.a.y + moved.y };
    d.b = { x: d.b.x + moved.x, y: d.b.y + moved.y };
    d.last = { x: d.last.x + moved.x, y: d.last.y + moved.y };
  };
  const endEdge = () => {
    edgeDrag.current = null;
  };
  const addCorner = (e: ReactMouseEvent<SVGPolygonElement>) => {
    const at = pagePoint(e.clientX, e.clientY, pageEl.current);
    if (!at || !selectedShape || selectedIndex < 0) return;
    const { edge, point } = nearestEdge(selectedShape, at);
    useComic.getState().insertCorner(page.id, selectedIndex, edge, point);
  };
  const startCut = (e: ReactPointerEvent<HTMLDivElement>) => {
    const at = pagePoint(e.clientX, e.clientY, pageEl.current);
    if (!at) return;
    const index = pageShapes(page).findIndex((s) => pointInShape(s, at));
    const id = page.panels[index]?.id;
    if (index < 0 || !id) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    useComic.getState().selectPanel(id);
    setCut({ panel: index, from: at, to: at });
  };
  const moveCut = (e: ReactPointerEvent<HTMLDivElement>) => {
    const at = pagePoint(e.clientX, e.clientY, pageEl.current);
    if (cut && at) setCut({ ...cut, to: at });
  };
  const endCut = () => {
    // A press without a line is only a click: nothing is cut.
    if (cut && Math.hypot(cut.to.x - cut.from.x, cut.to.y - cut.from.y) > 0.02) {
      if (!useComic.getState().splitPanel(page.id, cut.panel, cut.from, cut.to))
        toast({ status: 'warning', title: t('comic.shape.cutFailed') });
    }
    setCut(null);
  };

  return (
    <div className="comic-view" data-testid="comic-editor" onPointerDown={pressOnBlank}>
      <div className="comic-view__bar" role="toolbar" aria-label={t('comic.page.toolbar')}>
        {canPaint && (
          <div className="comic-view__group" role="group" aria-label={t('comic.paint.mode')}>
            <IconButton
              size={TOOLBAR_BUTTON_SIZE}
              label={t('comic.paint.page')}
              icon={<SquaresFour />}
              isActive={!painting}
              onClick={() => stopPainting(page.id)}
              data-testid="comic-mode-page"
            />
            <IconButton
              size={TOOLBAR_BUTTON_SIZE}
              label={t('comic.paint.paint')}
              icon={<PaintBrush />}
              isActive={painting}
              onClick={() => startPainting(page.id)}
              data-testid="comic-mode-paint"
            />
          </div>
        )}
        {painting && <div className="comic-view__group">{paintToolbar}</div>}
        {!painting && (
        <div className="comic-view__group">
          <PageSettings page={page} project={project} />
          <PageTemplates project={project} page={page} />
          <BackdropTools page={page} aspect={aspect} />
          <IconButton
            size={TOOLBAR_BUTTON_SIZE}
            label={t('comic.shape.cut')}
            icon={<Scissors />}
            isActive={cutting}
            onClick={() => useComic.getState().setCutting(!cutting)}
            data-testid="comic-cut"
          />
          <IconButton
            size={TOOLBAR_BUTTON_SIZE}
            label={t('comic.shape.addPanel')}
            icon={<PlusSquare />}
            onClick={() => {
              if (!useComic.getState().addPanel(page.id))
                toast({ status: 'warning', title: t('comic.shape.addPanelFailed') });
            }}
            data-testid="comic-add-panel"
          />
          {page.free && selected && (
            <>
              {(['front', 'forward', 'backward', 'back'] as const).map((to) => {
                const atTop = selectedIndex === page.panels.length - 1;
                const atBottom = selectedIndex === 0;
                return (
                  <IconButton
                    key={to}
                    size={TOOLBAR_BUTTON_SIZE}
                    label={t(`comic.order.${to}`)}
                    icon={ORDER_ICON[to]}
                    disabled={to === 'front' || to === 'forward' ? atTop : atBottom}
                    onClick={() => useComic.getState().movePanelOrder(page.id, selectedIndex, to)}
                    data-testid={`comic-order-${to}`}
                  />
                );
              })}
            </>
          )}
          <IconButton
            size={TOOLBAR_BUTTON_SIZE}
            label={deleteLabel(toDelete)}
            icon={<Trash />}
            disabled={!toDelete}
            onClick={deleteSelection}
            data-testid="comic-delete"
          />
        </div>
        )}
        {selected && !painting && (
          <PanelTools page={page} panel={selected} panelIndex={selectedIndex} templates={project.panelTemplates} cast={project.cast} places={project.places} />
        )}
        {selected && selectedBox && !painting && (
          <PictureTools
            onView={(next) => {
              useComic.getState().setPanelImageView(selected.id, next);
              useComic.getState().selectImage(selected.id);
            }}
            onFile={(file) => void putFileImage(selected.id, file).catch(reportImageFailure)}
            url={selectedUrl}
            view={selected.imageName ? selected.imageView : null}
            box={selectedBox}
            aspect={aspect}
          />
        )}
        {selected && !painting && (selected.imageName || selected.takes.length > 0) && (
          <div className="comic-view__group">
            {selected.imageName && <PanelFixButton panel={selected} />}
            <PanelTakes panel={selected} />
          </div>
        )}
        {selected && !painting && (
          <div className="comic-view__group">
            <ResetMenu
              testId="comic-reset"
              items={[
                ...(page.free
                  ? [
                      { id: 'panel-rotation', label: t('comic.reset.panelRotation'), run: () => useComic.getState().resetPanelShape(page.id, selectedIndex, 'rotation') },
                      { id: 'panel-shape', label: t('comic.reset.panelShape'), run: () => useComic.getState().resetPanelShape(page.id, selectedIndex, 'all') },
                    ]
                  : []),
                ...(selected.imageName ? pictureResetItems((parts) => useComic.getState().resetPanelImage(selected.id, parts)) : []),
              ]}
            />
          </div>
        )}
        <span className="comic-view__spacer" />
        <div className="comic-view__group">
          <IconButton
            size={TOOLBAR_BUTTON_SIZE}
            label={t('comic.page.export')}
            icon={<FloppyDisk />}
            onClick={() => void savePage(page, effectOf(project, page))}
            data-testid="comic-export"
          />
          <IconButton
            size={TOOLBAR_BUTTON_SIZE}
            label={t('comic.page.psd')}
            icon={<FileArrowDown />}
            onClick={() => void savePagePsd(project, page)}
            data-testid="comic-export-psd"
          />
          <BookExport project={project} />
        </div>
      </div>
      <PanelFixBar selectedPanelId={selected?.id ?? null} />
      <div className={cx('comic-stage', editedBubble && !dock && 'has-editor')}>
      {editorCard && (dock ? createPortal(editorCard, dock) : editorCard)}
      <div ref={viewEl} className="comic" data-testid="comic-scroll">
        <div
          ref={pageEl}
          className={cx('comic-page', page.backdrop && 'has-backdrop', painting && 'is-painting')}
          style={{ aspectRatio: `1 / ${aspect}`, width: `calc(min(100%, 720px) * ${zoom})` }}
          data-testid="comic-page"
        >
          {pictureSelected && selectedUrl && selectedBox && (
            <PictureGhost
              url={selectedUrl}
              view={selected.imageView}
              box={selectedBox}
              aspect={aspect}
            />
          )}
          <PageDropLayer pageId={page.id}>
          <div className="comic-page__crop" style={look.filter === 'none' ? undefined : { filter: look.filter }}>
            {page.backdrop && urls.get(page.backdrop.imageName) && (
              <BackdropPicture url={urls.get(page.backdrop.imageName)!} view={page.backdrop.view} aspect={aspect} />
            )}
          <PageLayerStack
            page={page}
            urls={urls}
            paint={painting && paintLayerId ? { layerId: paintLayerId, node: paintLayer } : null}
            panels={page.panels.map((panel, i) => {
              const placed = geometry[i];
              if (!placed) return null;
              return (
                <ComicPanelView
                  key={panel.id}
                  pageId={page.id}
                  panel={panel}
                  number={i + 1}
                  box={placed.box}
                  aspect={aspect}
                  outline={outlines[i] ?? []}
                  strokes={strokes}
                  frameColor={page.frameColor}
                  shape={placed.shape}
                  selected={panel.id === selectedPanelId}
                  imageUrl={panel.imageName ? urls.get(panel.imageName) : undefined}
                  poseUrl={panel.poseImageName ? urls.get(panel.poseImageName) : undefined}
                  drawing={drawing.has(panel.id)}
                  failed={drawFailed[panel.id] === true}
                  selectedBubbleId={panel.id === selectedPanelId ? selectedBubbleId : null}
                  backdropSelected={backdropSelected}
                  showBalloons={false}
                />
              );
            })}
            balloons={page.panels.map((panel, i) => {
              const placed = geometry[i];
              if (!placed) return null;
              return (
                <PanelBalloons
                  key={panel.id}
                  panel={panel}
                  number={i + 1}
                  box={placed.box}
                  shape={placed.shape}
                  selectedBubbleId={panel.id === selectedPanelId ? selectedBubbleId : null}
                />
              );
            })}
          />
          </div>
          </PageDropLayer>
          {look.paper && <div className="comic-page__paper" style={{ background: look.paper }} aria-hidden="true" />}
          {reshaped && (
            <svg
              className="comic-frames"
              viewBox={`0 0 1 ${aspect}`}
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              {(page.shapes ?? []).map((shape, i) => (
                <polygon
                  key={`edge-${i}`}
                  points={svgPoints(shape, aspect)}
                  className={cx('comic-frames__edge', i === selectedIndex && !selectedBubbleId && 'is-selected')}
                />
              ))}
            </svg>
          )}
          {selectedShape && !cutting && (
            <svg
              className="comic-frames"
              viewBox={`0 0 1 ${aspect}`}
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <polygon
                points={svgPoints(selectedShape, aspect)}
                className="comic-frames__hit"
                onDoubleClick={addCorner}
              />
            </svg>
          )}
          {cut && (
            <svg
              className="comic-frames"
              viewBox={`0 0 1 ${aspect}`}
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <line
                className="comic-cut__line"
                x1={cut.from.x}
                y1={cut.from.y * aspect}
                x2={cut.to.x}
                y2={cut.to.y * aspect}
              />
            </svg>
          )}
          {selectedShape && !cutting && (
            <button
              type="button"
              className="comic-rotate"
              style={{ left: `${shapeCentre(selectedShape).x * 100}%`, top: `${Math.min(...selectedShape.map((p) => p.y)) * 100}%` }}
              aria-label={t('comic.free.rotate')}
              title={t('comic.free.rotateHint')}
              data-testid="comic-rotate"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={startTurn}
              onPointerMove={moveTurn}
              onPointerUp={endTurn}
              onPointerCancel={endTurn}
            >
              <ArrowsClockwise size={14} weight="bold" aria-hidden="true" />
            </button>
          )}
          {selectedShape &&
            !cutting &&
            selectedShape.map((a, i) => {
              const b = selectedShape[(i + 1) % selectedShape.length]!;
              // The bar lies along the edge on screen (the page is `aspect` times as tall as it is wide).
              const angle = (Math.atan2((b.y - a.y) * aspect, b.x - a.x) * 180) / Math.PI;
              // The edge slides across itself: the cursor is the resize arrow for that direction (every 45 degrees).
              const across = (((angle + 90) % 180) + 180) % 180;
              const slide = across < 22.5 || across >= 157.5 ? 'is-ew' : across < 67.5 ? 'is-nwse' : across < 112.5 ? 'is-ns' : 'is-nesw';
              return (
                <button
                  key={`edge-${i}`}
                  type="button"
                  className={cx('comic-edge', slide)}
                  style={{ left: `${((a.x + b.x) / 2) * 100}%`, top: `${((a.y + b.y) / 2) * 100}%`, rotate: `${angle}deg` }}
                  aria-label={t('comic.shape.edge', { number: i + 1 })}
                  title={t('comic.shape.edgeHint')}
                  data-testid="comic-edge"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => dragEdge(e, a, b)}
                  onPointerMove={moveEdge}
                  onPointerUp={endEdge}
                  onPointerCancel={endEdge}
                />
              );
            })}
          {selectedShape &&
            !cutting &&
            selectedShape.map((p, i) => (
              <button
                key={i}
                type="button"
                className="comic-vertex"
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                aria-label={t('comic.shape.corner', { number: i + 1 })}
                title={t('comic.shape.cornerHint')}
                data-testid="comic-corner"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => dragCorner(e, p)}
                onPointerMove={moveCorner}
                onPointerUp={endCorner}
                onPointerCancel={endCorner}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  useComic.getState().removeCorner(page.id, selectedIndex, i);
                }}
              />
            ))}
          {backdropSelected && !painting && page.backdrop && urls.get(page.backdrop.imageName) && (
            <PictureHandles
              movable
              onView={(next) => useComic.getState().setBackdropView(page.id, next)}
              url={urls.get(page.backdrop.imageName)!}
              view={page.backdrop.view}
              box={PAGE_BOX}
              aspect={aspect}
            />
          )}
          {pictureSelected && selectedUrl && selectedBox && (
            <PanelPictureHandles
              page={page}
              index={selectedIndex}
              onView={(next) => useComic.getState().setPanelImageView(selected.id, next)}
              url={selectedUrl}
              view={selected.imageView}
              box={selectedBox}
              aspect={aspect}
            />
          )}
          {selected && selectedBox && !cutting && !painting && <PanelFixLayer panelId={selected.id} box={selectedBox} aspect={aspect} />}
          {cutting && !painting && (
            <div
              className="comic-cut"
              data-testid="comic-cut-layer"
              onPointerDown={startCut}
              onPointerMove={moveCut}
              onPointerUp={endCut}
              onPointerCancel={() => setCut(null)}
            />
          )}
          {painting && (
            <div className="comic-paint" data-testid="comic-paint">
              {paintSurface}
            </div>
          )}
        </div>
      </div>
      </div>
      <PagePager
        project={project}
        page={page}
        start={
          <div className="comic-view__group comic-view__group--plain">
            <IconButton
              size={TOOLBAR_BUTTON_SIZE}
              label={t('comic.history.undo')}
              icon={<ArrowCounterClockwise />}
              disabled={!canUndo}
              onClick={() => useComic.getState().undo()}
              data-testid="comic-undo"
            />
            <IconButton
              size={TOOLBAR_BUTTON_SIZE}
              label={t('comic.history.redo')}
              icon={<ArrowClockwise />}
              disabled={!canRedo}
              onClick={() => useComic.getState().redo()}
              data-testid="comic-redo"
            />
          </div>
        }
      >
        <div
          className="ui-zoom"
          role="group"
          aria-label={t('common.zoom')}
          title={t('comic.zoom.wheelHint')}
        >
          <IconButton
            size={TOOLBAR_BUTTON_SIZE}
            label={t('common.zoomOut')}
            icon={<MagnifyingGlassMinus />}
            disabled={zoom <= COMIC_ZOOM_MIN}
            onClick={() => setZoom(stepComicZoom(zoom, -1))}
          />
          <button
            type="button"
            className="ui-zoom__value"
            aria-label={t('comic.zoom.reset')}
            onClick={() => setZoom(1)}
            data-testid="comic-zoom-value"
          >
            {Math.round(zoom * 100)}%
          </button>
          <IconButton
            size={TOOLBAR_BUTTON_SIZE}
            label={t('common.zoomIn')}
            icon={<MagnifyingGlassPlus />}
            disabled={zoom >= COMIC_ZOOM_MAX}
            onClick={() => setZoom(stepComicZoom(zoom, 1))}
          />
        </div>
      </PagePager>
    </div>
  );
}
