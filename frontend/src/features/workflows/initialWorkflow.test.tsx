// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_WORKFLOWS } from '@/backend/defaultWorkflows';

/** Fresh copies of the hook and the store: the hook remembers at module level whether it has already run. */
async function loadHook() {
  vi.resetModules();
  const mod = await import('./initialWorkflow');
  const store = await import('@/state/workflows/workflows');
  return { useInitialWorkflow: mod.useInitialWorkflow, useWorkflows: store.useWorkflows };
}

afterEach(cleanup);

describe('useInitialWorkflow', () => {
  it('loads the default workflow when the library is already there', async () => {
    const { useInitialWorkflow, useWorkflows: store } = await loadHook();
    store.getState().setLibrary(DEFAULT_WORKFLOWS);
    renderHook(() => useInitialWorkflow());
    expect(store.getState().nodes.length).toBeGreaterThan(0);
    expect(store.getState().meta.id).toBe('default-t2i-sd15');
  });

  it('waits for the library when the tab is shown before the data has arrived', async () => {
    const { useInitialWorkflow, useWorkflows: store } = await loadHook();
    renderHook(() => useInitialWorkflow());
    expect(store.getState().nodes).toEqual([]);
    act(() => store.getState().setLibrary(DEFAULT_WORKFLOWS));
    expect(store.getState().nodes.length).toBeGreaterThan(0);
    expect(store.getState().meta.id).toBe('default-t2i-sd15');
  });

  it('runs only once, so a cleared editor stays empty when the tab is shown again', async () => {
    const { useInitialWorkflow, useWorkflows: store } = await loadHook();
    store.getState().setLibrary(DEFAULT_WORKFLOWS);
    const first = renderHook(() => useInitialWorkflow());
    first.unmount();
    act(() => store.setState({ nodes: [], edges: [] }));
    renderHook(() => useInitialWorkflow());
    expect(store.getState().nodes).toEqual([]);
  });
});
