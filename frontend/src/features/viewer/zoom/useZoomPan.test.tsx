// @vitest-environment jsdom
// Viewer zoom / pan: fit, wheel zoom around the cursor, clamped panning, hotkeys, double-click and reset on image change.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { docToScreen, MAX_SCALE, screenToDoc, type Size } from '@/ui/zoomMath';
import { FIT_PADDING, useZoomPan, type ZoomPan } from './useZoomPan';

const STAGE = { width: 400, height: 300 };
let zoom: ZoomPan;

function Harness({ content, resetKey, leftButtonPans }: { content: Size; resetKey: string; leftButtonPans?: boolean }) {
  zoom = useZoomPan({ content, resetKey, leftButtonPans });
  return <div ref={zoom.surfaceRef} data-testid="surface" />;
}

const surface = () => screen.getByTestId('surface');
const key = (k: string, init: KeyboardEventInit = {}) => act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })));
const keyUp = (k: string) => act(() => void window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true })));

beforeEach(() => {
  // jsdom has no layout: the surface reports the stage size, and its client rect starts at the origin.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(STAGE.width);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(STAGE.height);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useZoomPan', () => {
  it('starts fitted and centered with the viewer padding', () => {
    render(<Harness content={{ width: 1000, height: 500 }} resetKey="a" />);
    expect(zoom.stage).toEqual(STAGE);
    expect(zoom.fitted).toBe(true);
    const scale = (STAGE.width - 2 * FIT_PADDING) / 1000;
    expect(zoom.view.scale).toBeCloseTo(scale);
    expect(zoom.view.x).toBeCloseTo(FIT_PADDING);
    expect(zoom.view.y).toBeCloseTo((STAGE.height - 500 * scale) / 2);
    expect(zoom.grab).toBe(false);
  });

  it('zooms with the wheel keeping the point under the cursor fixed (Ctrl+wheel and pinch alike)', () => {
    render(<Harness content={{ width: 1000, height: 1000 }} resetKey="a" />);
    const anchor = { x: 250, y: 150 };
    const before = zoom.view;
    const doc = screenToDoc(anchor, before);
    const notPrevented = fireEvent.wheel(surface(), { deltaY: -500, clientX: anchor.x, clientY: anchor.y });
    expect(notPrevented).toBe(false);
    expect(zoom.view.scale).toBeGreaterThan(before.scale);
    expect(zoom.fitted).toBe(false);
    const after = docToScreen(doc, zoom.view);
    expect(after.x).toBeCloseTo(anchor.x);
    expect(after.y).toBeCloseTo(anchor.y);

    const mid = zoom.view;
    const doc2 = screenToDoc(anchor, mid);
    fireEvent.wheel(surface(), { deltaY: -20, ctrlKey: true, clientX: anchor.x, clientY: anchor.y });
    expect(zoom.view.scale).toBeGreaterThan(mid.scale);
    expect(docToScreen(doc2, zoom.view).x).toBeCloseTo(anchor.x);
    fireEvent.wheel(surface(), { deltaY: 300, clientX: anchor.x, clientY: anchor.y });
    expect(zoom.view.scale).toBeLessThan(mid.scale * 1.1);
  });

  it('clamps the scale and keeps the image covering the stage while panning', () => {
    render(<Harness content={{ width: 1000, height: 1000 }} resetKey="a" />);
    for (let i = 0; i < 20; i++) fireEvent.wheel(surface(), { deltaY: -1000, clientX: 200, clientY: 150 });
    expect(zoom.view.scale).toBe(MAX_SCALE);
    expect(zoom.grab).toBe(true);

    fireEvent.pointerDown(surface(), { pointerId: 1, button: 0, clientX: 200, clientY: 150 });
    expect(zoom.panning).toBe(true);
    fireEvent.pointerMove(surface(), { pointerId: 1, clientX: 100_000, clientY: 100_000 });
    expect(zoom.view.x).toBe(0);
    expect(zoom.view.y).toBe(0);
    fireEvent.pointerMove(surface(), { pointerId: 1, clientX: -100_000, clientY: -100_000 });
    expect(zoom.view.x).toBe(STAGE.width - 1000 * MAX_SCALE);
    expect(zoom.view.y).toBe(STAGE.height - 1000 * MAX_SCALE);
    fireEvent.pointerUp(surface(), { pointerId: 1 });
    expect(zoom.panning).toBe(false);
  });

  it('does not pan a fitted image, and pans by dragging once zoomed in', () => {
    render(<Harness content={{ width: 1000, height: 1000 }} resetKey="a" />);
    const fitted = zoom.view;
    fireEvent.pointerDown(surface(), { pointerId: 1, button: 0, clientX: 200, clientY: 150 });
    fireEvent.pointerMove(surface(), { pointerId: 1, clientX: 250, clientY: 150 });
    expect(zoom.panning).toBe(false);
    expect(zoom.view).toEqual(fitted);
    fireEvent.pointerUp(surface(), { pointerId: 1 });

    key('1', { ctrlKey: true });
    const start = zoom.view;
    fireEvent.pointerDown(surface(), { pointerId: 2, button: 0, clientX: 200, clientY: 150 });
    fireEvent.pointerMove(surface(), { pointerId: 2, clientX: 230, clientY: 110 });
    expect(zoom.view.x).toBeCloseTo(start.x + 30);
    expect(zoom.view.y).toBeCloseTo(start.y - 40);
    fireEvent.pointerUp(surface(), { pointerId: 2 });
  });

  it('pans with Space+drag or the middle button when the left button belongs to something else', () => {
    render(<Harness content={{ width: 1000, height: 1000 }} resetKey="a" leftButtonPans={false} />);
    key('1', { ctrlKey: true });
    const start = zoom.view;
    expect(zoom.grab).toBe(false);
    fireEvent.pointerDown(surface(), { pointerId: 1, button: 0, clientX: 200, clientY: 150 });
    fireEvent.pointerMove(surface(), { pointerId: 1, clientX: 260, clientY: 150 });
    expect(zoom.view).toEqual(start);
    fireEvent.pointerUp(surface(), { pointerId: 1 });

    fireEvent.pointerDown(surface(), { pointerId: 2, button: 1, clientX: 200, clientY: 150 });
    fireEvent.pointerMove(surface(), { pointerId: 2, clientX: 220, clientY: 150 });
    fireEvent.pointerUp(surface(), { pointerId: 2 });
    expect(zoom.view.x).toBeCloseTo(start.x + 20);

    key(' ');
    expect(zoom.grab).toBe(true);
    const mid = zoom.view;
    fireEvent.pointerDown(surface(), { pointerId: 3, button: 0, clientX: 200, clientY: 150 });
    fireEvent.pointerMove(surface(), { pointerId: 3, clientX: 190, clientY: 150 });
    fireEvent.pointerUp(surface(), { pointerId: 3 });
    expect(zoom.view.x).toBeCloseTo(mid.x - 10);
    keyUp(' ');
    expect(zoom.grab).toBe(false);
  });

  it('follows the canvas zoom hotkeys: Ctrl+1, plus / minus, Ctrl+0 (Ctrl with plus / minus zooms the whole app)', () => {
    render(<Harness content={{ width: 1000, height: 1000 }} resetKey="a" />);
    const fit = zoom.view.scale;
    key('1', { ctrlKey: true });
    expect(zoom.view.scale).toBe(1);
    key('=', { ctrlKey: true });
    expect(zoom.view.scale).toBe(1);
    key('=');
    expect(zoom.view.scale).toBe(1.25);
    key('-');
    key('-');
    expect(zoom.view.scale).toBe(0.75);
    key('0', { ctrlKey: true });
    expect(zoom.fitted).toBe(true);
    expect(zoom.view.scale).toBeCloseTo(fit);
  });

  it('toggles fit and 100% at the double-clicked point', () => {
    render(<Harness content={{ width: 1000, height: 1000 }} resetKey="a" />);
    const fitted = zoom.view;
    const anchor = { x: 210, y: 140 };
    const doc = screenToDoc(anchor, fitted);
    fireEvent.doubleClick(surface(), { clientX: anchor.x, clientY: anchor.y });
    expect(zoom.view.scale).toBe(1);
    expect(docToScreen(doc, zoom.view).x).toBeCloseTo(anchor.x);
    expect(docToScreen(doc, zoom.view).y).toBeCloseTo(anchor.y);
    fireEvent.doubleClick(surface(), { clientX: anchor.x, clientY: anchor.y });
    expect(zoom.fitted).toBe(true);
    expect(zoom.view).toEqual(fitted);
  });

  it('goes to 200% on double-click when the fit is already 100%', () => {
    render(<Harness content={{ width: 368, height: 100 }} resetKey="a" />);
    expect(zoom.view.scale).toBeCloseTo(1);
    fireEvent.doubleClick(surface(), { clientX: 200, clientY: 150 });
    expect(zoom.view.scale).toBe(2);
  });

  it('resets to fit when the image changes, also when going back to an earlier one', () => {
    const { rerender } = render(<Harness content={{ width: 1000, height: 1000 }} resetKey="a" />);
    const fitA = zoom.view;
    key('1', { ctrlKey: true });
    expect(zoom.fitted).toBe(false);
    rerender(<Harness content={{ width: 500, height: 1000 }} resetKey="b" />);
    expect(zoom.fitted).toBe(true);
    expect(zoom.view.scale).toBeCloseTo((STAGE.height - 2 * FIT_PADDING) / 1000);
    rerender(<Harness content={{ width: 1000, height: 1000 }} resetKey="a" />);
    expect(zoom.fitted).toBe(true);
    expect(zoom.view).toEqual(fitA);
  });

  it('stops listening once unmounted', () => {
    const { unmount } = render(<Harness content={{ width: 1000, height: 1000 }} resetKey="a" />);
    const el = surface();
    const view = zoom.view;
    unmount();
    fireEvent.wheel(el, { deltaY: -500, clientX: 200, clientY: 150 });
    key('1', { ctrlKey: true });
    expect(zoom.view).toEqual(view);
  });
});
