import { describe, expect, it } from 'vitest';
import { formatColor, parseColor } from './color';

describe('colour strings', () => {
  it('reads hex and rgb forms', () => {
    expect(parseColor('#FFD23F')).toEqual({ hex: '#ffd23f', alpha: 1 });
    expect(parseColor('#fa0')).toEqual({ hex: '#ffaa00', alpha: 1 });
    expect(parseColor('rgba(0, 0, 0, 0.45)')).toEqual({ hex: '#000000', alpha: 0.45 });
    expect(parseColor('rgb(255, 0, 16)')).toEqual({ hex: '#ff0010', alpha: 1 });
    expect(parseColor('not a colour')).toEqual({ hex: '#000000', alpha: 1 });
  });

  it('writes opaque colours as hex and translucent ones as rgba', () => {
    expect(formatColor({ hex: '#112233', alpha: 1 })).toBe('#112233');
    expect(formatColor({ hex: '#112233', alpha: 0.5 })).toBe('rgba(17, 34, 51, 0.5)');
  });

  it('round-trips a translucent colour', () => {
    expect(parseColor(formatColor({ hex: '#336699', alpha: 0.4 }))).toEqual({ hex: '#336699', alpha: 0.4 });
  });
});
