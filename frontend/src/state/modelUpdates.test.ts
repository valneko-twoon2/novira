import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ModelUpdate } from '@/backend';
import { useToasts } from './toasts';
import { UPDATE_CHECK_MAX_AGE_MS, useModelUpdates } from './modelUpdates';

const update = (key: string, latest = '9'): ModelUpdate => ({
  key,
  modelId: '1',
  installedVersionId: '2',
  latestVersionId: latest,
  latestName: 'v9',
  publishedAt: 0,
  pageUrl: `https://civitai.com/models/1?modelVersionId=${latest}`,
});
const initial = useModelUpdates.getState();
const titles = () => useToasts.getState().toasts.map((x) => x.title);

beforeEach(() => {
  useModelUpdates.setState(initial, true);
  useToasts.setState({ toasts: [] });
});
afterEach(() => vi.restoreAllMocks());

describe('check', () => {
  it('keeps the answer and the time, and tells once how many models are new', { tags: ['scenario'] }, async () => {
    const ask = vi.spyOn(backend, 'checkModelUpdates').mockResolvedValue([update('a'), update('b')]);
    expect(await useModelUpdates.getState().check()).toBe(true);
    expect(useModelUpdates.getState().updates.map((u) => u.key)).toEqual(['a', 'b']);
    expect(useModelUpdates.getState().checkedAt).not.toBeNull();
    expect(titles()).toHaveLength(1);
    // The same versions again: no second notice.
    await useModelUpdates.getState().check();
    expect(ask).toHaveBeenCalledTimes(2);
    expect(titles()).toHaveLength(1);
  });

  it('tells again for a version that came out after the last notice', { tags: ['condition'] }, async () => {
    const ask = vi.spyOn(backend, 'checkModelUpdates').mockResolvedValueOnce([update('a', '9')]).mockResolvedValueOnce([update('a', '10')]);
    await useModelUpdates.getState().check();
    await useModelUpdates.getState().check();
    expect(ask).toHaveBeenCalledTimes(2);
    expect(titles()).toHaveLength(2);
  });

  it('says nothing when nothing is new', { tags: ['boundary'] }, async () => {
    vi.spyOn(backend, 'checkModelUpdates').mockResolvedValue([]);
    expect(await useModelUpdates.getState().check()).toBe(true);
    expect(titles()).toEqual([]);
  });

  it('reports a failure unless it is quiet, and keeps the earlier answer', { tags: ['error-guessing', 'condition'] }, async () => {
    useModelUpdates.setState({ updates: [update('a')], checkedAt: 5 });
    vi.spyOn(backend, 'checkModelUpdates').mockRejectedValue(new Error('offline'));
    expect(await useModelUpdates.getState().check({ quiet: true })).toBe(false);
    expect(titles()).toEqual([]);
    expect(await useModelUpdates.getState().check()).toBe(false);
    expect(titles()).toHaveLength(1);
    expect(useModelUpdates.getState().updates).toHaveLength(1);
    expect(useModelUpdates.getState().checkedAt).toBe(5);
    expect(useModelUpdates.getState().checking).toBe(false);
  });

  it('does not start a second request while one is running', { tags: ['state-transition'] }, async () => {
    let answer!: (u: ModelUpdate[]) => void;
    const ask = vi.spyOn(backend, 'checkModelUpdates').mockReturnValue(new Promise((r) => (answer = r)));
    const first = useModelUpdates.getState().check();
    expect(useModelUpdates.getState().checking).toBe(true);
    await useModelUpdates.getState().check();
    expect(ask).toHaveBeenCalledTimes(1);
    answer([]);
    await first;
    expect(useModelUpdates.getState().checking).toBe(false);
  });
});

describe('checkIfStale', () => {
  it('asks when nothing was kept, and when the answer is a day old', { tags: ['boundary'] }, async () => {
    const ask = vi.spyOn(backend, 'checkModelUpdates').mockResolvedValue([]);
    expect(await useModelUpdates.getState().checkIfStale(1000)).toBe(true);
    useModelUpdates.setState({ checkedAt: 1000 });
    expect(await useModelUpdates.getState().checkIfStale(1000 + UPDATE_CHECK_MAX_AGE_MS)).toBe(true);
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('does not ask while the answer is fresh', { tags: ['boundary'] }, async () => {
    const ask = vi.spyOn(backend, 'checkModelUpdates').mockResolvedValue([]);
    useModelUpdates.setState({ checkedAt: 1000 });
    expect(await useModelUpdates.getState().checkIfStale(1000 + UPDATE_CHECK_MAX_AGE_MS - 1)).toBeNull();
    expect(ask).not.toHaveBeenCalled();
  });

  it('asks when the clock went back past the kept time', { tags: ['error-guessing'] }, async () => {
    const ask = vi.spyOn(backend, 'checkModelUpdates').mockResolvedValue([]);
    useModelUpdates.setState({ checkedAt: 5000 });
    await useModelUpdates.getState().checkIfStale(1000);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('is quiet about a failure', { tags: ['error-guessing'] }, async () => {
    vi.spyOn(backend, 'checkModelUpdates').mockRejectedValue(new Error('offline'));
    expect(await useModelUpdates.getState().checkIfStale(0)).toBe(false);
    expect(titles()).toEqual([]);
  });
});

describe('forget', () => {
  it('drops the updates of models that are gone', { tags: ['equivalence'] }, () => {
    useModelUpdates.setState({ updates: [update('a'), update('b')] });
    useModelUpdates.getState().forget(['b', 'c']);
    expect(useModelUpdates.getState().updates.map((u) => u.key)).toEqual(['b']);
  });
});
