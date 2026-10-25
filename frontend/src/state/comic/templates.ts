// The page layouts the comic screen offers without a saved template first. The first kind is by how many panels and in how
// many columns (the automatic layout). The second kind is by shape: each panel's corners in unit points, where 0 to 1 spans
// the page from its left to its right and from its top to its bottom, before the margin. The names are in the catalog
// (comic.template.builtin.<id>). A page keeps its reading direction when one of these is applied.
import type { ComicPoint } from './document';
import { EXTRA_SHAPE_LAYOUTS, type ExtraShapeLayoutId } from './moreTemplates';

export const BUILTIN_PAGE_LAYOUTS = [
  { id: 'single', panelCount: 1, columns: 1 },
  { id: 'strip', panelCount: 3, columns: 1 },
  { id: 'four', panelCount: 4, columns: 2 },
  { id: 'six', panelCount: 6, columns: 2 },
  { id: 'nine', panelCount: 9, columns: 3 },
] as const;

/** A panel's corners as unit points, from [x, y] pairs in reading order around the panel. */
const corners = (...c: [number, number][]): ComicPoint[] => c.map(([x, y]) => ({ x, y }));

export type ShapeLayoutId = 'diagonal' | 'bands' | 'bigleft' | 'strips' | 'zigzag' | 'frame' | 'widetop' | 'topcolumns' | 'stagger' | 'slants' | ExtraShapeLayoutId;

/** The shapes of the panels of a page, in reading order (the panel count is the number of shapes). */
export const BUILTIN_SHAPE_LAYOUTS: readonly { id: ShapeLayoutId; shapes: ComicPoint[][] }[] = [
  // Two panels cut by one slanted line.
  {
    id: 'diagonal',
    shapes: [
      corners([0, 0], [1, 0], [1, 0.4], [0, 0.6]),
      corners([0, 0.6], [1, 0.4], [1, 1], [0, 1]),
    ],
  },
  // Three bands, each slanted the same way.
  {
    id: 'bands',
    shapes: [
      corners([0, 0], [1, 0], [1, 0.2], [0, 0.36]),
      corners([0, 0.36], [1, 0.2], [1, 0.56], [0, 0.72]),
      corners([0, 0.72], [1, 0.56], [1, 1], [0, 1]),
    ],
  },
  // A tall panel on the left, two stacked on the right.
  {
    id: 'bigleft',
    shapes: [
      corners([0, 0], [0.6, 0], [0.6, 1], [0, 1]),
      corners([0.6, 0], [1, 0], [1, 0.5], [0.6, 0.5]),
      corners([0.6, 0.5], [1, 0.5], [1, 1], [0.6, 1]),
    ],
  },
  // Three upright strips.
  {
    id: 'strips',
    shapes: [
      corners([0, 0], [1 / 3, 0], [1 / 3, 1], [0, 1]),
      corners([1 / 3, 0], [2 / 3, 0], [2 / 3, 1], [1 / 3, 1]),
      corners([2 / 3, 0], [1, 0], [1, 1], [2 / 3, 1]),
    ],
  },
  // Two panels with a zigzag between them.
  {
    id: 'zigzag',
    shapes: [
      corners([0, 0], [1, 0], [1, 0.5], [0.65, 0.7], [0.35, 0.45], [0, 0.6]),
      corners([0, 0.6], [0.35, 0.45], [0.65, 0.7], [1, 0.5], [1, 1], [0, 1]),
    ],
  },
  // A large centre panel framed by four trapezoids.
  {
    id: 'frame',
    shapes: [
      corners([0.22, 0.22], [0.78, 0.22], [0.78, 0.78], [0.22, 0.78]),
      corners([0, 0], [1, 0], [0.78, 0.22], [0.22, 0.22]),
      corners([1, 0], [1, 1], [0.78, 0.78], [0.78, 0.22]),
      corners([1, 1], [0, 1], [0.22, 0.78], [0.78, 0.78]),
      corners([0, 1], [0, 0], [0.22, 0.22], [0.22, 0.78]),
    ],
  },
  // A wide panel on top, two slanted panels below it.
  {
    id: 'widetop',
    shapes: [
      corners([0, 0], [1, 0], [1, 0.4], [0.6, 0.4], [0, 0.4]),
      corners([0, 0.4], [0.6, 0.4], [0.4, 1], [0, 1]),
      corners([0.6, 0.4], [1, 0.4], [1, 1], [0.4, 1]),
    ],
  },
  // Two panels side by side on top, one large panel below.
  {
    id: 'topcolumns',
    shapes: [
      corners([0, 0], [0.5, 0], [0.5, 0.45], [0, 0.45]),
      corners([0.5, 0], [1, 0], [1, 0.45], [0.5, 0.45]),
      corners([0, 0.45], [0.5, 0.45], [1, 0.45], [1, 1], [0, 1]),
    ],
  },
  // A wide panel, then two rows of panels whose joins do not line up.
  {
    id: 'stagger',
    shapes: [
      corners([0, 0], [1, 0], [1, 0.3], [0, 0.3]),
      corners([0, 0.3], [0.45, 0.3], [0.45, 0.62], [0, 0.62]),
      corners([0.45, 0.3], [1, 0.3], [1, 0.62], [0.45, 0.62]),
      corners([0, 0.62], [0.35, 0.62], [0.35, 1], [0, 1]),
      corners([0.35, 0.62], [1, 0.62], [1, 1], [0.35, 1]),
    ],
  },
  // Four upright strips, each leaning the same way.
  {
    id: 'slants',
    shapes: [
      corners([0, 0], [0.25, 0], [0.15, 1], [0, 1]),
      corners([0.25, 0], [0.5, 0], [0.4, 1], [0.15, 1]),
      corners([0.5, 0], [0.75, 0], [0.65, 1], [0.4, 1]),
      corners([0.75, 0], [1, 0], [1, 1], [0.65, 1]),
    ],
  },
  ...EXTRA_SHAPE_LAYOUTS,
];
