import { describe, expect, it } from 'vitest';
import { BALLOON_LIMIT, estimateBox, fitScale, hasTail, mouthOf, personBoxes, placeBalloon, wrapBalloonText } from './balloonPlace';
import type { ComicPoint } from './document';

/** A person standing at x, from the head at y0 to the feet at y1, as 18 joints (only the shape matters here). */
const person = (x: number, y0: number, y1: number): ComicPoint[] =>
  Array.from({ length: 18 }, (_, i) => ({ x: x + (i % 3 === 0 ? 0.04 : -0.04) * (i > 1 ? 1 : 0), y: y0 + ((y1 - y0) * i) / 17 }));

describe('estimating a balloon box', () => {
  it('grows with the words, and a vertical balloon is taller than wide for a short line', () => {
    const small = estimateBox({ text: 'うん', scale: 1, vertical: true }, 1);
    const long = estimateBox({ text: 'すごい雨だね。\n濡れなかった？', scale: 1, vertical: true }, 1);
    expect(long.h).toBeGreaterThan(small.h);
    expect(long.w).toBeGreaterThan(small.w);
    expect(small.h).toBeGreaterThan(small.w);
  });

  it('is larger at a larger scale, wider across a wide panel less tall, and never past the panel', () => {
    const one = estimateBox({ text: 'こんにちは', scale: 1, vertical: false }, 1);
    expect(estimateBox({ text: 'こんにちは', scale: 2, vertical: false }, 1).w).toBeGreaterThan(one.w);
    expect(estimateBox({ text: 'こんにちは', scale: 1, vertical: false }, 2).h).toBeGreaterThan(one.h);
    expect(estimateBox({ text: 'あ'.repeat(500), scale: 4, vertical: true }, 1)).toMatchObject({ h: 0.95 });
  });
});

describe('placing a balloon', () => {
  const left = [person(0.25, 0.3, 0.95)];
  const size = { w: 0.2, h: 0.3 };

  it('keeps clear of the people and aims the tail at the speaker\'s mouth', () => {
    const mouth = mouthOf(left[0]!)!;
    const spot = placeBalloon(size, personBoxes(left), [], mouth);
    const box = personBoxes(left)[0]!;
    const apart = spot.x + size.w <= box.x || spot.x >= box.x + box.w || spot.y + size.h <= box.y || spot.y >= box.y + box.h;
    expect(apart).toBe(true);
    // The tip, put back into panel fractions, is the mouth.
    expect(spot.x + spot.tail!.x * size.w).toBeCloseTo(mouth.x, 5);
    expect(spot.y + spot.tail!.y * size.h).toBeCloseTo(mouth.y, 5);
  });

  it('stays inside the panel, and puts a later balloon beside the earlier one', () => {
    const first = placeBalloon(size, personBoxes(left), [], null);
    expect(first.tail).toBeNull();
    expect(first.x).toBeGreaterThanOrEqual(0);
    expect(first.y + size.h).toBeLessThanOrEqual(1);
    const second = placeBalloon(size, personBoxes(left), [{ ...first, ...size }], null);
    const apart = second.x + size.w <= first.x || second.x >= first.x + size.w || second.y + size.h <= first.y || second.y >= first.y + size.h;
    expect(apart).toBe(true);
  });

  it('puts the speaker\'s balloon on their own side of two people', () => {
    const two = [person(0.2, 0.3, 0.95), person(0.8, 0.3, 0.95)];
    const right = placeBalloon(size, personBoxes(two), [], mouthOf(two[1]!));
    expect(right.x).toBeGreaterThan(0.4);
  });

  it('knows which kinds have a tail', () => {
    expect(hasTail('speech')).toBe(true);
    expect(hasTail('caption')).toBe(false);
  });
});

describe('keeping a balloon small', () => {
  it('shrinks the words of a long line until the balloon is within the limit, and leaves a short one alone', () => {
    const long = { text: wrapBalloonText('すごい雨だね。濡れなかった？風邪をひかないようにね', true), scale: 1.5, vertical: true };
    const scale = fitScale(long, 1.4, 0.4);
    expect(scale).toBeLessThan(1.5);
    const box = estimateBox({ ...long, scale }, 1.4);
    expect(box.w).toBeLessThanOrEqual(BALLOON_LIMIT.w);
    expect(box.h).toBeLessThanOrEqual(BALLOON_LIMIT.h);
    expect(fitScale({ text: 'うん', scale: 1, vertical: true }, 1, 0.4)).toBe(1);
  });

  it('never goes below the floor', () => {
    expect(fitScale({ text: 'あ'.repeat(300), scale: 2, vertical: true }, 1, 0.4)).toBe(0.4);
  });
});

describe('breaking words into columns', () => {
  it('breaks a long line after punctuation when there is one late enough, else at the length', () => {
    expect(wrapBalloonText('ゴロー！おじいさん、おはよう！', true)).toBe('ゴロー！\nおじいさん、\nおはよう！');
    expect(wrapBalloonText('あいうえおかきくけこさし', true)).toBe('あいうえおかきく\nけこさし');
    expect(wrapBalloonText('あいうえおかきくけこさし', false)).toBe('あいうえおかきくけこさし');
  });

  it('keeps short lines, lines the writer broke, and words with emphasis marks', () => {
    expect(wrapBalloonText('うん', true)).toBe('うん');
    expect(wrapBalloonText('おはよう\nいい天気ですね', true)).toBe('おはよう\nいい天気ですね');
    expect(wrapBalloonText('**とても大きな声で叫んでいます**よ', true)).toBe('**とても大きな声で叫んでいます**よ');
  });

  it('makes a balloon shorter: broken words are estimated as the columns they are', () => {
    const one = estimateBox({ text: 'ゴロー！おじいさん、おはよう！', scale: 1, vertical: true }, 1.4);
    const two = estimateBox({ text: wrapBalloonText('ゴロー！おじいさん、おはよう！', true), scale: 1, vertical: true }, 1.4);
    expect(two.h).toBeLessThan(one.h);
    expect(two.w).toBeGreaterThan(one.w);
  });
});
