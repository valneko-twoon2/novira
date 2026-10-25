// Baking the turned pictures of migrated version 1 layers: the box a turned picture covers, the object that takes the baked
// picture, and that a project gets its pictures all at once or (when one fails) none.
import { describe, expect, it } from 'vitest';
import type { CanvasObject, RasterEntity } from '../canvas';
import { bakedObject, bakeRotations, turnedBox, withBaked } from './bakeRotation';
import type { ProjectBake } from './document';
import { defaultPageCanvas, type PageCanvas } from './pageCanvasDoc';

const bake = (extra: Partial<ProjectBake> = {}): ProjectBake => ({
  projectId: 'c1',
  pageId: 'p1',
  entityId: 'pic',
  objectId: 'pic-image',
  imageName: 'sky.png',
  cx: 500,
  cy: 400,
  width: 200,
  height: 100,
  rotation: 90,
  flipX: true,
  flipY: false,
  ...extra,
});

const picture: CanvasObject = { kind: 'image', id: 'pic-image', url: '', imageName: 'sky.png', x: 400, y: 350, width: 200, height: 100, flipX: true };
const layer: RasterEntity = { id: 'pic', type: 'raster', seq: 3, name: null, isEnabled: true, isLocked: false, opacity: 1, x: 0, y: 0, objects: [picture] };
const doc: PageCanvas = { ...defaultPageCanvas('A4'), entities: [...defaultPageCanvas('A4').entities, layer] };

describe('the box of a turned picture', () => {
  it('is the picture itself unturned or half turned, its sides swapped at a quarter turn, and wider at 45 degrees', () => {
    expect(turnedBox(200, 100, 0)).toEqual({ width: 200, height: 100 });
    const quarter = turnedBox(200, 100, 90);
    expect(quarter.width).toBeCloseTo(100);
    expect(quarter.height).toBeCloseTo(200);
    const half = turnedBox(200, 100, -180);
    expect(half.width).toBeCloseTo(200);
    const diagonal = turnedBox(100, 100, 45);
    expect(diagonal.width).toBeCloseTo(100 * Math.SQRT2);
  });
});

describe('the object of a baked picture', () => {
  it('covers the turned box about the same centre, with the new picture and no mirroring', () => {
    expect(bakedObject(bake(), 'turned.png')).toEqual({ imageName: 'turned.png', url: '', x: 450, y: 300, width: 100, height: 200 });
    const next = withBaked(doc, bake(), 'turned.png');
    expect(next.entities.at(-1)!.objects[0]).toEqual({ kind: 'image', id: 'pic-image', imageName: 'turned.png', url: '', x: 450, y: 300, width: 100, height: 200 });
  });

  it('leaves the page as it is when the object is gone', () => {
    expect(withBaked(doc, bake({ objectId: 'other' }), 'turned.png')).toBe(doc);
  });
});

describe('baking the pictures of the projects', () => {
  it('puts a project in all at once and reports a project of which one picture failed, untouched', async () => {
    const applied: [string, string[]][] = [];
    const failed = await bakeRotations(
      [bake(), bake({ objectId: 'second' }), bake({ projectId: 'c2', imageName: 'gone.png' }), bake({ projectId: 'c2' })],
      (projectId, baked) => applied.push([projectId, baked.map((b) => b.imageName)]),
      async (b) => {
        if (b.imageName === 'gone.png') throw new Error('gone');
        return `turned-${b.objectId}`;
      },
    );
    expect(applied).toEqual([['c1', ['turned-pic-image', 'turned-second']]]);
    expect(failed).toEqual(['c2']);
  });
});
