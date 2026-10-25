import { describe, expect, it } from 'vitest';
import { clampView, FITTED, MAX_SCALE, pinchView, swipeOf, SWIPE_DISTANCE, TAP_SCALE, tapView } from './gestures';

const picture = { width: 400, height: 600 };
const stage = { width: 400, height: 700 };

describe('phone picture gestures', () => {
  it('keeps a fitted picture still and lets a zoomed one move only as far as it overflows', () => {
    expect(clampView({ scale: 1, x: 50, y: -50 }, picture, stage)).toEqual(FITTED);
    // At 2x the picture is 800 x 1200 on a 400 x 700 stage: 200 and 250 to each side.
    expect(clampView({ scale: 2, x: 999, y: -999 }, picture, stage)).toEqual({ scale: 2, x: 200, y: -250 });
    expect(clampView({ scale: 2, x: 120, y: 30 }, picture, stage)).toEqual({ scale: 2, x: 120, y: 30 });
    // Never smaller than fitted, never past the largest scale.
    expect(clampView({ scale: 0.3, x: 0, y: 0 }, picture, stage).scale).toBe(1);
    expect(clampView({ scale: 40, x: 0, y: 0 }, picture, stage).scale).toBe(MAX_SCALE);
  });

  it('zooms a pinch around the middle of the fingers, keeping that point of the picture under them', () => {
    const from: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 40, y: 60 }, { x: 140, y: 60 }];
    const to: [{ x: number; y: number }, { x: number; y: number }] = [{ x: -10, y: 60 }, { x: 190, y: 60 }];
    const v = pinchView(FITTED, from, to);
    expect(v.scale).toBeCloseTo(2);
    // The middle (90, 60) was the picture's point (90, 60); at 2x it is drawn at 2 * 90 + x.
    expect(2 * 90 + v.x).toBeCloseTo(90);
    expect(2 * 60 + v.y).toBeCloseTo(60);
    // Fingers that move together pan as they zoom.
    const moved = pinchView(FITTED, from, [{ x: 0, y: 100 }, { x: 200, y: 100 }]);
    expect(2 * 90 + moved.x).toBeCloseTo(100);
    expect(2 * 60 + moved.y).toBeCloseTo(100);
    // Pinching in past fitted stops at fitted.
    expect(pinchView(FITTED, from, [{ x: 80, y: 60 }, { x: 100, y: 60 }]).scale).toBe(1);
    // Fingers on the same point do not divide by zero.
    expect(Number.isFinite(pinchView(FITTED, [{ x: 5, y: 5 }, { x: 5, y: 5 }], to).scale)).toBe(true);
  });

  it('zooms in around a double tap and goes back to fitted on the next', () => {
    const zoomed = tapView(FITTED, { x: 100, y: -40 });
    expect(zoomed.scale).toBe(TAP_SCALE);
    expect(TAP_SCALE * 100 + zoomed.x).toBeCloseTo(100);
    expect(TAP_SCALE * -40 + zoomed.y).toBeCloseTo(-40);
    expect(tapView(zoomed, { x: 0, y: 0 })).toEqual(FITTED);
  });

  it('tells a sideways swipe from a short or upright move', () => {
    expect(swipeOf(-SWIPE_DISTANCE, 0)).toBe('next');
    expect(swipeOf(SWIPE_DISTANCE + 1, 10)).toBe('previous');
    expect(swipeOf(-(SWIPE_DISTANCE - 1), 0)).toBeNull();
    expect(swipeOf(-100, 90)).toBeNull();
    expect(swipeOf(0, 300)).toBeNull();
  });
});
