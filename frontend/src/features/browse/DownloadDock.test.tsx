// @vitest-environment jsdom
// The download list names why a download failed, not only that it did.
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ModelInstallJob } from '@/backend';
import { useModels } from '@/state/models';
import { CIVITAI_SOURCE_PREFIX } from './download';
import { DownloadDock } from './DownloadDock';

const initial = useModels.getState();
const job = (over: Partial<ModelInstallJob>): ModelInstallJob => ({ id: 'j1', source: `${CIVITAI_SOURCE_PREFIX}1/2-3`, name: 'a.safetensors', status: 'error', bytes: 0, totalBytes: 0, ...over });
const show = (...jobs: ModelInstallJob[]) => {
  act(() => useModels.setState({ installJobs: jobs }));
  render(<DownloadDock />);
};

beforeEach(() => useModels.setState(initial, true));
afterEach(cleanup);

describe('DownloadDock', () => {
  it('shows the reason under a failed download', () => {
    show(job({ error: 'Download answered 401 Unauthorized (this file needs an API key; set it in Settings)' }));
    expect(screen.getByText(/Download answered 401/)).not.toBeNull();
  });

  it('shows no reason for a failure without one, a finished download or a running one', () => {
    show(job({ error: undefined }), job({ id: 'j2', status: 'completed', error: 'old' }), job({ id: 'j3', status: 'downloading', error: 'x' }));
    expect(document.querySelector('.browse-dock__error')).toBeNull();
  });
});
