// Property test for the CSS string of a canvas colour. In-process only (no network).
import fc from 'fast-check';
import { describe, it } from 'vitest';
import { check } from '@/propertyTest.testkit';
import { rgbaCss } from './rgbaCss';

const byte = fc.integer({ min: 0, max: 255 });

describe('rgbaCss (properties)', () => {
  it('rgbaCss writes the alpha it is given', () => {
    check(fc.property(byte, byte, byte, fc.double({ min: 0, max: 1, noNaN: true }), (r, g, b, a) => rgbaCss({ r, g, b, a }) === `rgba(${r}, ${g}, ${b}, ${a})`));
  });
});
