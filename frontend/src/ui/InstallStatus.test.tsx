// @vitest-environment jsdom
// An install shows its progress where its button was: nothing special while idle, a bar and percent while downloading, "installed" after.
import { cleanup, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ModelInstallJob } from '@/backend';
import { useModels } from '@/state/models';
import { InstallSlot } from './InstallStatus';

const job = (patch: Partial<ModelInstallJob>): ModelInstallJob => ({ id: 'j', source: 'org/repo::a.safetensors', name: 'a', status: 'downloading', bytes: 0, totalBytes: 0, ...patch });
const initial = useModels.getState();

afterEach(() => {
  cleanup();
  useModels.setState({ models: initial.models, installJobs: initial.installJobs });
});

describe('InstallSlot', () => {
  const show = () =>
    render(
      <InstallSlot source="org/repo::a.safetensors">
        <button type="button">Install</button>
      </InstallSlot>,
    );

  it('shows the button while nothing is installing, and the progress while a download runs', () => {
    useModels.setState({ installJobs: [] });
    show();
    expect(screen.getByRole('button', { name: 'Install' })).toBeTruthy();
    act(() => useModels.setState({ installJobs: [job({ bytes: 25, totalBytes: 100 })] }));
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25');
    expect(screen.getByTestId('install-state-progress').textContent).toContain('25%');
  });

  it('is indeterminate while the size is not known, and says installed when the job is done', () => {
    useModels.setState({ installJobs: [job({})] });
    show();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBeNull();
    act(() => useModels.setState({ installJobs: [job({ status: 'completed', bytes: 9, totalBytes: 9 })] }));
    expect(screen.getByTestId('install-state-installed')).toBeTruthy();
  });
});
