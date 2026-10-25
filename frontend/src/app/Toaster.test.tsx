// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast, useToasts } from '@/state/toasts';
import { Toaster } from './Toaster';

afterEach(() => {
  cleanup();
  useToasts.setState({ toasts: [] });
});

describe('toaster', () => {
  it('runs a toast action and closes the toast', () => {
    const run = vi.fn();
    toast({ status: 'error', title: 'Out of memory', actions: [{ label: 'Retry smaller', run }] }, 0);
    render(<Toaster />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry smaller' }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(useToasts.getState().toasts).toEqual([]);
  });
});
