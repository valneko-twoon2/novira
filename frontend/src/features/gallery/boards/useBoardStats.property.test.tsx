// @vitest-environment jsdom
// Property test for the per-board counts and cover image. In-process only (React hook on the gallery store).
import { cleanup, renderHook } from '@testing-library/react';
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import type { ImageDTO } from '@/backend';
import { check } from '@/propertyTest.testkit';
import { useGallery } from '@/state/gallery';
import { useBoardStats } from './useBoardStats';

afterEach(() => {
  cleanup();
  useGallery.setState({ images: [] });
});

const image = fc
  .record({
    createdAt: fc.integer({ min: 0, max: 1_000_000 }),
    boardId: fc.constantFrom<string | null>(null, 'a', 'b', 'c'),
    isIntermediate: fc.boolean(),
    category: fc.constantFrom<ImageDTO['category']>('general', 'user', 'mask', 'control', 'other'),
  })
  .map(
    (r): ImageDTO => ({ name: '', url: '', thumbnailUrl: '', width: 1, height: 1, starred: false, metadata: null, workflow: null, ...r }),
  );

describe('useBoardStats (properties)', () => {
  it('counts every visible image once, on its own board, and covers with the newest one', () => {
    check(
      fc.property(fc.array(image, { maxLength: 40 }), (list) => {
        const imgs = list.map((i, k) => ({ ...i, name: `i${k}` }));
        useGallery.setState({ images: imgs });
        const { result, unmount } = renderHook(() => useBoardStats());
        const visible = imgs.filter((i) => !i.isIntermediate);
        let total = 0;
        for (const [id, s] of result.current) {
          const mine = visible.filter((i) => (i.boardId ?? 'none') === id);
          expect(s.images).toBe(mine.filter((i) => i.category === 'general').length);
          expect(s.assets).toBe(mine.filter((i) => i.category !== 'general').length);
          expect(s.images + s.assets).toBeGreaterThan(0);
          expect(s.cover!.createdAt).toBe(Math.max(...mine.map((i) => i.createdAt)));
          total += s.images + s.assets;
        }
        expect(total).toBe(visible.length);
        unmount();
      }),
      80,
    );
  });
});
