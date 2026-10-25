// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ModelInstallJob } from '@/backend';
import { useModels } from '@/state/models';
import { useToasts } from '@/state/toasts';
import { useInstallToasts } from './useInstallToasts';

const initialModels = useModels.getState();
const initialToasts = useToasts.getState();
const job = (over: Partial<ModelInstallJob>): ModelInstallJob => ({ id: 'j1', source: 'src', name: 'Model', status: 'downloading', bytes: 0, totalBytes: 1, ...over });
const toasts = () => useToasts.getState().toasts;
const setJobs = (...jobs: ModelInstallJob[]) => act(() => useModels.setState({ installJobs: jobs }));

beforeEach(() => {
  useModels.setState(initialModels, true);
  useToasts.setState(initialToasts, true);
});
afterEach(cleanup);

describe('useInstallToasts', () => {
  it('announces a job that completes while it is mounted, naming the model', () => {
    setJobs(job({}));
    renderHook(() => useInstallToasts());
    setJobs(job({ status: 'completed' }));
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]).toMatchObject({ status: 'success', description: 'Model' });
  });

  it('announces a failed job with its error, or its source when it has none', () => {
    setJobs(job({}), job({ id: 'j2', source: 'other' }));
    renderHook(() => useInstallToasts());
    setJobs(job({ status: 'error', error: 'disk full' }), job({ id: 'j2', source: 'other', status: 'error' }));
    expect(toasts().map((t) => [t.status, t.description])).toEqual([
      ['error', 'disk full'],
      ['error', 'other'],
    ]);
  });

  it('stays quiet for jobs that were already finished when it mounted', () => {
    setJobs(job({ status: 'completed' }), job({ id: 'j2', status: 'error' }));
    renderHook(() => useInstallToasts());
    expect(toasts()).toEqual([]);
  });

  it('stays quiet for progress, and does not repeat a finished job on later updates', () => {
    setJobs(job({}));
    renderHook(() => useInstallToasts());
    setJobs(job({ bytes: 1, status: 'running' }));
    expect(toasts()).toEqual([]);
    setJobs(job({ status: 'completed' }));
    setJobs(job({ status: 'completed', bytes: 1 }), job({ id: 'j2' }));
    expect(toasts()).toHaveLength(1);
  });

  it('announces a job that is new and already finished on its first appearance', () => {
    renderHook(() => useInstallToasts());
    setJobs(job({ status: 'completed' }));
    expect(toasts()).toHaveLength(1);
  });
});
