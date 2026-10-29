// Moving a version 1 comic page to Canvas layers: whatever the saved layers hold (damaged or wild), the move never
// throws and gives a valid version 2 page (reading it again changes nothing, both slots exactly once), doing it twice gives
// the same page, and every turned picture left to bake names a layer and an image object that exist.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { blockExternalNetwork, check, junkJson } from '@/propertyTest.testkit';
import type { Size } from './imageView';
import { PAGE_SIZES } from './document';
import { migrateLayers } from './migrateLayers';
import { BALLOONS_SLOT, PANELS_SLOT, pageRasters, parsePageCanvas } from './pageCanvasDoc';

blockExternalNetwork();

const wild = fc.oneof(fc.double(), fc.integer({ min: -1000, max: 1000 }), fc.string({ maxLength: 6 }), fc.constant(null), fc.boolean());
const stroke = fc.record({ points: fc.array(wild, { maxLength: 12 }), color: fc.oneof(fc.constantFrom('#ff0000', '#00ff0a', 'red'), wild), width: wild, erase: fc.boolean() }, { requiredKeys: [] });
const view = fc.record({ cx: wild, cy: wild, scale: wild, rotation: fc.oneof(wild, fc.constantFrom(0, 90, 45, -30, 180)), flipX: fc.boolean(), flipY: fc.boolean() }, { requiredKeys: [] });
const layer = fc.oneof(
  fc.record(
    {
      id: fc.oneof(fc.constantFrom('panels', 'balloons', 'a', 'b', 'c'), fc.string({ maxLength: 4 })),
      kind: fc.constantFrom('panels', 'balloons', 'drawing', 'image', 'tone'),
      name: wild,
      visible: wild,
      locked: wild,
      opacity: wild,
      blend: fc.oneof(wild, fc.constantFrom('multiply', 'screen', 'normal')),
      strokes: fc.oneof(fc.array(stroke, { maxLength: 6 }), wild),
      imageName: fc.oneof(fc.constantFrom('x.png', 'y.png', 'gone.png'), wild),
      view: fc.oneof(view, wild),
    },
    { requiredKeys: [] },
  ),
  fc.anything(),
);
const saved = fc.oneof(fc.array(layer, { maxLength: 12 }), junkJson);
const size = fc.constantFrom(...PAGE_SIZES);
const sizes = fc.dictionary(fc.constantFrom('x.png', 'y.png'), fc.record({ width: fc.double({ min: -5, max: 4000, noNaN: true }), height: fc.double({ min: -5, max: 4000, noNaN: true }) }));
const sizeOf = (known: Record<string, Size>) => (name: string) => known[name];

describe('migrateLayers', () => {
  it('gives a valid page with both slots once, and a bake only for a turned picture that is on the page', () => {
    check(
      fc.property(saved, size, sizes, (raw, pageSize, known) => {
        const { canvas, bakes } = migrateLayers(raw, pageSize, sizeOf(known));
        expect(parsePageCanvas(canvas, pageSize)).toEqual(canvas);
        const rasters = pageRasters(canvas);
        expect(rasters.filter((r) => r.slot === PANELS_SLOT)).toHaveLength(1);
        expect(rasters.filter((r) => r.slot === BALLOONS_SLOT)).toHaveLength(1);
        for (const bake of bakes) {
          expect(bake.rotation).not.toBe(0);
          expect(Number.isFinite(bake.rotation)).toBe(true);
          const owner = rasters.find((r) => r.id === bake.entityId);
          expect(owner?.objects.some((o) => o.kind === 'image' && o.id === bake.objectId && o.imageName === bake.imageName)).toBe(true);
        }
      }),
    );
  });

  it('is repeatable: the same saved layers give the same page and the same bakes', () => {
    check(
      fc.property(saved, size, sizes, (raw, pageSize, known) => {
        expect(migrateLayers(raw, pageSize, sizeOf(known))).toEqual(migrateLayers(raw, pageSize, sizeOf(known)));
      }),
    );
  });

  it('is a page with the two slots and nothing else when the saved layers cannot be read at all', () => {
    check(
      fc.property(fc.oneof(fc.constant(undefined), fc.string(), fc.integer(), fc.constant(null)), size, (raw, pageSize) => {
        const { canvas, bakes } = migrateLayers(raw, pageSize, () => undefined);
        expect(bakes).toEqual([]);
        expect(pageRasters(canvas).map((r) => r.slot)).toEqual([PANELS_SLOT, BALLOONS_SLOT]);
        expect(pageRasters(canvas).every((r) => r.objects.length === 0)).toBe(true);
      }),
    );
  });
});
