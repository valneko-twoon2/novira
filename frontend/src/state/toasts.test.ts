import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettings } from './settings';
import { toast, useToasts } from './toasts';

beforeEach(() => {
  vi.useFakeTimers();
  useToasts.setState({ toasts: [] });
});
afterEach(() => vi.useRealTimers());

const titles = () => useToasts.getState().toasts.map((t) => t.title);

describe('toasts', () => {
  it('dismisses a toast after its duration', () => {
    const id = toast({ status: 'info', title: 'a' }, 1000);
    expect(useToasts.getState().toasts.map((t) => t.id)).toEqual([id]);
    vi.advanceTimersByTime(999);
    expect(titles()).toEqual(['a']);
    vi.advanceTimersByTime(1);
    expect(titles()).toEqual([]);
  });

  it('stays as long as the setting says when no duration is given', () => {
    useSettings.getState().set({ toastSeconds: 6 });
    toast({ status: 'info', title: 'b' });
    vi.advanceTimersByTime(5999);
    expect(titles()).toEqual(['b']);
    vi.advanceTimersByTime(1);
    expect(titles()).toEqual([]);
    useSettings.getState().reset();
  });

  it('keeps a toast with no duration until it is dismissed', () => {
    const id = toast({ status: 'error', title: 'sticky' }, 0);
    vi.advanceTimersByTime(60_000);
    expect(titles()).toEqual(['sticky']);
    useToasts.getState().dismiss(id);
    expect(titles()).toEqual([]);
  });

  it('shows at most the five newest toasts', () => {
    for (let i = 1; i <= 7; i++) toast({ status: 'info', title: String(i) }, 0);
    expect(titles()).toEqual(['3', '4', '5', '6', '7']);
  });

  it('gives every toast a distinct id', () => {
    const a = toast({ status: 'info', title: 'a' });
    const b = toast({ status: 'info', title: 'b' });
    expect(a).not.toBe(b);
  });
});
