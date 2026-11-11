// @vitest-environment jsdom
// The tooltip: closed it is only handlers on its control; it opens on a shown (keyboard) focus at once and on hover after the
// delay. jsdom, like a browser, counts a focus after a key press as `:focus-visible` and one after a click as not, so `focus()`
// here presses Tab first.
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
/** A keyboard focus: Tab, then the focus it moves. */
const focus = () => {
  fireEvent.keyDown(document, { key: 'Tab' });
  act(() => button().focus());
};
const blur = () => act(() => button().blur());

describe('Tooltip', { tags: [] }, () => {
  it('adds nothing but handlers and its state while closed', { tags: ['state-transition'] }, () => {
    render(
      <Tooltip content="Go there">
        <button type="button">go</button>
      </Tooltip>,
    );
    expect(button().getAttribute('data-state')).toBe('closed');
    expect(button().hasAttribute('aria-describedby')).toBe(false);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens at once on focus, describes the control, and closes on blur', { tags: ['state-transition'] }, () => {
    render(
      <Tooltip content="Go there" side="right">
        <button type="button">go</button>
      </Tooltip>,
    );
    focus();
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toBe('Go there');
    expect(tip.className).toBe('ui-tooltip');
    expect(button().getAttribute('aria-describedby')).toBe(tip.id);
    expect(button().getAttribute('data-state')).toBe('delayed-open');
    expect(tip.style.visibility).toBe('');
    blur();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it(
    'does not open on a focus the browser does not show, as when a dialog closed by the mouse gives the focus back',
    { tags: ['regression', 'condition'] },
    () => {
      render(
        <Tooltip content="Go there">
          <button type="button">go</button>
        </Tooltip>,
      );
      const el = button();
      const real = Element.prototype.matches;
      const matches = vi.spyOn(el, 'matches').mockImplementation((selector) => selector !== ':focus-visible' && real.call(el, selector));
      focus();
      expect(screen.queryByRole('tooltip')).toBeNull();
      expect(button().getAttribute('data-state')).toBe('closed');
      // Hovering it still shows the tooltip.
      fireEvent.pointerMove(button());
      act(() => vi.advanceTimersByTime(400));
      expect(screen.getByRole('tooltip').textContent).toBe('Go there');
      matches.mockRestore();
    },
  );

  it(
    'opens on hover after 400 ms, closes on leaving, and opens the next one at once for a moment',
    { tags: ['state-transition', 'boundary'] },
    () => {
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
    },
  );

  it('does not open when the pointer leaves before the delay', { tags: ['boundary', 'state-transition'] }, () => {
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

  it('closes on a press, and the focus the press gives does not open it', { tags: ['state-transition', 'regression'] }, () => {
    render(
      <Tooltip content="Go there">
        <button type="button">go</button>
      </Tooltip>,
    );
    focus();
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.pointerDown(button());
    expect(screen.queryByRole('tooltip')).toBeNull();
    blur();
    focus();
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.pointerUp(document);
    blur();
    focus();
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('closes on Escape and on a click', { tags: ['state-transition'] }, () => {
    render(
      <Tooltip content="Go there">
        <button type="button">go</button>
      </Tooltip>,
    );
    focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    blur();
    focus();
    fireEvent.click(button());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it("keeps the control's own handlers, state and ref", { tags: ['condition'] }, () => {
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
    focus();
    expect(onFocus).toHaveBeenCalledOnce();
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.click(button());
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows the control alone when there is nothing to say', { tags: ['boundary'] }, () => {
    render(
      <Tooltip content="">
        <button type="button">go</button>
      </Tooltip>,
    );
    expect(button().hasAttribute('data-state')).toBe(false);
    focus();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
