// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { useEngine } from '@/state/engine';
import { formatBytes, formatRemaining } from './EnginePanel';
import { ENGINE_START_GRACE_MS, MAX_PREPARE_MS, MIN_SPLASH_MS, useSplashGate } from './useSplashGate';

describe('start-up screen gate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useEngine.setState({ status: { state: 'ready' } });
    useComfyNodes.setState({ status: 'ready', defs: {}, error: null });
  });
  afterEach(() => vi.useRealTimers());

  it('stays for the minimum time even when everything is ready', () => {
    const { result } = renderHook(() => useSplashGate(true));
    expect(result.current.showSplash).toBe(true);
    act(() => void vi.advanceTimersByTime(MIN_SPLASH_MS + 10));
    expect(result.current.showSplash).toBe(false);
  });

  it('waits for the backend', () => {
    const { result, rerender } = renderHook(({ ready }) => useSplashGate(ready), { initialProps: { ready: false } });
    act(() => void vi.advanceTimersByTime(MIN_SPLASH_MS + 10));
    expect(result.current.showSplash).toBe(true);
    rerender({ ready: true });
    expect(result.current.showSplash).toBe(false);
  });

  it('waits while the engine is being installed', () => {
    useEngine.setState({ status: { state: 'downloading', bytes: 1, totalBytes: 10 } });
    const { result } = renderHook(() => useSplashGate(true));
    act(() => void vi.advanceTimersByTime(MIN_SPLASH_MS + 10));
    expect(result.current.showSplash).toBe(true);
  });

  it('leaves when the engine becomes ready, and does not come back for a later message', () => {
    useEngine.setState({ status: { state: 'starting' } });
    const { result } = renderHook(() => useSplashGate(true));
    act(() => void vi.advanceTimersByTime(MIN_SPLASH_MS + 10));
    expect(result.current.showSplash).toBe(true);
    act(() => useEngine.setState({ status: { state: 'ready' } }));
    expect(result.current.showSplash).toBe(false);
    act(() => useEngine.setState({ status: { state: 'error', message: 'late' } }));
    expect(result.current.showSplash).toBe(false);
  });

  it('holds on an engine error until the user opens the app', () => {
    useEngine.setState({ status: { state: 'error', message: 'boom' } });
    const { result } = renderHook(() => useSplashGate(true));
    act(() => void vi.advanceTimersByTime(MIN_SPLASH_MS + 10));
    expect(result.current.showSplash).toBe(true);
    act(() => result.current.open());
    expect(result.current.showSplash).toBe(false);
  });

  it('waits while the engine has not begun to start, instead of showing a banner a moment later', () => {
    useEngine.setState({ status: { state: 'idle' } });
    const { result } = renderHook(() => useSplashGate(true));
    act(() => void vi.advanceTimersByTime(MIN_SPLASH_MS + 10));
    expect(result.current.showSplash).toBe(true);
    expect(result.current.preparing).toBe(true);
    act(() => useEngine.setState({ status: { state: 'starting' } }));
    expect(result.current.showSplash).toBe(true);
    act(() => useEngine.setState({ status: { state: 'ready' } }));
    expect(result.current.showSplash).toBe(false);
  });

  it('opens anyway when the engine never begins', () => {
    useEngine.setState({ status: { state: 'idle' } });
    const { result } = renderHook(() => useSplashGate(true));
    act(() => void vi.advanceTimersByTime(ENGINE_START_GRACE_MS + 10));
    expect(result.current.showSplash).toBe(false);
  });

  it('reads the node list while it shows, and opens once it is read', () => {
    const load = vi.fn(async () => {});
    useComfyNodes.setState({ status: 'idle', defs: null, load });
    const { result } = renderHook(() => useSplashGate(true));
    act(() => void vi.advanceTimersByTime(MIN_SPLASH_MS + 10));
    expect(load).toHaveBeenCalled();
    expect(result.current.showSplash).toBe(true);
    act(() => useComfyNodes.setState({ status: 'loading' }));
    expect(result.current.showSplash).toBe(true);
    act(() => useComfyNodes.setState({ status: 'ready', defs: {} }));
    expect(result.current.showSplash).toBe(false);
  });

  it('does not wait for the node list forever', () => {
    useComfyNodes.setState({ status: 'loading', defs: null });
    const { result } = renderHook(() => useSplashGate(true));
    act(() => void vi.advanceTimersByTime(MAX_PREPARE_MS + 10));
    expect(result.current.showSplash).toBe(false);
  });
});

describe('engine card formatting', () => {
  it('writes sizes and the time left in the largest fitting unit', () => {
    expect(formatBytes(700 * 1024 * 1024)).toBe('700 MB');
    expect(formatBytes(2.4 * 1024 ** 3)).toBe('2.40 GB');
    expect(formatRemaining(18)).toContain('18');
    expect(formatRemaining(200)).toContain('3');
    expect(formatRemaining(3 * 3600 + 120)).toContain('3');
  });
});
