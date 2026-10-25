// @vitest-environment jsdom
// The drafts store's actions: selecting, marking, closing groups, the start problems, finishing and retrying.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type EnqueueRequest, type GenerationMetadata, type QueueItem } from '@/backend';
import { draftStepOf, useDrafts, type DraftCandidate, type DraftGroup } from './drafts';
import { registerInvokeBuilder } from './invoke';
import { useQueue } from './queue';

const candidate = (n: number, over: Partial<DraftCandidate> = {}): DraftCandidate => ({
  id: `c${n}`,
  seed: 10 + n,
  itemId: n,
  imageName: null,
  status: 'queued',
  error: null,
  finalItemId: null,
  finalImageName: null,
  finalStatus: null,
  verdict: null,
  ...over,
});
const group = (id: string, candidates: DraftCandidate[], over: Partial<DraftGroup> = {}): DraftGroup => ({
  id,
  createdAt: 0,
  params: { steps: 30, hiresFix: { scale: 2, strength: 0.4 } } as GenerationMetadata,
  boardId: 'board',
  position: 0.4,
  candidates,
  ...over,
});
const state = () => useDrafts.getState();

beforeEach(() => {
  localStorage.clear();
  useDrafts.setState({ groups: [], currentId: null, selection: [], busy: false });
});
afterEach(() => vi.restoreAllMocks());

describe('groups and selection', () => {
  it('switches the group and clears the selection, toggles candidates and clears them', () => {
    useDrafts.setState({ groups: [group('a', [candidate(1)]), group('b', [candidate(2)])], currentId: 'a' });
    state().toggleSelect('c1');
    state().toggleSelect('c9');
    expect(state().selection).toEqual(['c1', 'c9']);
    state().toggleSelect('c1');
    expect(state().selection).toEqual(['c9']);
    state().setCurrent('b');
    expect(state()).toMatchObject({ currentId: 'b', selection: [] });
    state().toggleSelect('c2');
    state().clearSelection();
    expect(state().selection).toEqual([]);
  });

  it('marks a candidate and unmarks it by marking the same verdict again', () => {
    useDrafts.setState({ groups: [group('a', [candidate(1)]), group('b', [candidate(2)])] });
    state().mark('a', 'c1', 'keep');
    expect(state().groups[0]!.candidates[0]!.verdict).toBe('keep');
    state().mark('a', 'c1', 'reject');
    expect(state().groups[0]!.candidates[0]!.verdict).toBe('reject');
    state().mark('a', 'c1', 'reject');
    expect(state().groups[0]!.candidates[0]!.verdict).toBeNull();
    expect(state().groups[1]!.candidates[0]!.verdict).toBeNull();
  });

  it('closes a group; closing the current one shows the last remaining, and another one changes nothing', () => {
    useDrafts.setState({ groups: [group('a', []), group('b', []), group('c', [])], currentId: 'c', selection: ['x'] });
    state().closeGroup('a');
    expect(state()).toMatchObject({ currentId: 'c', selection: ['x'] });
    state().closeGroup('c');
    expect(state()).toMatchObject({ currentId: 'b', selection: [] });
    state().closeGroup('b');
    expect(state().currentId).toBeNull();
  });

  it('follows the queue through the queue store', () => {
    useDrafts.setState({ groups: [group('a', [candidate(1)])] });
    useQueue.setState({ items: [{ id: 1, status: 'completed', imageName: 'done.png', error: null } as QueueItem] });
    expect(state().groups[0]!.candidates[0]).toMatchObject({ status: 'ready', imageName: 'done.png' });
    useQueue.setState({ items: [] });
  });

  it('works out the step a draft stops at', () => {
    expect(draftStepOf(group('a', []))).toBe(12);
  });
});

describe('starting', () => {
  it('says so when there is no builder, and when the settings are not text to picture', async () => {
    registerInvokeBuilder('generate', undefined as never);
    expect(await state().start(2, 0.3)).toEqual({ error: 'no-builder' });
    const request = { origin: 'generate', destination: 'gallery', params: { generationMode: 'img2img' }, iterations: 1, randomizeSeed: false, prepend: false, boardId: null } as EnqueueRequest;
    registerInvokeBuilder('generate', { readiness: () => [], build: async () => request });
    expect(await state().start(2, 0.3)).toEqual({ error: 'not-txt2img' });
    expect(state().busy).toBe(false);
  });
});

describe('finishing and retrying', () => {
  it('finishes the chosen candidates once each, leaving the others and unknown ids', async () => {
    const enqueue = vi.spyOn(backend, 'enqueue').mockImplementation(async (r) => [{ id: 100 + r.params.seed, params: r.params } as QueueItem]);
    useDrafts.setState({
      groups: [group('a', [candidate(1, { status: 'ready' }), candidate(2, { status: 'ready', finalItemId: 5 }), candidate(3, { status: 'ready' })], { refImages: [] as never })],
      selection: ['c1', 'c2'],
    });
    await state().finish('missing', ['c1']);
    await state().finish('a', ['c1', 'c2', 'nope']);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0]![0]).toMatchObject({ params: { seed: 11 }, boardId: 'board', iterations: 1, randomizeSeed: false });
    expect(state().groups[0]!.candidates.map((c) => c.finalItemId)).toEqual([111, 5, null]);
    expect(state().groups[0]!.candidates[0]!.finalStatus).toBe('queued');
    expect(state().selection).toEqual(['c2']);
    expect(state().busy).toBe(false);
  });

  it('runs the failed drafts again with the same seeds and without the second pass', async () => {
    const enqueue = vi.spyOn(backend, 'enqueue').mockImplementation(async (r) => [{ id: 200 + r.params.seed, params: r.params } as QueueItem]);
    useDrafts.setState({
      groups: [group('a', [candidate(1, { status: 'failed', error: 'oom', imageName: 'old.png' }), candidate(2, { status: 'ready' })], { refImages: [{ modelKey: 'ipa' }] as never })],
    });
    await state().retryFailed('missing');
    await state().retryFailed('a');
    expect(enqueue).toHaveBeenCalledTimes(1);
    const sent = enqueue.mock.calls[0]![0];
    expect(sent.params).toMatchObject({ seed: 11, draftAt: 0.4 });
    expect(sent.params.hiresFix).toBeUndefined();
    expect(sent.refImages).toEqual([{ modelKey: 'ipa' }]);
    expect(state().groups[0]!.candidates[0]).toMatchObject({ itemId: 211, status: 'queued', error: null, imageName: null });
    expect(state().groups[0]!.candidates[1]!.status).toBe('ready');
  });

  it('turns busy off when the queue refuses', async () => {
    vi.spyOn(backend, 'enqueue').mockRejectedValue(new Error('full'));
    useDrafts.setState({ groups: [group('a', [candidate(1, { status: 'failed' })])] });
    await expect(state().retryFailed('a')).rejects.toThrow('full');
    expect(state().busy).toBe(false);
    await expect(state().finish('a', ['c1'])).rejects.toThrow('full');
    expect(state().busy).toBe(false);
  });
});
