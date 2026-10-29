// @vitest-environment jsdom
// The natural size of a picture by its address: null until it has loaded, then kept for the next use.
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useImageSize } from './useImageSize';

/** Stands in for Image: records itself, and loads on demand with a given size. */
const images: FakeImage[] = [];
class FakeImage {
  onload: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  src = '';
  constructor() {
    images.push(this);
  }
  load(width: number, height: number) {
    this.naturalWidth = width;
    this.naturalHeight = height;
    this.onload?.();
  }
}

beforeEach(() => {
  images.length = 0;
  vi.stubGlobal('Image', FakeImage);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the size of a picture', () => {
  it('is null without an address', () => {
    const { result } = renderHook(() => useImageSize(undefined));
    expect(result.current).toBeNull();
    expect(images).toHaveLength(0);
  });

  it('is null until the picture has loaded, then its natural size', () => {
    const { result } = renderHook(() => useImageSize('novira://a-load.png'));
    expect(result.current).toBeNull();
    expect(images[0]!.src).toBe('novira://a-load.png');
    act(() => images[0]!.load(640, 480));
    expect(result.current).toEqual({ width: 640, height: 480 });
  });

  it('is known at once for an address loaded before, without loading it again', () => {
    const first = renderHook(() => useImageSize('novira://b-cached.png'));
    act(() => images[0]!.load(100, 200));
    first.unmount();
    const second = renderHook(() => useImageSize('novira://b-cached.png'));
    expect(second.result.current).toEqual({ width: 100, height: 200 });
    expect(images).toHaveLength(1);
  });

  it('drops the size when the address goes away, and ignores a load that finishes after the hook is gone', () => {
    const { result, rerender, unmount } = renderHook(({ url }: { url: string | undefined }) => useImageSize(url), { initialProps: { url: 'novira://c-gone.png' as string | undefined } });
    act(() => images[0]!.load(10, 20));
    expect(result.current).toEqual({ width: 10, height: 20 });
    rerender({ url: undefined });
    expect(result.current).toBeNull();
    rerender({ url: 'novira://d-late.png' });
    unmount();
    // The late load only fills the cache; nothing is set on a gone hook.
    expect(() => images[1]!.load(30, 40)).not.toThrow();
  });
});
