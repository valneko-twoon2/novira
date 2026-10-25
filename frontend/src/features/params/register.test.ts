// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ModelConfig } from '@/backend';
import { buildRequestFor, useInvokeWarnings, useReadiness } from '@/state/invoke';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useWildcards } from '@/state/prompts/wildcards';
import { registerParamsFeature } from './register';

const main = (key: string): ModelConfig => ({ key, name: key, type: 'main', base: 'sdxl', format: 'checkpoint', description: '', path: '', size: 0, source: '' }) as ModelConfig;
const initial = { params: useParams.getState(), models: useModels.getState(), wildcards: useWildcards.getState() };

beforeEach(() => {
  useParams.setState(initial.params, true);
  useModels.setState({ ...initial.models, models: [] }, true);
  useWildcards.setState(initial.wildcards, true);
});
afterEach(() => {
  useParams.setState(initial.params, true);
  useModels.setState(initial.models, true);
});

describe('registerParamsFeature', () => {
  it('registers the Generate and Upscaling builders with their readiness', () => {
    registerParamsFeature();
    const generate = renderHook(() => useReadiness('generate'));
    const upscaling = renderHook(() => useReadiness('upscaling'));
    expect(generate.result.current.length).toBeGreaterThan(0);
    expect(upscaling.result.current.length).toBeGreaterThan(0);
    expect(buildRequestFor('generate')).toBeInstanceOf(Promise);
    expect(buildRequestFor('upscaling')).toBeInstanceOf(Promise);
  });

  it('updates the readiness when the parameters, the models or the wildcard lists change', () => {
    registerParamsFeature();
    const generate = renderHook(() => useReadiness('generate'));
    const warnings = renderHook(() => useInvokeWarnings('generate'));
    act(() => useModels.setState({ models: [main('m1')] }));
    // No main model is picked for the user, however few there are.
    expect(useParams.getState().modelKey).toBeNull();
    act(() => useParams.getState().set({ modelKey: 'm1' }));
    expect(generate.result.current).toEqual([]);
    act(() => useParams.getState().set({ positivePrompt: 'a __nothing__ b' }));
    expect(generate.result.current.length).toBeGreaterThan(0);
    act(() => useWildcards.setState({ lists: [{ id: 'w', name: 'nothing', text: 'x' }] }));
    expect(generate.result.current).toEqual([]);
    expect(warnings.result.current).toEqual([]);
  });

  it('lets go of the chosen main model when it disappears, without choosing another, and registering twice subscribes once', () => {
    registerParamsFeature();
    registerParamsFeature();
    act(() => useModels.setState({ models: [main('m1'), main('m2')] }));
    expect(useParams.getState().modelKey).toBeNull();
    act(() => useParams.getState().set({ modelKey: 'm1' }));
    act(() => useModels.setState({ models: [main('m2')] }));
    expect(useParams.getState().modelKey).toBeNull();
  });
});
