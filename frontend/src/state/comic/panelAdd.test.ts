// Adding a panel (over the page, or by cutting one in half), sliding an edge of a panel, and the balloon editor beside the page.
import { beforeEach, describe, expect, it } from 'vitest';
import { newBubble, newProject } from './document';
import { MAX_PANELS_PER_PAGE, frameOutlines, pageAspect, pageShapes } from './layout';
import { allValid, halvingLines, mergeShapes, moveEdge, shapeArea, shapeBox, type Shape } from './shapes';
import { useComic } from './store';

const aspect = pageAspect('A4');

function reset() {
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, selectedPanelId: null, selectedBubbleId: null, bubbleEditor: false, cutting: false, pending: {}, past: [], future: [] });
}

/** A project with one page of `panels` panels laid out automatically in one column, read left to right. */
function seed(panels: number) {
  const project = newProject('P');
  const blank = project.pages[0]!.panels[0]!;
  project.pages[0] = { ...project.pages[0]!, direction: 'ltr', columns: 1, panels: Array.from({ length: panels }, (_, i) => ({ ...blank, id: `panel-${i}` })) };
  useComic.getState().setProjects([project]);
  return project.pages[0]!;
}

const current = () => useComic.getState().projects[0]!.pages[0]!;

beforeEach(reset);

describe('halvingLines', () => {
  const wide: Shape = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.2 }, { x: 0, y: 0.2 }];
  const tall: Shape = [{ x: 0, y: 0 }, { x: 0.2, y: 0 }, { x: 0.2, y: 1 }, { x: 0, y: 1 }];

  it('cuts a wide panel with an upright line through its middle first, and a level one second', () => {
    const [first, second] = halvingLines(wide, aspect);
    expect(first![0].x).toBeCloseTo(0.5);
    expect(first![1].x).toBeCloseTo(0.5);
    expect(second![0].y).toBeCloseTo(0.1);
  });

  it('cuts a tall panel with a level line first', () => {
    const [first] = halvingLines(tall, aspect);
    expect(first![0].y).toBeCloseTo(0.5);
    expect(first![1].y).toBeCloseTo(0.5);
  });
});

describe('moveEdge', () => {
  // Two panels, one above the other, sharing the level line at y 0.5.
  const page: Shape[] = [
    [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.5 }, { x: 0.1, y: 0.5 }],
    [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }],
  ];

  it('slides a shared edge for both panels, keeping the page whole', () => {
    const moved = moveEdge(page, 0, 2, { x: 0, y: 0.1 })!;
    expect(moved).not.toBeNull();
    expect(shapeBox(moved[0]!).height).toBeCloseTo(0.5);
    expect(shapeBox(moved[1]!).height).toBeCloseTo(0.3);
    expect(allValid(moved)).toBe(true);
  });

  it('refuses a slide that would turn a panel inside out', () => {
    expect(moveEdge(page, 0, 2, { x: 0, y: 0.5 })).toBeNull();
  });

  it('refuses an edge that does not exist', () => {
    expect(moveEdge(page, 5, 0, { x: 0, y: 0.1 })).toBeNull();
  });
});

describe('addPanel', () => {
  it('leaves a page of one big panel as it is drawn and lays the new panel over it, selected', () => {
    const page = seed(1);
    const drawn = frameOutlines(current());
    const id = useComic.getState().addPanel(page.id);
    expect(id).not.toBeNull();
    expect(current().panels.map((p) => p.id)).toEqual(['panel-0', id]);
    expect(current().free).toBe(true);
    expect(current().shapes![0]).toEqual(drawn[0]);
    expect(frameOutlines(current())[0]).toEqual(drawn[0]);
    expect(useComic.getState().selectedPanelId).toBe(id);
  });

  it('keeps every panel of a reshaped page, as one undo step', () => {
    const page = seed(2);
    useComic.getState().splitPanel(page.id, 0, { x: 0.3, y: -1 }, { x: 0.3, y: 2 });
    const before = pageShapes(current());
    useComic.getState().addPanel(page.id);
    expect(pageShapes(current()).slice(0, 3)).toEqual(before);
    expect(current().panels).toHaveLength(4);
    useComic.getState().undo();
    expect(current().panels).toHaveLength(3);
    expect(current().free).toBe(false);
  });

  it('adds nothing to a full page', () => {
    const page = seed(MAX_PANELS_PER_PAGE);
    expect(useComic.getState().addPanel(page.id)).toBeNull();
    expect(current().panels).toHaveLength(MAX_PANELS_PER_PAGE);
  });
});

describe('halvePanel', () => {
  it('cuts the largest panel in half when none is given, and selects the new one', () => {
    const page = seed(2);
    useComic.getState().splitPanel(page.id, 0, { x: 0.3, y: -1 }, { x: 0.3, y: 2 });
    const before = pageShapes(current());
    const largest = before.reduce((best, s, i) => (shapeArea(s) > shapeArea(before[best]!) ? i : best), 0);
    const id = useComic.getState().halvePanel(page.id, null);
    expect(id).not.toBeNull();
    expect(current().panels).toHaveLength(4);
    expect(current().panels[largest + 1]!.id).toBe(id);
    expect(useComic.getState().selectedPanelId).toBe(id);
    const after = pageShapes(current());
    expect(shapeArea(after[largest]!)).toBeCloseTo(shapeArea(before[largest]!) / 2, 3);
  });

  it('cuts the given panel, as one undo step', () => {
    const page = seed(3);
    useComic.getState().halvePanel(page.id, 2);
    expect(current().panels).toHaveLength(4);
    useComic.getState().undo();
    expect(current().panels).toHaveLength(3);
  });

  it('adds nothing to a full page', () => {
    const page = seed(MAX_PANELS_PER_PAGE);
    expect(useComic.getState().halvePanel(page.id, 0)).toBeNull();
    expect(current().panels).toHaveLength(MAX_PANELS_PER_PAGE);
  });
});

describe('the store moveEdge', () => {
  it('stops the slide at the page margin and says how far it went', () => {
    const page = seed(2);
    const top = pageShapes(current())[0]!;
    // The top edge of the first panel, slid far up: it only reaches the margin.
    const edge = top.findIndex((p, i) => p.y === Math.min(...top.map((q) => q.y)) && top[(i + 1) % top.length]!.y === p.y);
    const moved = useComic.getState().moveEdge(page.id, 0, edge, { x: 0, y: -0.5 });
    expect(moved).not.toBeNull();
    expect(moved!.y).toBe(0);
    expect(moved!.y).toBeGreaterThanOrEqual(-0.5);
  });

  it('moves a shared edge, and the panels stay a valid page', () => {
    const page = seed(2);
    const shape = pageShapes(current())[0]!;
    const bottom = shape.findIndex((p, i) => p.y === Math.max(...shape.map((q) => q.y)) && shape[(i + 1) % shape.length]!.y === p.y);
    const moved = useComic.getState().moveEdge(page.id, 0, bottom, { x: 0, y: 0.05 });
    expect(moved).toEqual({ x: 0, y: 0.05 });
    expect(allValid(current().shapes!)).toBe(true);
  });
});

describe('the balloon editor', () => {
  function withBubbles() {
    const page = seed(2);
    const a = newBubble('speech', 0.1, 0.1);
    const b = newBubble('caption', 0.5, 0.5);
    useComic.setState({
      projects: useComic.getState().projects.map((p) => ({ ...p, pages: p.pages.map((pg) => ({ ...pg, panels: pg.panels.map((pn, i) => (i === 0 ? { ...pn, bubbles: [a, b] } : pn)) })) })),
    });
    return { page, a, b };
  }

  it('opens on a balloon, follows another balloon, and closes when no balloon is chosen', () => {
    const { a, b } = withBubbles();
    useComic.getState().openBubbleEditor('panel-0', a.id);
    expect(useComic.getState()).toMatchObject({ bubbleEditor: true, selectedPanelId: 'panel-0', selectedBubbleId: a.id });
    useComic.getState().selectBubble(b.id);
    expect(useComic.getState()).toMatchObject({ bubbleEditor: true, selectedBubbleId: b.id });
    useComic.getState().selectBubble(null);
    expect(useComic.getState().bubbleEditor).toBe(false);
  });

  it('closes when another panel is chosen or its balloon is removed', () => {
    const { a } = withBubbles();
    useComic.getState().openBubbleEditor('panel-0', a.id);
    useComic.getState().selectPanel('panel-1');
    expect(useComic.getState().bubbleEditor).toBe(false);
    useComic.getState().openBubbleEditor('panel-0', a.id);
    useComic.getState().removeBubble('panel-0', a.id);
    expect(useComic.getState().bubbleEditor).toBe(false);
  });

  it('closes by itself and keeps the balloon chosen', () => {
    const { a } = withBubbles();
    useComic.getState().openBubbleEditor('panel-0', a.id);
    useComic.getState().closeBubbleEditor();
    expect(useComic.getState()).toMatchObject({ bubbleEditor: false, selectedBubbleId: a.id });
  });
});

describe('removePanel', () => {
  it('deletes a panel of an automatic page and lays the rest out again', () => {
    const page = seed(3);
    expect(useComic.getState().removePanel(page.id, 1)).toBe(true);
    expect(current().panels.map((p) => p.id)).toEqual(['panel-0', 'panel-2']);
    expect(current().shapes).toBeNull();
    useComic.getState().undo();
    expect(current().panels).toHaveLength(3);
  });

  it('gives the area of a panel on a reshaped page to its nearest neighbour, keeping the page whole', () => {
    const page = seed(3);
    useComic.getState().halvePanel(page.id, 2);
    const before = pageShapes(current());
    expect(current().shapes).not.toBeNull();
    useComic.setState({ selectedPanelId: 'panel-0' });
    expect(useComic.getState().removePanel(page.id, 0)).toBe(true);
    const after = pageShapes(current());
    expect(after).toHaveLength(before.length - 1);
    expect(allValid(after)).toBe(true);
    expect(after.reduce((sum, s) => sum + shapeArea(s), 0)).toBeCloseTo(before.reduce((sum, s) => sum + shapeArea(s), 0), 4);
    expect(useComic.getState().selectedPanelId).toBeNull();
  });

  it('keeps the last panel and refuses a panel that is not there', () => {
    const page = seed(1);
    expect(useComic.getState().removePanel(page.id, 0)).toBe(false);
    const two = seed(2);
    expect(useComic.getState().removePanel(two.id, 5)).toBe(false);
    expect(current().panels).toHaveLength(2);
  });
});

describe('mergeShapes', () => {
  const left: Shape = [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 1 }, { x: 0, y: 1 }];
  const right: Shape = [{ x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.5, y: 1 }];

  it('joins two panels that share an edge into one, whichever way each runs round', () => {
    const joined = mergeShapes(left, [...right].reverse())!;
    expect(joined).toHaveLength(4);
    expect(shapeArea(joined)).toBeCloseTo(1);
  });

  it('refuses panels that only touch at a corner or are apart', () => {
    const corner: Shape = [{ x: 0.5, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1.5 }, { x: 0.5, y: 1.5 }];
    expect(mergeShapes(left, corner)).toBeNull();
    expect(mergeShapes(left, [{ x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 2, y: 1 }])).toBeNull();
  });
});
