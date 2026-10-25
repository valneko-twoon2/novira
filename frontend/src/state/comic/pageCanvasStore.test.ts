// The comic store and a page's Canvas layers: putting them in is no undo step, the comic's undo keeps them as they are (on
// the paper the step brings back), and a new paper scales them by one factor and centres them.
import { beforeEach, describe, expect, it } from 'vitest';
import type { CanvasObject, RasterEntity } from '../canvas';
import { newProject, pagePixels } from './document';
import { addRaster, pageRasters, rescaleCanvasDoc, type PageCanvas } from './pageCanvasDoc';
import { activePage, useComic } from './store';

const stroke: CanvasObject = { kind: 'stroke', id: 's', tool: 'brush', color: { r: 0, g: 0, b: 0, a: 1 }, width: 10, points: [100, 100, 400, 800], clip: null };
const page = () => activePage(useComic.getState())!;
const painted = (doc: PageCanvas): PageCanvas => {
  const next = addRaster(doc, 'Ink')!;
  return { ...next, entities: next.entities.map((e) => (e.name === 'Ink' ? { ...e, objects: [stroke] } : e)) };
};

beforeEach(() => {
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, past: [], future: [] });
  useComic.getState().setProjects([newProject('Layers')]);
});

describe('putting in the layers of a page', () => {
  it('changes the page, makes no undo step, and tells when nothing changed', () => {
    const doc = painted(page().canvas);
    expect(useComic.getState().setPageCanvas(page().id, doc)).toBe(true);
    expect(page().canvas).toBe(doc);
    expect(useComic.getState().past).toHaveLength(0);
    expect(useComic.getState().setPageCanvas(page().id, doc)).toBe(false);
    expect(useComic.getState().setPageCanvas('missing', doc)).toBe(false);
  });

  it('is kept by the comic undo, which brings back the rest of the page', () => {
    const before = page().panels.length;
    useComic.getState().setPanelCount(page().id, before + 1);
    const doc = painted(page().canvas);
    useComic.getState().setPageCanvas(page().id, doc);
    useComic.getState().undo();
    expect(page().panels).toHaveLength(before);
    expect(page().canvas).toBe(doc);
    useComic.getState().redo();
    expect(page().canvas).toBe(doc);
  });
});

describe('a new paper', () => {
  it('scales the layers by one factor and centres them; undo brings them back to the old paper', () => {
    const doc = painted(page().canvas);
    useComic.getState().setPageCanvas(page().id, doc);
    const a4 = pagePixels({ size: 'A4' });
    useComic.getState().setPageLayout(page().id, { size: 'B4' });
    expect(page().size).toBe('B4');
    expect(page().canvas).toEqual(rescaleCanvasDoc(doc, a4, pagePixels({ size: 'B4' })));
    const ink = pageRasters(page().canvas).find((e) => e.name === 'Ink') as RasterEntity;
    expect((ink.objects[0] as typeof stroke).width).toBeGreaterThan(10);
    useComic.getState().undo();
    expect(page().size).toBe('A4');
    const back = pageRasters(page().canvas).find((e) => e.name === 'Ink')!;
    // Back where it was, but for the rounding of the two scalings (a pixel at most).
    const points = (back.objects[0] as Extract<CanvasObject, { kind: 'stroke' }>).points;
    const before = (stroke as Extract<CanvasObject, { kind: 'stroke' }>).points;
    points.forEach((v, i) => expect(Math.abs(v - before[i]!)).toBeLessThanOrEqual(1.5));
  });

  it('applies a page template on another paper the same way, and leaves the layers alone on the same paper', () => {
    const doc = painted(page().canvas);
    useComic.getState().setPageCanvas(page().id, doc);
    useComic.getState().applyPageLayout(page().id, { panelCount: 2, columns: 2, direction: 'rtl', size: 'A4', shapes: null });
    expect(page().canvas).toBe(doc);
    useComic.getState().applyPageLayout(page().id, { panelCount: 2, columns: 2, direction: 'rtl', size: 'A5', shapes: null });
    expect(page().canvas).toEqual(rescaleCanvasDoc(doc, pagePixels({ size: 'A4' }), pagePixels({ size: 'A5' })));
  });
});
