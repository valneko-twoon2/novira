import { describe, expect, it } from 'vitest';
import { balloonShape, baseOutline, FIT_PANEL_SHARE, fitStep, lineStrokes, polyPath, seedOf, type BalloonLook } from './balloon';
import { BUBBLE_KINDS, LETTERING_KINDS, newBubble, type BubbleKind } from './document';

/** A balloon's look with the hand-drawn wavering off, so the outline is the shape's own. */
const look = (kind: BubbleKind, more: Partial<BalloonLook> = {}): BalloonLook => ({ ...newBubble(kind, 0, 0), rough: 0, ...more });
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

describe('balloon outlines', () => {
  it('draws nothing round lettering that has no balloon', () => {
    for (const kind of LETTERING_KINDS) expect(balloonShape(look(kind, { tail: { x: 0, y: 1.2 } }))).toEqual({ body: null, tail: [], ink: [] });
  });

  it('gives every balloon a closed body round the middle of its box', () => {
    for (const kind of BUBBLE_KINDS.filter((k) => !LETTERING_KINDS.includes(k))) {
      const body = balloonShape(look(kind, { rough: 0.4 }), 3).body!;
      expect(body.length, kind).toBeGreaterThan(3);
      const xs = body.map((p) => p.x);
      const ys = body.map((p) => p.y);
      // The outline goes round the box: it reaches both sides of the middle, and its spikes stay within reach of the box.
      expect(Math.min(...xs), kind).toBeLessThan(0.2);
      expect(Math.max(...xs), kind).toBeGreaterThan(0.8);
      expect(Math.min(...ys), kind).toBeLessThan(0.2);
      expect(Math.max(...ys), kind).toBeGreaterThan(0.8);
      expect(Math.min(...xs, ...ys), kind).toBeGreaterThan(-0.6);
      expect(Math.max(...xs, ...ys), kind).toBeLessThan(1.6);
    }
  });

  it('draws a speech balloon with no wavering on the ellipse of its box', () => {
    const body = balloonShape(look('speech')).body!;
    for (const p of body) expect(near(((p.x - 0.5) / 0.5) ** 2 + ((p.y - 0.5) / 0.5) ** 2, 1)).toBe(true);
  });

  it('wavers the same way for the same balloon, and another way for another', () => {
    const shaky = look('speech', { rough: 1 });
    expect(balloonShape(shaky, seedOf('bubble-a'))).toEqual(balloonShape(shaky, seedOf('bubble-a')));
    expect(balloonShape(shaky, seedOf('bubble-a'))).not.toEqual(balloonShape(shaky, seedOf('bubble-b')));
    // With no wavering, the seed changes nothing on a shape that has no uneven parts.
    expect(balloonShape(look('speech'), 1)).toEqual(balloonShape(look('speech'), 2));
  });

  it('moves a wavering line off the ellipse, but only a little', () => {
    const body = balloonShape(look('speech', { rough: 1 }), 5).body!;
    const off = body.map((p) => Math.abs(Math.hypot(p.x - 0.5, p.y - 0.5) - 0.5));
    expect(Math.max(...off)).toBeGreaterThan(0.005);
    expect(Math.max(...off)).toBeLessThan(0.06);
  });

  it('gives a shout a tip and a dip for each spike', () => {
    expect(balloonShape(look('shout', { spikes: 10 })).body).toHaveLength(20);
    expect(balloonShape(look('shout', { spikes: 30 })).body).toHaveLength(60);
  });

  it('draws one ray of ink for each ray of a flash, and none for other balloons', () => {
    expect(balloonShape(look('flash', { spikes: 40 })).ink).toHaveLength(40);
    expect(balloonShape(look('speech')).ink).toEqual([]);
  });

  it('draws the tail to the tip, wherever it is', () => {
    for (const tip of [{ x: 0.08, y: 1.18 }, { x: -0.5, y: 0.5 }, { x: 1.5, y: 0.5 }]) {
      const [wedge] = balloonShape(look('speech', { tail: tip })).tail;
      expect(wedge!.some((p) => near(p.x, tip.x) && near(p.y, tip.y))).toBe(true);
    }
  });

  it('draws no tail when the balloon has none, when the tip is at the middle, or for a shape with no tail', () => {
    expect(balloonShape(look('speech', { tail: null })).tail).toEqual([]);
    expect(balloonShape(look('speech', { tail: { x: 0.5, y: 0.5 } })).tail).toEqual([]);
    expect(balloonShape(look('caption', { tail: { x: 0, y: 1.2 } })).tail).toEqual([]);
    expect(balloonShape(look('flash', { tail: { x: 0, y: 1.2 } })).tail).toEqual([]);
  });

  it('draws a thought with a trail of three dots, and an electric balloon with one bolt', () => {
    expect(balloonShape(look('thought', { tail: { x: 0.5, y: 1.5 } })).tail).toHaveLength(3);
    const bolt = balloonShape(look('electric', { tail: { x: 0.5, y: 1.5 } })).tail;
    expect(bolt).toHaveLength(1);
    expect(bolt[0]!.some((p) => near(p.x, 0.5) && near(p.y, 1.5))).toBe(true);
  });

  it('bends the tail to one side or the other with its bend', () => {
    const middle = (curve: number) => {
      const [wedge] = balloonShape(look('speech', { tail: { x: 0.5, y: 1.5 }, tailCurve: curve })).tail;
      return wedge![6]!.x;
    };
    expect(middle(1)).toBeLessThan(middle(0));
    expect(middle(-1)).toBeGreaterThan(middle(0));
  });

  it('follows an outline drawn by hand instead of the shape', () => {
    const square = { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], smooth: false };
    const body = balloonShape(look('speech', { outline: square })).body!;
    for (const p of body) expect(near(p.x, 0) || near(p.x, 1) || near(p.y, 0) || near(p.y, 1)).toBe(true);
    // The spikes of a shout are laid along the drawn outline too.
    const spiky = balloonShape(look('shout', { outline: square, spikes: 12 })).body!;
    expect(spiky).toHaveLength(24);
  });
});

describe('the points an outline is drawn from', () => {
  it('are the corners of a box, the sides of a many-sided box, and points round the rounder shapes', () => {
    expect(baseOutline({ kind: 'caption', spikes: 0 })).toEqual({ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], smooth: false });
    expect(baseOutline({ kind: 'electric', spikes: 6 }).points).toHaveLength(6);
    expect(baseOutline({ kind: 'electric', spikes: 6 }).smooth).toBe(false);
    expect(baseOutline({ kind: 'speech', spikes: 0 })).toMatchObject({ smooth: true });
    expect(baseOutline({ kind: 'speech', spikes: 0 }).points).toHaveLength(12);
  });
});

describe('drawing an outline', () => {
  it('writes each polygon as a closed path', () => {
    expect(polyPath([[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]])).toBe('M0.0000 0.0000L1.0000 0.0000L1.0000 1.0000Z');
    expect(polyPath([])).toBe('');
  });

  it('lays one line as one stroke, two lines as three, and no line as none', () => {
    expect(lineStrokes('solid')).toEqual([{ widths: 2, ink: true }]);
    expect(lineStrokes('dashed')).toEqual([{ widths: 2, ink: true }]);
    expect(lineStrokes('double').map((s) => s.ink)).toEqual([true, false, true]);
    expect(lineStrokes('none')).toEqual([]);
  });
});

describe('fitting a balloon', () => {
  const fits = { wordsOverflow: false, width: 0.3, height: 0.4, outlineX: 1, outlineY: 1 };

  it('shrinks the words while they run out of the balloon or the balloon is too big for its panel', () => {
    expect(fitStep({ scale: 1, x: 0, y: 0 }, { ...fits, wordsOverflow: true })).toEqual({ patch: { scale: 0.9 }, done: false });
    expect(fitStep({ scale: 2, x: 0, y: 0 }, { ...fits, height: FIT_PANEL_SHARE + 0.01 })).toEqual({ patch: { scale: 1.8 }, done: false });
    expect(fitStep({ scale: 0.42, x: 0, y: 0 }, { ...fits, wordsOverflow: true }).patch).toEqual({ scale: 0.4 });
  });

  it('stops at the smallest size, and moves a balloon that fits inside its panel', () => {
    expect(fitStep({ scale: 0.4, x: 0.1, y: 0.1 }, { ...fits, wordsOverflow: true })).toEqual({ patch: {}, done: true });
    expect(fitStep({ scale: 1, x: 0.9, y: -0.2 }, fits)).toEqual({ patch: { x: 0.7, y: 0 }, done: true });
    expect(fitStep({ scale: 1, x: 0.2, y: 0.3 }, fits)).toEqual({ patch: {}, done: true });
  });

  it("measures the outline, which is larger than the words' box, against the panel and keeps it inside", () => {
    const ellipse = { ...fits, width: 0.7, outlineX: Math.SQRT2 };
    expect(fitStep({ scale: 1, x: 0.1, y: 0.1 }, ellipse).done).toBe(false);
    expect(fitStep({ scale: 1, x: 0.1, y: 0.1 }, { ...ellipse, outlineX: 1 }).done).toBe(true);
    const box = { ...fits, outlineX: 1.4, outlineY: 1.4 };
    expect(fitStep({ scale: 1, x: 0, y: 0.9 }, box).patch).toEqual({ x: expect.closeTo(0.06), y: expect.closeTo(0.52) });
    expect(fitStep({ scale: 0.4, x: 0, y: 0 }, { ...box, width: 0.9 }).patch.x).toBeCloseTo(0.05);
  });
});
