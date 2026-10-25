// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backend, type ModelInstallJob } from '@/backend';
import { useModels } from '@/state/models';
import { installModel, startInstall, useInstallState } from './modelInstall';

const job = (source: string): ModelInstallJob => ({ id: `job-${source}`, source, status: 'waiting', bytes: 0, totalBytes: 0 }) as ModelInstallJob;

afterEach(() => {
  vi.restoreAllMocks();
  useModels.setState({ models: [], installJobs: [] });
});

describe('starting an install', () => {
  it('counts the source as installing while the request is on its way, and drops a second request for it', async () => {
    let answer: (j: ModelInstallJob) => void = () => {};
    const request = vi.fn(() => new Promise<ModelInstallJob>((resolve) => (answer = resolve)));
    const { result } = renderHook(() => useInstallState('civitai:1/2'));
    expect(result.current.kind).toBe('idle');
    let first!: Promise<boolean>;
    act(() => {
      first = startInstall('civitai:1/2', request);
    });
    expect(result.current).toEqual({ kind: 'queued', progress: 0 });
    await expect(startInstall('civitai:1/2', request)).resolves.toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => {
      answer(job('civitai:1/2'));
      await first;
    });
    // The job is in the store at once, so the button stays busy without waiting for the event.
    expect(useModels.getState().installJobs.map((j) => j.source)).toEqual(['civitai:1/2']);
    expect(result.current.kind).toBe('queued');
  });

  it('lets the source be asked for again after the request failed', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('no'));
    await expect(startInstall('s', failing)).rejects.toThrow('no');
    const { result } = renderHook(() => useInstallState('s'));
    expect(result.current.kind).toBe('idle');
    await expect(startInstall('s', () => Promise.resolve(job('s')))).resolves.toBe(true);
  });

  it('installModel asks the backend once for two quick presses', async () => {
    const ask = vi.spyOn(backend, 'installModel').mockImplementation(() => new Promise((r) => setTimeout(() => r(job('x.safetensors')), 5)));
    await Promise.all([installModel('x.safetensors'), installModel('x.safetensors')]);
    expect(ask).toHaveBeenCalledTimes(1);
  });
});
