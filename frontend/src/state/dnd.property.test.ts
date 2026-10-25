// Fuzz-style tests for drag-and-drop payload parsing: whatever a drag carries (another app, a file, hand-made text),
// reading it never throws and only ever yields image names. In-process only (no network).
import type { DragEvent } from 'react';
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import { check, junkJson, junkStored, junkText, blockExternalNetwork } from '@/propertyTest.testkit';
import { DEFERRED_MIME, getDragImages, hasDragImages, IMAGE_MIME, registerDragSource, resolveDropImages } from './dnd';

blockExternalNetwork();

const dragEvent = (data: Record<string, string>): DragEvent =>
  ({ dataTransfer: { getData: (mime: string) => data[mime] ?? '', types: Object.keys(data), setData: (m: string, v: string) => void (data[m] = v), effectAllowed: '' } }) as unknown as DragEvent;

const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach((c) => c()));

describe('drag payloads (properties)', () => {
  it('getDragImages never throws and returns only strings', () => {
    check(
      fc.property(junkStored, (raw) => {
        const names = getDragImages(dragEvent({ [IMAGE_MIME]: raw }));
        expect(Array.isArray(names)).toBe(true);
        expect(names.every((n) => typeof n === 'string')).toBe(true);
      }),
    );
  });

  it('keeps exactly the string entries of a JSON array, in order', () => {
    check(
      fc.property(fc.array(fc.oneof(junkText, fc.integer(), fc.constant(null), fc.boolean())), (items) => {
        const names = getDragImages(dragEvent({ [IMAGE_MIME]: JSON.stringify(items) }));
        expect(names).toEqual(items.filter((x): x is string => typeof x === 'string'));
      }),
    );
  });

  it('resolveDropImages resolves for any payload and returns names of registered sources only', async () => {
    cleanups.push(registerDragSource('layer', async (id) => (id.length % 2 ? `saved-${id}` : null)));
    await fc.assert(
      fc.asyncProperty(junkStored, junkStored, async (images, deferred) => {
        const out = await resolveDropImages(dragEvent({ [IMAGE_MIME]: images, [DEFERRED_MIME]: deferred }));
        expect(Array.isArray(out)).toBe(true);
        expect(out.every((n) => typeof n === 'string')).toBe(true);
      }),
      { numRuns: 100, seed: 20261007 },
    );
  });

  it('a deferred drag of an unregistered kind (or without an id) yields nothing', async () => {
    await fc.assert(
      fc.asyncProperty(junkJson, async (payload) => {
        const out = await resolveDropImages(dragEvent({ [DEFERRED_MIME]: JSON.stringify(payload) }));
        expect(out).toEqual([]);
      }),
      { numRuns: 100, seed: 20261007 },
    );
  });

  it('a registered deferred source gives its name, a failing one gives nothing and hasDragImages follows the types', async () => {
    cleanups.push(registerDragSource('k', async (id) => (id === 'none' ? null : `n-${id}`)));
    await fc.assert(
      fc.asyncProperty(junkText, async (id) => {
        const out = await resolveDropImages(dragEvent({ [DEFERRED_MIME]: JSON.stringify({ kind: 'k', id }) }));
        expect(out).toEqual(id === 'none' ? [] : [`n-${id}`]);
      }),
      { numRuns: 100, seed: 20261007 },
    );
    check(
      fc.property(fc.array(fc.oneof(fc.constantFrom(IMAGE_MIME, DEFERRED_MIME, 'Files', 'text/plain'), junkText)), (types) => {
        expect(hasDragImages(types)).toBe(types.some((t) => t === IMAGE_MIME || t === DEFERRED_MIME || t === 'Files'));
      }),
    );
  });
});
