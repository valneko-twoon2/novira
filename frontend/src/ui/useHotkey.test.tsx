// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chordLabel, useHotkey } from './useHotkey';

afterEach(cleanup);

const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = window) => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};

describe('useHotkey', () => {
  it('runs on the exact chord only, with Ctrl as mod outside macOS', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('mod+enter', handler));
    press('Enter');
    press('Enter', { ctrlKey: true, shiftKey: true });
    expect(handler).not.toHaveBeenCalled();
    const e = press('Enter', { ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
    expect(e.defaultPrevented).toBe(true);
  });

  it('accepts several chords and the named keys', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey(['space', 'delete', 'shift+x'], handler));
    press(' ');
    press('Backspace');
    press('Delete');
    press('X', { shiftKey: true });
    press('x');
    expect(handler).toHaveBeenCalledTimes(4);
  });

  it('leaves Ctrl+C and Ctrl+X to the browser while text is selected on the page', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey(['mod+c', 'mod+x'], handler));
    const { getByText } = render(<p>selected words</p>);
    const range = document.createRange();
    range.selectNodeContents(getByText('selected words'));
    window.getSelection()?.addRange(range);
    for (const key of ['c', 'x']) expect(press(key, { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(handler).not.toHaveBeenCalled();
    window.getSelection()?.removeAllRanges();
    expect(press('c', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('leaves Ctrl+C to the browser while text is selected inside a text field', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('mod+c', handler, { allowInInput: true }));
    const { getByRole } = render(<input defaultValue="some text" />);
    const input = getByRole('textbox') as HTMLInputElement;
    input.setSelectionRange(0, 4);
    expect(press('c', { ctrlKey: true }, input).defaultPrevented).toBe(false);
    input.setSelectionRange(2, 2);
    press('c', { ctrlKey: true }, input);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('keeps other chords working while text is selected', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('mod+s', handler));
    const { getByText } = render(<p>words</p>);
    const range = document.createRange();
    range.selectNodeContents(getByText('words'));
    window.getSelection()?.addRange(range);
    press('s', { ctrlKey: true });
    window.getSelection()?.removeAllRanges();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('labels the plus and minus keys, which a chord cannot spell', () => {
    expect(chordLabel('mod+plus')).toBe('Ctrl++');
    expect(chordLabel('mod+minus')).toBe('Ctrl+-');
  });

  it('matches plus and minus with or without Shift, and on the numpad', () => {
    const zoomIn = vi.fn();
    const zoomOut = vi.fn();
    renderHook(() => {
      useHotkey('mod+plus', zoomIn);
      useHotkey('mod+minus', zoomOut);
    });
    press('=', { ctrlKey: true });
    press('+', { ctrlKey: true, shiftKey: true });
    press('+', { ctrlKey: true, code: 'NumpadAdd' });
    press('+');
    expect(zoomIn).toHaveBeenCalledTimes(3);
    press('-', { ctrlKey: true });
    press('Subtract', { ctrlKey: true, code: 'NumpadSubtract' });
    press('-', { ctrlKey: true, altKey: true });
    expect(zoomOut).toHaveBeenCalledTimes(2);
  });

  it('ignores keys typed into a field unless allowed', () => {
    const plain = vi.fn();
    const inInput = vi.fn();
    renderHook(() => {
      useHotkey('g', plain);
      useHotkey('h', inInput, { allowInInput: true });
    });
    const { getByRole } = render(<input aria-label="field" />);
    const input = getByRole('textbox');
    fireEvent.keyDown(input, { key: 'g' });
    fireEvent.keyDown(input, { key: 'h' });
    expect(plain).not.toHaveBeenCalled();
    expect(inInput).toHaveBeenCalledOnce();
  });

  it('does nothing while disabled and leaves the default when asked', () => {
    const handler = vi.fn();
    const { rerender } = renderHook(({ enabled }) => useHotkey('g', handler, { enabled, preventDefault: false }), { initialProps: { enabled: false } });
    press('g');
    expect(handler).not.toHaveBeenCalled();
    rerender({ enabled: true });
    const e = press('g');
    expect(handler).toHaveBeenCalledOnce();
    expect(e.defaultPrevented).toBe(false);
  });

  it('calls the latest handler and stops listening on unmount', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(({ fn }) => useHotkey('g', fn), { initialProps: { fn: first } });
    rerender({ fn: second });
    press('g');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    unmount();
    press('g');
    expect(second).toHaveBeenCalledOnce();
  });
});

describe('chordLabel', () => {
  it('shows chords for menus', () => {
    expect(chordLabel('mod+shift+enter')).toBe('Ctrl+Shift+Enter');
    expect(chordLabel('g')).toBe('G');
    expect(chordLabel('mod+plus')).toBe('Ctrl++');
    expect(chordLabel('mod+minus')).toBe('Ctrl+-');
  });
});
