// Stacking order, putting things back to their defaults, and the finishing effect of a page or a comic.
import { beforeEach, describe, expect, it } from 'vitest';
import { newProject, parseComicProject, serializeComicProject } from './document';
import { effectOf } from './effects';
import { rotateShape, shapeTilt } from './freeShapes';
import { pageShapes } from './layout';
import { useComic } from './store';

function reset() {
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, selectedPanelId: null, selectedBubbleId: null, bubbleEditor: false, imageSelected: false, backdropSelected: false, cutting: false, pending: {}, past: [], future: [] });
}

function seed() {
  const project = newProject('P');
  useComic.getState().setProjects([project]);
  return project.pages[0]!.id;
}

const page = () => useComic.getState().projects[0]!.pages[0]!;

beforeEach(reset);

describe('the stacking order of panels', () => {
  it('moves a panel to the front or the back with its shape, one step or all the way', () => {
    const id = seed();
    useComic.getState().setPageFree(id, true);
    const ids = page().panels.map((p) => p.id);
    const shapes = page().shapes!.map((s) => s[0]);
    expect(useComic.getState().movePanelOrder(id, 0, 'front')).toBe(2);
    expect(page().panels.map((p) => p.id)).toEqual([ids[1], ids[2], ids[0]]);
    expect(page().shapes!.map((s) => s[0])).toEqual([shapes[1], shapes[2], shapes[0]]);
    expect(useComic.getState().movePanelOrder(id, 2, 'backward')).toBe(1);
    expect(useComic.getState().movePanelOrder(id, 1, 'back')).toBe(0);
    expect(page().panels.map((p) => p.id)).toEqual([ids[0], ids[1], ids[2]]);
  });

  it('changes nothing for a panel already at the end, or one that is not there', () => {
    const id = seed();
    useComic.getState().setPageFree(id, true);
    const before = useComic.getState().projects;
    expect(useComic.getState().movePanelOrder(id, 2, 'front')).toBe(-1);
    expect(useComic.getState().movePanelOrder(id, 0, 'back')).toBe(-1);
    expect(useComic.getState().movePanelOrder(id, 9, 'front')).toBe(-1);
    expect(useComic.getState().projects).toBe(before);
  });

  it('is one undo step', () => {
    const id = seed();
    useComic.getState().setPageFree(id, true);
    const order = page().panels.map((p) => p.id);
    useComic.getState().movePanelOrder(id, 0, 'front');
    useComic.getState().undo();
    expect(page().panels.map((p) => p.id)).toEqual(order);
  });
});

describe('putting a panel and its picture back', () => {
  it('turns a tilted panel upright and keeps its size; "all" gives back the automatic shape', () => {
    const id = seed();
    useComic.getState().setPageFree(id, true);
    const original = pageShapes(page())[1]!;
    const aspect = 297 / 210;
    const tilted = rotateShape(original, 0.4, aspect)!;
    useComic.getState().setFreeShape(id, 1, tilted);
    expect(Math.abs(shapeTilt(page().shapes![1]!, aspect))).toBeGreaterThan(0.3);
    expect(useComic.getState().resetPanelShape(id, 1, 'rotation')).toBe(true);
    expect(Math.abs(shapeTilt(page().shapes![1]!, aspect))).toBeLessThan(1e-6);
    useComic.getState().setFreeShape(id, 1, tilted);
    expect(useComic.getState().resetPanelShape(id, 1, 'all')).toBe(true);
    page().shapes![1]!.forEach((p, i) => {
      expect(p.x).toBeCloseTo(original[i]!.x);
      expect(p.y).toBeCloseTo(original[i]!.y);
    });
  });

  it('does not reset the shape of a page that is not free', () => {
    const id = seed();
    expect(useComic.getState().resetPanelShape(id, 0, 'all')).toBe(false);
  });

  it('puts back only the chosen parts of a picture view', () => {
    const id = seed();
    const panelId = page().panels[0]!.id;
    useComic.getState().setPanelImage(panelId, 'a.png');
    useComic.getState().setPanelImageView(panelId, { cx: 0.2, cy: 0.8, scale: 2, rotation: 40, flipX: true });
    useComic.getState().resetPanelImage(panelId, ['rotation']);
    expect(page().panels[0]!.imageView).toMatchObject({ cx: 0.2, scale: 2, rotation: 0, flipX: true });
    useComic.getState().resetPanelImage(panelId, ['position', 'flip']);
    expect(page().panels[0]!.imageView).toMatchObject({ cx: 0.5, cy: 0.5, scale: 2, flipX: false });
    useComic.getState().resetPanelImage(panelId, ['scale']);
    expect(page().panels[0]!.imageView.scale).toBe(1);
    void id;
  });

  it('puts back the backdrop view', () => {
    const id = seed();
    useComic.getState().setBackdrop(id, 'a.png');
    useComic.getState().setBackdropView(id, { scale: 3, rotation: 20 });
    useComic.getState().resetBackdrop(id, ['rotation', 'scale']);
    expect(page().backdrop!.view).toMatchObject({ scale: 1, rotation: 0 });
  });
});

describe('the finishing effect', () => {
  it('follows the comic unless the page has its own', () => {
    const id = seed();
    useComic.getState().setProjectEffect('ebook');
    const project = () => useComic.getState().projects[0]!;
    expect(effectOf(project(), page())).toBe('ebook');
    useComic.getState().setPageEffect(id, 'mono');
    expect(effectOf(project(), page())).toBe('mono');
    useComic.getState().setPageEffect(id, null);
    expect(effectOf(project(), page())).toBe('ebook');
  });

  it('is saved and read back, a comic saved before it has none, and an unknown name falls back', () => {
    const id = seed();
    useComic.getState().setProjectEffect('sepia');
    useComic.getState().setPageEffect(id, 'mono');
    const again = parseComicProject(serializeComicProject(useComic.getState().projects[0]!))!;
    expect(again.effect).toBe('sepia');
    expect(again.pages[0]!.effect).toBe('mono');
    const old = parseComicProject({ version: 1, id: 'c', pages: [{ id: 'p', panels: [{ id: 'x' }] }] })!;
    expect(old.effect).toBe('none');
    expect(old.pages[0]!.effect).toBeNull();
    expect(parseComicProject({ version: 1, id: 'c', effect: 'neon' })!.effect).toBe('none');
  });
});
