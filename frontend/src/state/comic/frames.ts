// The frame of a panel: a black line with an empty band between it and the picture, drawn inside the panel along the edge of
// its shape, after the gutter that keeps panels apart. The screen and the page image both draw it from these widths, so they
// agree. Each ring is a stroke centred on the shape's edge and clipped to the panel, so only its inner half shows.
import { PAGE_SIZE_MM, type ComicPage } from './document';

/** The three strokes of a panel's frame, widest first, as fractions of the page's width. */
export interface FrameStrokes {
  /** White, the band between the frame line and the picture (as wide as the line and the inset together). */
  deep: number;
  /** Black, the frame line and what lies inside it. */
  line: number;
  /** White, the gutter: the space between this panel's frame and its neighbour's. */
  gutter: number;
}

/** A length in millimetres of a page's paper as a fraction of the page's width. */
export function mmToPage(page: Pick<ComicPage, 'size'>, mm: number): number {
  return mm / PAGE_SIZE_MM[page.size].width;
}

/**
 * The strokes of the page's frames. Centred on a panel's edge, each reaches half its width into the panel: the gutter's half
 * is white, then comes the black line, then the inset's white band, then the picture.
 */
export function frameStrokes(page: Pick<ComicPage, 'size' | 'frameMm' | 'insetMm' | 'marginMm'>): FrameStrokes {
  const frame = mmToPage(page, page.frameMm);
  const inset = mmToPage(page, page.insetMm);
  const gutter = 2 * mmToPage(page, page.marginMm);
  return { deep: gutter + 2 * (frame + inset), line: gutter + 2 * frame, gutter };
}
