import { describe, expect, it } from 'vitest';
import { balloonOutline, outlineScale } from './balloon';

describe('the outline of a balloon', () => {
  it('is the text box scaled about its centre, and stretched by the balloon width and height', () => {
    const box = { x: 10, y: 20, width: 100, height: 40 };
    for (const look of [{ kind: 'speech', width: 1, height: 1 }, { kind: 'caption', width: 1.5, height: 0.8 }] as const) {
      const outline = balloonOutline(box, look);
      expect(outline.width).toBeCloseTo(100 * outlineScale(look.kind) * look.width);
      expect(outline.height).toBeCloseTo(40 * outlineScale(look.kind) * look.height);
      expect(outline.x + outline.width / 2).toBeCloseTo(box.x + box.width / 2);
      expect(outline.y + outline.height / 2).toBeCloseTo(box.y + box.height / 2);
    }
  });

  it('holds the corners of the text box inside the ellipse of a round balloon', () => {
    // An ellipse of the outline's size: each corner of the text box must satisfy (dx/a)² + (dy/b)² ≤ 1.
    const box = { x: 0, y: 0, width: 300, height: 60 };
    const outline = balloonOutline(box, { kind: 'speech', width: 1, height: 1 });
    const cx = outline.x + outline.width / 2;
    const cy = outline.y + outline.height / 2;
    for (const [x, y] of [
      [box.x, box.y],
      [box.x + box.width, box.y],
      [box.x, box.y + box.height],
      [box.x + box.width, box.y + box.height],
    ] as const) {
      const dx = (x - cx) / (outline.width / 2);
      const dy = (y - cy) / (outline.height / 2);
      expect(dx * dx + dy * dy).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('gives a box only a little room round the words', () => {
    expect(outlineScale('caption')).toBeLessThan(outlineScale('speech'));
    expect(outlineScale('caption')).toBeGreaterThan(1);
  });
});
