// The mask of a partial redraw lands where it was painted, whatever the picture's place in its panel: going from a pixel of
// the picture to the panel the way the page draws it (pageRender: the centre, the turn, the mirror) and back through
// panelToPicture gives the same pixel.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { blockExternalNetwork, check } from '@/propertyTest.testkit';
import type { ComicImageView } from './document';
import { pictureBox, type Size } from './imageView';
import { applyMatrix, panelToPicture } from './panelFix';

blockExternalNetwork();

/** Where a pixel of the picture is shown in the panel: as pageRender draws it (translate, rotate, then mirror). */
function shown(view: ComicImageView, image: Size, panel: Size, px: number, py: number) {
  const box = pictureBox(view, image, panel);
  const qx = (px / image.width - 0.5) * box.width * (view.flipX ? -1 : 1);
  const qy = (py / image.height - 0.5) * box.height * (view.flipY ? -1 : 1);
  const t = (view.rotation * Math.PI) / 180;
  return { x: box.cx + qx * Math.cos(t) - qy * Math.sin(t), y: box.cy + qx * Math.sin(t) + qy * Math.cos(t) };
}

describe('panelToPicture (properties)', () => {
  it('undoes how the page shows the picture', () => {
    const view = fc.record({
      cx: fc.double({ min: -1, max: 2, noNaN: true }),
      cy: fc.double({ min: -1, max: 2, noNaN: true }),
      scale: fc.double({ min: 0.1, max: 8, noNaN: true }),
      rotation: fc.double({ min: -180, max: 180, noNaN: true }),
      flipX: fc.boolean(),
      flipY: fc.boolean(),
    });
    const size = fc.record({ width: fc.integer({ min: 16, max: 4096 }), height: fc.integer({ min: 16, max: 4096 }) });
    const panel = fc.record({ width: fc.double({ min: 0.05, max: 1000, noNaN: true }), height: fc.double({ min: 0.05, max: 1000, noNaN: true }) });
    check(
      fc.property(view, size, panel, fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (v, image, p, u, w) => {
        const px = u * image.width;
        const py = w * image.height;
        const on = shown(v, image, p, px, py);
        const back = applyMatrix(panelToPicture(v, image, p), on.x, on.y);
        const tolerance = 1e-6 * Math.max(image.width, image.height);
        expect(Math.abs(back.x - px)).toBeLessThan(tolerance);
        expect(Math.abs(back.y - py)).toBeLessThan(tolerance);
      }),
    );
  });
});
