import { beforeEach, describe, expect, it } from 'vitest';
import { useComicFix } from './fixState';
import { FIX_BRUSH, FIX_LIMITS, FIX_STRENGTH } from './panelFix';

beforeEach(() => useComicFix.getState().stop());

describe('marking a part of a panel picture', () => {
  it('starts on a panel and drops what was marked on another one', () => {
    const fix = useComicFix.getState();
    fix.start('a');
    fix.begin(0.1, 0.1);
    fix.setWords('a hand');
    fix.start('a');
    expect(useComicFix.getState().strokes).toHaveLength(1);
    fix.start('b');
    expect(useComicFix.getState()).toMatchObject({ panelId: 'b', strokes: [], words: '' });
  });

  it('draws strokes with the brush of the moment, takes the last one away and clears them', () => {
    const fix = useComicFix.getState();
    fix.start('a');
    fix.setBrush(0.1);
    fix.begin(0.1, 0.1);
    fix.extend(0.3, 0.3, 1);
    fix.setBrush(0.02);
    fix.begin(0.5, 0.5);
    expect(useComicFix.getState().strokes.map((s) => s.width)).toEqual([0.1, 0.02]);
    expect(useComicFix.getState().strokes[0]!.points).toEqual([0.1, 0.1, 0.3, 0.3]);
    useComicFix.getState().undoStroke();
    expect(useComicFix.getState().strokes).toHaveLength(1);
    useComicFix.getState().clear();
    expect(useComicFix.getState().strokes).toEqual([]);
  });

  it('draws nothing when no panel is marked, and keeps to the most strokes a mask holds', () => {
    const fix = useComicFix.getState();
    fix.begin(0.1, 0.1);
    fix.extend(0.2, 0.2, 1);
    expect(useComicFix.getState().strokes).toEqual([]);
    fix.start('a');
    for (let i = 0; i < FIX_LIMITS.strokes + 5; i++) useComicFix.getState().begin(0.5, 0.5);
    expect(useComicFix.getState().strokes).toHaveLength(FIX_LIMITS.strokes);
  });

  it('keeps the brush and the strength within their ranges', () => {
    const fix = useComicFix.getState();
    fix.setBrush(5);
    fix.setStrength(-1);
    expect(useComicFix.getState()).toMatchObject({ brush: FIX_BRUSH.max, strength: FIX_STRENGTH.min });
    fix.setBrush(Number.NaN);
    expect(useComicFix.getState().brush).toBe(FIX_BRUSH.min);
  });

  it('ends with nothing marked', () => {
    const fix = useComicFix.getState();
    fix.start('a');
    fix.begin(0.1, 0.1);
    fix.stop();
    expect(useComicFix.getState()).toMatchObject({ panelId: null, strokes: [] });
  });
});
