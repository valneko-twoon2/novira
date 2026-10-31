// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { PointerEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { usePictureGestures } from './usePictureGestures';

// The stage is 400x400 at (0,0): positions given here are relative to its centre once 200 is subtracted.
function ev(id: number, x: number, y: number, t: number) {
  return {
    pointerId: id,
    clientX: x + 200,
    clientY: y + 200,
    timeStamp: t,
    currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }), setPointerCapture: vi.fn() },
  } as unknown as PointerEvent<HTMLElement>;
}

function setup(resetKey = 'a') {
  const onSwipe = vi.fn();
  const hook = renderHook((p: { key: string }) => usePictureGestures({ picture: { width: 400, height: 400 }, stage: { width: 400, height: 400 }, resetKey: p.key, onSwipe }), {
    initialProps: { key: resetKey },
  });
  return { ...hook, onSwipe };
}

describe('usePictureGestures', () => {
  it('starts fitted', () => {
    const { result } = setup();
    expect(result.current.view).toEqual({ scale: 1, x: 0, y: 0 });
    expect(result.current.drag).toBe(0);
  });

  it('follows a swiping finger and swipes to the next picture on release', () => {
    const { result, onSwipe } = setup();
    const h = () => result.current.handlers;
    act(() => h().onPointerDown(ev(1, 100, 0, 0)));
    act(() => h().onPointerMove(ev(1, 20, 5, 100)));
    expect(result.current.drag).toBe(-80);
    act(() => h().onPointerUp(ev(1, 20, 5, 200)));
    expect(onSwipe).toHaveBeenCalledWith('next');
    expect(result.current.drag).toBe(0);
  });

  it('swipes to the previous picture to the right, and ignores a short or mostly vertical move', () => {
    const { result, onSwipe } = setup();
    const h = () => result.current.handlers;
    act(() => h().onPointerDown(ev(1, 0, 0, 0)));
    act(() => h().onPointerUp(ev(1, 100, 0, 500)));
    expect(onSwipe).toHaveBeenLastCalledWith('previous');
    onSwipe.mockClear();
    act(() => h().onPointerDown(ev(1, 0, 0, 1000)));
    act(() => h().onPointerUp(ev(1, 30, 0, 1500)));
    act(() => h().onPointerDown(ev(1, 0, 0, 2000)));
    act(() => h().onPointerUp(ev(1, 80, 200, 2500)));
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('zooms in on a double tap and back out on the next one', () => {
    const { result } = setup();
    const h = () => result.current.handlers;
    const tap = (t: number) => {
      act(() => h().onPointerDown(ev(1, 10, 10, t)));
      act(() => h().onPointerUp(ev(1, 10, 10, t + 50)));
    };
    tap(0);
    expect(result.current.view.scale).toBe(1);
    tap(150);
    expect(result.current.view.scale).toBe(2.5);
    tap(1000);
    tap(1150);
    expect(result.current.view).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('does not double-tap when the taps are far apart in time or space, or slow', () => {
    const { result } = setup();
    const h = () => result.current.handlers;
    act(() => h().onPointerDown(ev(1, 0, 0, 0)));
    act(() => h().onPointerUp(ev(1, 0, 0, 50)));
    // Too late.
    act(() => h().onPointerDown(ev(1, 0, 0, 1000)));
    act(() => h().onPointerUp(ev(1, 0, 0, 1050)));
    expect(result.current.view.scale).toBe(1);
    // Too far from the previous tap.
    act(() => h().onPointerDown(ev(1, 100, 100, 1100)));
    act(() => h().onPointerUp(ev(1, 100, 100, 1150)));
    expect(result.current.view.scale).toBe(1);
    // A long press is not a tap.
    act(() => h().onPointerDown(ev(1, 100, 100, 1200)));
    act(() => h().onPointerUp(ev(1, 100, 100, 1700)));
    act(() => h().onPointerDown(ev(1, 100, 100, 1750)));
    act(() => h().onPointerUp(ev(1, 100, 100, 1800)));
    expect(result.current.view.scale).toBe(1);
  });

  it('pinches to zoom with two fingers, then pans the zoomed picture with one', () => {
    const { result } = setup();
    const h = () => result.current.handlers;
    act(() => h().onPointerDown(ev(1, -50, 0, 0)));
    act(() => h().onPointerDown(ev(2, 50, 0, 10)));
    act(() => h().onPointerMove(ev(2, 150, 0, 50)));
    expect(result.current.view.scale).toBeCloseTo(2, 5);
    // Lift one finger: the other now pans from the pinched view.
    act(() => h().onPointerUp(ev(2, 150, 0, 100)));
    const before = result.current.view;
    act(() => h().onPointerMove(ev(1, -30, 0, 150)));
    expect(result.current.view.x).toBeCloseTo(before.x + 20, 5);
    expect(result.current.view.scale).toBeCloseTo(2, 5);
  });

  it('ignores moves and ups from a pointer that is not down', () => {
    const { result, onSwipe } = setup();
    act(() => result.current.handlers.onPointerMove(ev(9, 100, 0, 0)));
    act(() => result.current.handlers.onPointerUp(ev(9, 100, 0, 10)));
    expect(result.current.view.scale).toBe(1);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('goes back to fitted when the picture changes', () => {
    const { result, rerender } = setup('a');
    const h = () => result.current.handlers;
    act(() => h().onPointerDown(ev(1, 0, 0, 0)));
    act(() => h().onPointerUp(ev(1, 0, 0, 40)));
    act(() => h().onPointerDown(ev(1, 0, 0, 100)));
    act(() => h().onPointerUp(ev(1, 0, 0, 140)));
    expect(result.current.view.scale).toBe(2.5);
    rerender({ key: 'b' });
    expect(result.current.view).toEqual({ scale: 1, x: 0, y: 0 });
  });
});
