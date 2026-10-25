// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { CALL_LIMIT, createRecorder, perf, snakeCase } from './perf';

/** A clock that moves 10 ms each time it is read. */
const ticking = () => {
  let t = 0;
  return () => (t += 10);
};

describe('perf recorder', () => {
  it('keeps only the last calls of a bounded ring, oldest first, and counts the dropped ones', async () => {
    const rec = createRecorder({ now: ticking(), limit: 3 });
    for (const name of ['a', 'b', 'c', 'd', 'e']) await rec.timed(name, () => Promise.resolve(name));
    const snap = rec.snapshot();
    expect(snap.calls.map((c) => c.name)).toEqual(['c', 'd', 'e']);
    expect(snap.dropped).toBe(2);
    expect(snap.calls.every((c) => c.duration === 10 && c.ok)).toBe(true);
  });

  it('is in call order before the ring is full, and the page recorder holds CALL_LIMIT', async () => {
    const rec = createRecorder({ now: ticking(), limit: 4 });
    await rec.timed('one', () => Promise.resolve(1));
    await rec.timed('two', () => Promise.resolve(2));
    expect(rec.snapshot()).toMatchObject({ calls: [{ name: 'one', start: 10 }, { name: 'two', start: 30 }], dropped: 0 });
    expect(CALL_LIMIT).toBe(500);
  });

  it('notes no size unless recording, then the length of the answer as JSON', async () => {
    const off = createRecorder({ now: ticking() });
    await off.timed('bootstrap', () => Promise.resolve({ images: [1, 2] }));
    expect(off.snapshot().calls[0]).not.toHaveProperty('size');
    expect(off.snapshot().recording).toBe(false);
    const on = createRecorder({ now: ticking(), recording: true });
    await on.timed('bootstrap', () => Promise.resolve({ images: [1, 2] }));
    await on.timed('void', () => Promise.resolve(undefined));
    expect(on.snapshot().calls.map((c) => c.size)).toEqual([JSON.stringify({ images: [1, 2] }).length, 0]);
  });

  it('notes a failed call as not ok, with no size, and passes the error on', async () => {
    const rec = createRecorder({ now: ticking(), recording: true });
    await expect(rec.timed('enqueue', () => Promise.reject(new Error('busy')))).rejects.toThrow('busy');
    expect(rec.snapshot().calls).toEqual([{ name: 'enqueue', start: 10, duration: 10, ok: false }]);
  });

  it('keeps the first time of each mark and sends it to the timeline once', () => {
    const markEntry = vi.fn();
    const rec = createRecorder({ now: ticking(), markEntry });
    rec.mark('backend-ready');
    rec.mark('backend-ready');
    rec.mark('stores-filled');
    expect(rec.snapshot().marks).toEqual({ 'backend-ready': 10, 'stores-filled': 20 });
    expect(markEntry.mock.calls).toEqual([['novira:backend-ready'], ['novira:stores-filled']]);
  });

  it('times the promise methods of a prototype under their snake-case name and leaves the others as they were', async () => {
    class Client {
      factor = 3;
      async listImages(n: number) {
        return n * this.factor;
      }
      queueStatus() {
        return this.factor;
      }
      get kind() {
        return 'mock';
      }
    }
    const rec = createRecorder({ now: ticking() });
    rec.timeMethods(Client.prototype, snakeCase);
    const client = new Client();
    expect(await client.listImages(2)).toBe(6);
    expect(client.queueStatus()).toBe(3);
    expect(client.kind).toBe('mock');
    expect(rec.snapshot().calls.map((c) => c.name)).toEqual(['list_images']);
  });

  it('gives the harness a read-only snapshot on window', () => {
    const exposed = (window as unknown as { __noviraPerf: { snapshot: () => unknown } }).__noviraPerf;
    expect(Object.isFrozen(exposed)).toBe(true);
    expect(exposed.snapshot()).toEqual(perf.snapshot());
  });

  it('writes command-like names', () => {
    expect(snakeCase('listUnfinishedDownloads')).toBe('list_unfinished_downloads');
    expect(snakeCase('bootstrap')).toBe('bootstrap');
  });
});
