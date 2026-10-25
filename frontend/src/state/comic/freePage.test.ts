// A page whose panels are placed freely: turning it on and off, moving and turning a panel, and what each tiling operation does there.
import { beforeEach, describe, expect, it } from 'vitest';
import { newProject, parseComicProject, serializeComicProject } from './document';
import { rotateShape, translateShape } from './freeShapes';
import { frameOutlines, pageAspect, pageShapes } from './layout';
import { shapeArea } from './shapes';
import { useComic } from './store';

const aspect = pageAspect('A4');

function reset() {
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, selectedPanelId: null, selectedBubbleId: null, bubbleEditor: false, cutting: false, pending: {}, past: [], future: [] });
}

/** A project with one page of three panels, made free. */
function seedFree() {
  const project = newProject('P');
  useComic.getState().setProjects([project]);
  useComic.getState().setPageFree(project.pages[0]!.id, true);
  return current();
}

const current = () => useComic.getState().projects[0]!.pages[0]!;

beforeEach(reset);

describe('turning free placement on and off', () => {
  it('keeps the shapes the panels have when it goes on, and lays the page out again when it goes off', () => {
    const project = newProject('P');
    useComic.getState().setProjects([project]);
    // The panels keep the rectangles they are drawn with, so nothing moves.
    const before = frameOutlines(project.pages[0]!);
    useComic.getState().setPageFree(project.pages[0]!.id, true);
    expect(current()).toMatchObject({ free: true, shapes: before });
    useComic.getState().setPageFree(project.pages[0]!.id, false);
    expect(current()).toMatchObject({ free: false, shapes: null });
    useComic.getState().undo();
    expect(current().free).toBe(true);
  });

  it('is left again by anything that lays the page out: a new panel count, new columns, a layout or a reset', () => {
    const free = () => {
      const page = seedFree();
      return page.id;
    };
    let id = free();
    useComic.getState().setPanelCount(id, 4);
    expect(current()).toMatchObject({ free: false, shapes: null });
    reset();
    id = free();
    useComic.getState().setPageLayout(id, { columns: 3 });
    expect(current().free).toBe(false);
    reset();
    id = free();
    useComic.getState().resetPageShapes(id);
    expect(current()).toMatchObject({ free: false, shapes: null });
    reset();
    id = free();
    const page = current();
    useComic.getState().applyPageLayout(id, { panelCount: 3, columns: 2, direction: page.direction, size: page.size });
    expect(current().free).toBe(false);
  });

  it('is saved and read back, and only a page with shapes can be free', () => {
    seedFree();
    const doc = serializeComicProject(useComic.getState().projects[0]!) as Record<string, unknown>;
    expect(parseComicProject(doc)!.pages[0]!.free).toBe(true);
    const stale = { ...doc, pages: [{ ...(doc.pages as Record<string, unknown>[])[0], shapes: null }] };
    expect(parseComicProject(stale)!.pages[0]!.free).toBe(false);
  });
});

describe('moving and turning a panel', () => {
  it('moves one panel only, which may then lie over another, and a whole drag is one undo step', () => {
    const page = seedFree();
    const [first, second] = page.shapes!;
    // The second panel is a half-width one in the bottom row (the page is read from the right).
    const target = translateShape(second!, { x: -0.1, y: -0.1 })!;
    expect(useComic.getState().setFreeShape(page.id, 1, target, 'carry')).toBe(true);
    expect(useComic.getState().setFreeShape(page.id, 1, translateShape(second!, { x: -0.2, y: -0.1 })!, 'carry')).toBe(true);
    expect(current().shapes![0]).toEqual(first);
    expect(current().shapes![1]![0]!.x).toBeCloseTo(second![0]!.x - 0.2);
    // It now lies over the first panel, which a tiled page would not allow.
    expect(current().shapes![1]![0]!.y).toBeLessThan(first![2]!.y);
    useComic.getState().undo();
    expect(current().shapes![1]).toEqual(second);
  });

  it('turns a panel by any angle and keeps its size', () => {
    const page = seedFree();
    const start = page.shapes![1]!;
    const turned = rotateShape(start, (37 * Math.PI) / 180, aspect)!;
    useComic.getState().setFreeShape(page.id, 1, turned, 'turn');
    const stored = current().shapes![1]!;
    expect(shapeArea(stored.map((p) => ({ x: p.x, y: p.y * aspect })))).toBeCloseTo(shapeArea(start.map((p) => ({ x: p.x, y: p.y * aspect }))), 6);
    expect(stored).not.toEqual(start);
  });

  it('makes a page free when a panel of it is moved, in the same undo step as the move', () => {
    const project = newProject('P');
    useComic.getState().setProjects([project]);
    const page = project.pages[0]!;
    const moved = translateShape(pageShapes(page)[0]!, { x: 0.05, y: 0.02 })!;
    expect(useComic.getState().setFreeShape(page.id, 0, moved)).toBe(true);
    expect(current().free).toBe(true);
    expect(current().shapes![0]).toEqual(moved);
    // The other panels keep the places they had in the automatic layout.
    expect(current().shapes!.slice(1)).toEqual(frameOutlines(page).slice(1));
    useComic.getState().undo();
    expect(current()).toMatchObject({ free: false, shapes: null });
  });

  it('refuses a shape for a panel that is not there, or a shape too small to be a panel', () => {
    const page = seedFree();
    const shape = pageShapes(page)[0]!;
    expect(useComic.getState().setFreeShape(page.id, 9, shape)).toBe(false);
    expect(useComic.getState().setFreeShape(page.id, 0, shape.map((p) => ({ x: 0.5 + p.x * 0.01, y: 0.5 + p.y * 0.01 })))).toBe(false);
  });
});

describe('the other panel operations on a free page', () => {
  it('moves a corner of one panel only, with no stitching to its neighbour', () => {
    const page = seedFree();
    const before = page.shapes!;
    expect(useComic.getState().moveCorner(page.id, 0, 2, { x: 0.45, y: 0.3 })).toBe(true);
    expect(current().shapes![0]![2]).toEqual({ x: 0.45, y: 0.3 });
    expect(current().shapes![1]).toEqual(before[1]);
  });

  it('adds a panel of its own at the end instead of cutting one', () => {
    const page = seedFree();
    const id = useComic.getState().halvePanel(page.id, 0);
    expect(id).not.toBeNull();
    expect(current().panels).toHaveLength(4);
    expect(current().shapes).toHaveLength(4);
    expect(current().free).toBe(true);
    expect(useComic.getState().selectedPanelId).toBe(id);
  });

  it('cuts a panel in two without touching the panels around it', () => {
    const page = seedFree();
    const [first, ...rest] = page.shapes!;
    const box = { x: Math.min(...first!.map((p) => p.x)), right: Math.max(...first!.map((p) => p.x)) };
    const middle = (box.x + box.right) / 2;
    expect(useComic.getState().splitPanel(page.id, 0, { x: middle, y: -0.1 }, { x: middle, y: 1.1 })).toBe(true);
    expect(current().panels).toHaveLength(4);
    expect(current().free).toBe(true);
    expect(current().shapes!.slice(2)).toEqual(rest);
  });

  it('removes a panel with its shape and lets no neighbour grow into the space', () => {
    const page = seedFree();
    const [, second, third] = page.shapes!;
    expect(useComic.getState().removePanel(page.id, 0)).toBe(true);
    expect(current().shapes).toEqual([second, third]);
    expect(current().free).toBe(true);
  });
});
