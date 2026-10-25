import { describe, expect, it } from 'vitest';
import { PAGE_SIZES, PAGE_SIZE_MM, emptyPage } from './document';
import { layoutFor, pageAspect, pageBoxes, PAGE_ASPECT } from './layout';

describe('the paper of a page', () => {
  it('keeps the proportions of each paper, A4 being the default', () => {
    expect(pageAspect('A4')).toBe(1.414);
    expect(pageAspect()).toBe(PAGE_ASPECT);
    expect(pageAspect('A5')).toBe(1.419);
    expect(pageAspect('B4')).toBe(1.416);
    expect(pageAspect('B5')).toBe(1.412);
  });

  it('gives the sizes the page can have, all of them with a paper in millimetres', () => {
    expect(PAGE_SIZES).toEqual(['A4', 'A5', 'B4', 'B5']);
    for (const size of PAGE_SIZES) expect(PAGE_SIZE_MM[size].height).toBeGreaterThan(PAGE_SIZE_MM[size].width);
  });

  it('lays the panels out on the page of its own paper: a single panel fills the page inside its margin', () => {
    // The margin is 0.04 of the page's width on every side, so a panel that fills the page is the page less 0.08 in height.
    for (const size of PAGE_SIZES) {
      const [only] = pageBoxes({ panels: [{}], columns: 1, direction: 'ltr', size });
      expect(only!.height * pageAspect(size)).toBeCloseTo(pageAspect(size) - 0.08, 6);
    }
  });

  it('gives a page with no paper the A4 layout, as before', () => {
    expect(pageBoxes({ panels: [{}, {}, {}], columns: 2, direction: 'rtl' })).toEqual(layoutFor(3, 2, 'rtl', PAGE_ASPECT));
  });

  it('starts a new page on A4', () => {
    expect(emptyPage().size).toBe('A4');
  });
});
