// Shared zoom / pan math of the canvas stage and the image viewer.
import { describe, expect, it } from 'vitest';
import {
  MAX_SCALE,
  MIN_SCALE,
  boxToScreen,
  canPan,
  clampPan,
  containIn,
  docToScreen,
  fitRect,
  screenToDoc,
  stepZoom,
  wheelZoomFactor,
  zoomAt,
} from './zoomMath';

describe('zoom math', () => {
  it('round-trips screen and document coordinates', () => {
    const v = { x: 30, y: -20, scale: 0.5 };
    expect(screenToDoc(docToScreen({ x: 100, y: 200 }, v), v)).toEqual({ x: 100, y: 200 });
    expect(boxToScreen({ x: 10, y: 20, width: 100, height: 50 }, v)).toEqual({ x: 35, y: -10, width: 50, height: 25 });
  });

  it('keeps the anchor fixed when zooming', () => {
    const v = { x: 10, y: 10, scale: 1 };
    const anchor = { x: 200, y: 150 };
    const z = zoomAt(v, anchor, 2);
    expect(z.scale).toBe(2);
    expect(docToScreen(screenToDoc(anchor, v), z)).toEqual(anchor);
  });

  it('clamps the scale to the limits', () => {
    const v = { x: 0, y: 0, scale: 1 };
    expect(zoomAt(v, { x: 0, y: 0 }, 1000).scale).toBe(MAX_SCALE);
    expect(zoomAt(v, { x: 0, y: 0 }, 0).scale).toBe(MIN_SCALE);
  });

  it('steps through the zoom presets and stops at the limits', () => {
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(1, -1)).toBe(0.75);
    expect(stepZoom(0.9, 1)).toBe(1);
    expect(stepZoom(MAX_SCALE, 1)).toBe(MAX_SCALE);
    expect(stepZoom(MIN_SCALE, -1)).toBe(MIN_SCALE);
  });

  it('zooms in for wheel up and out for wheel down, faster per line than per pixel', () => {
    expect(wheelZoomFactor({ deltaY: -100, deltaMode: 0 })).toBeGreaterThan(1);
    expect(wheelZoomFactor({ deltaY: 100, deltaMode: 0 })).toBeLessThan(1);
    expect(wheelZoomFactor({ deltaY: -100, deltaMode: 0 }) * wheelZoomFactor({ deltaY: 100, deltaMode: 0 })).toBeCloseTo(1);
    expect(wheelZoomFactor({ deltaY: -3, deltaMode: 1 })).toBeGreaterThan(wheelZoomFactor({ deltaY: -3, deltaMode: 0 }));
  });

  it('fits a rect into the stage centered', () => {
    const v = fitRect({ x: 0, y: 0, width: 1000, height: 500 }, 600, 400, 50);
    expect(v.scale).toBeCloseTo(0.5);
    expect(docToScreen({ x: 500, y: 250 }, v)).toEqual({ x: 300, y: 200 });
  });

  it('centers content smaller than the stage and keeps larger content covering it', () => {
    const content = { width: 100, height: 100 };
    const stage = { width: 400, height: 300 };
    expect(clampPan({ x: -999, y: 999, scale: 1 }, content, stage)).toEqual({ x: 150, y: 100, scale: 1 });
    // At 10x the content is 1000×1000: its edges may not come inside the stage.
    expect(clampPan({ x: 50, y: -5000, scale: 10 }, content, stage)).toEqual({ x: 0, y: -700, scale: 10 });
    expect(clampPan({ x: -100, y: -200, scale: 10 }, content, stage)).toEqual({ x: -100, y: -200, scale: 10 });
    expect(canPan({ x: 0, y: 0, scale: 1 }, content, stage)).toBe(false);
    expect(canPan({ x: 0, y: 0, scale: 10 }, content, stage)).toBe(true);
  });

  it('contains a box in a rect, centered, in whole pixels', () => {
    expect(containIn(200, 100, { x: 0, y: 0, width: 100, height: 100 })).toEqual({ x: 0, y: 25, width: 100, height: 50 });
  });
});
