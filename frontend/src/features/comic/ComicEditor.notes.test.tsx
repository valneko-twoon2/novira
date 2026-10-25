// @vitest-environment jsdom
// A panel's stage direction (written in the toolbar, shown until the panel has a picture), and balloon words kept inside
// their balloon: marked when they run out, and shrunk step by step when the balloon is fitted.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/i18n';
import { BUBBLE_SCALE_RANGE, newProject } from '@/state/comic/document';
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
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
});
beforeEach(() => {
  setLocale('en');
  useComic.setState({ fittingBubbleIds: [], centeringBubbleId: null });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setLocale('ja');
});

describe('stage directions', () => {
  it('are written in the panel tools and shown in the empty panel in place of its prompt', () => {
    const project = newProject('Notes');
    useComic.getState().setProjects([project]);
    const panelId = project.pages[0]!.panels[0]!.id;
    useComic.getState().setPrompt(panelId, '1girl, kitchen');
    renderEditor();
    act(() => useComic.getState().selectPanel(panelId));
    expect(screen.getByText('1girl, kitchen')).toBeTruthy();
    fireEvent.click(screen.getByTestId('comic-note-tools'));
    fireEvent.change(screen.getByTestId('comic-note'), { target: { value: 'Night. She waits.' } });
    expect(useComic.getState().projects[0]!.pages[0]!.panels[0]!.note).toBe('Night. She waits.');
    const shown = screen.getByText('Night. She waits.', { selector: '.comic-panel__empty' });
    expect(shown.classList.contains('is-note')).toBe(true);
  });
});

describe('balloon words', () => {
  /** Lays the page out as a browser would: panels 400px, balloons 100px, words wider than their balloon. */
  function layOut() {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(100);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const wide = this.classList.contains('comic-bubble__text');
      return { left: wide ? -20 : 0, top: 0, right: wide ? 120 : 100, bottom: 100, width: wide ? 140 : 100, height: 100, x: 0, y: 0 } as DOMRect;
    });
  }

  it('are marked when they run out, and the fit button shrinks them to the smallest size', () => {
    const project = newProject('Fit');
    useComic.getState().setProjects([project]);
    const panelId = project.pages[0]!.panels[0]!.id;
    const id = useComic.getState().addBubble(panelId, 'speech', { x: 0.1, y: 0.1, text: 'A very long line' })!;
    layOut();
    renderEditor();
    const balloon = screen.getByTestId('comic-bubble');
    expect(balloon.classList.contains('is-overflowing')).toBe(true);
    act(() => useComic.getState().openBubbleEditor(panelId, id));
    fireEvent.click(screen.getByTestId('comic-bubble-fit'));
    const bubble = useComic.getState().projects[0]!.pages[0]!.panels[0]!.bubbles[0]!;
    expect(bubble.scale).toBe(BUBBLE_SCALE_RANGE.min);
    expect(useComic.getState().fittingBubbleIds).toEqual([]);
  });

  it('are left as they are when they fit', () => {
    const project = newProject('Fits');
    useComic.getState().setProjects([project]);
    const panelId = project.pages[0]!.panels[0]!.id;
    useComic.getState().addBubble(panelId, 'speech', { x: 0.1, y: 0.1, text: 'Hi' });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(100);
    renderEditor();
    expect(screen.getByTestId('comic-bubble').classList.contains('is-overflowing')).toBe(false);
  });
});
