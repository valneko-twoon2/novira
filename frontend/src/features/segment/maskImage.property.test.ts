// Property tests for the mask pixel functions (selection overlay, cut-out, mosaic, transparent mask). In-process only.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check } from '@/propertyTest.testkit';
import { cutoutPixels, maskFromPixels, mosaicPixels, overlayPixels, transparentMaskPixels } from './maskImage';

const picture = fc
  .record({ width: fc.integer({ min: 1, max: 9 }), height: fc.integer({ min: 1, max: 9 }) })
  .chain(({ width, height }) =>
    fc.uint8Array({ minLength: width * height * 4, maxLength: width * height * 4 }).map((bytes) => ({ width, height, rgba: new Uint8ClampedArray(bytes) })),
  );

describe('mask pixels (properties)', () => {
  it('maskFromPixels gives one selection value per pixel, from the brightness', () => {
    check(
      fc.property(picture, ({ width, height, rgba }) => {
        const m = maskFromPixels(rgba, width, height);
        expect(m.alpha.length).toBe(width * height);
        for (let i = 0; i < m.alpha.length; i++) {
          const lo = Math.min(rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!);
          const hi = Math.max(rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!);
          expect(m.alpha[i]!).toBeGreaterThanOrEqual(lo);
          expect(m.alpha[i]!).toBeLessThanOrEqual(hi);
        }
      }),
    );
  });

  it('overlayPixels never exceeds the strength and inversion complements the selection', () => {
    check(
      fc.property(picture, fc.boolean(), fc.double({ min: 0, max: 1, noNaN: true }), ({ width, height, rgba }, invert, strength) => {
        const m = maskFromPixels(rgba, width, height);
        const o = overlayPixels(m, [1, 2, 3], invert, strength);
        const inv = overlayPixels(m, [1, 2, 3], !invert, 1);
        const plain = overlayPixels(m, [1, 2, 3], invert, 1);
        expect(o.length).toBe(width * height * 4);
        for (let i = 0; i < m.alpha.length; i++) {
          expect(o[i * 4 + 3]!).toBeLessThanOrEqual(Math.round(255 * strength));
          expect(plain[i * 4 + 3]! + inv[i * 4 + 3]!).toBe(255);
        }
      }),
    );
  });

  it('cutoutPixels only ever lowers the alpha and keeps the colours', () => {
    check(
      fc.property(picture, picture, fc.boolean(), (a, b, invert) => {
        const m = maskFromPixels(a.rgba, a.width, a.height);
        const src = new Uint8ClampedArray(a.width * a.height * 4).map((_, i) => b.rgba[i % b.rgba.length]!);
        const out = cutoutPixels(src, m, invert);
        for (let i = 0; i < m.alpha.length; i++) {
          expect(out[i * 4 + 3]!).toBeLessThanOrEqual(src[i * 4 + 3]!);
          for (let c = 0; c < 3; c++) expect(out[i * 4 + c]).toBe(src[i * 4 + c]);
        }
      }),
    );
  });

  it('mosaicPixels keeps the size, leaves unselected pixels alone and never throws for any block size', () => {
    check(
      fc.property(picture, fc.boolean(), fc.double({ min: -5, max: 40, noNaN: true }), ({ width, height, rgba }, invert, block) => {
        const m = maskFromPixels(rgba, width, height);
        const out = mosaicPixels(rgba, m, invert, block);
        expect(out.length).toBe(rgba.length);
        for (let i = 0; i < m.alpha.length; i++) {
          const selected = invert ? m.alpha[i]! < 255 : m.alpha[i]! > 0;
          if (!selected) for (let c = 0; c < 4; c++) expect(out[i * 4 + c]).toBe(rgba[i * 4 + c]);
        }
      }),
    );
  });

  it('transparentMaskPixels is white where selected', () => {
    check(
      fc.property(picture, fc.boolean(), ({ width, height, rgba }, invert) => {
        const out = transparentMaskPixels(maskFromPixels(rgba, width, height), invert);
        for (let i = 0; i < width * height; i++) expect([out[i * 4], out[i * 4 + 1], out[i * 4 + 2]]).toEqual([255, 255, 255]);
      }),
    );
  });
});
