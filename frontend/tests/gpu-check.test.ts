// The GPU check run before a verification run on the real engine (tools/gpu-check.mjs): reading nvidia-smi, the
// busy verdict and the lock state.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { busyThreshold, judge, lockState, parseGpus } from '../../tools/gpu-check.mjs';

const gpu = (load: number) => [{ name: 'GPU', load, used: 1000, total: 12000 }];

describe('gpu check', () => {
  it('reads one line per GPU and skips lines that are not numbers', () => {
    expect(parseGpus('NVIDIA GeForce RTX 4070 Ti, 3, 1419, 12282\r\nOther, 90, 5000, 8000\n')).toEqual([
      { name: 'NVIDIA GeForce RTX 4070 Ti', load: 3, used: 1419, total: 12282 },
      { name: 'Other', load: 90, used: 5000, total: 8000 },
    ]);
    expect(parseGpus('NVIDIA-SMI has failed\n')).toEqual([]);
    expect(parseGpus('GPU, [N/A], 10, 20\n')).toEqual([]);
  });

  it('is busy when the mean load reaches the threshold, and free just under it', () => {
    expect(judge([gpu(25), gpu(25)], 25)).toMatchObject({ busy: true, known: true, load: 25 });
    expect(judge([gpu(24), gpu(25)], 25)).toMatchObject({ busy: false, known: true, load: 25 });
    expect(judge([gpu(20), gpu(28)], 25)).toMatchObject({ busy: false, load: 24 });
    // One short spike among idle samples is not a game.
    expect(judge([gpu(100), gpu(0), gpu(0), gpu(0), gpu(0)], 25)).toMatchObject({ busy: false, load: 20 });
  });

  it('judges by the busiest GPU', () => {
    const two = (a: number, b: number) => [...gpu(a), ...gpu(b)];
    expect(judge([two(0, 80), two(0, 70)], 25)).toMatchObject({ busy: true, load: 75 });
  });

  it('does not block when nvidia-smi cannot be read', () => {
    expect(judge([], 25)).toMatchObject({ busy: false, known: false, load: null });
    expect(judge([[], null], 25)).toMatchObject({ busy: false, known: false });
  });
});

describe('gpu lock state', () => {
  let dir = '';
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  it('says whether the lock is unset, free, held by novira or by another program', () => {
    dir = mkdtempSync(join(tmpdir(), 'gpu-lock-'));
    const lock = join(dir, 'gpu.lock');
    expect(lockState('')).toBe('NOVIRA_GPU_LOCK is not set');
    expect(lockState(lock)).toMatch(/^the GPU lock is free/);
    mkdirSync(lock);
    expect(lockState(lock)).toMatch(/held by another program/);
    writeFileSync(`${lock}.owner`, '1234 2026-10-13T00:00:00Z\n');
    expect(lockState(lock)).toBe('the GPU lock is held by novira (1234 2026-10-13T00:00:00Z)');
  });
});

describe('the busy threshold', () => {
  it('takes 0 to 100 from NOVIRA_GPU_BUSY_PERCENT, 0 meaning any use, and 25 for anything else', () => {
    expect(busyThreshold('0')).toBe(0);
    expect(busyThreshold('60')).toBe(60);
    expect(busyThreshold('100')).toBe(100);
    for (const v of [undefined, '', ' ', 'x', '-1', '101']) expect(busyThreshold(v), String(v)).toBe(25);
  });
});
