// Unit tests for the desktop UI zoom ladder.
import { describe, expect, it } from 'vitest';
import { sanitizeUiZoom, stepUiZoom, UI_ZOOM_STEPS } from './uiZoom';

describe('UI zoom', () => {
  it('steps up and down the ladder', () => {
    expect(stepUiZoom(1, 1)).toBe(1.1);
    expect(stepUiZoom(1, -1)).toBe(0.9);
    expect(stepUiZoom(1.25, -1)).toBe(1.1);
  });

  it('snaps an off-ladder value to the next level in the asked direction', () => {
    expect(stepUiZoom(1.05, 1)).toBe(1.1);
    expect(stepUiZoom(1.05, -1)).toBe(1);
  });

  it('stays at the ends', () => {
    expect(stepUiZoom(UI_ZOOM_STEPS[0], -1)).toBe(0.5);
    expect(stepUiZoom(3, 1)).toBe(3);
  });

  it('falls back to 100 % for broken stored values', () => {
    expect(sanitizeUiZoom(1.5)).toBe(1.5);
    for (const bad of [undefined, null, 'x', Number.NaN, 0, 10, -1]) expect(sanitizeUiZoom(bad)).toBe(1);
  });
});
