import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettings } from './settings';
import { HISTORY_LIMIT, toast, useToasts } from './toasts';

beforeEach(() => {
  vi.useFakeTimers();
  useToasts.setState({ toasts: [], history: [], unread: 0, bells: 0 });
});
afterEach(() => vi.useRealTimers());

const titles = () => useToasts.getState().toasts.map((t) => t.title);

describe('toasts', () => {
  it('dismisses a toast after its duration', { tags: ['boundary'] }, () => {
    const id = toast({ status: 'info', title: 'a' }, 1000);
    expect(useToasts.getState().toasts.map((t) => t.id)).toEqual([id]);
    vi.advanceTimersByTime(999);
    expect(titles()).toEqual(['a']);
    vi.advanceTimersByTime(1);
    expect(titles()).toEqual([]);
  });

  it('stays as long as the setting says when no duration is given', { tags: ['boundary'] }, () => {
    useSettings.getState().set({ toastSeconds: 6 });
    toast({ status: 'info', title: 'b' });
    vi.advanceTimersByTime(5999);
    expect(titles()).toEqual(['b']);
    vi.advanceTimersByTime(1);
    expect(titles()).toEqual([]);
    useSettings.getState().reset();
  });

  it('keeps a toast with no duration until it is dismissed', { tags: ['boundary'] }, () => {
    const id = toast({ status: 'error', title: 'sticky' }, 0);
    vi.advanceTimersByTime(60_000);
    expect(titles()).toEqual(['sticky']);
    useToasts.getState().dismiss(id);
    expect(titles()).toEqual([]);
  });

  it('shows at most the five newest toasts', { tags: ['boundary'] }, () => {
    for (let i = 1; i <= 7; i++) toast({ status: 'info', title: String(i) }, 0);
    expect(titles()).toEqual(['3', '4', '5', '6', '7']);
  });

  it('gives every toast a distinct id', { tags: ['equivalence'] }, () => {
    const a = toast({ status: 'info', title: 'a' });
    const b = toast({ status: 'info', title: 'b' });
    expect(a).not.toBe(b);
  });
});

describe('notification history', () => {
  const history = () => useToasts.getState().history.map((n) => n.title);

  it('keeps every notification, newest first, after its toast has gone', { tags: ['equivalence'] }, () => {
    toast({ status: 'info', title: 'a' }, 1000);
    toast({ status: 'error', title: 'b' }, 1000);
    vi.advanceTimersByTime(1000);
    expect(titles()).toEqual([]);
    expect(history()).toEqual(['b', 'a']);
    expect(useToasts.getState().unread).toBe(2);
  });

  it('keeps only the newest notifications past the limit', { tags: ['boundary'] }, () => {
    for (let i = 1; i <= HISTORY_LIMIT + 2; i++) toast({ status: 'info', title: String(i) }, 0);
    expect(history()).toHaveLength(HISTORY_LIMIT);
    expect(history()[0]).toBe(String(HISTORY_LIMIT + 2));
    expect(history().at(-1)).toBe('3');
  });

  it('puts a quiet notification only in the history while a bell is mounted', { tags: ['condition'] }, () => {
    const detach = useToasts.getState().attachBell();
    toast({ status: 'success', title: 'deleted', quiet: true });
    expect(titles()).toEqual([]);
    expect(history()).toEqual(['deleted']);
    expect(useToasts.getState().unread).toBe(1);
    detach();
    toast({ status: 'success', title: 'deleted again', quiet: true }, 0);
    expect(titles()).toEqual(['deleted again']);
  });

  it('runs an action once, from the toast or from the history', { tags: ['state-transition'] }, () => {
    const run = vi.fn();
    const id = toast({ status: 'success', title: 'deleted', actions: [{ label: 'Undo', run }] }, 0);
    useToasts.getState().runAction(id, 0);
    useToasts.getState().runAction(id, 0);
    expect(run).toHaveBeenCalledTimes(1);
    expect(titles()).toEqual([]);
    expect(useToasts.getState().history[0]?.actions).toBeUndefined();
  });

  it('marks everything read, forgets one notification or all of them', { tags: ['equivalence'] }, () => {
    const a = toast({ status: 'info', title: 'a' }, 0);
    toast({ status: 'info', title: 'b' }, 0);
    useToasts.getState().markRead();
    expect(useToasts.getState().unread).toBe(0);
    useToasts.getState().forget(a);
    expect(history()).toEqual(['b']);
    expect(titles()).toEqual(['b']);
    toast({ status: 'info', title: 'c' }, 0);
    useToasts.getState().forget();
    expect(history()).toEqual([]);
    expect(useToasts.getState().unread).toBe(0);
  });
});
