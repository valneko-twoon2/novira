// @vitest-environment jsdom
// The developer log: capping, uncaught errors reaching the log and one throttled notification, console capture.
import { beforeEach, describe, expect, it } from 'vitest';
import { describeError, installDevLogCapture, isResizeObserverNotice, MAX_LOG_ENTRIES, resetDevLogThrottle, useDevLog } from './devLog';
import { useToasts } from './toasts';

describe('developer log', () => {
  beforeEach(() => {
    useDevLog.getState().clear();
    useToasts.setState({ toasts: [] });
    resetDevLogThrottle();
  });

  it('keeps only the newest lines and cuts huge messages', () => {
    const add = useDevLog.getState().add;
    for (let i = 0; i < MAX_LOG_ENTRIES + 5; i++) add({ level: 'info', source: 't', message: `line ${i}` });
    const entries = useDevLog.getState().entries;
    expect(entries).toHaveLength(MAX_LOG_ENTRIES);
    expect(entries[0]!.message).toBe('line 5');
    add({ level: 'error', source: 't', message: 'x'.repeat(10_000) });
    expect(useDevLog.getState().entries.at(-1)!.message.length).toBeLessThan(4100);
  });

  it('describes anything thrown', () => {
    expect(describeError(new TypeError('bad'))).toBe('TypeError: bad');
    expect(describeError('plain')).toBe('plain');
    expect(describeError({ code: 1 })).toBe('{"code":1}');
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(describeError(cyclic)).toBe('[object Object]');
  });

  it('logs uncaught errors and rejections, with one notification per burst', () => {
    installDevLogCapture();
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('render loop'), message: 'render loop' }));
    const rejection = new Event('unhandledrejection') as Event & { reason: unknown };
    rejection.reason = new Error('nobody awaited');
    window.dispatchEvent(rejection);
    const messages = useDevLog.getState().entries.map((e) => e.message);
    expect(messages.some((m) => m.includes('render loop'))).toBe(true);
    expect(messages.some((m) => m.includes('nobody awaited'))).toBe(true);
    expect(useToasts.getState().toasts.filter((t) => t.status === 'error')).toHaveLength(1);
  });

  it('logs the ResizeObserver loop notice as a warning without a notification', () => {
    installDevLogCapture();
    const notice = 'ResizeObserver loop completed with undelivered notifications.';
    window.dispatchEvent(new ErrorEvent('error', { message: notice }));
    window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop limit exceeded' }));
    expect(useToasts.getState().toasts).toHaveLength(0);
    const entries = useDevLog.getState().entries;
    expect(entries.map((e) => e.level)).toEqual(['warn', 'warn']);
    expect(entries[0]!.message).toBe(notice);
    // A real error after the notices is still reported.
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('real'), message: 'real' }));
    expect(useToasts.getState().toasts.filter((t) => t.status === 'error')).toHaveLength(1);
    expect(useDevLog.getState().entries.at(-1)!.level).toBe('error');
  });

  it('tells the ResizeObserver notice from other messages', () => {
    expect(isResizeObserverNotice('ResizeObserver loop completed with undelivered notifications.')).toBe(true);
    expect(isResizeObserverNotice('ResizeObserver loop limit exceeded')).toBe(true);
    expect(isResizeObserverNotice('TypeError: ResizeObserver loop completed')).toBe(false);
    expect(isResizeObserverNotice('Script error.')).toBe(false);
    expect(isResizeObserverNotice(undefined)).toBe(false);
  });

  it('copies console warnings and errors into the log', () => {
    installDevLogCapture();
    console.warn('careful', 3);
    const last = useDevLog.getState().entries.at(-1)!;
    expect(last).toMatchObject({ level: 'warn', source: 'console', message: 'careful 3' });
  });
});
