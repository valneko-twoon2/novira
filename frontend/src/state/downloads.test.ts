import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PackStatus } from '@/backend';
import { remainingSeconds, useDownloads, type PackDownload } from './downloads';

const model = (status: PackStatus): PackDownload => ({ key: 'model:video', kind: 'model', pack: 'video', status });
const node = (status: PackStatus): PackDownload => ({ key: 'node:https://github.com/a/b', kind: 'node', url: 'https://github.com/a/b', status });
const running: PackStatus = { state: 'downloading', file: 'f', index: 1, count: 2, bytes: 5, totalBytes: 10 };

beforeEach(() => useDownloads.setState({ entries: [] }));
afterEach(() => vi.useRealTimers());

describe('download list', () => {
  it('keeps one entry per pack, updated in place, in the order they started', () => {
    const { track } = useDownloads.getState();
    track(model(running));
    track(node({ state: 'installing', step: 'requirements' }));
    track(model({ ...running, bytes: 9 }));
    const entries = useDownloads.getState().entries;
    expect(entries.map((e) => e.key)).toEqual(['model:video', 'node:https://github.com/a/b']);
    expect(entries[0]!.status).toMatchObject({ bytes: 9 });
  });

  it('drops a pack that went back to missing (cancelled)', () => {
    const { track } = useDownloads.getState();
    track(model(running));
    track(model({ state: 'missing', totalBytes: 10 }));
    expect(useDownloads.getState().entries).toEqual([]);
  });

  it('clears finished and failed entries but not the ones still working', () => {
    const { track, clearFinished, dismiss } = useDownloads.getState();
    track(model(running));
    track(node({ state: 'error', message: 'boom' }));
    clearFinished();
    expect(useDownloads.getState().entries.map((e) => e.key)).toEqual(['model:video']);
    dismiss('model:video');
    expect(useDownloads.getState().entries).toEqual([]);
  });

  it('works out the time left from the speed of the file in progress', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const file = (bytes: number, name = 'a.safetensors', index = 1): PackStatus => ({ state: 'downloading', file: name, index, count: 2, bytes, totalBytes: 1000 });
    const { track } = useDownloads.getState();
    const left = () => remainingSeconds(useDownloads.getState().entries[0]!);
    track(model(file(0)));
    expect(left()).toBeNull();
    // 100 bytes in 2 s: 50 B/s, so 900 bytes left take 18 s.
    vi.setSystemTime(2000);
    track(model(file(100)));
    expect(left()).toBeCloseTo(18, 5);
    // Reports closer together than a second do not make the speed jump around.
    vi.setSystemTime(2300);
    track(model(file(400)));
    expect(left()).toBeCloseTo(18 - 300 / 50, 5);
    // The next file starts the measurement again: nothing to say until it has been going for a moment.
    vi.setSystemTime(3000);
    track(model(file(0, 'b.safetensors', 2)));
    expect(left()).toBeNull();
    // Without a size announced there is no time left to give; the entry still remembers when it started.
    track(node({ state: 'downloading', file: '', index: 1, count: 1, bytes: 5, totalBytes: 0 }));
    expect(remainingSeconds(useDownloads.getState().entries[1]!)).toBeNull();
    expect(useDownloads.getState().entries[1]!.since).toBe(3000);
    // Finished: the speed is dropped.
    track(model({ state: 'ready' }));
    expect(left()).toBeNull();
  });
});
