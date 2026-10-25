// Finishing effects over a whole page (see COMIC_EFFECTS): each is a CSS filter and, for the e-book, a paper tone that is
// multiplied over the page. The screen shows them as CSS and the saved page draws them with the same values, so the two agree.
import type { ComicEffect, ComicPage, ComicProject } from './document';

export interface EffectLook {
  /** A CSS filter list, applied to the drawn page. */
  filter: string;
  /** The colour of the paper, multiplied over the filtered page; null for none. */
  paper: string | null;
}

export const EFFECT_LOOK: Record<ComicEffect, EffectLook> = {
  none: { filter: 'none', paper: null },
  mono: { filter: 'grayscale(1)', paper: null },
  ebook: { filter: 'grayscale(1) contrast(1.12) brightness(0.98)', paper: '#f1eee6' },
  sepia: { filter: 'sepia(0.85) contrast(1.05)', paper: null },
};

/** The effect a page is shown and saved with: its own, or else its comic's. */
export function effectOf(project: Pick<ComicProject, 'effect'>, page: Pick<ComicPage, 'effect'>): ComicEffect {
  return page.effect ?? project.effect;
}
