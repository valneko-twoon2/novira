// Property tests for the whole-UI zoom ladder and the sanitising of a stored zoom. In-process only (no network).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check, junkJson } from '@/propertyTest.testkit';
import { sanitizeUiZoom, stepUiZoom, UI_ZOOM_STEPS } from './uiZoom';

describe('UI zoom (properties)', () => {
  it('sanitizeUiZoom of any stored value is a usable zoom and is idempotent', () => {
    check(
      fc.property(fc.oneof(junkJson, fc.double(), fc.constantFrom(NaN, Infinity, -Infinity, 0, -1)), (v) => {
        const z = sanitizeUiZoom(v);
        expect(Number.isFinite(z)).toBe(true);
        expect(z).toBeGreaterThanOrEqual(UI_ZOOM_STEPS[0]);
        expect(z).toBeLessThanOrEqual(UI_ZOOM_STEPS[UI_ZOOM_STEPS.length - 1]!);
        expect(sanitizeUiZoom(z)).toBe(z);
      }),
    );
  });

  it('stepUiZoom moves one rung on the ladder and stays at the ends', () => {
    check(
      fc.property(fc.double({ min: 0.5, max: 3, noNaN: true }), (z) => {
        const up = stepUiZoom(z, 1);
        const down = stepUiZoom(z, -1);
        expect(UI_ZOOM_STEPS as readonly number[]).toContain(up);
        expect(UI_ZOOM_STEPS as readonly number[]).toContain(down);
        expect(up).toBeGreaterThanOrEqual(z - 1e-6);
        expect(down).toBeLessThanOrEqual(z + 1e-6);
      }),
    );
  });

  it('repeated steps reach the ends of the ladder', () => {
    let z: number = 1;
    for (let i = 0; i < UI_ZOOM_STEPS.length; i++) z = stepUiZoom(z, 1);
    expect(z).toBe(UI_ZOOM_STEPS[UI_ZOOM_STEPS.length - 1]);
    for (let i = 0; i < UI_ZOOM_STEPS.length; i++) z = stepUiZoom(z, -1);
    expect(z).toBe(UI_ZOOM_STEPS[0]);
  });
});
