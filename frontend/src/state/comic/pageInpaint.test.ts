// Inpainting on a comic page: the generation box is kept inside the page and a sane size, and a queued inpaint is staged on
// the page that asked for it, even when another page is open by then.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newProject } from './document';
import { pageCanvasStore, resetPageCanvases } from './pageCanvas';
import {
  fitPageBbox,
  landPageInpaint,
  limitPageBbox,
  MAX_INPAINT_AREA,
  MAX_INPAINT_SIDE,
  pageBboxProblem,
  pageOfInpaint,
  resetPageInpaints,
  trackPageInpaint,
} from './pageInpaint';
import { usePagePaint } from './paintMode';
import { activePage, useComic } from './store';

const doc = { width: 1654, height: 2339 };

describe('the generation box on a page', () => {
  it('is fine inside the page and within the size limits', () => {
    expect(pageBboxProblem({ x: 0, y: 0, width: 1024, height: 1024 }, doc)).toBeNull();
    expect(pageBboxProblem({ x: 630, y: 1315, width: 1024, height: 1024 }, doc)).toBeNull();
  });

  it('names what is wrong with a box', () => {
    expect(pageBboxProblem({ x: 0, y: 0, width: 32, height: 512 }, doc)).toBe('tooSmall');
    expect(pageBboxProblem({ x: -8, y: 0, width: 512, height: 512 }, doc)).toBe('outside');
    expect(pageBboxProblem({ x: 700, y: 0, width: 1024, height: 512 }, doc)).toBe('outside');
    expect(pageBboxProblem({ x: 0, y: 0, width: 1654, height: 2336 }, doc)).toBe('tooLarge');
    expect(pageBboxProblem({ x: 0, y: 0, width: 1600, height: 1600 }, doc)).toBe('tooLarge');
  });

  it('is limited to multiples of 8, the page and the size limits', () => {
    const big = limitPageBbox({ x: -50, y: 9000, width: 5000, height: 5000 }, doc);
    expect(pageBboxProblem(big, doc)).toBeNull();
    expect(big.width % 8).toBe(0);
    expect(big.height % 8).toBe(0);
    expect(big.width * big.height).toBeLessThanOrEqual(MAX_INPAINT_AREA);
    expect(Math.max(big.width, big.height)).toBeLessThanOrEqual(MAX_INPAINT_SIDE);
    expect(limitPageBbox({ x: 10, y: 10, width: 8, height: 8 }, doc)).toEqual({ x: 10, y: 10, width: 64, height: 64 });
    expect(limitPageBbox({ x: 1600, y: 2300, width: 512, height: 512 }, doc)).toEqual({ x: 1142, y: 1827, width: 512, height: 512 });
  });

  it('keeps a box that is fine as it is', () => {
    const box = { x: 100, y: 200, width: 512, height: 768 };
    expect(limitPageBbox(box, doc)).toEqual(box);
  });

  it('is fitted around what is to be redrawn, keeping its shape', () => {
    const fitted = fitPageBbox({ x: 0, y: 0, width: 1654, height: 2336 }, doc, { x: 1400, y: 2100, width: 200, height: 200 });
    expect(pageBboxProblem(fitted, doc)).toBeNull();
    // Pushed back inside the page at the corner where the mask lies.
    expect(fitted.x + fitted.width).toBe(1654);
    expect(fitted.y + fitted.height).toBeGreaterThan(2100);
    expect(fitted.height / fitted.width).toBeGreaterThan(1.2);
  });

  it('is fitted around its own middle without a mask', () => {
    const fitted = fitPageBbox({ x: 0, y: 0, width: 1654, height: 2336 }, doc, null);
    expect(pageBboxProblem(fitted, doc)).toBeNull();
  });
});

describe('the result of a page inpaint', () => {
  beforeEach(() => {
    resetPageCanvases();
    resetPageInpaints();
    usePagePaint.setState({ painting: false });
    useComic.getState().setProjects([newProject('Rain')]);
    useComic.getState().addPage();
  });
  afterEach(() => {
    resetPageCanvases();
    resetPageInpaints();
  });

  const pages = () => useComic.getState().projects[0]!.pages;

  it('is staged on the store of the page that asked, once', () => {
    const [first, second] = pages();
    trackPageInpaint([41, 42], first!.id);
    expect(pageOfInpaint(41)).toBe(first!.id);
    expect(landPageInpaint(41, 'a.png')).toBe(true);
    expect(pageCanvasStore(first!.id)!.getState().stagedImageNames).toEqual(['a.png']);
    expect(pageCanvasStore(second!.id)!.getState().stagedImageNames).toEqual([]);
    // Told once: the same item is no page's any more.
    expect(landPageInpaint(41, 'a.png')).toBe(false);
  });

  it('lands on the asking page when another page is open, without starting to paint', () => {
    const [first, second] = pages();
    useComic.getState().selectPage(second!.id);
    expect(activePage(useComic.getState())!.id).toBe(second!.id);
    trackPageInpaint([7], first!.id);
    landPageInpaint(7, 'b.png');
    expect(pageCanvasStore(first!.id)!.getState().stagedImageNames).toEqual(['b.png']);
    expect(usePagePaint.getState().painting).toBe(false);
  });

  it('starts painting when the page is the open one', () => {
    const [first] = pages();
    useComic.getState().selectPage(first!.id);
    trackPageInpaint([9], first!.id);
    landPageInpaint(9, 'c.png');
    expect(usePagePaint.getState().painting).toBe(true);
  });

  it('leaves an item no page asked for to the Image tab', () => {
    expect(landPageInpaint(1234, 'd.png')).toBe(false);
  });
});
