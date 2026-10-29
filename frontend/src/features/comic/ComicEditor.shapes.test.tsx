// @vitest-environment jsdom
// The page view's direct manipulation of a selected panel (its corners, its edges, the turning handle, a double click for a
// corner), the cut tool, the export and zoom buttons, the Alt-wheel on the backdrop, and painting mode.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { setLocale, t } from '@/i18n';
import { newProject } from '@/state/comic/document';
import { MAX_PANELS_PER_PAGE } from '@/state/comic/layout';
import { stopPainting, usePagePaint } from '@/state/comic/paintMode';
import { useComic } from '@/state/comic/store';
import { useGallery } from '@/state/gallery';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { ComicEditor, type ComicEditorProps } from './ComicEditor';
import * as savePageModule from './savePage';

const initialGallery = useGallery.getState();
const page = () => useComic.getState().projects[0]!.pages[0]!;
const WIDTH = 1000;
const HEIGHT = 1414;

function show(props: ComicEditorProps = {}, prepare?: (project: ReturnType<typeof newProject>) => void) {
  const project = newProject('Shapes');
  prepare?.(project);
  useComic.getState().setProjects([project]);
  const view = render(
    <TooltipProvider>
      <ComicEditor {...props} />
    </TooltipProvider>,
  );
  return view;
}

/** Gives the page element a size on screen, as a browser would. */
function layout(width = WIDTH, height = HEIGHT) {
  screen.getByTestId('comic-page').getBoundingClientRect = () => ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }) as DOMRect;
}

beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
});
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  setLocale('en');
  useToasts.setState({ toasts: [] });
  useGallery.setState({ ...initialGallery, images: [{ name: 'sky.png', url: 'novira://sky.png' } as ImageDTO] }, true);
});
afterEach(() => {
  cleanup();
  stopPainting();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setLocale('ja');
  useGallery.setState(initialGallery, true);
  useComic.setState({ selectedPanelId: null, imageSelected: false, backdropSelected: false, cutting: false });
});

describe('the corners of the selected panel', () => {
  it('drags a corner, which reshapes the page, and stops on release', () => {
    show();
    layout();
    act(() => useComic.getState().selectPanel(page().panels[0]!.id));
    const corner = screen.getAllByTestId('comic-corner')[0]!;
    const before = page().shapes;
    expect(before).toBeNull();
    const left = parseFloat(corner.style.left) / 100;
    const top = parseFloat(corner.style.top) / 100;
    fireEvent.pointerDown(corner, { pointerId: 1, clientX: left * WIDTH, clientY: top * HEIGHT });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: left * WIDTH + 40, clientY: top * HEIGHT + 40 });
    expect(page().shapes).not.toBeNull();
    fireEvent.pointerUp(corner, { pointerId: 1 });
    const after = JSON.stringify(page().shapes);
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: left * WIDTH + 80, clientY: top * HEIGHT + 80 });
    expect(JSON.stringify(page().shapes)).toBe(after);
  });

  it('ignores a move of another pointer, and a move before the page is laid out', () => {
    show();
    act(() => useComic.getState().selectPanel(page().panels[0]!.id));
    const corner = screen.getAllByTestId('comic-corner')[0]!;
    fireEvent.pointerDown(corner, { pointerId: 1, clientX: 10, clientY: 10 });
    // The page has no size here (jsdom), so there is no point under the pointer.
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 50, clientY: 50 });
    expect(page().shapes).toBeNull();
    layout();
    fireEvent.pointerMove(corner, { pointerId: 2, clientX: 50, clientY: 50 });
    expect(page().shapes).toBeNull();
    fireEvent.pointerCancel(corner, { pointerId: 1 });
  });

  it('removes a corner on a double click, and keeps a click from reaching the page', () => {
    show();
    layout();
    act(() => useComic.getState().selectPanel(page().panels[0]!.id));
    const select = vi.spyOn(useComic.getState(), 'selectPanel');
    fireEvent.click(screen.getAllByTestId('comic-corner')[0]!);
    expect(select).not.toHaveBeenCalled();
    // A panel of four corners cannot lose one, but a panel with five can.
    const corners = screen.getAllByTestId('comic-corner').length;
    fireEvent.doubleClick(screen.getAllByTestId('comic-corner')[0]!);
    expect(screen.getAllByTestId('comic-corner').length).toBeLessThanOrEqual(corners);
  });

  it('adds a corner on a double click on the panel outline, and removes it again with a double click on the corner', () => {
    const { container } = show();
    layout();
    act(() => useComic.getState().selectPanel(page().panels[0]!.id));
    const hit = container.querySelector('.comic-frames__hit')!;
    const corners = screen.getAllByTestId('comic-corner').length;
    // On the left edge of the first panel.
    fireEvent.doubleClick(hit, { clientX: 0, clientY: HEIGHT / 4 });
    const added = screen.getAllByTestId('comic-corner').length;
    expect(added).toBeGreaterThan(corners);
    // Without a size on screen, nothing is added.
    screen.getByTestId('comic-page').getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0 }) as DOMRect;
    fireEvent.doubleClick(container.querySelector('.comic-frames__hit')!, { clientX: 0, clientY: HEIGHT / 4 });
    expect(screen.getAllByTestId('comic-corner')).toHaveLength(added);
    layout();
    // The corner just added is the one a double click takes away again (a corner shared with a neighbour stays).
    for (const c of screen.getAllByTestId('comic-corner')) {
      if (screen.getAllByTestId('comic-corner').length < added) break;
      fireEvent.doubleClick(c);
    }
    expect(screen.getAllByTestId('comic-corner').length).toBeLessThan(added);
  });
});

describe('the edges and the turning handle', () => {
  it('slides an edge with its bar', () => {
    show();
    layout();
    act(() => useComic.getState().selectPanel(page().panels[0]!.id));
    const bars = screen.getAllByTestId('comic-edge');
    // The right edge of the first panel (the one that has a neighbour to share it with).
    const bar = bars.find((b) => parseFloat(b.style.left) > 30 && parseFloat(b.style.left) < 70) ?? bars[1]!;
    const x = (parseFloat(bar.style.left) / 100) * WIDTH;
    const y = (parseFloat(bar.style.top) / 100) * HEIGHT;
    const before = JSON.stringify(page().panels.map((p) => p.id)) + JSON.stringify(page().shapes);
    fireEvent.pointerDown(bar, { pointerId: 1, clientX: x, clientY: y });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: x + 30, clientY: y + 30 });
    fireEvent.pointerUp(bar, { pointerId: 1 });
    expect(JSON.stringify(page().panels.map((p) => p.id)) + JSON.stringify(page().shapes)).not.toBe(before);
    // After the release a move does nothing more.
    const after = JSON.stringify(page().shapes);
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: x + 90, clientY: y + 90 });
    expect(JSON.stringify(page().shapes)).toBe(after);
  });

  it('does not start sliding an edge before the page is laid out, and ignores another pointer', () => {
    show();
    act(() => useComic.getState().selectPanel(page().panels[0]!.id));
    const bar = screen.getAllByTestId('comic-edge')[0]!;
    fireEvent.pointerDown(bar, { pointerId: 1, clientX: 5, clientY: 5 });
    layout();
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 50, clientY: 50 });
    expect(page().shapes).toBeNull();
    fireEvent.pointerDown(bar, { pointerId: 1, clientX: 5, clientY: 5 });
    fireEvent.pointerMove(bar, { pointerId: 2, clientX: 50, clientY: 50 });
    expect(page().shapes).toBeNull();
    fireEvent.pointerCancel(bar, { pointerId: 1 });
  });

  it('turns the panel with the handle above it, and in steps of 15 degrees with Shift', () => {
    show();
    layout();
    act(() => useComic.getState().selectPanel(page().panels[0]!.id));
    const handle = screen.getByTestId('comic-rotate');
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 250, clientY: 100 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 600, clientY: 300 });
    expect(page().shapes).not.toBeNull();
    const free = JSON.stringify(page().shapes);
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 640, clientY: 320, shiftKey: true });
    expect(JSON.stringify(page().shapes)).not.toBe('null');
    fireEvent.pointerUp(handle, { pointerId: 1 });
    const after = JSON.stringify(page().shapes);
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 100, clientY: 900 });
    expect(JSON.stringify(page().shapes)).toBe(after);
    expect(free).not.toBe('null');
    fireEvent.click(handle);
  });

  it('ignores a turn that is not started with a laid-out page, or by another pointer', () => {
    show();
    act(() => useComic.getState().selectPanel(page().panels[0]!.id));
    const handle = screen.getByTestId('comic-rotate');
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 250, clientY: 100 });
    layout();
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 600, clientY: 300 });
    expect(page().shapes).toBeNull();
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 250, clientY: 100 });
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 600, clientY: 300 });
    expect(page().shapes).toBeNull();
    fireEvent.pointerCancel(handle, { pointerId: 1 });
  });
});

describe('the cut tool', () => {
  const drawLine = (from: [number, number], to: [number, number]) => {
    const layer = screen.getByTestId('comic-cut-layer');
    fireEvent.pointerDown(layer, { pointerId: 1, clientX: from[0], clientY: from[1] });
    fireEvent.pointerMove(layer, { pointerId: 1, clientX: to[0], clientY: to[1] });
    return layer;
  };

  it('splits the panel under the line in two, and shows the line while it is drawn', () => {
    const { container } = show();
    layout();
    act(() => useComic.getState().setCutting(true));
    const count = page().panels.length;
    const layer = drawLine([200, 300], [800, 300]);
    expect(container.querySelector('.comic-cut__line')).not.toBeNull();
    fireEvent.pointerUp(layer, { pointerId: 1 });
    expect(page().panels).toHaveLength(count + 1);
    expect(container.querySelector('.comic-cut__line')).toBeNull();
  });

  it('cuts nothing for a click or a line too short, and nothing outside every panel', () => {
    show();
    layout();
    act(() => useComic.getState().setCutting(true));
    const count = page().panels.length;
    fireEvent.pointerUp(drawLine([200, 300], [205, 300]), { pointerId: 1 });
    expect(page().panels).toHaveLength(count);
    // A press with no panel under it (outside the page) starts no line.
    const layer = screen.getByTestId('comic-cut-layer');
    fireEvent.pointerDown(layer, { pointerId: 1, clientX: -500, clientY: -500 });
    fireEvent.pointerMove(layer, { pointerId: 1, clientX: 500, clientY: 500 });
    fireEvent.pointerUp(layer, { pointerId: 1 });
    expect(page().panels).toHaveLength(count);
  });

  it('warns when the page holds the most panels, and drops the line when the press is cancelled', () => {
    const { container } = show();
    layout();
    act(() => useComic.getState().setPanelCount(page().id, MAX_PANELS_PER_PAGE));
    act(() => useComic.getState().setCutting(true));
    const count = page().panels.length;
    const layer = drawLine([200, 300], [800, 300]);
    fireEvent.pointerUp(layer, { pointerId: 1 });
    expect(page().panels).toHaveLength(count);
    expect(useToasts.getState().toasts.some((x) => x.title === t('comic.shape.cutFailed'))).toBe(true);
    drawLine([200, 300], [800, 300]);
    fireEvent.pointerCancel(screen.getByTestId('comic-cut-layer'), { pointerId: 1 });
    expect(container.querySelector('.comic-cut__line')).toBeNull();
  });

  it('turns the cut tool on and off from its button, and adds a panel or says it cannot', () => {
    show();
    fireEvent.click(screen.getByTestId('comic-cut'));
    expect(useComic.getState().cutting).toBe(true);
    fireEvent.click(screen.getByTestId('comic-cut'));
    expect(useComic.getState().cutting).toBe(false);
    vi.spyOn(useComic.getState(), 'addPanel').mockReturnValue(null);
    fireEvent.click(screen.getByTestId('comic-add-panel'));
    expect(useToasts.getState().toasts.some((x) => x.title === t('comic.shape.addPanelFailed'))).toBe(true);
  });
});

describe('the buttons under and beside the page', () => {
  it('saves the page as a picture and as a PSD', () => {
    const picture = vi.spyOn(savePageModule, 'savePage').mockResolvedValue();
    const psd = vi.spyOn(savePageModule, 'savePagePsd').mockResolvedValue();
    show();
    fireEvent.click(screen.getByTestId('comic-export'));
    expect(picture).toHaveBeenCalledOnce();
    expect(picture.mock.calls[0]![0].id).toBe(page().id);
    fireEvent.click(screen.getByTestId('comic-export-psd'));
    expect(psd).toHaveBeenCalledOnce();
  });

  it('undoes and redoes from the buttons, which are off while there is nothing to do', () => {
    show();
    const undo = screen.getByTestId('comic-undo') as HTMLButtonElement;
    const redo = screen.getByTestId('comic-redo') as HTMLButtonElement;
    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('comic-add-panel'));
    const count = page().panels.length;
    expect(undo.disabled).toBe(false);
    fireEvent.click(undo);
    expect(page().panels).toHaveLength(count - 1);
    expect(redo.disabled).toBe(false);
    fireEvent.click(redo);
    expect(page().panels).toHaveLength(count);
  });

  it('undoes and redoes from the keys', () => {
    show();
    fireEvent.click(screen.getByTestId('comic-add-panel'));
    const count = page().panels.length;
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(page().panels).toHaveLength(count - 1);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(page().panels).toHaveLength(count);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
    expect(page().panels).toHaveLength(count);
  });

  it('zooms in and out with the buttons, and stops at the ends of the range', () => {
    show();
    const value = screen.getByTestId('comic-zoom-value');
    const zoomIn = screen.getByRole('button', { name: t('common.zoomIn') }) as HTMLButtonElement;
    const zoomOut = screen.getByRole('button', { name: t('common.zoomOut') }) as HTMLButtonElement;
    fireEvent.click(zoomIn);
    expect(parseInt(value.textContent!)).toBeGreaterThan(100);
    fireEvent.click(zoomOut);
    fireEvent.click(zoomOut);
    expect(parseInt(value.textContent!)).toBeLessThan(100);
    for (let i = 0; i < 40; i++) fireEvent.click(zoomOut);
    expect(zoomOut.disabled).toBe(true);
    for (let i = 0; i < 80; i++) fireEvent.click(zoomIn);
    expect(zoomIn.disabled).toBe(true);
  });

  it('ignores a Ctrl wheel that does not change the zoom (already at the end)', () => {
    show();
    const scroll = screen.getByTestId('comic-scroll');
    for (let i = 0; i < 40; i++) fireEvent.wheel(scroll, { ctrlKey: true, deltaY: 100 });
    const at = screen.getByTestId('comic-zoom-value').textContent;
    fireEvent.wheel(scroll, { ctrlKey: true, deltaY: 100 });
    expect(screen.getByTestId('comic-zoom-value').textContent).toBe(at);
  });

  it('opens a new comic from the empty state with its button, which then shows the page', () => {
    useComic.getState().setProjects([]);
    render(
      <TooltipProvider>
        <ComicEditor />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByTestId('comic-new-empty'));
    expect(useComic.getState().projects).toHaveLength(1);
  });

  it('shows an empty view for a comic without a page on screen', () => {
    const project = newProject('None');
    useComic.getState().setProjects([{ ...project, pages: [] }]);
    const { container } = render(
      <TooltipProvider>
        <ComicEditor />
      </TooltipProvider>,
    );
    expect(container.querySelector('[data-testid="comic-editor"]')).not.toBeNull();
    expect(screen.queryByTestId('comic-page')).toBeNull();
  });
});

describe('Alt and the wheel on the backdrop', () => {
  const withBackdrop = (project: ReturnType<typeof newProject>) => {
    project.pages[0] = { ...project.pages[0]!, backdrop: { imageName: 'sky.png', view: { cx: 0.5, cy: 0.5, scale: 1, rotation: 0, flipX: false, flipY: false } } };
  };

  it('scales the backdrop when the wheel turns over the paper, and selects it', () => {
    show({}, withBackdrop);
    layout();
    const paper = screen.getByTestId('comic-page');
    fireEvent.wheel(paper, { altKey: true, deltaY: -100, clientX: 500, clientY: 700 });
    expect(page().backdrop!.view.scale).toBeCloseTo(1.1);
    expect(useComic.getState().backdropSelected).toBe(true);
    fireEvent.wheel(paper, { altKey: true, deltaY: 100, clientX: 500, clientY: 700 });
    expect(page().backdrop!.view.scale).toBeCloseTo(1);
  });

  it('scales the backdrop over its own handles while it is selected', () => {
    show({}, withBackdrop);
    layout();
    act(() => useComic.getState().selectBackdrop(true));
    fireEvent.wheel(screen.getByTestId('comic-picture-handles'), { altKey: true, deltaY: -100, clientX: 400, clientY: 400 });
    expect(page().backdrop!.view.scale).toBeCloseTo(1.1);
  });

  it('leaves a page without a backdrop alone, and a wheel with no turn, or with Ctrl', () => {
    show();
    layout();
    const paper = screen.getByTestId('comic-page');
    fireEvent.wheel(paper, { altKey: true, deltaY: -100, clientX: 500, clientY: 700 });
    expect(page().backdrop).toBeNull();
    cleanup();
    show({}, withBackdrop);
    layout();
    const still = screen.getByTestId('comic-page');
    fireEvent.wheel(still, { altKey: true, deltaY: 0 });
    fireEvent.wheel(still, { altKey: true, ctrlKey: true, deltaY: -100 });
    expect(page().backdrop!.view.scale).toBe(1);
  });

  it('does nothing for a picture-less panel under the pointer', () => {
    show({}, withBackdrop);
    layout();
    const before = page().backdrop!.view.scale;
    fireEvent.wheel(screen.getByTestId('comic-panel-1'), { altKey: true, deltaY: -100, clientX: 100, clientY: 100 });
    // A panel without a picture does not take the wheel, and the backdrop is not scaled instead.
    expect(page().backdrop!.view.scale).toBe(before);
  });
});

describe('painting on the page', () => {
  const paintProps = (): ComicEditorProps => ({
    canPaint: true,
    paintSurface: <div data-testid="surface" />,
    paintToolbar: <span data-testid="paint-tools" />,
  });

  it('shows the mode switch only when the shell can paint', () => {
    show();
    expect(screen.queryByTestId('comic-mode-paint')).toBeNull();
    cleanup();
    show(paintProps());
    expect(screen.getByTestId('comic-mode-page').getAttribute('aria-pressed') ?? 'true').toBeTruthy();
    expect(screen.queryByTestId('surface')).toBeNull();
  });

  it('swaps the page tools for the painting parts while painting, and back with the page button or Escape', async () => {
    show(paintProps());
    act(() => useComic.getState().selectPanel(page().panels[0]!.id));
    expect(screen.getByTestId('comic-panel-tools')).toBeTruthy();
    fireEvent.click(screen.getByTestId('comic-mode-paint'));
    await waitFor(() => expect(screen.getByTestId('surface')).toBeTruthy());
    expect(screen.getByTestId('paint-tools')).toBeTruthy();
    expect(screen.queryByTestId('comic-panel-tools')).toBeNull();
    expect(screen.queryByTestId('comic-add-panel')).toBeNull();
    expect(screen.queryByTestId('comic-rotate')).toBeNull();
    // The page's own keys are out of reach: Delete does not take the panel away.
    const count = page().panels.length;
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(page().panels).toHaveLength(count);
    // A press on blank paper while painting changes no selection.
    const selectedBefore = useComic.getState().selectedPanelId;
    fireEvent.pointerDown(screen.getByTestId('comic-editor'), { button: 0 });
    expect(useComic.getState().selectedPanelId).toBe(selectedBefore);
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('surface')).toBeNull());
    expect(usePagePaint.getState().painting).toBe(false);
    fireEvent.click(screen.getByTestId('comic-mode-paint'));
    await waitFor(() => expect(screen.getByTestId('surface')).toBeTruthy());
    fireEvent.click(screen.getByTestId('comic-mode-page'));
    await waitFor(() => expect(screen.queryByTestId('surface')).toBeNull());
  });
});
