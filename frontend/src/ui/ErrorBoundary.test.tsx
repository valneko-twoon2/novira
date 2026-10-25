// @vitest-environment jsdom
// A failed render stays inside its boundary, is logged, and can be tried again.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useDevLog } from '@/state/devLog';
import { ErrorBoundary } from './ErrorBoundary';

let broken = true;
function Flaky() {
  if (broken) throw new Error('bad data');
  return <p>fine</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    broken = true;
    useDevLog.getState().clear();
    // React reports the caught error on the console; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows the fallback next to working siblings and logs the error', () => {
    render(
      <>
        <ErrorBoundary area="left">
          <Flaky />
        </ErrorBoundary>
        <p>sibling</p>
      </>,
    );
    expect(screen.getByTestId('error-boundary').textContent).toContain('bad data');
    expect(screen.getByText('sibling')).toBeTruthy();
    expect(useDevLog.getState().entries.some((e) => e.source === 'render: left' && e.message.includes('bad data'))).toBe(true);
  });

  it('renders again on retry', () => {
    render(
      <ErrorBoundary area="left">
        <Flaky />
      </ErrorBoundary>,
    );
    broken = false;
    fireEvent.click(screen.getByText(t('common.error.retry')));
    expect(screen.getByText('fine')).toBeTruthy();
  });

  it('renders again when a reset key changes', () => {
    const { rerender } = render(
      <ErrorBoundary area="tab" resetKeys={['generate']}>
        <Flaky />
      </ErrorBoundary>,
    );
    broken = false;
    rerender(
      <ErrorBoundary area="tab" resetKeys={['canvas']}>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeTruthy();
  });
});
