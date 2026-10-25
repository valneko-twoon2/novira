// @vitest-environment jsdom
// The engine card of the start-up screen: the three steps, the download figures and the transfer rate.
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { EnginePanel, formatBytes, StartupCard, useTransferRate, WaitCard } from './EnginePanel';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('formatBytes', () => {
  it('uses MB below a gigabyte and GB above', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatBytes(1.5 * 1024 ** 3)).toBe('1.50 GB');
  });
});

describe('useTransferRate', () => {
  it('says nothing until a second and a half of samples, then the bytes per second', () => {
    const { result, rerender } = renderHook(({ bytes, active }) => useTransferRate(bytes, active), { initialProps: { bytes: 0, active: true } });
    expect(result.current).toBeNull();
    act(() => void vi.advanceTimersByTime(1000));
    rerender({ bytes: 1000, active: true });
    expect(result.current).toBeNull();
    act(() => void vi.advanceTimersByTime(1000));
    rerender({ bytes: 4000, active: true });
    expect(result.current).toBe(2000);
  });

  it('averages over the last few seconds only, and resets when the download is not active', () => {
    const { result, rerender } = renderHook(({ bytes, active }) => useTransferRate(bytes, active), { initialProps: { bytes: 0, active: true } });
    for (let i = 1; i <= 5; i++) {
      act(() => void vi.advanceTimersByTime(2000));
      rerender({ bytes: i * 2000, active: true });
    }
    // Only the samples of the last six seconds count: 2 KB every 2 s.
    expect(result.current).toBeCloseTo(1000, 0);
    rerender({ bytes: 10000, active: false });
    expect(result.current).toBeNull();
  });
});

describe('EnginePanel', () => {
  it('marks the steps done, active and waiting, and shows the download figures', () => {
    render(<EnginePanel status={{ state: 'downloading', bytes: 50 * 1024 * 1024, totalBytes: 200 * 1024 * 1024 } as never} />);
    expect(screen.getByText('25%')).toBeTruthy();
    expect(screen.getByText(t('engine.sizeProgress', { done: '50 MB', total: '200 MB' }))).toBeTruthy();
    expect(screen.getByText(t('engine.firstRunNote'))).toBeTruthy();
    const items = document.querySelectorAll('.ep__step');
    expect([...items].map((i) => i.className)).toEqual(['ep__step is-active', 'ep__step', 'ep__step']);
  });

  it('shows the speed and the time left once the rate is known', () => {
    const view = render(<EnginePanel status={{ state: 'downloading', bytes: 0, totalBytes: 100 * 1024 * 1024 } as never} />);
    act(() => void vi.advanceTimersByTime(2000));
    view.rerender(<EnginePanel status={{ state: 'downloading', bytes: 10 * 1024 * 1024, totalBytes: 100 * 1024 * 1024 } as never} />);
    expect(screen.getByText(t('splash.engine.rate', { rate: '5 MB' }))).toBeTruthy();
    expect(document.querySelector('.ep__row--meta')).toBeTruthy();
  });

  it('shows an indeterminate bar for the later steps and when the size is unknown', () => {
    const view = render(<EnginePanel status={{ state: 'extracting' } as never} />);
    expect([...document.querySelectorAll('.ep__step')].map((i) => i.className)).toEqual(['ep__step is-done', 'ep__step is-active', 'ep__step']);
    expect(screen.queryByText(t('engine.firstRunNote'))).toBeNull();
    view.rerender(<EnginePanel status={{ state: 'starting' } as never} />);
    expect([...document.querySelectorAll('.ep__step')].map((i) => i.className)).toEqual(['ep__step is-done', 'ep__step is-done', 'ep__step is-active']);
    view.rerender(<EnginePanel status={{ state: 'downloading', bytes: 0, totalBytes: 0 } as never} />);
    expect(screen.queryByText('0%')).toBeNull();
  });
});

describe('cards', () => {
  it('announces an error card as an alert and a plain one as a status', () => {
    render(
      <>
        <StartupCard icon={null} heading="Broken" sub="details" tone="error" testId="bad" />
        <StartupCard icon={null} heading="Fine" testId="ok" />
        <WaitCard heading="Waiting" sub="a moment" />
      </>,
    );
    expect(screen.getByTestId('bad').getAttribute('role')).toBe('alert');
    expect(screen.getByTestId('ok').getAttribute('role')).toBe('status');
    expect(screen.getByText('details')).toBeTruthy();
    expect(screen.getByTestId('splash-wait')).toBeTruthy();
  });
});
