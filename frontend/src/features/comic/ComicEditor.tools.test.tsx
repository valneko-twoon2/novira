// @vitest-environment jsdom
// The page view's newer tools: adding a panel from the toolbar, the bars that slide an edge of the selected panel, and the
// balloon editor that a double click opens beside the page.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '@/i18n';
import { newProject } from '@/state/comic/document';
import { BALLOON_PRESETS, presetLabel } from './BalloonPreview';
import { frameOutlines } from '@/state/comic/layout';
import { useComic } from '@/state/comic/store';
import { loadAppFonts } from '@/state/fonts';
import { TooltipProvider } from '@/ui';
import { ComicEditor } from './ComicEditor';

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
  // The slant slider measures itself.
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  // jsdom has no pointer capture, which a press on a balloon asks for.
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
});
beforeEach(() => setLocale('en'));
afterEach(() => {
  cleanup();
  setLocale('ja');
});

describe('adding and reshaping panels', () => {
  it('adds a panel from the toolbar and selects it', () => {
    const project = newProject('Add');
    useComic.getState().setProjects([project]);
    renderEditor();
    fireEvent.click(screen.getByTestId('comic-add-panel'));
    const page = useComic.getState().projects[0]!.pages[0]!;
    expect(page.panels).toHaveLength(project.pages[0]!.panels.length + 1);
    expect(page.panels.some((p) => p.id === useComic.getState().selectedPanelId)).toBe(true);
  });

  it('shows a bar on each edge of the selected panel only', () => {
    const project = newProject('Edges');
    useComic.getState().setProjects([project]);
    renderEditor();
    expect(screen.queryAllByTestId('comic-edge')).toHaveLength(0);
    act(() => useComic.getState().selectPanel(project.pages[0]!.panels[0]!.id));
    expect(screen.getAllByTestId('comic-edge')).toHaveLength(4);
    expect(screen.getAllByTestId('comic-corner')).toHaveLength(4);
  });
});

describe('placing panels freely', () => {
  it('has no switch for it: the cut tool works on every page, and no panel has a grip', () => {
    const project = newProject('Free');
    useComic.getState().setProjects([project]);
    renderEditor();
    expect(screen.queryByTestId('comic-free')).toBeNull();
    expect(screen.queryByTestId('comic-panel-grip')).toBeNull();
    act(() => useComic.getState().setPageFree(project.pages[0]!.id, true));
    expect((screen.getByTestId('comic-cut') as HTMLButtonElement).disabled).toBe(false);
  });

  it('hides the handles of a panel whose balloon is selected, and frames the balloon instead', () => {
    const project = newProject('Balloon');
    useComic.getState().setProjects([project]);
    const panelId = project.pages[0]!.panels[1]!.id;
    renderEditor();
    act(() => useComic.getState().selectPanel(panelId));
    expect(screen.getByTestId('comic-rotate')).toBeTruthy();
    expect(screen.queryByTestId('comic-bubble-selection')).toBeNull();
    act(() => void useComic.getState().addBubble(panelId, 'speech'));
    expect(screen.queryByTestId('comic-rotate')).toBeNull();
    expect(screen.getByTestId('comic-bubble-selection')).toBeTruthy();
    act(() => useComic.getState().selectBubble(null));
    expect(screen.getByTestId('comic-rotate')).toBeTruthy();
    expect(screen.queryByTestId('comic-bubble-selection')).toBeNull();
  });

  it('shows the turn handle for the selected panel, and carries a panel of a new page that is pressed anywhere', () => {
    const project = newProject('Handle');
    useComic.getState().setProjects([project]);
    renderEditor();
    expect(screen.queryByTestId('comic-rotate')).toBeNull();
    act(() => useComic.getState().selectPanel(project.pages[0]!.panels[1]!.id));
    expect(screen.getByTestId('comic-rotate')).toBeTruthy();
    // jsdom lays nothing out, so the page is given a size for the pointer's distance to become a share of it.
    const page = screen.getByTestId('comic-page');
    page.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1414, right: 1000, bottom: 1414, x: 0, y: 0 }) as DOMRect;
    const panel = screen.getByTestId('comic-panel-2');
    fireEvent.pointerDown(panel, { pointerId: 1, clientX: 600, clientY: 900 });
    // A press that does not move is a click: the panel stays where it is, and the page keeps its automatic layout.
    fireEvent.pointerMove(panel, { pointerId: 1, buttons: 1, clientX: 601, clientY: 900 });
    expect(useComic.getState().projects[0]!.pages[0]).toMatchObject({ free: false, shapes: null });
    const before = frameOutlines(useComic.getState().projects[0]!.pages[0]!)[1]![0]!;
    fireEvent.pointerMove(panel, { pointerId: 1, buttons: 1, clientX: 500, clientY: 800 });
    fireEvent.pointerUp(panel, { pointerId: 1 });
    const after = useComic.getState().projects[0]!.pages[0]!.shapes![1]![0]!;
    expect(after.x).toBeCloseTo(before.x - 0.1, 2);
    expect(after.y).toBeCloseTo(before.y - 100 / 1414, 2);
    expect(useComic.getState().projects[0]!.pages[0]!.free).toBe(true);
  });

  it('lets a panel run partly off the page when it is carried there', () => {
    const project = newProject('Off');
    useComic.getState().setProjects([project]);
    renderEditor();
    const page = screen.getByTestId('comic-page');
    page.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1414, right: 1000, bottom: 1414, x: 0, y: 0 }) as DOMRect;
    const panel = screen.getByTestId('comic-panel-2');
    fireEvent.pointerDown(panel, { pointerId: 1, clientX: 600, clientY: 900 });
    fireEvent.pointerMove(panel, { pointerId: 1, buttons: 1, clientX: 1400, clientY: 900 });
    fireEvent.pointerUp(panel, { pointerId: 1 });
    const shape = useComic.getState().projects[0]!.pages[0]!.shapes![1]!;
    expect(Math.max(...shape.map((p) => p.x))).toBeGreaterThan(1);
  });
});

describe('deleting and letting go', () => {
  it('deletes the selected panel from the toolbar, and the button waits for a selection', () => {
    const project = newProject('Delete');
    useComic.getState().setProjects([project]);
    renderEditor();
    const button = screen.getByTestId('comic-delete') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    act(() => useComic.getState().selectPanel(project.pages[0]!.panels[0]!.id));
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-label')).toBe(t('comic.shape.removePanel'));
    fireEvent.click(button);
    expect(useComic.getState().projects[0]!.pages[0]!.panels).toHaveLength(project.pages[0]!.panels.length - 1);
    expect(useComic.getState().selectedPanelId).toBeNull();
  });

  it('has one trash button, which takes away the selected balloon, then the picture, then the panel', () => {
    const project = newProject('One trash');
    useComic.getState().setProjects([project]);
    const panelId = project.pages[0]!.panels[0]!.id;
    act(() => useComic.getState().setPanelImage(panelId, 'cat.png'));
    renderEditor();
    expect(screen.getAllByTestId('comic-delete')).toHaveLength(1);
    expect(screen.queryByTestId('comic-image-clear')).toBeNull();
    const button = () => screen.getByTestId('comic-delete');
    const panel = () => useComic.getState().projects[0]!.pages[0]!.panels[0]!;
    act(() => {
      const bubbleId = useComic.getState().addBubble(panelId, 'speech')!;
      useComic.getState().selectPanel(panelId);
      useComic.getState().selectBubble(bubbleId);
    });
    expect(button().getAttribute('aria-label')).toBe(t('comic.bubble.remove'));
    fireEvent.click(button());
    expect(panel().bubbles).toHaveLength(0);
    act(() => useComic.getState().selectImage(panelId));
    expect(button().getAttribute('aria-label')).toBe(t('comic.panel.imageClear'));
    fireEvent.click(button());
    expect(panel().imageName).toBeNull();
    // Taking the picture out leaves its panel selected; the next press takes the panel.
    expect(button().getAttribute('aria-label')).toBe(t('comic.shape.removePanel'));
    fireEvent.click(button());
    expect(useComic.getState().projects[0]!.pages[0]!.panels).toHaveLength(2);
  });

  it('keeps the last panel of a page', () => {
    const project = newProject('Last');
    useComic.getState().setProjects([project]);
    act(() => useComic.getState().setPanelCount(project.pages[0]!.id, 1));
    renderEditor();
    act(() => useComic.getState().selectPanel(useComic.getState().projects[0]!.pages[0]!.panels[0]!.id));
    expect((screen.getByTestId('comic-delete') as HTMLButtonElement).disabled).toBe(true);
  });

  it('lets go of the selected panel when a blank part of the view is pressed, and not when a panel is', () => {
    const project = newProject('Blank');
    useComic.getState().setProjects([project]);
    const id = project.pages[0]!.panels[0]!.id;
    renderEditor();
    act(() => useComic.getState().selectPanel(id));
    fireEvent.pointerDown(screen.getByTestId('comic-panel-1'));
    expect(useComic.getState().selectedPanelId).toBe(id);
    fireEvent.pointerDown(screen.getByTestId('comic-page'));
    expect(useComic.getState().selectedPanelId).toBeNull();
    act(() => useComic.getState().selectPanel(id));
    fireEvent.pointerDown(screen.getByTestId('comic-scroll'));
    expect(useComic.getState().selectedPanelId).toBeNull();
  });

  it('lets go of a panel chosen after another one, and does not go back to the first', () => {
    const project = newProject('Two');
    useComic.getState().setProjects([project]);
    const [first, second] = project.pages[0]!.panels;
    renderEditor();
    fireEvent.pointerDown(screen.getByTestId('comic-panel-1'), { button: 0, pointerId: 1 });
    fireEvent.pointerDown(screen.getByTestId('comic-panel-2'), { button: 0, pointerId: 1 });
    expect(useComic.getState().selectedPanelId).toBe(second!.id);
    fireEvent.pointerDown(screen.getByTestId('comic-scroll'), { button: 0 });
    expect(useComic.getState().selectedPanelId).toBeNull();
    expect(useComic.getState().selectedPanelId).not.toBe(first!.id);
  });

  it('selects the backdrop when the page outside the panels is pressed, and Delete takes it off', () => {
    const project = newProject('Backdrop');
    useComic.getState().setProjects([project]);
    const pageId = project.pages[0]!.id;
    act(() => useComic.getState().setBackdrop(pageId, 'sky.png'));
    renderEditor();
    fireEvent.pointerDown(screen.getByTestId('comic-page'), { button: 0 });
    expect(useComic.getState().backdropSelected).toBe(true);
    expect(screen.getByTestId('comic-delete').getAttribute('aria-label')).toBe(t('comic.backdrop.clear'));
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(useComic.getState().projects[0]!.pages[0]!.backdrop).toBeNull();
    // With no backdrop, the same press only lets go.
    fireEvent.pointerDown(screen.getByTestId('comic-page'), { button: 0 });
    expect(useComic.getState().backdropSelected).toBe(false);
  });
});

describe('the balloon editor', () => {
  function withBalloon() {
    const project = newProject('Balloon');
    useComic.getState().setProjects([project]);
    const panelId = project.pages[0]!.panels[0]!.id;
    const bubbleId = useComic.getState().addBubble(panelId, 'speech')!;
    useComic.getState().updateBubble(panelId, bubbleId, { text: 'Hello' });
    useComic.getState().selectPanel(null);
    return { panelId, bubbleId };
  }

  it('opens beside the page on a double click and edits the balloon there', () => {
    const { panelId, bubbleId } = withBalloon();
    renderEditor();
    expect(screen.queryByTestId('comic-bubble-editor')).toBeNull();
    fireEvent.pointerDown(screen.getByTestId('comic-bubble'));
    expect(screen.queryByTestId('comic-bubble-editor')).toBeNull();
    fireEvent.doubleClick(screen.getByTestId('comic-bubble'));
    const editor = screen.getByTestId('comic-bubble-editor');
    fireEvent.change(screen.getByRole('textbox', { name: t('comic.bubble.text') }), { target: { value: 'Bye' } });
    expect(useComic.getState().projects[0]!.pages[0]!.panels[0]!.bubbles[0]!.text).toBe('Bye');
    expect(useComic.getState()).toMatchObject({ selectedPanelId: panelId, selectedBubbleId: bubbleId });
    expect(editor.closest('.comic-page')).toBeNull();
  });

  it('makes the selected words bold or dotted, and shows them so on the page', () => {
    withBalloon();
    renderEditor();
    fireEvent.doubleClick(screen.getByTestId('comic-bubble'));
    const field = screen.getByRole('textbox', { name: t('comic.bubble.text') }) as HTMLTextAreaElement;
    field.setSelectionRange(0, 2);
    fireEvent.click(screen.getByTestId('comic-bubble-bold'));
    const words = () => useComic.getState().projects[0]!.pages[0]!.panels[0]!.bubbles[0]!.text;
    expect(words()).toBe('**He**llo');
    field.setSelectionRange(8, 9);
    fireEvent.click(screen.getByTestId('comic-bubble-dots'));
    expect(words()).toBe('**He**ll《《o》》');
    const shown = screen.getByTestId('comic-bubble').querySelector('.comic-bubble__text')!;
    expect(shown.textContent).toBe('Hello');
    expect(shown.querySelector('.is-bold')?.textContent).toBe('He');
    expect(shown.querySelector('.is-dots')?.textContent).toBe('o');
  });

  it('sets the size by a slider and the font from the list, and the page shows the font', async () => {
    const { panelId, bubbleId } = withBalloon();
    renderEditor();
    fireEvent.doubleClick(screen.getByTestId('comic-bubble'));
    expect(screen.getByRole('slider', { name: t('comic.bubble.size') })).toBeTruthy();
    act(() => useComic.getState().updateBubble(panelId, bubbleId, { scale: 1.45 }));
    expect(useComic.getState().projects[0]!.pages[0]!.panels[0]!.bubbles[0]!.scale).toBe(1.45);
    fireEvent.click(screen.getByTestId('comic-bubble-font'));
    fireEvent.click(await screen.findByText('Shippori Mincho'));
    expect(useComic.getState().projects[0]!.pages[0]!.panels[0]!.bubbles[0]!.font).toBe('Shippori Mincho');
    expect((screen.getByTestId('comic-bubble') as HTMLElement).style.fontFamily).toContain('Shippori Mincho');
  });

  it('offers a slant and no tail for a sound effect, and the slant turns the lettering on the page', () => {
    const { panelId, bubbleId } = withBalloon();
    renderEditor();
    fireEvent.doubleClick(screen.getByTestId('comic-bubble'));
    expect(screen.getByTestId('comic-bubble-tail-toggle')).toBeTruthy();
    expect(screen.queryByRole('slider', { name: t('comic.bubble.rotation') })).toBeNull();
    act(() => useComic.getState().updateBubble(panelId, bubbleId, { kind: 'sfx', tail: null, rotation: 30 }));
    expect(screen.queryByTestId('comic-bubble-tail-toggle')).toBeNull();
    expect(screen.getByRole('slider', { name: t('comic.bubble.rotation') })).toBeTruthy();
    expect((screen.getByTestId('comic-bubble') as HTMLElement).style.transform).toBe('rotate(30deg)');
  });

  it('lies over the board panel when there is one wide enough, and stays by the page otherwise', () => {
    const { panelId, bubbleId } = withBalloon();
    const board = document.createElement('div');
    board.className = 'workspace__right';
    board.getBoundingClientRect = () => ({ width: 400 }) as DOMRect;
    document.body.append(board);
    try {
      renderEditor();
      act(() => useComic.getState().openBubbleEditor(panelId, bubbleId));
      expect(screen.getByTestId('comic-bubble-editor').parentElement).toBe(board);
      expect(document.querySelector('.comic-stage')?.classList.contains('has-editor')).toBe(false);
      cleanup();
      board.getBoundingClientRect = () => ({ width: 100 }) as DOMRect;
      renderEditor();
      act(() => useComic.getState().openBubbleEditor(panelId, bubbleId));
      expect(screen.getByTestId('comic-bubble-editor').parentElement?.classList.contains('comic-stage')).toBe(true);
    } finally {
      board.remove();
    }
  });

  it('closes on Escape in its text and on its close button, keeping the balloon chosen', () => {
    const { panelId, bubbleId } = withBalloon();
    renderEditor();
    act(() => useComic.getState().openBubbleEditor(panelId, bubbleId));
    fireEvent.keyDown(screen.getByRole('textbox', { name: t('comic.bubble.text') }), { key: 'Escape' });
    expect(screen.queryByTestId('comic-bubble-editor')).toBeNull();
    expect(useComic.getState().selectedBubbleId).toBe(bubbleId);
    act(() => useComic.getState().openBubbleEditor(panelId, bubbleId));
    fireEvent.click(screen.getByTestId('comic-bubble-editor-close'));
    expect(screen.queryByTestId('comic-bubble-editor')).toBeNull();
  });

  it('lists the balloons in the toolbar without their fields, and opens the editor from the list', async () => {
    const { panelId } = withBalloon();
    act(() => useComic.getState().selectPanel(panelId));
    renderEditor();
    fireEvent.click(screen.getByTestId('comic-bubbles'));
    const row = await screen.findByTestId('comic-bubble-row');
    expect(row.textContent).toContain('Hello');
    expect(row.querySelector('input, textarea')).toBeNull();
    fireEvent.click(screen.getByTestId('comic-bubble-edit'));
    expect(screen.getByTestId('comic-bubble-editor')).toBeTruthy();
  });

  it('draws every balloon of the list as it looks, and adds the one pressed with its look', async () => {
    const project = newProject('List');
    useComic.getState().setProjects([project]);
    const panelId = project.pages[0]!.panels[0]!.id;
    act(() => useComic.getState().selectPanel(panelId));
    renderEditor();
    fireEvent.click(screen.getByTestId('comic-bubbles'));
    await screen.findByTestId('comic-add-whisper');
    for (const preset of BALLOON_PRESETS) {
      const tile = screen.getByTestId(`comic-add-${preset.id}`);
      // A balloon is drawn with its outline; lettering with no balloon shows a word instead.
      expect(tile.querySelector('.comic-balloon-preview'), preset.id).toBeTruthy();
      expect(tile.textContent, preset.id).toContain(presetLabel(preset));
    }
    expect(screen.getByTestId('comic-add-explosion').querySelectorAll('.comic-balloon__line').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('comic-add-whisper'));
    const bubble = useComic.getState().projects[0]!.pages[0]!.panels[0]!.bubbles[0]!;
    expect(bubble).toMatchObject({ kind: 'speech', line: 'dashed' });
    expect(screen.getByTestId('comic-bubble-editor')).toBeTruthy();
  });

  it('adds a sound-effect picture, shows it as a picture, and chooses another by search and by hand', async () => {
    const project = newProject('Stamp');
    useComic.getState().setProjects([project]);
    const panelId = project.pages[0]!.panels[0]!.id;
    act(() => useComic.getState().selectPanel(panelId));
    renderEditor();
    fireEvent.click(screen.getByTestId('comic-bubbles'));
    fireEvent.click(await screen.findByTestId('comic-add-stamp'));
    const bubble = () => useComic.getState().projects[0]!.pages[0]!.panels[0]!.bubbles[0]!;
    expect(bubble()).toMatchObject({ kind: 'stamp', text: 'block-doon', tail: null });
    // The balloon on the page is the picture, not words.
    const shown = screen.getByTestId('comic-bubble').querySelector('img');
    expect(shown?.getAttribute('src')).toMatch(/block-doon.*.webp$/);
    // The editor offers the pictures instead of a text box; a search narrows them and a press chooses one.
    expect(screen.getByTestId('comic-stamp-picker')).toBeTruthy();
    expect(screen.queryByTestId('comic-bubble-vertical')).toBeNull();
    const all = screen.getAllByTestId('comic-stamp-tile').length;
    fireEvent.change(screen.getByPlaceholderText(t('comic.stamp.search')), { target: { value: 'ざわ' } });
    const found = screen.getAllByTestId('comic-stamp-tile');
    expect(found.length).toBeGreaterThan(0);
    expect(found.length).toBeLessThan(all);
    fireEvent.click(found[0]!);
    expect(bubble().text).toBe('block-zawa');
    fireEvent.click(screen.getByTestId('comic-stamp-style-burst'));
    fireEvent.click(screen.getAllByTestId('comic-stamp-tile')[0]!);
    expect(bubble().text.startsWith('burst-')).toBe(true);
  });

  it('shapes the outline freely by its points, and puts the shape back', () => {
    const { panelId, bubbleId } = withBalloon();
    renderEditor();
    act(() => useComic.getState().openBubbleEditor(panelId, bubbleId));
    const bubble = () => useComic.getState().projects[0]!.pages[0]!.panels[0]!.bubbles[0]!;
    expect(screen.queryAllByTestId('comic-bubble-point')).toHaveLength(0);
    fireEvent.click(screen.getByTestId('comic-bubble-shape'));
    // The outline starts as the shape's own points; the tail's handle makes way for them.
    expect(bubble().outline).toMatchObject({ smooth: true });
    expect(screen.getAllByTestId('comic-bubble-point')).toHaveLength(12);
    expect(screen.queryByTestId('comic-bubble-tail')).toBeNull();
    // jsdom lays nothing out: the balloon is given a box for the pointer to be measured against.
    const balloon = screen.getByTestId('comic-bubble');
    balloon.getBoundingClientRect = () => ({ left: 100, top: 100, width: 100, height: 50, right: 200, bottom: 150, x: 100, y: 100 }) as DOMRect;
    const point = screen.getAllByTestId('comic-bubble-point')[0]!;
    fireEvent.pointerDown(point, { pointerId: 1 });
    fireEvent.pointerMove(point, { pointerId: 1, clientX: 150, clientY: 60 });
    fireEvent.pointerUp(point, { pointerId: 1 });
    const moved = bubble().outline!.points[0]!;
    expect(moved.x).toBeCloseTo(0.5);
    expect(moved.y).toBeLessThan(0);
    // A double click on a point removes it; one on the balloon adds a point.
    fireEvent.doubleClick(screen.getAllByTestId('comic-bubble-point')[1]!);
    expect(bubble().outline!.points).toHaveLength(11);
    fireEvent.doubleClick(balloon, { clientX: 200, clientY: 125 });
    expect(bubble().outline!.points).toHaveLength(12);
    fireEvent.click(screen.getByTestId('comic-bubble-smooth'));
    expect(bubble().outline!.smooth).toBe(false);
    fireEvent.click(screen.getByTestId('comic-bubble-shape-reset'));
    expect(bubble().outline).toBeNull();
    expect(screen.queryAllByTestId('comic-bubble-point')).toHaveLength(0);
  });

  it('changes the line and the fill, and gives a new shape its own spikes', () => {
    const { panelId, bubbleId } = withBalloon();
    renderEditor();
    act(() => useComic.getState().openBubbleEditor(panelId, bubbleId));
    fireEvent.click(screen.getByTestId('comic-bubble-dark'));
    const bubble = () => useComic.getState().projects[0]!.pages[0]!.panels[0]!.bubbles[0]!;
    expect(bubble().dark).toBe(true);
    expect(screen.getByTestId('comic-bubble').classList.contains('is-dark')).toBe(true);
    // A speech balloon has no spikes to count; a shout has.
    expect(screen.queryByRole('slider', { name: t('comic.bubble.spikes') })).toBeNull();
    act(() => useComic.getState().updateBubble(panelId, bubbleId, { kind: 'shout' }));
    expect(screen.getByRole('slider', { name: t('comic.bubble.spikes') })).toBeTruthy();
  });
});
