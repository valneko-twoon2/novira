// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { setLocale, t } from '@/i18n';
import { newProject } from '@/state/comic/document';
import { pageAspect, templateShapes } from '@/state/comic/layout';
import { useComic } from '@/state/comic/store';
import { BUILTIN_SHAPE_LAYOUTS } from '@/state/comic/templates';
import { useGallery } from '@/state/gallery';
import { useToasts } from '@/state/toasts';
import { loadAppFonts } from '@/state/fonts';
import { TooltipProvider } from '@/ui';
import { ComicEditor } from './ComicEditor';
import { groupSize } from './PagePager';

// The buttons of the page view show tooltips, which need the provider the app has at its root.
function renderEditor() {
  return render(
    <TooltipProvider>
      <ComicEditor />
    </TooltipProvider>,
  );
}

// Balloons appear once the app's fonts are loaded (ComicBalloon).
beforeAll(() => loadAppFonts());
beforeAll(() => {
  // jsdom has no pointer capture, which a press on a panel asks for (a press carries the panel).
  Element.prototype.setPointerCapture ??= () => {};
});
beforeEach(() => setLocale('en'));
afterEach(() => {
  cleanup();
  setLocale('ja');
});

describe('the comic page view', () => {
  it('says that no comic is open when there is none', () => {
    useComic.getState().setProjects([]);
    renderEditor();
    expect(screen.getByText(t('comic.editor.emptyTitle'))).toBeTruthy();
  });

  it('shows the panels of the page, selects one on click and shows its balloon', () => {
    const project = newProject('Page test');
    useComic.getState().setProjects([project]);
    const { container } = renderEditor();
    const panels = screen.getAllByRole('group', { name: t('comic.panel.number', { number: 1 }) });
    expect(panels).toHaveLength(1);
    expect(container.querySelectorAll('.comic-panel')).toHaveLength(project.pages[0]!.panels.length);

    const panelId = project.pages[0]!.panels[0]!.id;
    act(() => useComic.getState().setPrompt(panelId, 'a sleeping cat'));
    expect(screen.getByText('a sleeping cat')).toBeTruthy();

    fireEvent.click(panels[0]!);
    expect(useComic.getState().selectedPanelId).toBe(panelId);

    act(() => {
      const bubbleId = useComic.getState().addBubble(panelId, 'speech')!;
      useComic.getState().updateBubble(panelId, bubbleId, { text: 'Hello' });
    });
    expect(screen.getByTestId('comic-bubble').textContent).toBe('Hello');
  });

  it('makes a new comic from the empty view', () => {
    useComic.getState().setProjects([]);
    renderEditor();
    fireEvent.click(screen.getByTestId('comic-new-empty'));
    expect(useComic.getState().projects).toHaveLength(1);
    expect(screen.getByTestId('comic-page')).toBeTruthy();
  });

  it('zooms with Ctrl and the mouse wheel, and not with the wheel alone', () => {
    useComic.getState().setProjects([newProject('Wheel')]);
    renderEditor();
    const view = screen.getByTestId('comic-scroll');
    fireEvent.wheel(view, { deltaY: -200 });
    expect(screen.getByTestId('comic-zoom-value').textContent).toBe('100%');
    fireEvent.wheel(view, { deltaY: -200, ctrlKey: true });
    expect(Number.parseInt(screen.getByTestId('comic-zoom-value').textContent ?? '', 10)).toBeGreaterThan(100);
  });

  it('zooms the page with its bar, and the reset button goes back to 100%', () => {
    useComic.getState().setProjects([newProject('Zoom test')]);
    renderEditor();
    expect(screen.getByTestId('comic-zoom-value').textContent).toBe('100%');
    fireEvent.click(screen.getByRole('button', { name: t('common.zoomIn') }));
    expect(screen.getByTestId('comic-zoom-value').textContent).toBe('150%');
    fireEvent.click(screen.getByRole('button', { name: t('comic.zoom.reset') }));
    expect(screen.getByTestId('comic-zoom-value').textContent).toBe('100%');
  });
});

describe('reshaping the page', () => {
  it('draws the frames of a reshaped page, and shows the corners of the panel that is selected', () => {
    const project = newProject('Shapes');
    const page = project.pages[0]!;
    const shapes = templateShapes(BUILTIN_SHAPE_LAYOUTS.find((l) => l.id === 'diagonal')!.shapes, pageAspect(page.size), page.direction);
    project.pages[0] = { ...page, panels: page.panels.slice(0, 2), shapes };
    useComic.getState().setProjects([project]);
    const { container } = renderEditor();
    expect(container.querySelectorAll('.comic-frames__edge')).toHaveLength(2);
    expect(screen.queryAllByTestId('comic-corner')).toHaveLength(0);

    fireEvent.click(screen.getByTestId('comic-panel-1'));
    expect(screen.getAllByTestId('comic-corner')).toHaveLength(4);
  });

  it('shows the cut layer only while the page is being cut', () => {
    useComic.getState().setProjects([newProject('Cut')]);
    renderEditor();
    expect(screen.queryByTestId('comic-cut-layer')).toBeNull();
    act(() => useComic.getState().setCutting(true));
    expect(screen.getByTestId('comic-cut-layer')).toBeTruthy();
    act(() => useComic.getState().setCutting(false));
    expect(screen.queryByTestId('comic-cut-layer')).toBeNull();
  });
});

describe('the pages under the page view', () => {
  it('opens a page from its drawing, and deletes the page on screen on the second press', () => {
    useComic.getState().setProjects([newProject('Pages')]);
    act(() => void useComic.getState().addPage());
    renderEditor();
    const pages = () => useComic.getState().projects[0]!.pages;
    // Adding a page opens it.
    expect(screen.getByTestId('comic-page-2').getAttribute('aria-pressed')).toBe('true');
    // Each page is a small drawing of its panels.
    expect(screen.getByTestId('comic-page-1').querySelectorAll('.comic-thumb__frame')).toHaveLength(3);
    fireEvent.click(screen.getByTestId('comic-page-1'));
    expect(screen.getByTestId('comic-page-1').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('comic-page-2'));
    expect(screen.getByTestId('comic-page-2').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByTestId('comic-page-delete'));
    expect(pages()).toHaveLength(2);
    expect(screen.getByTestId('comic-page-delete').getAttribute('aria-label')).toBe(t('comic.page.deleteAgain'));
    fireEvent.click(screen.getByTestId('comic-page-delete'));
    expect(pages()).toHaveLength(1);
  });

  it('fits as many page drawings as the row has room for, from one to ten', () => {
    // An A4 drawing is 56px tall, so about 40px wide with its frame, and 4px apart.
    expect(groupSize(0, pageAspect('A4'))).toBe(1);
    expect(groupSize(200, pageAspect('A4'))).toBe(4);
    expect(groupSize(10_000, pageAspect('A4'))).toBe(10);
  });

  it('shows ten pages at a time, and the arrows show the pages before and after', () => {
    useComic.getState().setProjects([newProject('Many')]);
    act(() => {
      for (let i = 0; i < 11; i++) useComic.getState().addPage();
    });
    renderEditor();
    // The twelfth page was added last, so its group is on screen: pages 11 and 12.
    const shown = () => screen.getAllByTestId(/^comic-page-\d+$/).map((el) => el.dataset.testid);
    expect(shown()).toEqual(['comic-page-11', 'comic-page-12']);
    expect((screen.getByTestId('comic-page-group-next') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('comic-page-group-prev'));
    expect(shown()).toHaveLength(10);
    expect(shown()[0]).toBe('comic-page-1');
    expect((screen.getByTestId('comic-page-group-prev') as HTMLButtonElement).disabled).toBe(true);
    // Showing another group does not change the page on screen; opening a page there does.
    expect(useComic.getState().activePageId).toBe(useComic.getState().projects[0]!.pages[11]!.id);
    fireEvent.click(screen.getByTestId('comic-page-3'));
    expect(useComic.getState().activePageId).toBe(useComic.getState().projects[0]!.pages[2]!.id);
  });

  it('lists the pages of a comic read from the right from the right, with the later pages behind the left arrow', () => {
    const order = () => [...screen.getByTestId('comic-pager').children].map((el) => el.getAttribute('data-testid'));
    const project = newProject('Manga');
    useComic.getState().setProjects([{ ...project, pages: project.pages.map((p) => ({ ...p, direction: 'rtl' })) }]);
    const view = renderEditor();
    expect(screen.getByTestId('comic-pager-list').classList.contains('is-rtl')).toBe(true);
    expect(order().slice(0, 3)).toEqual(['comic-page-group-next', 'comic-pager-list', 'comic-page-group-prev']);
    view.unmount();
    useComic.getState().setProjects([{ ...project, pages: project.pages.map((p) => ({ ...p, direction: 'ltr' })) }]);
    renderEditor();
    expect(screen.getByTestId('comic-pager-list').classList.contains('is-rtl')).toBe(false);
    expect(order().slice(0, 3)).toEqual(['comic-page-group-prev', 'comic-pager-list', 'comic-page-group-next']);
  });
});

describe('the frame of the panels', () => {
  it('draws three rings in each panel, as wide as the page settings say', () => {
    const project = newProject('Frame');
    useComic.getState().setProjects([project]);
    const { container } = renderEditor();
    const rings = (panel: number) => container.querySelectorAll(`[data-testid="comic-panel-${panel}"] .comic-panel__ring`);
    expect(rings(1)).toHaveLength(3);
    const widthOf = (el: Element) => Number.parseFloat((el as SVGElement).style.strokeWidth);
    const before = widthOf(rings(1)[1]!);
    act(() => useComic.getState().setPageLayout(project.pages[0]!.id, { frameMm: 2, insetMm: 5 }));
    expect(widthOf(rings(1)[1]!)).toBeGreaterThan(before);
    expect(widthOf(rings(1)[0]!)).toBeGreaterThan(widthOf(rings(1)[1]!));
    expect(widthOf(rings(1)[2]!)).toBeLessThan(widthOf(rings(1)[1]!));
  });

  it('draws the frame line in the colour the page settings say', () => {
    const project = newProject('Colour');
    useComic.getState().setProjects([project]);
    const { container } = renderEditor();
    const line = () => container.querySelector('[data-testid="comic-panel-1"] .comic-panel__ring.is-line') as SVGElement;
    expect(line().style.stroke).toBe('rgb(0, 0, 0)');
    act(() => useComic.getState().setPageLayout(project.pages[0]!.id, { frameColor: '#3366FF' }));
    expect(useComic.getState().projects[0]!.pages[0]!.frameColor).toBe('#3366ff');
    expect(line().style.stroke).toBe('rgb(51, 102, 255)');
    act(() => useComic.getState().setPageLayout(project.pages[0]!.id, { frameColor: 'red' }));
    expect(useComic.getState().projects[0]!.pages[0]!.frameColor).toBe('#000000');
  });
});

describe('the page templates', () => {
  it('applies a template on a press, and waits for a second press when it drops panels', () => {
    const project = newProject('Templates');
    useComic.getState().setProjects([project]);
    const pageId = project.pages[0]!.id;
    act(() => useComic.getState().setPanelCount(pageId, 6));
    renderEditor();
    const panels = () => useComic.getState().projects[0]!.pages[0]!.panels;
    fireEvent.click(screen.getByTestId('comic-page-templates'));
    const four = () => screen.getAllByTestId('comic-page-template').find((el) => el.dataset.template === 'builtin:four')!;
    fireEvent.click(four());
    expect(panels()).toHaveLength(6);
    expect(four().textContent).toBe(t('comic.template.applyAgain'));
    fireEvent.click(four());
    expect(panels()).toHaveLength(4);

    // A template with more panels applies at once, and gives the panels its shapes.
    fireEvent.click(screen.getByTestId('comic-page-templates'));
    fireEvent.click(screen.getAllByTestId('comic-page-template').find((el) => el.dataset.template === 'shape:stagger')!);
    expect(panels()).toHaveLength(5);
    expect(useComic.getState().projects[0]!.pages[0]!.shapes).toHaveLength(5);
  });
});

describe('the picture in a panel', () => {
  function withPicture() {
    const project = newProject('Picture');
    useComic.getState().setProjects([project]);
    useGallery.setState({ images: [{ name: 'cat.png', url: 'novira://cat.png' } as ImageDTO] });
    const panelId = project.pages[0]!.panels[0]!.id;
    act(() => useComic.getState().setPanelImage(panelId, 'cat.png'));
    return panelId;
  }
  const panelOf = (id: string) => useComic.getState().projects[0]!.pages[0]!.panels.find((p) => p.id === id)!;
  /** Presses the picture with Alt held, which takes the picture rather than its panel (jsdom has no pointer capture, so the picture gets a stand-in). */
  const pressPicture = (altKey = true) => {
    const picture = screen.getByTestId('comic-panel-image');
    picture.setPointerCapture = vi.fn();
    fireEvent.pointerDown(picture, { button: 0, pointerId: 1, altKey });
  };

  it('shows its handles when it is pressed with Alt or double-clicked, and its tools in the toolbar', () => {
    withPicture();
    renderEditor();
    expect(screen.queryByTestId('comic-picture-handles')).toBeNull();
    // A press without Alt is the panel's: it only selects the panel.
    pressPicture(false);
    expect(screen.queryByTestId('comic-picture-handles')).toBeNull();
    fireEvent.doubleClick(screen.getByTestId('comic-panel-image'));
    expect(screen.getByTestId('comic-picture-handles')).toBeTruthy();
    act(() => useComic.getState().selectPanel(null));
    pressPicture();
    expect(screen.getByTestId('comic-picture-handles')).toBeTruthy();
    expect(screen.getAllByTestId('comic-picture-corner')).toHaveLength(4);
    expect(screen.getByTestId('comic-image-flip-x')).toBeTruthy();
  });

  it('turns and mirrors it from the toolbar', () => {
    const panelId = withPicture();
    renderEditor();
    pressPicture();
    fireEvent.click(screen.getByTestId('comic-image-rotate-right'));
    fireEvent.click(screen.getByTestId('comic-image-flip-x'));
    expect(panelOf(panelId).imageView).toMatchObject({ rotation: 90, flipX: true });
    fireEvent.click(screen.getByTestId('comic-image-cover'));
    expect(panelOf(panelId).imageView).toMatchObject({ rotation: 0, scale: 1, cx: 0.5, cy: 0.5, flipX: true });
  });

  it('takes the selected picture out of its panel with Delete, and the notice puts it back', () => {
    const panelId = withPicture();
    useToasts.setState({ toasts: [] });
    renderEditor();
    act(() => useComic.getState().setPanelImageView(panelId, { scale: 0.5 }));
    pressPicture();
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(panelOf(panelId).imageName).toBeNull();
    const notice = useToasts.getState().toasts.at(-1)!;
    expect(notice.title).toBe(t('comic.image.removed'));
    act(() => notice.actions![0]!.run());
    expect(panelOf(panelId)).toMatchObject({ imageName: 'cat.png', imageView: { scale: 0.5 } });
  });

  it('takes the panel away, picture and all, when Delete is pressed with only the panel selected, and undo brings it back', () => {
    const panelId = withPicture();
    renderEditor();
    act(() => useComic.getState().selectPanel(panelId));
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(useComic.getState().projects[0]!.pages[0]!.panels).toHaveLength(2);
    act(() => useComic.getState().undo());
    expect(panelOf(panelId).imageName).toBe('cat.png');
  });

  it('scales the picture under the pointer with Alt and the mouse wheel, keeping the point under the pointer', () => {
    const panelId = withPicture();
    renderEditor();
    const panel = screen.getByTestId('comic-panel-1');
    panel.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0 }) as DOMRect;
    // Over the panel's left quarter, a turn of the wheel away from the user enlarges the picture about that point.
    fireEvent.wheel(screen.getByTestId('comic-panel-image'), { deltaY: -100, altKey: true, clientX: 100, clientY: 150 });
    const view = panelOf(panelId).imageView;
    expect(view.scale).toBeCloseTo(1.1);
    expect(view.cx).toBeCloseTo(0.25 + (0.5 - 0.25) * 1.1);
    expect(view.cy).toBeCloseTo(0.5);
    expect(useComic.getState()).toMatchObject({ imageSelected: true, selectedPanelId: panelId });
    // Without Alt the wheel leaves the picture alone.
    fireEvent.wheel(screen.getByTestId('comic-panel-image'), { deltaY: 100, clientX: 100, clientY: 150 });
    expect(panelOf(panelId).imageView.scale).toBeCloseTo(1.1);
  });
});
