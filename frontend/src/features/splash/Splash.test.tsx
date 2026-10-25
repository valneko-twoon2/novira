// @vitest-environment jsdom
// The start-up screen: it can be opened while the engine downloads (the app then shows the progress in its banner),
// and on an engine error; not while the engine is only starting.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEngine } from '@/state/engine';
import { Splash } from './Splash';

afterEach(() => cleanup());

const setStatus = (status: object) => useEngine.setState({ status } as never);

describe('the start-up screen', () => {
  it('can be opened while the engine downloads', () => {
    setStatus({ state: 'downloading', bytes: 0, totalBytes: 0 });
    const onOpen = vi.fn();
    render(<Splash onOpen={onOpen} />);
    fireEvent.click(screen.getByTestId('splash-open-later'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('is offered on an engine error', () => {
    setStatus({ state: 'error', message: 'the engine did not start' });
    const onOpen = vi.fn();
    render(<Splash onOpen={onOpen} />);
    fireEvent.click(screen.getByTestId('splash-open'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('is not offered while the engine is only starting', () => {
    setStatus({ state: 'starting' });
    render(<Splash onOpen={vi.fn()} />);
    expect(screen.queryByTestId('splash-open-later')).toBeNull();
    expect(screen.queryByTestId('splash-open')).toBeNull();
  });
});

