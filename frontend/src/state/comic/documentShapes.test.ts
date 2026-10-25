import { describe, expect, it } from 'vitest';
import { COMIC_VERSION, parseComicProject } from './document';

const triangle = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
];

/** A saved project with one page of the given panel ids and shapes, and a page template. */
function saved(panelIds: string[], shapes: unknown, templateShapes: unknown = null) {
  return {
    version: COMIC_VERSION,
    id: 'comic-1',
    name: 'P',
    pages: [{ id: 'page-1', panels: panelIds.map((id) => ({ id })), columns: 2, direction: 'ltr', size: 'A4', shapes }],
    panelTemplates: [],
    pageTemplates: [{ id: 'tpl-1', name: 'T', panelCount: 2, columns: 2, direction: 'ltr', size: 'A4', shapes: templateShapes }],
    createdAt: 1,
    updatedAt: 2,
  };
}

describe('reading the shapes of a saved page', () => {
  it('keeps shapes that are one for each panel', () => {
    const project = parseComicProject(saved(['a', 'b'], [triangle, triangle]));
    expect(project!.pages[0]!.shapes).toEqual([triangle, triangle]);
  });

  it('takes the automatic layout when the shapes are not one for each panel', () => {
    expect(parseComicProject(saved(['a', 'b'], [triangle]))!.pages[0]!.shapes).toBeNull();
  });

  it('takes the automatic layout when a shape is not a shape', () => {
    expect(parseComicProject(saved(['a', 'b'], [triangle, [{ x: 0, y: 0 }]]))!.pages[0]!.shapes).toBeNull();
    expect(parseComicProject(saved(['a', 'b'], [triangle, 'nope']))!.pages[0]!.shapes).toBeNull();
  });

  it('reads a page saved before shapes as the automatic layout', () => {
    const old = saved(['a'], undefined);
    expect(parseComicProject(old)!.pages[0]!.shapes).toBeNull();
  });

  it('keeps the corners within a page-length of the page', () => {
    const outside = [
      { x: -1, y: 0.5 },
      { x: 2, y: 0 },
      { x: 0.5, y: 3 },
    ];
    expect(parseComicProject(saved(['a', 'b'], [outside, triangle]))!.pages[0]!.shapes![0]).toEqual([
      { x: -1, y: 0.5 },
      { x: 2, y: 0 },
      { x: 0.5, y: 2 },
    ]);
  });

  it('keeps the shapes of a page template for its panel count', () => {
    expect(parseComicProject(saved(['a', 'b'], null, [triangle, triangle]))!.pageTemplates[0]!.shapes).toEqual([triangle, triangle]);
    expect(parseComicProject(saved(['a', 'b'], null, [triangle]))!.pageTemplates[0]!.shapes).toBeNull();
  });
});
