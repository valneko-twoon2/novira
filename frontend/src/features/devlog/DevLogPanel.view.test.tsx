// @vitest-environment jsdom
// The developer log panel: the lines, the text filter, copying and clearing.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t, tCount } from '@/i18n';
import { useDevLog } from '@/state/devLog';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { DevLogPanel } from './DevLogPanel';

const initial = { log: useDevLog.getState(), toasts: useToasts.getState() };
const show = () =>
  render(
    <TooltipProvider>
      <DevLogPanel />
    </TooltipProvider>,
  );

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useDevLog.setState({ ...initial.log, entries: [], open: true }, true);
  useToasts.setState(initial.toasts, true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const addLines = () => {
  useDevLog.getState().add({ level: 'info', source: 'backend', message: 'started', at: Date.UTC(2026, 0, 1, 12, 0, 0) });
  useDevLog.getState().add({ level: 'warn', source: 'console', message: 'slow response' });
  useDevLog.getState().add({ level: 'error', source: 'backend', message: 'out of memory' });
};

describe('DevLogPanel', () => {
  it('says so when there is nothing to show, and keeps the buttons off', () => {
    show();
    expect(screen.getByText(t('app.devlog.empty'))).toBeTruthy();
    expect((screen.getByLabelText(t('app.devlog.copy')) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText(t('app.devlog.clear')) as HTMLButtonElement).disabled).toBe(true);
  });

  it('lists the lines with their source and filters them by text', () => {
    addLines();
    show();
    expect(screen.getAllByTestId('devlog-row')).toHaveLength(3);
    expect(screen.getByText(tCount('app.devlog.count', 3))).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(t('app.devlog.filter')), { target: { value: 'CONSOLE' } });
    expect(screen.getAllByTestId('devlog-row')).toHaveLength(1);
    fireEvent.change(screen.getByPlaceholderText(t('app.devlog.filter')), { target: { value: 'memory' } });
    expect(screen.getByText('out of memory')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(t('app.devlog.filter')), { target: { value: 'nothing like this' } });
    expect(screen.getByText(t('app.devlog.empty'))).toBeTruthy();
  });

  it('follows new lines while at the bottom, and leaves the position when scrolled up', () => {
    show();
    const list = document.querySelector('.devlog__list') as HTMLElement;
    Object.defineProperties(list, { scrollHeight: { value: 1000, configurable: true }, clientHeight: { value: 100, configurable: true } });
    act(() => addLines());
    expect(list.scrollTop).toBe(1000);
    list.scrollTop = 0;
    fireEvent.scroll(list);
    act(() => useDevLog.getState().add({ level: 'info', source: 'x', message: 'later' }));
    expect(list.scrollTop).toBe(0);
    list.scrollTop = 900;
    fireEvent.scroll(list);
    act(() => useDevLog.getState().add({ level: 'info', source: 'x', message: 'again' }));
    expect(list.scrollTop).toBe(1000);
  });

  it('copies the shown lines as text, and reports when the clipboard refuses', async () => {
    addLines();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    show();
    fireEvent.click(screen.getByLabelText(t('app.devlog.copy')));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const text = writeText.mock.calls[0]![0] as string;
    expect(text.split('\n')).toHaveLength(3);
    expect(text).toContain('2026-01-01T12:00:00.000Z INFO [backend] started');
    await waitFor(() => expect(useToasts.getState().toasts.at(-1)?.title).toBe(t('app.devlog.copied')));
    writeText.mockRejectedValue(new Error('denied'));
    fireEvent.click(screen.getByLabelText(t('app.devlog.copy')));
    await waitFor(() => expect(useToasts.getState().toasts.at(-1)?.status).toBe('error'));
  });

  it('clears the log and closes the panel', () => {
    addLines();
    show();
    fireEvent.click(screen.getByLabelText(t('app.devlog.clear')));
    expect(useDevLog.getState().entries).toEqual([]);
    fireEvent.click(screen.getByLabelText(t('app.devlog.close')));
    expect(useDevLog.getState().open).toBe(false);
  });
});
