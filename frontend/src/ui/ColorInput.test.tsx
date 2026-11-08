// @vitest-environment jsdom
// The colour picker control: a burst of changes (a picker drag fires several per frame) reaches the parent at once for the
// first and then once per frame with the latest value, and what is waiting goes out when the picker loses focus.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ColorInput } from './ColorInput';

beforeEach(() => vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const input = () => screen.getByLabelText('colour') as HTMLInputElement;
const change = (hex: string) => fireEvent.change(input(), { target: { value: hex } });
const frame = () => act(() => void vi.advanceTimersByTime(20));

describe('ColorInput', () => {
  it('sends a single change at once', () => {
    const onChange = vi.fn();
    render(<ColorInput value="#000000" onChange={onChange} aria-label="colour" />);
    change('#112233');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('#112233');
  });

  it('folds a burst into the first change and one change per frame with the latest value', () => {
    const onChange = vi.fn();
    render(<ColorInput value="#000000" onChange={onChange} aria-label="colour" />);
    for (const hex of ['#010101', '#020202', '#030303', '#040404', '#050505']) change(hex);
    expect(onChange.mock.calls.map((c) => c[0])).toEqual(['#010101']);
    frame();
    expect(onChange.mock.calls.map((c) => c[0])).toEqual(['#010101', '#050505']);
    // Nothing more arrives: the window closes and the next change is sent at once again.
    frame();
    frame();
    change('#060606');
    expect(onChange).toHaveBeenLastCalledWith('#060606');
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('shows the colour being dragged while the parent value is behind', () => {
    render(<ColorInput value="#000000" onChange={() => undefined} aria-label="colour" />);
    change('#010101');
    change('#0a0a0a');
    expect(input().value).toBe('#0a0a0a');
    frame();
    frame();
    expect(input().value).toBe('#000000');
  });

  it('sends the waiting value when the picker loses focus, and when the control goes away', () => {
    const onChange = vi.fn();
    const { unmount } = render(<ColorInput value="#000000" onChange={onChange} aria-label="colour" />);
    change('#010101');
    change('#020202');
    fireEvent.blur(input());
    expect(onChange.mock.calls.map((c) => c[0])).toEqual(['#010101', '#020202']);
    change('#030303');
    change('#040404');
    unmount();
    expect(onChange).toHaveBeenLastCalledWith('#040404');
  });
});
