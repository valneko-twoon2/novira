// @vitest-environment jsdom
// Vertical text with two characters set side by side in one cell (exclamation pairs, two-digit numbers).
import { describe, expect, it } from 'vitest';
import { recordingContext } from '@/backend/mock/canvas2dRecorder.testkit';
import { newTextLayer, type Scene } from '@/state/text/textModel';
import { renderScene } from './render';

function verticalScene(value: string): Scene {
  const layer = newTextLayer({ width: 400, height: 300 }, value);
  return { width: 400, height: 300, background: { kind: 'color', color: null }, layers: [{ ...layer, style: { ...layer.style, fontSize: 40, vertical: true } }] };
}

describe('vertical text with paired cells', () => {
  it('sets a pair of characters in one cell at a smaller size than a single character', () => {
    const rec = recordingContext();
    renderScene(rec.ctx, verticalScene('a12'), null);
    const drawn = rec.of('fillText').map((a) => a[0]);
    expect(drawn).toContain('12');
    expect(drawn).toContain('a');
    const fonts = rec.sets.filter((s) => s.name === 'font').map((s) => String(s.value));
    // The pair is set at 62% of the font size (24.8 px), the single character at the full size.
    expect(fonts.some((f) => f.includes('24.8px'))).toBe(true);
    expect(fonts.some((f) => f.includes('40px'))).toBe(true);
  });

  it('turns two exclamation marks into one pair cell', () => {
    const rec = recordingContext();
    renderScene(rec.ctx, verticalScene('あ!!'), null);
    expect(rec.of('fillText').map((a) => a[0])).toContain('!!');
  });
});
