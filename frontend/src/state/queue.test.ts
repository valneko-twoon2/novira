import { beforeEach, describe, expect, it } from 'vitest';
import type { QueueItem } from '@/backend';
import { mergeProgress, useQueue } from './queue';

const initial = useQueue.getState();
beforeEach(() => useQueue.setState(initial, true));

const item = (id: number, status: QueueItem['status']) => ({ id, status }) as QueueItem;

const progress = (itemId: number, url: string | null) => ({ itemId, step: 1, totalSteps: 4, progressImageUrl: url, message: 'denoise' });

describe('mergeProgress', () => {
  it('takes a new picture, keeps the last one through a step with none, and starts clean for another item', () => {
    expect(mergeProgress(progress(1, 'a'), progress(1, 'b')).progressImageUrl).toBe('b');
    expect(mergeProgress(progress(1, 'a'), progress(1, null)).progressImageUrl).toBe('a');
    expect(mergeProgress(progress(1, 'a'), progress(2, null)).progressImageUrl).toBeNull();
    expect(mergeProgress(null, progress(1, null)).progressImageUrl).toBeNull();
    expect(mergeProgress(progress(1, null), progress(1, null)).progressImageUrl).toBeNull();
  });
});

describe('queue store', () => {
  it('appends unknown items and replaces known ones in place', () => {
    useQueue.getState().setItems([item(1, 'pending'), item(2, 'pending')]);
    useQueue.getState().upsertItem(item(1, 'in_progress'));
    useQueue.getState().upsertItem(item(3, 'pending'));
    expect(useQueue.getState().items.map((i) => [i.id, i.status])).toEqual([
      [1, 'in_progress'],
      [2, 'pending'],
      [3, 'pending'],
    ]);
  });
});
