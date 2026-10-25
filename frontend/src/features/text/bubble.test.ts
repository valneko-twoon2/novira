import { describe, expect, it } from 'vitest';
import { BUBBLE_SHAPES, newBubbleLayer } from '@/state/text/textModel';
import { boundaryRadius, bubbleGeometry, commandBounds, seeded } from './bubble';

const scene = { width: 1000, height: 1000 };

describe('bubble geometry', () => {
  it('draws every shape as a closed outline inside its size', () => {
    for (const shape of BUBBLE_SHAPES) {
      const layer = newBubbleLayer(scene, shape, 'text');
      const geo = bubbleGeometry({ ...layer, tail: { ...layer.tail, enabled: false } });
      expect(geo.body[0]![0]).toBe('M');
      expect(geo.body.at(-1)![0]).toBe('Z');
      const b = commandBounds(geo.body);
      // Cloud bumps and burst spikes may reach a little past the nominal size, never far.
      expect(b.maxX - b.minX).toBeLessThanOrEqual(layer.width * 1.25);
      expect(b.maxY - b.minY).toBeLessThanOrEqual(layer.height * 1.25);
      expect(b.maxX - b.minX).toBeGreaterThan(layer.width * 0.8);
    }
  });

  it('adds a pointer that reaches the target', () => {
    const layer = newBubbleLayer(scene, 'round', 'a');
    const geo = bubbleGeometry({ ...layer, tail: { ...layer.tail, enabled: true, x: 0, y: layer.height } });
    expect(geo.tail).not.toBeNull();
    expect(commandBounds(geo.tail!).maxY).toBe(layer.height);
  });

  it('has no pointer when it is switched off, inside the body, or for a narration box', () => {
    const round = newBubbleLayer(scene, 'round', 'a');
    expect(bubbleGeometry({ ...round, tail: { ...round.tail, enabled: false } }).tail).toBeNull();
    expect(bubbleGeometry({ ...round, tail: { ...round.tail, enabled: true, x: 1, y: 1 } }).tail).toBeNull();
    const narration = newBubbleLayer(scene, 'narration', 'a');
    expect(bubbleGeometry({ ...narration, tail: { ...narration.tail, enabled: true } }).tail).toBeNull();
  });

  it('trails circles from a thought cloud and dashes a whisper', () => {
    const cloud = newBubbleLayer(scene, 'cloud', 'a');
    const geo = bubbleGeometry({ ...cloud, tail: { ...cloud.tail, enabled: true, x: 0, y: cloud.height } });
    expect(geo.circles).toHaveLength(3);
    expect(geo.circles[0]!.r).toBeGreaterThan(geo.circles[2]!.r);
    expect(bubbleGeometry(newBubbleLayer(scene, 'whisper', 'a')).dashed).toBe(true);
  });

  it('makes the same burst from the same seed', () => {
    const burst = newBubbleLayer(scene, 'burst', 'a');
    expect(bubbleGeometry({ ...burst, seed: 3 }).body).toEqual(bubbleGeometry({ ...burst, seed: 3 }).body);
    expect(bubbleGeometry({ ...burst, seed: 3 }).body).not.toEqual(bubbleGeometry({ ...burst, seed: 4 }).body);
  });

  it('points a burst spike at the target', () => {
    const burst = newBubbleLayer(scene, 'burst', 'a');
    const geo = bubbleGeometry({ ...burst, tail: { ...burst.tail, enabled: true, x: 0, y: burst.height * 1.5 } });
    expect(commandBounds(geo.body).maxY).toBe(burst.height * 1.5);
  });

  it('measures the outline distance of ellipses and rectangles', () => {
    expect(boundaryRadius('round', 100, 50, 0)).toBeCloseTo(100);
    expect(boundaryRadius('round', 100, 50, Math.PI / 2)).toBeCloseTo(50);
    expect(boundaryRadius('box', 100, 50, 0)).toBeCloseTo(100);
    expect(boundaryRadius('box', 100, 50, Math.PI / 4)).toBeCloseTo(50 * Math.SQRT2);
  });

  it('gives the same random numbers for a seed', () => {
    const a = seeded(5);
    const b = seeded(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
