// Property tests for the shared zoom / pan math (canvas stage and image viewer). In-process only (no network).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check } from '@/propertyTest.testkit';
import {
  canPan,
  clampPan,
  clampScale,
  containIn,
  docToScreen,
  fitRect,
  MAX_SCALE,
  MIN_SCALE,
  screenToDoc,
  stepZoom,
  wheelZoomFactor,
  zoomAt,
  type ViewTransform,
} from './zoomMath';

const coord = fc.double({ min: -1e5, max: 1e5, noNaN: true });
const point = fc.record({ x: coord, y: coord });
const scale = fc.double({ min: MIN_SCALE, max: MAX_SCALE, noNaN: true });
const view: fc.Arbitrary<ViewTransform> = fc.record({ x: coord, y: coord, scale });
const length = fc.integer({ min: 1, max: 8000 });
const box = fc.record({ x: fc.integer({ min: -5000, max: 5000 }), y: fc.integer({ min: -5000, max: 5000 }), width: length, height: length });
const size = fc.record({ width: length, height: length });
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

describe('zoomMath (properties)', () => {
  it('maps document to screen and back to the same point', () => {
    check(
      fc.property(point, view, (p, v) => {
        const back = screenToDoc(docToScreen(p, v), v);
        return near(back.x, p.x, 1e-6) && near(back.y, p.y, 1e-6);
      }),
    );
  });

  it('zoomAt keeps the anchor fixed and clamps the scale', () => {
    check(
      fc.property(view, point, fc.double({ min: -100, max: 100, noNaN: true }), (v, anchor, requested) => {
        const next = zoomAt(v, anchor, requested);
        expect(next.scale).toBeGreaterThanOrEqual(MIN_SCALE);
        expect(next.scale).toBeLessThanOrEqual(MAX_SCALE);
        expect(next.scale).toBe(clampScale(requested));
        // the document point under the anchor before is under the anchor after
        const doc = screenToDoc(anchor, v);
        const after = docToScreen(doc, next);
        expect(near(after.x, anchor.x, 1e-5)).toBe(true);
        expect(near(after.y, anchor.y, 1e-5)).toBe(true);
      }),
    );
  });

  it('clampScale is idempotent and stays inside the limits', () => {
    check(
      fc.property(fc.double({ noNaN: true }), (s) => {
        const c = clampScale(s);
        return c >= MIN_SCALE && c <= MAX_SCALE && clampScale(c) === c;
      }),
    );
  });

  it('stepZoom moves in the asked direction and never leaves the limits', () => {
    check(
      fc.property(scale, (s) => {
        const up = stepZoom(s, 1);
        const down = stepZoom(s, -1);
        expect(up).toBeGreaterThanOrEqual(s - 1e-3);
        expect(down).toBeLessThanOrEqual(s + 1e-3);
        expect(up).toBeLessThanOrEqual(MAX_SCALE);
        expect(down).toBeGreaterThanOrEqual(MIN_SCALE);
        if (s < MAX_SCALE - 1e-3) expect(up).toBeGreaterThan(s);
        if (s > MIN_SCALE + 1e-3) expect(down).toBeLessThan(s);
      }),
    );
  });

  it('fitRect centres the rect on the stage and, when not clamped, fits inside the padding', () => {
    check(
      fc.property(box, size, fc.integer({ min: 0, max: 200 }), (rect, stage, padding) => {
        const v = fitRect(rect, stage.width, stage.height, padding);
        expect(v.scale).toBeGreaterThanOrEqual(MIN_SCALE);
        expect(v.scale).toBeLessThanOrEqual(MAX_SCALE);
        const c = docToScreen({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, v);
        expect(near(c.x, stage.width / 2, 1e-6)).toBe(true);
        expect(near(c.y, stage.height / 2, 1e-6)).toBe(true);
        const unclamped = v.scale > MIN_SCALE && v.scale < MAX_SCALE;
        if (unclamped) {
          expect(rect.width * v.scale).toBeLessThanOrEqual(Math.max(1, stage.width - padding * 2) + 1e-6);
          expect(rect.height * v.scale).toBeLessThanOrEqual(Math.max(1, stage.height - padding * 2) + 1e-6);
        }
      }),
    );
  });

  it('clampPan is idempotent, keeps the scale and keeps content reachable', () => {
    check(
      fc.property(view, size, size, (v, content, stage) => {
        const once = clampPan(v, content, stage);
        const twice = clampPan(once, content, stage);
        expect(once.scale).toBe(v.scale);
        expect(twice).toEqual(once);
        const w = content.width * v.scale;
        const h = content.height * v.scale;
        if (w <= stage.width) expect(near(once.x, (stage.width - w) / 2)).toBe(true);
        else {
          expect(once.x).toBeLessThanOrEqual(0);
          expect(once.x + w).toBeGreaterThanOrEqual(stage.width - 1e-6);
        }
        if (h <= stage.height) expect(near(once.y, (stage.height - h) / 2)).toBe(true);
        else {
          expect(once.y).toBeLessThanOrEqual(0);
          expect(once.y + h).toBeGreaterThanOrEqual(stage.height - 1e-6);
        }
      }),
    );
  });

  it('canPan is false exactly when the scaled content fits the stage (within half a pixel)', () => {
    check(
      fc.property(view, size, size, (v, content, stage) => {
        const fits = content.width * v.scale <= stage.width + 0.5 && content.height * v.scale <= stage.height + 0.5;
        expect(canPan(v, content, stage)).toBe(!fits);
      }),
    );
  });

  it('wheelZoomFactor is positive, finite and inverts for opposite deltas', () => {
    check(
      fc.property(fc.double({ min: -2000, max: 2000, noNaN: true }), fc.constantFrom(0, 1, 2), (deltaY, deltaMode) => {
        const f = wheelZoomFactor({ deltaY, deltaMode });
        const g = wheelZoomFactor({ deltaY: -deltaY, deltaMode });
        expect(f).toBeGreaterThan(0);
        expect(Number.isFinite(f)).toBe(true);
        expect(near(f * g, 1, 1e-9)).toBe(true);
      }),
    );
  });

  it('containIn returns a centred box that fits the rect (whole pixels)', () => {
    check(
      fc.property(length, length, box, (w, h, r) => {
        const out = containIn(w, h, r);
        expect(Number.isInteger(out.width) && Number.isInteger(out.height) && Number.isInteger(out.x) && Number.isInteger(out.y)).toBe(true);
        expect(out.width).toBeLessThanOrEqual(r.width);
        expect(out.height).toBeLessThanOrEqual(r.height);
        expect(out.x).toBeGreaterThanOrEqual(r.x);
        expect(out.y).toBeGreaterThanOrEqual(r.y);
        expect(out.x + out.width).toBeLessThanOrEqual(r.x + r.width);
        expect(out.y + out.height).toBeLessThanOrEqual(r.y + r.height);
      }),
    );
  });
});
