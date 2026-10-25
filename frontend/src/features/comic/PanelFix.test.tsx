// @vitest-environment jsdom
// Redrawing a part of the selected panel's picture: the toolbar button starts the marking, the brush paints on the surface
// over the panel, Redraw queues it and ends the marking, and choosing another panel ends it too.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/i18n';
import { newProject, type ComicPanel } from '@/state/comic/document';
import { useComicFix } from '@/state/comic/fixState';
import { findPanel, useComic } from '@/state/comic/store';
import { TooltipProvider } from '@/ui';
import { PanelFixBar, PanelFixButton, PanelFixLayer } from './PanelFix';

const redrawPart = vi.hoisted(() => vi.fn(async () => true));
vi.mock('@/state/comic/generate', () => ({ redrawPart }));

const panel = (): ComicPanel => findPanel(useComic.getState().projects, 'panel-0')!.panel;
const BOX = { x: 0, y: 0, width: 0.5, height: 0.5 };

function show(selected: string | null = 'panel-0') {
  return render(
    <TooltipProvider>
      <PanelFixButton panel={panel()} />
      <PanelFixBar selectedPanelId={selected} />
      <PanelFixLayer panelId="panel-0" box={BOX} aspect={1.414} />
    </TooltipProvider>,
  );
}

/** The surface measures 200 × 200 on the screen. */
function surface() {
  const el = screen.getByTestId('comic-fix-surface');
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });
  return el;
}

beforeEach(() => {
  // The brush and strength sliders measure themselves.
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  setLocale('en');
  redrawPart.mockClear();
  useComicFix.getState().stop();
  const project = newProject('P');
  project.pages[0]!.panels = [{ ...project.pages[0]!.panels[0]!, id: 'panel-0', imageName: 'girl.png' }];
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, selectedPanelId: null, selectedBubbleId: null, pending: {} });
  useComic.getState().setProjects([project]);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setLocale('ja');
});

describe('PanelFix', () => {
  it('shows the strip and the surface only while the panel is marked', () => {
    show();
    expect(screen.queryByTestId('comic-fix-bar')).toBeNull();
    expect(screen.queryByTestId('comic-fix-surface')).toBeNull();
    fireEvent.click(screen.getByTestId('comic-fix'));
    expect(screen.getByTestId('comic-fix-bar')).toBeTruthy();
    expect(screen.getByTestId('comic-fix-surface')).toBeTruthy();
    fireEvent.click(screen.getByTestId('comic-fix-cancel'));
    expect(screen.queryByTestId('comic-fix-bar')).toBeNull();
  });

  it('paints strokes in fractions of the panel, and Redraw queues them with the words and ends the marking', async () => {
    show();
    fireEvent.click(screen.getByTestId('comic-fix'));
    expect((screen.getByTestId('comic-fix-go') as HTMLButtonElement).disabled).toBe(true);
    const el = surface();
    fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: 20, clientY: 40 });
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 100, clientY: 120 });
    fireEvent.pointerUp(el, { pointerId: 1 });
    expect(useComicFix.getState().strokes[0]!.points).toEqual([0.1, 0.2, 0.5, 0.6]);
    fireEvent.change(screen.getByTestId('comic-fix-words'), { target: { value: 'an open hand' } });
    const painted = useComicFix.getState().strokes;
    fireEvent.click(screen.getByTestId('comic-fix-go'));
    await waitFor(() => expect(redrawPart).toHaveBeenCalledWith('panel-0', { strokes: painted, boxes: [] }, expect.objectContaining({ words: 'an open hand' })));
    await waitFor(() => expect(useComicFix.getState().panelId).toBeNull());
  });

  it('keeps the marking when nothing could be queued', async () => {
    redrawPart.mockResolvedValueOnce(false);
    show();
    fireEvent.click(screen.getByTestId('comic-fix'));
    const el = surface();
    fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: 20, clientY: 40 });
    fireEvent.pointerUp(el, { pointerId: 1 });
    fireEvent.click(screen.getByTestId('comic-fix-go'));
    await waitFor(() => expect(redrawPart).toHaveBeenCalled());
    expect(useComicFix.getState().panelId).toBe('panel-0');
  });

  it('ends the marking when another panel is selected', () => {
    useComicFix.getState().start('panel-0');
    show('panel-1');
    expect(useComicFix.getState().panelId).toBeNull();
  });
});
