import { describe, expect, it } from 'vitest';
import { FRAME_WIDTH_RANGE } from './document';
import { frameStrokes, mmToPage } from './frames';

const page = (frameMm: number, insetMm: number, marginMm = 5) => ({ size: 'A4' as const, frameMm, insetMm, marginMm });
// A 5 mm margin is a stroke of 10 mm centred on the edge, so 5 mm of white shows inside the panel.
const G = 2 * (5 / 210);

describe('the strokes of a panel frame', () => {
  it('measures millimetres as a share of the paper width', () => {
    expect(mmToPage({ size: 'A4' }, 21)).toBeCloseTo(0.1);
    expect(mmToPage({ size: 'A5' }, 14.8)).toBeCloseTo(0.1);
  });

  it('is only the margin at no frame line and no inset', () => {
    expect(frameStrokes(page(0, 0))).toEqual({ deep: G, line: G, gutter: G });
  });

  it('draws no white at all at no margin (the first setting)', () => {
    const s = frameStrokes(page(0.6, 0, 0));
    expect(s.gutter).toBe(0);
    expect(s.line).toBeCloseTo(2 * mmToPage({ size: 'A4' }, 0.6));
    expect(s.deep).toBe(s.line);
  });

  it('adds the line to both sides of the gutter, and the inset beyond the line', () => {
    const frame = mmToPage({ size: 'A4' }, FRAME_WIDTH_RANGE.default);
    const strokes = frameStrokes(page(FRAME_WIDTH_RANGE.default, 2.1));
    expect(strokes.gutter).toBeCloseTo(G);
    expect(strokes.line).toBeCloseTo(G + 2 * frame);
    // The deep ring reaches the line's far side plus 2.1 mm (a hundredth of the width on each side).
    expect(strokes.deep).toBeCloseTo(strokes.line + 2 * 0.01);
  });

  it('keeps the same share of the paper at another paper size', () => {
    expect(frameStrokes({ ...page(0.6, 0), size: 'B5' as const }).line).toBeGreaterThan(frameStrokes(page(0.6, 0)).line);
  });
});
