// The limits a canvas store can enforce (a comic page has them): adding or duplicating a layer, converting one, and adding
// an object are refused at the limit with the store telling its host, and allowed one below it.
import { describe, expect, it, vi } from 'vitest';
import { createCanvasStore, entityLimitHit, type CanvasObject } from './canvas';

const limits = { rasters: 4, masks: 2, objects: 3 };
const dot = (id: string): CanvasObject => ({ kind: 'rect', id, x: 0, y: 0, width: 1, height: 1, color: { r: 0, g: 0, b: 0, a: 1 } });
const make = () => {
  const onLimit = vi.fn();
  return { store: createCanvasStore({ syncParams: false, limits, onLimit }), onLimit };
};

describe('entity limits', () => {
  it('allows the last raster layer and refuses the one over it', () => {
    const { store, onLimit } = make();
    for (let i = 0; i < limits.rasters; i++) expect(store.getState().addEntity('raster')).not.toBe('');
    expect(onLimit).not.toHaveBeenCalled();
    const past = store.getState().past.length;
    expect(store.getState().addEntity('raster')).toBe('');
    expect(onLimit).toHaveBeenCalledWith('rasters');
    expect(store.getState().entities).toHaveLength(limits.rasters);
    expect(store.getState().past).toHaveLength(past);
  });

  it('counts inpaint and regional layers together as masks, and leaves other kinds alone', () => {
    const { store, onLimit } = make();
    store.getState().addEntity('inpaint');
    store.getState().addEntity('regional');
    expect(store.getState().addEntity('inpaint')).toBe('');
    expect(store.getState().addEntity('regional')).toBe('');
    expect(onLimit).toHaveBeenCalledTimes(2);
    expect(onLimit).toHaveBeenLastCalledWith('masks');
    expect(store.getState().addEntity('control')).not.toBe('');
  });

  it('refuses to duplicate and to convert at the limit, and allows both below it', () => {
    const { store, onLimit } = make();
    const first = store.getState().addEntity('raster');
    store.getState().duplicateEntity(first);
    expect(store.getState().entities).toHaveLength(2);
    store.getState().addEntity('raster');
    store.getState().addEntity('raster');
    store.getState().duplicateEntity(first);
    expect(store.getState().entities).toHaveLength(4);
    expect(onLimit).toHaveBeenLastCalledWith('rasters');
    const mask = store.getState().addEntity('inpaint');
    store.getState().addEntity('inpaint');
    store.getState().convertEntity(first, 'inpaint');
    expect(store.getState().entities.find((e) => e.id === first)?.type).toBe('raster');
    expect(onLimit).toHaveBeenLastCalledWith('masks');
    expect(mask).not.toBe('');
  });

  it('refuses the object over the limit of one layer, and a patch that grows it', () => {
    const { store, onLimit } = make();
    const id = store.getState().addEntity('raster');
    for (let i = 0; i < limits.objects; i++) store.getState().addObject(id, dot(`o${i}`));
    expect(onLimit).not.toHaveBeenCalled();
    store.getState().addObject(id, dot('over'));
    expect(onLimit).toHaveBeenCalledWith('objects');
    const layer = () => store.getState().entities.find((e) => e.id === id)!;
    expect(layer().objects).toHaveLength(limits.objects);
    const grown = [...layer().objects, dot('x')];
    store.getState().updateEntity(id, { objects: grown });
    expect(layer().objects).toHaveLength(limits.objects);
    // A patch that does not grow it (a transform) still works.
    store.getState().updateEntity(id, { objects: layer().objects.slice(0, 2) });
    expect(layer().objects).toHaveLength(2);
  });

  it('has no limit without limits', () => {
    const store = createCanvasStore({ syncParams: false });
    for (let i = 0; i < 40; i++) expect(store.getState().addEntity('raster')).not.toBe('');
    expect(entityLimitHit(store.getState().entities, 'raster', undefined)).toBeNull();
  });
});
