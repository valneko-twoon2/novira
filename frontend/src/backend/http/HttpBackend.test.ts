// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrap as bootstrapSample } from '../contract/samples/events';
import { queueItem } from '../contract/samples/queue';
import type { BackendEvent, EnqueueRequest, QueueItem } from '../types';
import { HttpBackend } from './HttpBackend';

/** A stand-in for the browser's WebSocket that the test drives by hand. */
class FakeSocket {
  static all: FakeSocket[] = [];
  static at(i: number): FakeSocket {
    const socket = FakeSocket.all[i];
    if (!socket) throw new Error(`no socket ${i}`);
    return socket;
  }
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  open() {
    this.onopen?.();
  }
  send(event: unknown) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
  drop() {
    this.onclose?.();
  }
}

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
let snapshotItems: QueueItem[] = [];

const item = (id: number, status: QueueItem['status']): QueueItem => ({ ...queueItem, id, status });
const status = (isPaused: boolean) => ({
  pending: 0,
  inProgress: 0,
  completed: 0,
  failed: 0,
  canceled: 0,
  total: snapshotItems.length,
  isPaused,
});
const json = (value: unknown, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 422, json: () => Promise.resolve(value), blob: () => Promise.resolve(new Blob(['x'])) });

beforeEach(() => {
  calls = [];
  FakeSocket.all = [];
  snapshotItems = [item(1, 'pending')];
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      switch (url) {
        case '/api/bootstrap':
          return json({ ...bootstrapSample, workflows: [], queue: { items: snapshotItems, status: status(false) } });
        case '/api/queue_snapshot':
          return json({ items: snapshotItems, status: status(true) });
        case '/api/enqueue':
          return json([item(9, 'pending')]);
        case '/upload/image':
          return json({ name: 'up.png', url: '/novira-image/full/up.png' });
        case '/api/open_civitai_page':
          return json('https://civitai.com/models/12');
        case '/api/open_source_page':
          return json({ error: 'this address cannot be opened', code: 'failed' }, false);
        case '/api/refuse':
          return json({ error: 'nope', code: 'failed' }, false);
        default:
          return json(null);
      }
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const request = (patch: Partial<EnqueueRequest> = {}): EnqueueRequest =>
  ({
    origin: 'generate',
    destination: 'gallery',
    params: queueItem.params,
    iterations: 1,
    randomizeSeed: false,
    prepend: false,
    boardId: null,
    ...patch,
  }) as EnqueueRequest;

async function started() {
  const backend = new HttpBackend();
  const boot = backend.bootstrap();
  await vi.waitFor(() => expect(FakeSocket.all).toHaveLength(1));
  FakeSocket.at(0).open();
  await boot;
  return { backend, socket: FakeSocket.at(0) };
}

describe('HttpBackend events', () => {
  it('opens the event socket on the page origin before the first read and mirrors the queue from it', async () => {
    const { backend, socket } = await started();
    expect(socket.url).toBe(`ws://${location.host}/events`);
    expect(backend.listQueue().map((i) => i.id)).toEqual([1]);
    const seen: BackendEvent[] = [];
    backend.subscribe((e) => seen.push(e));

    socket.send({ type: 'queue_item_status_changed', item: item(1, 'in_progress') });
    socket.send({ type: 'queue_item_status_changed', item: item(2, 'pending') });
    socket.send({ type: 'processor_state', isPaused: true });
    expect(backend.listQueue().map((i) => [i.id, i.status])).toEqual([
      [1, 'in_progress'],
      [2, 'pending'],
    ]);
    expect(backend.queueStatus()).toMatchObject({ inProgress: 1, pending: 1, total: 2, isPaused: true });
    expect(seen.map((e) => e.type)).toEqual(['queue_item_status_changed', 'queue_item_status_changed', 'processor_state']);

    // The remaining items travel with `queue_cleared`; the listeners get the event without them.
    socket.send({ type: 'queue_cleared', items: [item(2, 'pending')] });
    expect(backend.listQueue().map((i) => i.id)).toEqual([2]);
    expect(seen.at(-1)).toEqual({ type: 'queue_cleared' });
  });

  it('delivers progress and other events as they come, and ignores a message that is not an event', async () => {
    const { backend, socket } = await started();
    const seen: BackendEvent[] = [];
    const stop = backend.subscribe((e) => seen.push(e));
    socket.send({ type: 'engine_status', status: { state: 'ready' } });
    socket.onmessage?.({ data: 'not json' });
    stop();
    socket.send({ type: 'processor_state', isPaused: false });
    expect(seen).toEqual([{ type: 'engine_status', status: { state: 'ready' } }]);
  });

  it('opens the socket again after it drops and reads the queue it missed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const { backend, socket } = await started();
    const seen: BackendEvent[] = [];
    backend.subscribe((e) => seen.push(e));
    snapshotItems = [item(1, 'completed'), item(3, 'pending')];

    socket.drop();
    expect(FakeSocket.all).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.all).toHaveLength(2);
    FakeSocket.at(1).open();
    await vi.waitFor(() => expect(seen).toEqual([{ type: 'queue_cleared' }]));
    expect(backend.listQueue().map((i) => i.id)).toEqual([1, 3]);
    expect(backend.queueStatus().isPaused).toBe(true);
  });

  it('does not wait for a socket that never opens', async () => {
    const backend = new HttpBackend();
    const boot = backend.bootstrap();
    await vi.waitFor(() => expect(FakeSocket.all).toHaveLength(1));
    FakeSocket.at(0).drop();
    await expect(boot).resolves.toMatchObject({ boards: bootstrapSample.boards });
  });
});

describe('HttpBackend pictures and jobs', () => {
  it('posts a picture as bytes with its options in a header', async () => {
    const backend = new HttpBackend();
    const image = await backend.uploadImage(new Blob(['png']), { boardId: 'b1', category: 'mask' });
    expect(image.url).toBe('/novira-image/full/up.png');
    const call = calls.find((c) => c.url === '/upload/image');
    expect(call?.init?.method).toBe('POST');
    expect(call?.init?.headers).toEqual({
      'content-type': 'application/octet-stream',
      'x-novira-options': JSON.stringify({ boardId: 'b1', isIntermediate: false, category: 'mask' }),
    });
  });

  it('stores a picture of the page before the job names it, and leaves the server pictures alone', async () => {
    const backend = new HttpBackend();
    await backend.enqueue(
      request({
        initImageUrl: 'blob:http://localhost/flat',
        maskImageUrl: '/novira-image/full/mask.png',
      }),
    );
    const posted = calls.find((c) => c.url === '/api/enqueue');
    const body = JSON.parse(String(posted?.init?.body)) as { request: Record<string, unknown> };
    expect(body.request.initImageUrl).toBe('/novira-image/full/up.png');
    expect(body.request.maskImageUrl).toBe('/novira-image/full/mask.png');
    expect(calls.filter((c) => c.url === '/upload/image')).toHaveLength(1);
    const upload = calls.find((c) => c.url === '/upload/image');
    expect(JSON.parse(String((upload?.init?.headers as Record<string, string>)['x-novira-options']))).toMatchObject({
      isIntermediate: true,
      category: 'general',
    });
  });

  it('shows the message of a refused command', async () => {
    const backend = new HttpBackend();
    await expect(backend.createBoard('x')).resolves.toBeNull();
    vi.mocked(fetch).mockImplementationOnce(() => json({ error: 'The picture was deleted', code: 'failed' }, false) as never);
    await expect(backend.deleteBoard('x', false)).rejects.toThrow('The picture was deleted');
  });
});

describe('HttpBackend pages outside the app', () => {
  it('opens the address the server checked in a new tab, without a link back to this page', async () => {
    const open = vi.fn(() => null);
    vi.stubGlobal('open', open);
    await new HttpBackend().openCivitaiPage('12');
    const call = calls.find((c) => c.url === '/api/open_civitai_page');
    expect(JSON.parse(String(call?.init?.body))).toEqual({ modelId: '12' });
    expect(open).toHaveBeenCalledWith('https://civitai.com/models/12', '_blank', 'noopener,noreferrer');
  });

  it('opens nothing when the server refuses the address', async () => {
    const open = vi.fn(() => null);
    vi.stubGlobal('open', open);
    await expect(new HttpBackend().openSourcePage('https://evil.example/')).rejects.toThrow('this address cannot be opened');
    expect(open).not.toHaveBeenCalled();
  });
});
