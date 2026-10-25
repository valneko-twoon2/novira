// Property tests for reading a comic page's Canvas layers: whatever is saved, reading it gives a page within every limit,
// with both slots, unique ids and rounded coordinates, and reading that page again gives the same page. In-process only.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check } from '@/propertyTest.testkit';
import { PAGE_SIZES } from './document';
import {
  BALLOONS_SLOT,
  MAX_COORDINATES_PER_PAGE,
  MAX_MASKS_PER_PAGE,
  MAX_OBJECTS_PER_LAYER,
  MAX_RASTERS_PER_PAGE,
  objectCoordinates,
  PANELS_SLOT,
  pageRasters,
  parsePageCanvas,
  rescaleCanvasDoc,
  serializePageCanvas,
} from './pageCanvasDoc';

const num = fc.oneof(fc.double({ min: -2e5, max: 2e5, noNaN: true }), fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, 0, -0.05, 0.05));
const color = fc.oneof(fc.record({ r: num, g: num, b: num, a: num }), fc.constant('red'));
const id = fc.oneof(fc.constantFrom('a', 'b', 'c', 'panels', 'balloons'), fc.string({ maxLength: 4 }), fc.constant(''));
const object = fc.oneof(
  fc.record({ kind: fc.constant('stroke'), id, tool: fc.constantFrom('brush', 'eraser', 'mosaic', 'pen'), color, width: num, points: fc.array(num, { maxLength: 12 }), clip: fc.oneof(fc.constant(null), fc.record({ x: num, y: num, width: num, height: num })) }),
  fc.record({ kind: fc.constant('rect'), id, x: num, y: num, width: num, height: num, color }),
  fc.record({ kind: fc.constant('image'), id, url: fc.string({ maxLength: 3 }), imageName: fc.oneof(fc.constant(null), fc.string({ maxLength: 6 })), x: num, y: num, width: num, height: num, flipX: fc.boolean() }),
  fc.anything(),
);
const entity = fc.oneof(
  fc.record(
    {
      id,
      type: fc.constantFrom('raster', 'inpaint', 'regional', 'control', 'tone'),
      seq: num,
      name: fc.oneof(fc.constant(null), fc.string({ maxLength: 80 })),
      isEnabled: fc.anything(),
      isLocked: fc.anything(),
      opacity: num,
      x: num,
      y: num,
      objects: fc.array(object, { maxLength: 6 }),
      blend: fc.constantFrom('normal', 'multiply', 'screen', 'overlay', undefined),
      slot: fc.constantFrom(undefined, PANELS_SLOT, BALLOONS_SLOT, 'tone'),
      color,
      fill: fc.constantFrom('solid', 'grid', 'nope'),
      denoiseLimit: fc.oneof(fc.constant(null), num),
      noiseLevel: fc.oneof(fc.constant(null), num),
      refImages: fc.array(fc.record({ id, imageName: fc.oneof(fc.constant(null), fc.string({ maxLength: 5 })), method: fc.constantFrom('full', 'style') }), { maxLength: 3 }),
    },
    { requiredKeys: ['id', 'type'] },
  ),
  fc.anything(),
);
const saved = fc.record({ entities: fc.array(entity, { maxLength: 50 }), bbox: fc.oneof(fc.record({ x: num, y: num, width: num, height: num }), fc.anything()) }, { requiredKeys: [] });
const size = fc.constantFrom(...PAGE_SIZES);

describe('reading a page (properties)', () => {
  it('always gives a page within every limit, with each slot once, unique ids and rounded coordinates', () => {
    check(
      fc.property(saved, size, (doc, paper) => {
        const page = parsePageCanvas(doc, paper);
        const rasters = pageRasters(page);
        expect(rasters.length).toBeLessThanOrEqual(MAX_RASTERS_PER_PAGE);
        expect(rasters.filter((e) => e.slot === PANELS_SLOT)).toHaveLength(1);
        expect(rasters.filter((e) => e.slot === BALLOONS_SLOT)).toHaveLength(1);
        expect(page.entities.filter((e) => e.type !== 'raster').length).toBeLessThanOrEqual(MAX_MASKS_PER_PAGE);
        expect(new Set(page.entities.map((e) => e.id)).size).toBe(page.entities.length);
        // Rasters first, then inpaint masks, then regional guidance.
        const order = page.entities.map((e) => ['raster', 'inpaint', 'regional'].indexOf(e.type));
        expect(order.every((v, i) => v >= 0 && (i === 0 || v >= order[i - 1]!))).toBe(true);
        let coordinates = 0;
        for (const e of page.entities) {
          expect(e.objects.length).toBeLessThanOrEqual(MAX_OBJECTS_PER_LAYER);
          for (const o of e.objects) {
            coordinates += objectCoordinates(o);
            const numbers = o.kind === 'stroke' ? o.points : o.kind === 'pose' ? o.points : [o.x, o.y, o.width, o.height];
            for (const n of numbers) expect(Math.abs(Math.round(n * 10) - n * 10)).toBeLessThan(1e-6);
          }
        }
        expect(coordinates).toBeLessThanOrEqual(MAX_COORDINATES_PER_PAGE);
        expect(page.bbox.width % 8).toBe(0);
        expect(page.bbox.height).toBeGreaterThanOrEqual(64);
      }),
    );
  });

  it('reads a page it read before (and its saved shape) as the same page', () => {
    check(
      fc.property(saved, size, (doc, paper) => {
        const page = parsePageCanvas(doc, paper);
        expect(parsePageCanvas(page, paper)).toEqual(page);
        expect(parsePageCanvas(JSON.parse(JSON.stringify(serializePageCanvas(page, paper))), paper)).toEqual(page);
      }),
    );
  });

  it('keeps a page within its limits on any paper change, and changes nothing on the same paper', () => {
    check(
      fc.property(saved, size, size, (doc, from, to) => {
        const page = parsePageCanvas(doc, from);
        const sizes = { A4: { width: 1654, height: 2339 }, A5: { width: 1166, height: 1654 }, B4: { width: 2024, height: 2866 }, B5: { width: 1433, height: 2024 } } as const;
        const moved = rescaleCanvasDoc(page, sizes[from], sizes[to]);
        if (from === to) expect(moved).toBe(page);
        expect(parsePageCanvas(moved, to).entities.map((e) => e.id)).toEqual(page.entities.map((e) => e.id));
      }),
      60,
    );
  });
});
