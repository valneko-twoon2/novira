// Unit tests for the drag payloads: gallery names, deferred sources resolved on drop, and drag detection.
import type { DragEvent } from 'react';
import { describe, expect, it } from 'vitest';
import { DEFERRED_MIME, IMAGE_MIME, hasDragImages, registerDragSource, resolveDropImages, setDeferredDrag, setDragImages } from './dnd';

function dragEvent(data: Record<string, string> = {}): DragEvent {
  const store = { ...data };
  const dataTransfer = {
    effectAllowed: 'none',
    get types() {
      return Object.keys(store);
    },
    setData: (type: string, value: string) => {
      store[type] = value;
    },
    getData: (type: string) => store[type] ?? '',
  };
  return { dataTransfer } as unknown as DragEvent;
}

describe('drag payloads', () => {
  it('passes gallery names through unchanged', async () => {
    const e = dragEvent();
    setDragImages(e, ['a.png', 'b.png']);
    expect(await resolveDropImages(e)).toEqual(['a.png', 'b.png']);
  });

  it('resolves a deferred source through its registered resolver', async () => {
    const off = registerDragSource('test-layer', async (id) => `saved-${id}.png`);
    const e = dragEvent();
    setDeferredDrag(e, 'test-layer', 'L1');
    expect(e.dataTransfer.types).toContain(DEFERRED_MIME);
    expect(await resolveDropImages(e)).toEqual(['saved-L1.png']);
    off();
    expect(await resolveDropImages(e)).toEqual([]);
  });

  it('gives nothing for an empty deferred source, an unknown kind or broken data', async () => {
    const off = registerDragSource('empty-layer', async () => null);
    const empty = dragEvent();
    setDeferredDrag(empty, 'empty-layer', 'L1');
    expect(await resolveDropImages(empty)).toEqual([]);
    off();
    const unknown = dragEvent();
    setDeferredDrag(unknown, 'nobody', 'x');
    expect(await resolveDropImages(unknown)).toEqual([]);
    expect(await resolveDropImages(dragEvent({ [DEFERRED_MIME]: '{not json' }))).toEqual([]);
    expect(await resolveDropImages(dragEvent({ [IMAGE_MIME]: '{"a":1}' }))).toEqual([]);
  });

  it('an unregister call does not remove a newer resolver of the same kind', async () => {
    const offOld = registerDragSource('k', async () => 'old.png');
    registerDragSource('k', async () => 'new.png');
    offOld();
    const e = dragEvent();
    setDeferredDrag(e, 'k', '1');
    expect(await resolveDropImages(e)).toEqual(['new.png']);
  });

  it('recognises image, deferred and file drags but not text', () => {
    expect(hasDragImages([IMAGE_MIME])).toBe(true);
    expect(hasDragImages([DEFERRED_MIME])).toBe(true);
    expect(hasDragImages(['Files'])).toBe(true);
    expect(hasDragImages(['text/plain'])).toBe(false);
  });
});
