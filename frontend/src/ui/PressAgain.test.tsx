// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PressAgainButton } from './PressAgain';

afterEach(cleanup);

describe('PressAgainButton', () => {
  it('acts on the second press, and the first press says so in the label', () => {
    const onConfirm = vi.fn();
    render(
      <PressAgainButton againLabel="Really delete" onConfirm={onConfirm}>
        Delete
      </PressAgainButton>,
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(button.textContent).toBe('Really delete');
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(button.textContent).toBe('Delete');
  });

  it('disarms when it loses focus, so a later press only arms it again', () => {
    const onConfirm = vi.fn();
    render(
      <PressAgainButton againLabel="Really delete" onConfirm={onConfirm}>
        Delete
      </PressAgainButton>,
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.blur(button);
    expect(button.textContent).toBe('Delete');
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
