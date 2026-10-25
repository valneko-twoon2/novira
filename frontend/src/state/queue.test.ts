import { beforeEach, describe, expect, it } from 'vitest';
import type { QueueItem } from '@/backend';
import { useQueue } from './queue';

const initial = useQueue.getState();
beforeEach(() => useQueue.setState(initial, true));

const item = (id: number, status: QueueItem['status']) => ({ id, status }) as QueueItem;

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
