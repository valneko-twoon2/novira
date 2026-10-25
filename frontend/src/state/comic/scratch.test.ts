// The pictures made only to be looked at: the oldest are deleted as new ones come, and a run's end sweeps them all.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { keepScratch, sweepScratch } from './scratch';

afterEach(() => vi.restoreAllMocks());

describe('the looked-at pictures', () => {
  it('keeps the last few, deletes the older ones, and deletes the rest when swept', async () => {
    const gone = vi.spyOn(backend, 'deleteImages').mockResolvedValue();
    for (const name of ['a', 'b', 'c', 'd', 'e', 'f']) keepScratch(name);
    expect(gone).toHaveBeenNthCalledWith(1, ['a']);
    expect(gone).toHaveBeenNthCalledWith(2, ['b']);
    await sweepScratch();
    expect(gone).toHaveBeenLastCalledWith(['c', 'd', 'e', 'f']);
    await sweepScratch();
    expect(gone).toHaveBeenCalledTimes(3);
  });

  it('goes on when a picture cannot be deleted', async () => {
    vi.spyOn(backend, 'deleteImages').mockRejectedValue(new Error('gone already'));
    keepScratch('x');
    await expect(sweepScratch()).resolves.toBeUndefined();
  });
});
