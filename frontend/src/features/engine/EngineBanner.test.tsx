// @vitest-environment jsdom
// The banner that says what the backend is doing to get ComfyUI running: hidden when idle or ready.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '@/i18n';
import { useEngine } from '@/state/engine';
import { EngineBanner } from './EngineBanner';

const initial = useEngine.getState();
const setStatus = (status: object) => useEngine.setState({ status } as never);

afterEach(() => {
  cleanup();
  useEngine.setState(initial, true);
});

describe('EngineBanner', () => {
  it.each([['idle'], ['ready']])('shows nothing while %s', (state) => {
    setStatus({ state });
    render(<EngineBanner />);
    expect(screen.queryByTestId('engine-banner')).toBeNull();
  });

  it('shows the error as an alert with its message', () => {
    setStatus({ state: 'error', message: 'port 8188 is taken' });
    render(<EngineBanner />);
    const banner = screen.getByRole('alert');
    expect(banner.className).toContain('is-error');
    expect(banner.textContent).toContain(t('engine.title.error'));
    expect(banner.textContent).toContain('port 8188 is taken');
  });

  it.each([['extracting'], ['starting']])('shows %s as a status with an indeterminate bar and no size', (state) => {
    setStatus({ state });
    render(<EngineBanner />);
    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain(t(`engine.title.${state}` as 'engine.title.starting'));
    expect(banner.textContent).not.toContain(t('engine.firstRunNote'));
    expect(screen.queryByText(/MB/)).toBeNull();
  });

  it('shows the download size in MB and the first-run note', () => {
    setStatus({ state: 'downloading', bytes: 50 * 1024 * 1024, totalBytes: 200 * 1024 * 1024 });
    render(<EngineBanner />);
    expect(screen.getByText(t('engine.sizeProgress', { done: '50 MB', total: '200 MB' }))).toBeTruthy();
    expect(screen.getByText(t('engine.firstRunNote'))).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25');
  });

  it('shows sizes of a gigabyte or more in GB with two decimals', () => {
    setStatus({ state: 'downloading', bytes: 1024 * 1024 * 1024, totalBytes: 3 * 1024 * 1024 * 1024 });
    render(<EngineBanner />);
    expect(screen.getByText(t('engine.sizeProgress', { done: '1.00 GB', total: '3.00 GB' }))).toBeTruthy();
  });

  it('shows no size while the total is unknown, but still the note', () => {
    setStatus({ state: 'downloading', bytes: 10, totalBytes: 0 });
    render(<EngineBanner />);
    expect(screen.queryByText(/MB/)).toBeNull();
    expect(screen.getByText(t('engine.firstRunNote'))).toBeTruthy();
  });
});
