import { beforeEach, describe, expect, it } from 'vitest';
import { newProject, type ComicPoint } from './document';
import { pageAspect, pageShapes, templateShapes } from './layout';
import { shapeArea, type Shape } from './shapes';
import { useComic } from './store';
import { BUILTIN_SHAPE_LAYOUTS } from './templates';

const aspect = pageAspect('A4');
const layout = (id: string) => templateShapes(BUILTIN_SHAPE_LAYOUTS.find((l) => l.id === id)!.shapes, aspect, 'ltr');
const pt = (x: number, y: number): ComicPoint => ({ x, y });

function reset() {
  useComic.setState({
    projects: [],
    activeProjectId: null,
    activePageId: null,
    selectedPanelId: null,
    selectedBubbleId: null,
    cutting: false,
    pending: {},
    past: [],
    future: [],
  });
}

/** A project with one page of `panels` panels, each named by its prompt, the page read left to right. */
function seed(panels: number) {
  const project = newProject('P');
  const blank = project.pages[0]!.panels[0]!;
  project.pages[0] = {
    ...project.pages[0]!,
    direction: 'ltr',
    panels: Array.from({ length: panels }, (_, i) => ({ ...blank, id: `panel-${i}`, prompt: `prompt ${i}` })),
  };
  useComic.getState().setProjects([project]);
  return project.pages[0]!;
}

const current = () => useComic.getState().projects[0]!.pages[0]!;

beforeEach(reset);

describe('applying a shape layout', () => {
  it('takes the panel count from the shapes and keeps them on the page', () => {
    const page = seed(1);
    const shapes = layout('diagonal');
    useComic.getState().applyPageLayout(page.id, { panelCount: 0, columns: 2, direction: 'ltr', size: 'A4', shapes });
    expect(current().panels).toHaveLength(2);
    expect(current().shapes).toEqual(shapes);
    expect(current().panels.map((p) => p.prompt)).toEqual(['prompt 0', '']);
  });

  it('returns a page with no shapes to the automatic layout when the layout has none', () => {
    const page = seed(2);
    useComic.getState().applyPageLayout(page.id, { panelCount: 3, columns: 1, direction: 'ltr', size: 'A4', shapes: null });
    expect(current().shapes).toBeNull();
    expect(current().panels).toHaveLength(3);
  });
});

describe('cutting a panel', () => {
  it('makes a new empty panel after the cut one, and the two parts make the panel', () => {
    const page = seed(2);
    useComic.getState().applyPageLayout(page.id, { panelCount: 2, columns: 2, direction: 'ltr', size: 'A4', shapes: layout('strips').slice(0, 2) });
    const before = pageShapes(current())[0]!;
    expect(useComic.getState().splitPanel(page.id, 0, pt(0.2, 0), pt(0.2, 1))).toBe(true);
    expect(current().panels.map((p) => p.prompt)).toEqual(['prompt 0', '', 'prompt 1']);
    const shapes = current().shapes!;
    expect(shapes).toHaveLength(3);
    expect(shapes.reduce((total, s) => total + shapeArea(s), 0)).toBeCloseTo(shapeArea(before) + shapeArea(pageShapes(current())[2]!), 6);
  });

  it('cuts an automatic page as its rectangles, and refuses a line that misses the panel', () => {
    const page = seed(1);
    expect(useComic.getState().splitPanel(page.id, 0, pt(2, 0), pt(2, 1))).toBe(false);
    expect(current().shapes).toBeNull();
    expect(useComic.getState().splitPanel(page.id, 0, pt(0.5, 0), pt(0.5, 1))).toBe(true);
    expect(current().shapes).toHaveLength(2);
  });

  it('does not add a panel past the most a page holds', () => {
    const page = seed(24);
    expect(useComic.getState().splitPanel(page.id, 0, pt(0.5, 0), pt(0.5, 1))).toBe(false);
    expect(current().panels).toHaveLength(24);
  });
});

describe('moving the corners of a panel', () => {
  it('moves a corner that two panels share for both, and keeps the page valid', () => {
    const page = seed(2);
    useComic.getState().applyPageLayout(page.id, { panelCount: 2, columns: 2, direction: 'ltr', size: 'A4', shapes: layout('diagonal') });
    // The corner where the diagonal meets the right edge: the first panel's third corner and the second's second.
    expect(useComic.getState().moveCorner(page.id, 0, 2, pt(0.9, 0.3))).toBe(true);
    expect(current().shapes![0]![2]).toEqual(pt(0.9, 0.3));
    expect(current().shapes![1]![1]).toEqual(pt(0.9, 0.3));
  });

  it('refuses a move that makes a panel cross itself, and changes nothing', () => {
    const page = seed(2);
    useComic.getState().applyPageLayout(page.id, { panelCount: 2, columns: 2, direction: 'ltr', size: 'A4', shapes: layout('diagonal') });
    const before = current().shapes;
    // The first panel's last corner moved onto its first corner: two corners in one place.
    expect(useComic.getState().moveCorner(page.id, 0, 3, pageShapes0()[0]!)).toBe(false);
    expect(current().shapes).toBe(before);
  });

  it('adds a corner on an edge of a page that is still automatic, and removes it again', () => {
    const page = seed(2);
    // The right edge of the top panel: a point on it adds a straight corner, which can go again.
    expect(useComic.getState().insertCorner(page.id, 0, 1, pt(0.97, 0.2))).toBe(true);
    expect(current().shapes![0]).toHaveLength(5);
    expect(useComic.getState().removeCorner(page.id, 0, 2)).toBe(true);
    expect(current().shapes![0]).toHaveLength(4);
    // A rectangle's corner is bent, so it stays.
    expect(useComic.getState().removeCorner(page.id, 0, 0)).toBe(false);
  });

  it('takes one undo step for the moves of one drag', () => {
    const page = seed(2);
    useComic.getState().applyPageLayout(page.id, { panelCount: 2, columns: 2, direction: 'ltr', size: 'A4', shapes: layout('diagonal') });
    const before = current().shapes;
    useComic.getState().moveCorner(page.id, 0, 2, pt(0.9, 0.3));
    useComic.getState().moveCorner(page.id, 0, 2, pt(0.8, 0.35));
    useComic.getState().undo();
    expect(current().shapes).toEqual(before);
  });
});

describe('changing a reshaped page', () => {
  it('goes back to the automatic layout when the panel count changes', () => {
    const page = seed(2);
    useComic.getState().applyPageLayout(page.id, { panelCount: 2, columns: 2, direction: 'ltr', size: 'A4', shapes: layout('diagonal') });
    useComic.getState().setPanelCount(page.id, 3);
    expect(current().shapes).toBeNull();
    expect(current().panels).toHaveLength(3);
  });

  it('goes back to the automatic layout when the columns change, and keeps the shapes for a new paper', () => {
    const page = seed(2);
    useComic.getState().applyPageLayout(page.id, { panelCount: 2, columns: 2, direction: 'ltr', size: 'A4', shapes: layout('diagonal') });
    useComic.getState().setPageLayout(page.id, { size: 'B4' });
    expect(current().shapes).not.toBeNull();
    useComic.getState().setPageLayout(page.id, { columns: 1 });
    expect(current().shapes).toBeNull();
  });

  it('flips the shapes when the reading direction changes', () => {
    const page = seed(2);
    useComic.getState().applyPageLayout(page.id, { panelCount: 2, columns: 2, direction: 'ltr', size: 'A4', shapes: layout('bands').slice(0, 2) });
    const before = current().shapes![0]![0]!;
    useComic.getState().setPageLayout(page.id, { direction: 'rtl' });
    expect(current().shapes![0]![0]!.x).toBeCloseTo(1 - before.x);
    expect(current().shapes![0]![0]!.y).toBeCloseTo(before.y);
  });

  it('swaps the shapes with the panels, so each panel keeps its place in the swap', () => {
    const page = seed(2);
    const shapes = layout('diagonal');
    useComic.getState().applyPageLayout(page.id, { panelCount: 2, columns: 2, direction: 'ltr', size: 'A4', shapes });
    useComic.getState().swapPanels(page.id, 0, 1);
    expect(current().panels.map((p) => p.prompt)).toEqual(['prompt 1', 'prompt 0']);
    expect(current().shapes).toEqual([shapes[1], shapes[0]]);
  });

  it('goes back to the automatic layout on a reset, which can be undone', () => {
    const page = seed(2);
    const shapes = layout('diagonal');
    useComic.getState().applyPageLayout(page.id, { panelCount: 2, columns: 2, direction: 'ltr', size: 'A4', shapes });
    useComic.getState().resetPageShapes(page.id);
    expect(current().shapes).toBeNull();
    useComic.getState().undo();
    expect(current().shapes).toEqual(shapes);
  });
});

describe('page templates with shapes', () => {
  it('saves the shapes of a page, and applying the template brings them back', () => {
    const page = seed(2);
    const shapes = layout('diagonal');
    useComic.getState().applyPageLayout(page.id, { panelCount: 2, columns: 2, direction: 'ltr', size: 'A4', shapes });
    const id = useComic.getState().savePageTemplate(page.id, 'Cut')!;
    useComic.getState().resetPageShapes(page.id);
    const saved = useComic.getState().projects[0]!.pageTemplates.find((t) => t.id === id)!;
    expect(saved.shapes).toEqual(shapes);
    useComic.getState().applyPageLayout(page.id, { panelCount: saved.panelCount, columns: saved.columns, direction: saved.direction, size: saved.size, shapes: saved.shapes });
    expect(current().shapes).toEqual(shapes);
  });

  it('turns cutting on and off without touching the project', () => {
    const before = useComic.getState().projects;
    useComic.getState().setCutting(true);
    expect(useComic.getState().cutting).toBe(true);
    useComic.getState().setCutting(false);
    expect(useComic.getState().projects).toBe(before);
  });
});

/** The first panel's shape of the page as it is now (for a move onto its own corner). */
function pageShapes0(): Shape {
  return current().shapes![0]!;
}
