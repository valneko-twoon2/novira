// @vitest-environment jsdom
// The desktop UI zoom: keys step the stored level, the level reaches the backend, Ctrl+0 stays the view's "fit".
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setUiZoom = vi.fn(async () => undefined);
vi.mock('@/backend', async (orig) => {
  const real = await orig<typeof import('@/backend')>();
  return { ...real, backend: { ...real.backend, kind: 'tauri', setUiZoom } };
});

const { UiZoom } = await import('./UiZoom');
const { useSettings } = await import('@/state/settings');

const press = (key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ctrlKey: true, ...init }));
  });

describe('UiZoom (desktop)', () => {
  beforeEach(() => {
    setUiZoom.mockClear();
    useSettings.getState().set({ uiZoom: 1 });
  });
  afterEach(cleanup);

  it('applies the stored level on start and after every step', () => {
    useSettings.getState().set({ uiZoom: 1.25 });
    render(<UiZoom />);
    expect(setUiZoom).toHaveBeenLastCalledWith(1.25);
    press('=');
    expect(useSettings.getState().uiZoom).toBe(1.5);
    expect(setUiZoom).toHaveBeenLastCalledWith(1.5);
    press('-');
    press('-');
    expect(useSettings.getState().uiZoom).toBe(1.1);
  });

  it('accepts the plus key of Japanese and US layouts and the keypad', () => {
    render(<UiZoom />);
    press(';');
    press('+', { shiftKey: true });
    press('+');
    expect(useSettings.getState().uiZoom).toBe(1.5);
  });

  it('leaves Ctrl+0 to the canvas and the viewer', () => {
    useSettings.getState().set({ uiZoom: 2 });
    render(<UiZoom />);
    press('0');
    expect(useSettings.getState().uiZoom).toBe(2);
  });

  it('falls back to 100 % when the stored level is broken', () => {
    useSettings.getState().set({ uiZoom: Number.NaN });
    render(<UiZoom />);
    expect(setUiZoom).toHaveBeenLastCalledWith(1);
  });
});
