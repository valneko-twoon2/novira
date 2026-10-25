// The saved shape of canvas layers: naming page-only pictures, the saved entity, and restoring it with an injected lookup.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import type { CanvasEntity, ImageObject, RasterEntity, RegionalEntity, StrokeObject } from './canvas';
import { entitiesForSaving, forSaving, namedObjects, restoreEntities, restoreEntity, withNamedImage, type FindImage } from './canvasDocument';
import { useGallery } from './gallery';

const initialGallery = useGallery.getState();

const image = (name: string): ImageDTO =>
  ({ name, url: `asset://${name}`, thumbnailUrl: `asset://${name}`, width: 64, height: 64, isIntermediate: true, category: 'general', boardId: null }) as unknown as ImageDTO;
const stroke: StrokeObject = { kind: 'stroke', id: 's1', tool: 'brush', color: { r: 1, g: 2, b: 3, a: 1 }, width: 4, points: [0, 0, 5, 5], clip: null };
const picture = (url: string, imageName: string | null, id = 'i1'): ImageObject => ({ kind: 'image', id, url, imageName, x: 0, y: 0, width: 64, height: 64 });
const raster = (objects: RasterEntity['objects'], id = 'e1'): RasterEntity => ({ id, type: 'raster', seq: 1, name: null, isEnabled: true, isLocked: false, opacity: 1, x: 0, y: 0, objects });
const findIn =
  (...names: string[]): FindImage =>
  (name) =>
    names.includes(name) ? { url: `asset://${name}` } : undefined;

beforeEach(() => useGallery.setState(initialGallery, true));
afterEach(() => vi.restoreAllMocks());

describe('naming pictures for saving', () => {
  it('stores a page-only picture once, tells the caller its new address and keeps named pictures as they are', async () => {
    const store = vi.spyOn(backend, 'saveImageFromUrl').mockResolvedValue(image('layer-1.png'));
    const onNamed = vi.fn();
    const named = picture('asset://kept.png', 'kept.png', 'i2');
    const out = await namedObjects([stroke, picture('blob:doc-a', null), named], onNamed);
    expect(out[1]).toMatchObject({ url: 'asset://layer-1.png', imageName: 'layer-1.png' });
    expect(out[2]).toBe(named);
    expect(onNamed).toHaveBeenCalledTimes(1);
    expect(useGallery.getState().images.map((i) => i.name)).toContain('layer-1.png');
    // The same page-only address is not uploaded again.
    await namedObjects([picture('blob:doc-a', null, 'i3')], onNamed);
    expect(store).toHaveBeenCalledTimes(1);
  });

  it('leaves out a picture that cannot be stored and keeps the rest', async () => {
    vi.spyOn(backend, 'saveImageFromUrl').mockRejectedValue(new Error('disk full'));
    const onNamed = vi.fn();
    const out = await namedObjects([stroke, picture('blob:doc-b', null)], onNamed);
    expect(out).toEqual([stroke]);
    expect(onNamed).not.toHaveBeenCalled();
  });

  it('swaps a named picture into the entities that still hold it unnamed, and nothing else', () => {
    const entities: CanvasEntity[] = [raster([stroke, picture('blob:x', null)]), raster([stroke], 'e2')];
    const named = picture('asset://n.png', 'n.png');
    const out = withNamedImage(entities, named);
    expect(out[0]!.objects[1]).toBe(named);
    expect(out[1]).toBe(entities[1]);
    expect(withNamedImage(out, named)).toBe(out);
  });

  it('saves pictures by name only and drops page-only reference addresses', async () => {
    const regional = {
      ...raster([picture('asset://a.png', 'a.png')]),
      type: 'regional',
      refImages: [
        { id: 'r1', imageName: 'ref.png', imageUrl: 'asset://ref.png', modelKey: null, weight: 1, method: 'full' },
        { id: 'r2', imageName: null, imageUrl: 'blob:ref', modelKey: null, weight: 1, method: 'full' },
        { id: 'r3', imageName: null, imageUrl: 'https://x/ref.png', modelKey: null, weight: 1, method: 'full' },
      ],
    } as unknown as RegionalEntity;
    const saved = forSaving(regional) as RegionalEntity;
    expect(saved.objects[0]).toMatchObject({ url: '', imageName: 'a.png' });
    expect(saved.refImages.map((r) => r.imageUrl)).toEqual([null, null, 'https://x/ref.png']);
    const [plain] = (await entitiesForSaving([raster([stroke])], vi.fn())) as RasterEntity[];
    expect(plain!.objects).toEqual([stroke]);
  });
});

describe('restoring saved entities', () => {
  it('looks pictures up through the given lookup and drops the ones that are gone and damaged parts', () => {
    const entities = restoreEntities(
      [{ ...raster([]), objects: [stroke, picture('', 'here.png'), picture('', 'gone.png', 'i2'), { kind: 'bogus', id: 'x' }] }, { id: 'e2', type: 'unknown', objects: [] }, 'junk'],
      findIn('here.png'),
    );
    expect(entities).toHaveLength(1);
    expect(entities[0]!.objects.map((o) => o.id)).toEqual(['s1', 'i1']);
    expect(entities[0]!.objects[1]).toMatchObject({ url: 'asset://here.png' });
  });

  it('gives a regional reference its address again, or clears its name when the picture is gone', () => {
    const e = restoreEntity(
      { ...raster([]), type: 'regional', refImages: [{ id: 'r1', imageName: 'ref.png', imageUrl: null }, { id: 'r2', imageName: 'gone.png', imageUrl: null }, 'junk'] },
      findIn('ref.png'),
    ) as RegionalEntity;
    expect(e.refImages).toEqual([
      { id: 'r1', imageName: 'ref.png', imageUrl: 'asset://ref.png' },
      { id: 'r2', imageName: null, imageUrl: null },
    ]);
  });

  it('keeps a pose as it was saved and drops one with the wrong number of joints', () => {
    const pose = { kind: 'pose', id: 'p1', points: Array.from({ length: 36 }, (_, i) => i), hidden: [16], width: 4 };
    const e = restoreEntity({ id: 'c1', type: 'control', objects: [pose, { ...pose, id: 'p2', points: [1, 2] }, { ...pose, id: 'p3', hidden: 'x' }] }, findIn());
    expect(e!.objects).toEqual([pose]);
  });

  it('keeps the depth of a pose and drops a damaged one, leaving the pose flat', () => {
    const pose = { kind: 'pose', id: 'p1', points: Array.from({ length: 36 }, (_, i) => i), hidden: [], width: 4 };
    const depth = Array.from({ length: 18 }, (_, i) => i - 5);
    const e = restoreEntity({ id: 'c1', type: 'control', objects: [{ ...pose, depth }, { ...pose, id: 'p2', depth: [1, 2] }, { ...pose, id: 'p3', depth: 'x' }] }, findIn());
    const [a, b, c] = e!.objects;
    expect(a).toEqual({ ...pose, depth });
    expect(b).toEqual({ ...pose, id: 'p2' });
    expect(c).toEqual({ ...pose, id: 'p3' });
  });

  it("keeps a raster layer's blend through saving and restoring, and drops an unknown one", () => {
    for (const blend of ['normal', 'multiply', 'screen'] as const) {
      const back = restoreEntity(JSON.parse(JSON.stringify(forSaving({ ...raster([stroke]), blend }))), findIn());
      expect(back).toMatchObject({ type: 'raster', blend });
    }
    expect(restoreEntity({ ...raster([stroke]) }, findIn())).not.toHaveProperty('blend');
    expect(restoreEntity({ ...raster([stroke]), blend: 'overlay' }, findIn())).not.toHaveProperty('blend');
    expect(restoreEntity({ ...raster([stroke]), blend: 3 }, findIn())).not.toHaveProperty('blend');
  });

  it('keeps a slot through saving and restoring, without objects, and ignores a slot name that is not text', () => {
    const back = restoreEntity(JSON.parse(JSON.stringify(forSaving({ ...raster([]), slot: 'panels', opacity: 0.4 }))), findIn());
    expect(back).toMatchObject({ type: 'raster', slot: 'panels', opacity: 0.4, objects: [] });
    expect(restoreEntity({ ...raster([stroke]), slot: 'balloons' }, findIn())!.objects).toEqual([]);
    const notSlot = restoreEntity({ ...raster([stroke]), slot: 7 }, findIn());
    expect(notSlot).not.toHaveProperty('slot');
    expect(notSlot!.objects).toEqual([stroke]);
  });

  it('refuses what is not an entity', () => {
    expect(restoreEntity(null, findIn())).toBeNull();
    expect(restoreEntity({ id: 1, type: 'raster', objects: [] }, findIn())).toBeNull();
    expect(restoreEntity({ id: 'e', type: 'raster' }, findIn())).toBeNull();
  });
});
