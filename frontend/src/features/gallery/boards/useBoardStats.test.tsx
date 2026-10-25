// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ImageDTO } from '@/backend';
import { useGallery } from '@/state/gallery';
import { useBoardStats } from './useBoardStats';

const initial = useGallery.getState();
let n = 0;
const image = (over: Partial<ImageDTO>): ImageDTO => ({ name: `i${n++}`, boardId: null, category: 'general', isIntermediate: false, createdAt: 0, ...over }) as ImageDTO;

beforeEach(() => useGallery.setState(initial, true));
afterEach(cleanup);

describe('useBoardStats', () => {
  it('counts general images and assets separately per board, with uncategorized pictures under none', () => {
    useGallery.setState({
      images: [
        image({ boardId: 'b1' }),
        image({ boardId: 'b1' }),
        image({ boardId: 'b1', category: 'user' }),
        image({ boardId: null }),
      ],
    });
    const stats = renderHook(() => useBoardStats()).result.current;
    expect(stats.get('b1')).toMatchObject({ images: 2, assets: 1 });
    expect(stats.get('none')).toMatchObject({ images: 1, assets: 0 });
    expect(stats.has('b2')).toBe(false);
  });

  it('uses the newest picture as the cover and skips intermediates', () => {
    const old = image({ boardId: 'b1', createdAt: 1 });
    const newest = image({ boardId: 'b1', createdAt: 5 });
    const hidden = image({ boardId: 'b1', createdAt: 9, isIntermediate: true });
    useGallery.setState({ images: [old, newest, hidden] });
    const stats = renderHook(() => useBoardStats()).result.current;
    expect(stats.get('b1')?.cover).toBe(newest);
    expect(stats.get('b1')?.images).toBe(2);
  });

  it('has no entry for a board whose only pictures are intermediates', () => {
    useGallery.setState({ images: [image({ boardId: 'b1', isIntermediate: true })] });
    expect(renderHook(() => useBoardStats()).result.current.size).toBe(0);
  });
});
