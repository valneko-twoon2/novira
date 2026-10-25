// @vitest-environment jsdom
// The tooltip: closed it is only handlers on its control; it opens on focus at once and on hover after the delay.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from './Tooltip';

// Each test starts the clock again, so it starts well past the moment the last test's tooltip closed (when the next one
// would open without the delay).
let start = 0;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  start += 10_000;
  vi.advanceTimersByTime(start);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const button = () => screen.getByRole('button', { name: 'go' });

describe('Tooltip', () => {
  it('adds nothing but handlers and its state while closed', () => {
    render(
      <Tooltip content="Go there">
        <button type="button">go</button>
      </Tooltip>,
    );
    expect(button().getAttribute('data-state')).toBe('closed');
    expect(button().hasAttribute('aria-describedby')).toBe(false);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens at once on focus, describes the control, and closes on blur', () => {
    render(
      <Tooltip content="Go there" side="right">
        <button type="button">go</button>
      </Tooltip>,
    );
    fireEvent.focus(button());
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toBe('Go there');
    expect(tip.className).toBe('ui-tooltip');
    expect(button().getAttribute('aria-describedby')).toBe(tip.id);
    expect(button().getAttribute('data-state')).toBe('delayed-open');
    expect(tip.style.visibility).toBe('');
    fireEvent.blur(button());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens on hover after 400 ms, closes on leaving, and opens the next one at once for a moment', () => {
    render(
      <>
        <Tooltip content="First">
          <button type="button">go</button>
        </Tooltip>
        <Tooltip content="Second">
          <button type="button">next</button>
        </Tooltip>
      </>,
    );
    fireEvent.pointerMove(button());
    act(() => vi.advanceTimersByTime(399));
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('tooltip').textContent).toBe('First');
    fireEvent.pointerLeave(button());
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.pointerMove(screen.getByRole('button', { name: 'next' }));
    expect(screen.getByRole('tooltip').textContent).toBe('Second');
  });

  it('does not open when the pointer leaves before the delay', () => {
    render(
      <Tooltip content="Go there">
        <button type="button">go</button>
      </Tooltip>,
    );
    fireEvent.pointerMove(button());
    fireEvent.pointerLeave(button());
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('closes on a press, and the focus the press gives does not open it', () => {
    render(
      <Tooltip content="Go there">
        <button type="button">go</button>
      </Tooltip>,
    );
    fireEvent.focus(button());
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.pointerDown(button());
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.focus(button());
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.pointerUp(document);
    fireEvent.blur(button());
    fireEvent.focus(button());
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('closes on Escape and on a click', () => {
    render(
      <Tooltip content="Go there">
        <button type="button">go</button>
      </Tooltip>,
    );
    fireEvent.focus(button());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.blur(button());
    fireEvent.focus(button());
    fireEvent.click(button());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it("keeps the control's own handlers, state and ref", () => {
    const onFocus = vi.fn();
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(
      <Tooltip content="Go there">
        <button type="button" ref={ref} data-state="open" onFocus={onFocus} onClick={onClick}>
          go
        </button>
      </Tooltip>,
    );
    expect(ref.current).toBe(button());
    expect(button().getAttribute('data-state')).toBe('open');
    fireEvent.focus(button());
    expect(onFocus).toHaveBeenCalledOnce();
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.click(button());
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows the control alone when there is nothing to say', () => {
    render(
      <Tooltip content="">
        <button type="button">go</button>
      </Tooltip>,
    );
    expect(button().hasAttribute('data-state')).toBe(false);
    fireEvent.focus(button());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
