// @vitest-environment jsdom
// The desktop app drops the browser's own menu and shortcuts; text fields keep their menu.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let kind: 'tauri' | 'mock' = 'tauri';
vi.mock('@/backend', async (orig) => {
  const real = await orig<typeof import('@/backend')>();
  return {
    ...real,
    backend: new Proxy(real.backend, { get: (target, prop) => (prop === 'kind' ? kind : Reflect.get(target, prop)) }),
  };
});

const { NativeFeel, isBrowserShortcut } = await import('./NativeFeel');

function fire(target: EventTarget, type: string): boolean {
  const e = new Event(type, { bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e.defaultPrevented;
}

describe('NativeFeel', () => {
  it('treats a key event with no key (some autofill and IME events) as no shortcut', () => {
    expect(isBrowserShortcut({ key: undefined as unknown as string, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false })).toBe(false);
  });

  afterEach(() => {
    cleanup();
    kind = 'tauri';
  });

  it('cancels the context menu on the page but not in a text field', () => {
    render(
      <div>
        <p data-testid="text">x</p>
        <input data-testid="field" />
        <textarea data-testid="area" />
        <input data-testid="range" type="range" />
        <NativeFeel />
      </div>,
    );
    expect(fire(document.querySelector('[data-testid=text]')!, 'contextmenu')).toBe(true);
    expect(fire(document.querySelector('[data-testid=range]')!, 'contextmenu')).toBe(true);
    expect(fire(document.querySelector('[data-testid=field]')!, 'contextmenu')).toBe(false);
    expect(fire(document.querySelector('[data-testid=area]')!, 'contextmenu')).toBe(false);
  });

  it('stops a dropped file from navigating the window', () => {
    render(<NativeFeel />);
    const e = new Event('drop', { cancelable: true }) as Event & { dataTransfer?: unknown };
    e.dataTransfer = { types: ['Files'] };
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it('does nothing in a browser', () => {
    kind = 'mock';
    render(<NativeFeel />);
    expect(fire(document.body, 'contextmenu')).toBe(false);
  });

  it('names the browser shortcuts only', () => {
    const k = (key: string, init: Partial<KeyboardEvent> = {}) => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...init });
    expect(isBrowserShortcut(k('F5'))).toBe(true);
    expect(isBrowserShortcut(k('r', { ctrlKey: true }))).toBe(true);
    expect(isBrowserShortcut(k('p', { ctrlKey: true }))).toBe(true);
    expect(isBrowserShortcut(k('ArrowLeft', { altKey: true }))).toBe(true);
    expect(isBrowserShortcut(k('r'))).toBe(false);
    // Vitest runs as a development build, where the developer tools keys stay.
    expect(isBrowserShortcut(k('F12'))).toBe(!import.meta.env.DEV);
    expect(isBrowserShortcut(k('z', { ctrlKey: true }))).toBe(false);
    expect(isBrowserShortcut(k('Enter', { ctrlKey: true }))).toBe(false);
    expect(isBrowserShortcut(k('s', { ctrlKey: true, shiftKey: true }))).toBe(false);
  });
});
