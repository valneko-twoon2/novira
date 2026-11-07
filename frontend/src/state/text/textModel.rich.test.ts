// The AI fill of a text layer: what makes it stale and what does not.
import { describe, expect, it } from 'vitest';
import { newTextLayer, richIsCurrent, richSourceKey, type RichFill, type TextLayer } from './textModel';

const layer = (): TextLayer => newTextLayer({ width: 1000, height: 1000 }, 'NOVIRA');
const rich = (l: TextLayer): RichFill => ({ imageName: 'a.png', candidates: ['a.png'], width: 400, height: 200, fontSize: l.style.fontSize, sourceKey: richSourceKey(l) });

describe('richSourceKey', () => {
  it('does not change with colours, position, rotation, opacity or the size of the layer', () => {
    const l = layer();
    const key = richSourceKey(l);
    const moved = { ...l, x: 5, y: 9, rotation: 30, opacity: 0.4, visible: false, locked: true };
    expect(richSourceKey(moved)).toBe(key);
    expect(richSourceKey({ ...l, style: { ...l.style, fill: { kind: 'solid', color: '#ff0000' }, stroke: null, outline: { color: '#fff', width: 9 }, shadow: null } })).toBe(key);
    // Scaling with the corner handle scales the font size and the spacing together, with rounding.
    const scaled = { ...l, style: { ...l.style, fontSize: l.style.fontSize * 2, letterSpacing: l.style.letterSpacing * 2 } };
    expect(richSourceKey(scaled)).toBe(key);
  });

  it('changes with what shapes the letters', () => {
    const l = layer();
    const key = richSourceKey(l);
    expect(richSourceKey({ ...l, text: 'NOVIRA!' })).not.toBe(key);
    expect(richSourceKey({ ...l, bend: 20 })).not.toBe(key);
    for (const patch of [{ fontFamily: 'Dela Gothic One' }, { fontWeight: 400 }, { lineHeight: 2 }, { align: 'left' as const }, { vertical: true }]) {
      expect(richSourceKey({ ...l, style: { ...l.style, ...patch } })).not.toBe(key);
    }
  });

  it('counts the letter spacing as a share of the font size in steps of 2%', () => {
    const base = layer();
    const l = { ...base, style: { ...base.style, fontSize: 100, letterSpacing: 0 } };
    const key = richSourceKey(l);
    expect(richSourceKey({ ...l, style: { ...l.style, letterSpacing: 0.9 } })).toBe(key);
    expect(richSourceKey({ ...l, style: { ...l.style, letterSpacing: 5 } })).not.toBe(key);
  });
});

describe('richIsCurrent', () => {
  it('is false with no AI fill, true for the lettering it was made for and false after a change', () => {
    const l = layer();
    expect(richIsCurrent(l)).toBe(false);
    const made = { ...l, rich: rich(l) };
    expect(richIsCurrent(made)).toBe(true);
    expect(richIsCurrent({ ...made, text: 'other' })).toBe(false);
    expect(richIsCurrent({ ...made, x: 400, style: { ...made.style, fill: { kind: 'solid' as const, color: '#00ff00' } } })).toBe(true);
  });
});
