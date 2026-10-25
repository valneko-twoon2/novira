// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type CivitaiFile, type CivitaiModel, type ModelConfig, type ModelInstallJob } from '@/backend';
import { useModels } from '@/state/models';
import { useToasts } from '@/state/toasts';
import { CIVITAI_SOURCE_PREFIX, defaultFile, downloadFile, fileSource, useDownloadState } from './download';

const initialModels = useModels.getState();
const initialToasts = useToasts.getState();

const file = (id: string, name = `${id}.safetensors`): CivitaiFile => ({ id, name, sizeBytes: 1, format: 'SafeTensor', precision: 'fp16' });
const model = (over: Partial<CivitaiModel> = {}): CivitaiModel =>
  ({ id: 'm1', name: 'M', versions: [{ id: 'v1', name: 'v1', baseModel: 'sdxl', createdAt: 0, triggerWords: [], files: [file('f1'), file('f2')] }], ...over }) as CivitaiModel;
const job = (over: Partial<ModelInstallJob>): ModelInstallJob => ({ id: 'j1', source: 'src', name: 'n', status: 'downloading', bytes: 0, totalBytes: 0, ...over });

beforeEach(() => {
  useModels.setState(initialModels, true);
  useToasts.setState(initialToasts, true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('download sources', () => {
  it('names a Civitai file by model and file id, and a Hugging Face file by repo and path', () => {
    expect(fileSource(model(), file('f1'))).toBe(`${CIVITAI_SOURCE_PREFIX}m1/f1`);
    expect(fileSource(model({ id: 'owner/repo', source: 'huggingface' }), file('dir/w.safetensors'))).toBe('owner/repo::dir/w.safetensors');
  });

  it('defaults to the first file of the first version', () => {
    expect(defaultFile(model()).id).toBe('f1');
  });
});

describe('downloadFile', () => {
  it('queues the install and shows an info toast with the file name', async () => {
    const install = vi.spyOn(backend, 'installModel').mockResolvedValue(job({}));
    await downloadFile(model(), file('f1', 'a.safetensors'));
    expect(install).toHaveBeenCalledWith(`${CIVITAI_SOURCE_PREFIX}m1/f1`, 'a.safetensors');
    const last = useToasts.getState().toasts.at(-1);
    expect(last?.status).toBe('info');
    expect(last?.description).toBe('a.safetensors');
  });

  it('shows the error text when the install cannot be queued, for an Error and for a plain string', async () => {
    const install = vi.spyOn(backend, 'installModel');
    install.mockRejectedValueOnce(new Error('disk full'));
    await downloadFile(model(), file('f1'));
    expect(useToasts.getState().toasts.at(-1)).toMatchObject({ status: 'error', description: 'disk full' });
    install.mockRejectedValueOnce('boom');
    await downloadFile(model(), file('f1'));
    expect(useToasts.getState().toasts.at(-1)).toMatchObject({ status: 'error', description: 'boom' });
  });
});

describe('useDownloadState', () => {
  const state = (source = 'src', name = 'n') => renderHook(() => useDownloadState(source, name)).result;

  it('is idle with no model and no job', () => {
    expect(state().current).toEqual({ kind: 'idle' });
  });

  it('is installed when an installed model matches by source or by name', () => {
    useModels.setState({ models: [{ key: 'k', source: 'src', name: 'other' } as ModelConfig] });
    expect(state('src', 'x').current).toEqual({ kind: 'installed' });
    useModels.setState({ models: [{ key: 'k', source: 'other', name: 'n' } as ModelConfig] });
    expect(state('src', 'n').current).toEqual({ kind: 'installed' });
  });

  it('is installed when the job completed, and queued with its progress while the job is active', () => {
    useModels.setState({ installJobs: [job({ status: 'completed' })] });
    expect(state().current).toEqual({ kind: 'installed' });
    useModels.setState({ installJobs: [job({ status: 'downloading', bytes: 25, totalBytes: 100 })] });
    expect(state().current).toEqual({ kind: 'queued', progress: 0.25 });
  });

  it('reports zero progress when the total size is unknown, and covers every active status', () => {
    for (const status of ['waiting', 'downloading', 'running'] as const) {
      useModels.setState({ installJobs: [job({ status, bytes: 10, totalBytes: 0 })] });
      expect(state().current).toEqual({ kind: 'queued', progress: 0 });
    }
  });

  it('stays idle for a failed job and for a job of another source', () => {
    useModels.setState({ installJobs: [job({ status: 'failed' })] });
    expect(state().current).toEqual({ kind: 'idle' });
    useModels.setState({ installJobs: [job({ status: 'downloading', source: 'else' })] });
    expect(state().current).toEqual({ kind: 'idle' });
  });

  it('updates when the job progresses', () => {
    useModels.setState({ installJobs: [job({ bytes: 0, totalBytes: 10 })] });
    const result = state();
    act(() => useModels.getState().upsertInstallJob(job({ bytes: 5, totalBytes: 10 })));
    expect(result.current).toEqual({ kind: 'queued', progress: 0.5 });
  });
});
