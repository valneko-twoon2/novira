import { beforeEach, describe, expect, it } from 'vitest';
import { newProject } from './document';
import { activePage, findPanel, useComic } from './store';

/** One project with one page, open. */
function seed() {
  const project = newProject('A');
  useComic.getState().setProjects([project]);
  return project;
}

beforeEach(() => {
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, selectedPanelId: null, selectedBubbleId: null, pending: {} });
});

describe('the comic store: page layout and balloons', () => {
  it('sets the columns and the reading direction of a page, and keeps the rest of it', () => {
    const project = seed();
    const page = project.pages[0]!.id;
    useComic.getState().setPageLayout(page, { columns: 3 });
    useComic.getState().setPageLayout(page, { direction: 'ltr' });
    expect(activePage(useComic.getState())).toMatchObject({ columns: 3, direction: 'ltr' });
    expect(activePage(useComic.getState())!.panels).toHaveLength(project.pages[0]!.panels.length);
  });

  it('adds each kind of balloon with its default tail, size and writing direction', () => {
    const project = seed();
    const panel = project.pages[0]!.panels[0]!.id;
    const speech = useComic.getState().addBubble(panel, 'speech')!;
    const caption = useComic.getState().addBubble(panel, 'caption')!;
    const bubbles = findPanel(useComic.getState().projects, panel)!.panel.bubbles;
    expect(bubbles.find((b) => b.id === speech)).toMatchObject({ kind: 'speech', tail: { x: 0.08, y: 1.18 }, scale: 1, vertical: false });
    expect(bubbles.find((b) => b.id === caption)).toMatchObject({ kind: 'caption', tail: null });
  });

  it('changes the tail, size, writing direction and kind of a balloon', () => {
    const project = seed();
    const panel = project.pages[0]!.panels[0]!.id;
    const bubble = useComic.getState().addBubble(panel, 'speech')!;
    useComic.getState().updateBubble(panel, bubble, { kind: 'shout', tail: { x: 1.4, y: -0.3 }, scale: 1.7, vertical: true });
    expect(findPanel(useComic.getState().projects, panel)!.panel.bubbles[0]).toMatchObject({
      kind: 'shout',
      tail: { x: 1.4, y: -0.3 },
      scale: 1.7,
      vertical: true,
    });
  });

  it('adds a balloon with the look of a preset, and the look its shape starts with', () => {
    const project = seed();
    const panel = project.pages[0]!.panels[0]!.id;
    const whisper = useComic.getState().addBubble(panel, 'speech', { line: 'dashed' })!;
    const flash = useComic.getState().addBubble(panel, 'flash')!;
    const bubbles = findPanel(useComic.getState().projects, panel)!.panel.bubbles;
    expect(bubbles.find((b) => b.id === whisper)).toMatchObject({ kind: 'speech', line: 'dashed', rough: 0.4, outline: null });
    expect(bubbles.find((b) => b.id === flash)).toMatchObject({ kind: 'flash', line: 'none', tail: null, spikes: 72 });
  });

  it('keeps every change of a balloon in range', () => {
    const project = seed();
    const panel = project.pages[0]!.panels[0]!.id;
    const bubble = useComic.getState().addBubble(panel, 'shout')!;
    useComic.getState().updateBubble(panel, bubble, { lineWidth: 50, rough: 3, width: 0.1, spikes: 2.4, depth: -1, tailCurve: 9 });
    expect(findPanel(useComic.getState().projects, panel)!.panel.bubbles[0]).toMatchObject({ lineWidth: 4, rough: 1, width: 0.6, spikes: 3, depth: 0, tailCurve: 1 });
  });

  it('shows the points of the selected balloon only, until another balloon or none is chosen', () => {
    const project = seed();
    const panel = project.pages[0]!.panels[0]!.id;
    const a = useComic.getState().addBubble(panel, 'speech')!;
    const b = useComic.getState().addBubble(panel, 'speech')!;
    useComic.getState().openBubbleEditor(panel, a);
    useComic.getState().setBubbleShaping(true);
    expect(useComic.getState().bubbleShaping).toBe(true);
    // The same balloon chosen again keeps its points on show.
    useComic.getState().selectBubble(a);
    expect(useComic.getState().bubbleShaping).toBe(true);
    useComic.getState().selectBubble(b);
    expect(useComic.getState().bubbleShaping).toBe(false);
    useComic.getState().setBubbleShaping(true);
    useComic.getState().closeBubbleEditor();
    expect(useComic.getState().bubbleShaping).toBe(false);
    // With no balloon selected there is nothing to shape.
    useComic.getState().selectBubble(null);
    useComic.getState().setBubbleShaping(true);
    expect(useComic.getState().bubbleShaping).toBe(false);
  });
});

describe('a balloon just added goes to the middle of its panel', () => {
  const bubble = (panelId: string, id: string) => findPanel(useComic.getState().projects, panelId)!.panel.bubbles.find((b) => b.id === id)!;

  it('once the screen gives its size, as part of the step that added it', () => {
    const panelId = seed().pages[0]!.panels[0]!.id;
    const id = useComic.getState().addBubble(panelId, 'speech')!;
    expect(useComic.getState().centeringBubbleId).toBe(id);
    useComic.getState().centerBubble(panelId, id, 0.4, 0.2);
    expect(bubble(panelId, id)).toMatchObject({ x: 0.3, y: 0.4 });
    expect(useComic.getState().centeringBubbleId).toBeNull();
    // Measured again later, it stays where it is now.
    useComic.getState().centerBubble(panelId, id, 0.1, 0.1);
    expect(bubble(panelId, id)).toMatchObject({ x: 0.3, y: 0.4 });
    useComic.getState().undo();
    expect(findPanel(useComic.getState().projects, panelId)!.panel.bubbles).toHaveLength(0);
  });

  it('keeps a balloon bigger than its panel at the panel corner', () => {
    const panelId = seed().pages[0]!.panels[0]!.id;
    const id = useComic.getState().addBubble(panelId, 'speech')!;
    useComic.getState().centerBubble(panelId, id, 1.5, Number.NaN);
    expect(bubble(panelId, id)).toMatchObject({ x: 0, y: 0.5 });
  });

  it('but not one given its own place, when it is added or before it is drawn', () => {
    const panelId = seed().pages[0]!.panels[0]!.id;
    useComic.getState().addBubble(panelId, 'speech', { x: 0.7, y: 0.1 });
    expect(useComic.getState().centeringBubbleId).toBeNull();
    const id = useComic.getState().addBubble(panelId, 'caption')!;
    useComic.getState().updateBubble(panelId, id, { x: 0.2 });
    useComic.getState().centerBubble(panelId, id, 0.4, 0.2);
    expect(bubble(panelId, id).x).toBe(0.2);
  });
});
