// @vitest-environment jsdom
// What the Candidates view's flow lists, in which order, what can be chosen or accepted, and the label of a batch's time.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { useDrafts, type DraftCandidate, type DraftGroup } from '@/state/drafts';
import { accept, flowGroups, flowOrder, isAcceptable, isDecided, isSelectable, rangeOf, whenLabel } from './flow';

const candidate = (id: string, over: Partial<DraftCandidate> = {}): DraftCandidate => ({
  id,
  seed: 1,
  itemId: 1,
  imageName: `${id}.png`,
  status: 'ready',
  error: null,
  finalItemId: null,
  finalImageName: null,
  finalStatus: null,
  verdict: null,
  ...over,
});
const group = (id: string, candidates: DraftCandidate[], over: Partial<DraftGroup> = {}): DraftGroup =>
  ({ id, createdAt: 0, params: {}, boardId: null, position: 0.35, candidates, ...over }) as DraftGroup;
const image = (name: string, isIntermediate = false) => ({ name, isIntermediate }) as ImageDTO;
const finished = (id: string) => candidate(id, { finalItemId: 2, finalImageName: `f-${id}.png`, finalStatus: 'ready' });

afterEach(() => vi.restoreAllMocks());

describe('the flow', { tags: [] }, () => {
  it(
    'lists the batches with something to decide, newest first, and leaves out a batch of drafts all finished',
    { tags: ['equivalence', 'decision-table'] },
    () => {
      const images = [image('f-a1.png'), image('f-b1.png')];
      const groups = [group('a', [finished('a1')]), group('b', [finished('b1'), candidate('b2')]), group('c', [candidate('c1')], { kind: 'generation' })];
      expect(flowGroups(groups, images, null, 8).shown.map((g) => g.id)).toEqual(['c', 'b']);
      // A finished picture deleted from the gallery can be finished again: the batch is back.
      expect(flowGroups(groups, [], null, 8).shown.map((g) => g.id)).toEqual(['c', 'b', 'a']);
      expect(isDecided(groups[0]!, groups[0]!.candidates[0]!, images)).toBe(true);
      expect(isDecided(groups[2]!, groups[2]!.candidates[0]!, images)).toBe(false);
    },
  );

  it('shows at most the limit, counts them all, and always shows the batch opened from the history', { tags: ['boundary'] }, () => {
    const groups = Array.from({ length: 5 }, (_, i) => group(`g${i + 1}`, [candidate(`c${i + 1}`)]));
    expect(flowGroups(groups, [], null, 2)).toMatchObject({ total: 5, shown: [{ id: 'g5' }, { id: 'g4' }] });
    expect(flowGroups(groups, [], null, 5).shown).toHaveLength(5);
    expect(flowGroups(groups, [], 'g1', 2).shown.map((g) => g.id)).toEqual(['g5', 'g4', 'g1']);
    // An opened batch is shown even with everything in it decided.
    const done = [group('x', [finished('x1')])];
    expect(flowGroups(done, [image('f-x1.png')], 'x', 2).shown.map((g) => g.id)).toEqual(['x']);
    expect(flowGroups(done, [image('f-x1.png')], null, 2)).toEqual({ shown: [], total: 0 });
  });

  it('selects a range in the order of the flow, either way, and only the target when the anchor is gone', { tags: ['boundary'] }, () => {
    const order = flowOrder([group('b', [candidate('b1'), candidate('b2')]), group('a', [candidate('a1')])]);
    expect(order).toEqual(['b1', 'b2', 'a1']);
    expect(rangeOf(order, 'b1', 'a1')).toEqual(['b1', 'b2', 'a1']);
    expect(rangeOf(order, 'a1', 'b2')).toEqual(['b2', 'a1']);
    expect(rangeOf(order, 'b2', 'b2')).toEqual(['b2']);
    expect(rangeOf(order, null, 'b2')).toEqual(['b2']);
    expect(rangeOf(order, 'gone', 'b2')).toEqual(['b2']);
  });
});

describe('choosing and accepting', { tags: [] }, () => {
  const gen = (c: DraftCandidate) => group('g', [c], { kind: 'generation' });
  const held = candidate('h', { imageName: null, finalItemId: 1, finalImageName: 'h.png', finalStatus: 'ready' });

  it('lets a drawn picture be chosen and a waiting one not, in both kinds of batch', { tags: ['equivalence'] }, () => {
    expect(isSelectable(gen(held), held, [image('h.png', true)])).toBe(true);
    expect(isSelectable(gen(held), held, [])).toBe(false);
    expect(isSelectable(gen({ ...held, finalStatus: 'running' }), { ...held, finalStatus: 'running' }, [image('h.png', true)])).toBe(false);
    expect(isSelectable(group('d', []), candidate('d'), [])).toBe(true);
    expect(isSelectable(group('d', []), candidate('d', { status: 'queued' }), [])).toBe(false);
  });

  it('accepts a held picture and a draft not finished yet, not one already on a board or finished', { tags: ['decision-table'] }, () => {
    expect(isAcceptable(gen(held), held, [image('h.png', true)])).toBe(true);
    expect(isAcceptable(gen(held), held, [image('h.png', false)])).toBe(false);
    expect(isAcceptable(group('d', []), candidate('d'), [])).toBe(true);
    expect(isAcceptable(group('d', []), finished('d'), [image('f-d.png')])).toBe(false);
    expect(isAcceptable(group('d', []), candidate('d', { status: 'running' }), [])).toBe(false);
  });

  it('moves the held pictures of a generation batch and finishes the drafts of a batch of drafts, only the acceptable ones', { tags: ['decision-table'] }, () => {
    const adopt = vi.fn().mockResolvedValue(undefined);
    const finish = vi.fn().mockResolvedValue(undefined);
    useDrafts.setState({ adopt, finish });
    accept(gen(held), ['h'], [image('h.png', true)]);
    expect(adopt).toHaveBeenCalledWith('g', ['h']);
    const drafts = group('d', [candidate('d1'), candidate('d2', { status: 'queued' })]);
    accept(drafts, ['d1', 'd2'], []);
    expect(finish).toHaveBeenCalledWith('d', ['d1']);
    accept(drafts, ['d2'], []);
    expect(finish).toHaveBeenCalledTimes(1);
  });
});

describe('the time of a batch', { tags: [] }, () => {
  it('is the time today and a date with the time on another day', { tags: ['boundary'] }, () => {
    const now = new Date(2026, 10, 13, 15, 0).getTime();
    const today = whenLabel(new Date(2026, 10, 13, 0, 5).getTime(), now);
    const yesterday = whenLabel(new Date(2026, 10, 12, 23, 55).getTime(), now);
    expect(today).toMatch(/05/);
    expect(today).not.toMatch(/13/);
    expect(yesterday).toMatch(/12/);
    expect(yesterday).toMatch(/55/);
  });
});
