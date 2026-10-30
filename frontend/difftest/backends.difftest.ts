// @vitest-environment jsdom
// The same calls to the browser mock and to the real backend (novira-server, started by tools/diff-backends.mjs), and
// their answers compared: what the end-to-end tests see from the mock must be what the app sees from the backend.
// Compared after taking out what is meant to differ: ids and names each side makes up (mapped by first appearance),
// times, picture addresses (the transport), and the mock's own seed models and example workflows (only what a case made
// is compared). An error is compared as "refused", not by its text.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { BackendClient } from '../src/backend/client';
import { HttpBackend } from '../src/backend/http/HttpBackend';
import { MockBackend } from '../src/backend/mock/MockBackend';

// jsdom draws nothing: the mock reads a picture's size from the PNG header, as the backend does.
vi.mock('../src/backend/mock/imageSynth', async (original) => ({
  ...(await original<typeof import('../src/backend/mock/imageSynth')>()),
  imageSize: vi.fn(async (url: string) => {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    const view = new DataView(bytes.buffer);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }),
}));

const ORIGIN = process.env.NOVIRA_DIFF_ORIGIN;
const TOKEN = process.env.NOVIRA_DIFF_TOKEN;

/** A real PNG of `w` by `h` pixels, one colour, built by hand (no canvas in jsdom). */
function png(w: number, h: number): Blob {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes: Uint8Array) => {
    let c = 0xffffffff;
    for (const b of bytes) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set(new TextEncoder().encode(type), 4);
    out.set(data, 8);
    view.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)));
    return out;
  };
  const header = new Uint8Array(13);
  const hv = new DataView(header.buffer);
  hv.setUint32(0, w);
  hv.setUint32(4, h);
  header.set([8, 2, 0, 0, 0], 8);
  // Stored (uncompressed) deflate blocks of the rows: filter byte 0, then RGB.
  const raw = new Uint8Array(h * (1 + w * 3));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([200, 100, 50], y * (1 + w * 3) + 1 + x * 3);
  const blocks: number[] = [0x78, 0x01];
  for (let at = 0; at < raw.length; at += 65535) {
    const part = raw.subarray(at, Math.min(raw.length, at + 65535));
    const last = at + 65535 >= raw.length ? 1 : 0;
    blocks.push(last, part.length & 0xff, part.length >> 8, ~part.length & 0xff, (~part.length >> 8) & 0xff, ...part);
  }
  let a = 1;
  let b = 0;
  for (const byte of raw) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  const adler = ((b << 16) | a) >>> 0;
  blocks.push(adler >>> 24, (adler >>> 16) & 0xff, (adler >>> 8) & 0xff, adler & 0xff);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', new Uint8Array(blocks)), chunk('IEND', new Uint8Array())];
  return new Blob(parts, { type: 'image/png' });
}

/** Replaces what each side makes up on its own, so two answers can be compared. */
function normalize(value: unknown): unknown {
  const seen = new Map<string, string>();
  const made = (s: string) => {
    if (!seen.has(s)) seen.set(s, `<made ${seen.size + 1}>`);
    return seen.get(s)!;
  };
  const walk = (v: unknown, key = ''): unknown => {
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === 'object') {
      // In key order, so the made-up values are numbered alike whatever order each side writes its fields in.
      return Object.fromEntries(
        Object.entries(v)
          .sort(([a], [b]) => a.localeCompare(b))
          .filter(([k]) => !['url', 'thumbnailUrl'].includes(k))
          .map(([k, x]) => [k, walk(x, k)]),
      );
    }
    // No answer: the mock's `undefined`, the server's JSON `null`.
    if (v === undefined) return null;
    if (typeof v === 'number' && /(At|Ms)$/.test(key)) return '<time>';
    if (typeof v === 'string' && (/^(board|wf)-[0-9a-z-]+$/i.test(v) || /[0-9a-f]{32}/.test(v) || /^mock-/.test(v) || /^\d{6}-[0-9a-z]+\.png$/.test(v))) return made(v);
    return v;
  };
  return walk(value);
}

type Outcome = { value: unknown } | { refused: true };

async function settle(work: Promise<unknown>): Promise<Outcome> {
  try {
    return { value: await work };
  } catch {
    return { refused: true };
  }
}

const backends: { mock: BackendClient; real: BackendClient } = {} as never;

type Step = () => Promise<unknown>;

/** Runs the steps on each backend in turn, each one settled before the next starts, and compares what each answered. */
async function same(steps: (b: BackendClient) => Step[] | Promise<Step[]>): Promise<void> {
  const answers: Record<string, unknown> = {};
  for (const side of ['mock', 'real'] as const) {
    const out: Outcome[] = [];
    for (const step of await steps(backends[side])) out.push(await settle(step()));
    answers[side] = normalize(out);
  }
  expect(answers.real).toEqual(answers.mock);
}

describe.runIf(ORIGIN && TOKEN)('the mock answers as the real backend does', () => {
  beforeAll(async () => {
    const realFetch = globalThis.fetch;
    // The page's relative addresses go to the started server, with its token (a browser sends the cookie instead).
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' && input.startsWith('/') ? `${ORIGIN}${input}` : input;
      const own = typeof url === 'string' && url.startsWith(ORIGIN!);
      const headers = new Headers(init?.headers);
      if (own) headers.set('x-novira-token', TOKEN!);
      // jsdom's Blob is not Node's: its bytes go as they are (Node's fetch would send its name).
      const body = init?.body instanceof Blob ? new Uint8Array(await init.body.arrayBuffer()) : init?.body;
      return realFetch(url, { ...init, headers, body });
    });
    // No events are compared: a socket that never opens (bootstrap waits a moment for it, then reads).
    vi.stubGlobal(
      'WebSocket',
      class {
        onopen = null;
        onclose = null;
        onmessage = null;
        close() {}
      },
    );
    backends.mock = new MockBackend('empty');
    backends.real = new HttpBackend();
    await backends.mock.bootstrap();
    await backends.real.bootstrap();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('makes, renames, archives and refuses boards alike', async () => {
    await same((b) => [
      () => b.createBoard('  Trimmed  '),
      () => b.createBoard('   '),
      () => b.createBoard('x'.repeat(300)),
      () => b.createBoard('Second').then((board) => b.updateBoard(board.id, { name: '  Renamed ' })),
      () => b.createBoard('Third').then((board) => b.updateBoard(board.id, { archived: true })),
      () => b.updateBoard('board-none', { name: 'nobody' }),
      () => b.updateBoard('board-none', { name: '   ' }),
    ]);
  });

  it('saves, replaces and deletes workflows alike', async () => {
    await same(async (b) => {
      const first = await b.saveWorkflow({ name: 'Diff A', description: '', author: '', tags: ['x'], graph: { v: 1 } } as never);
      return [
        () => Promise.resolve(first),
        () => b.saveWorkflow({ id: first.id, name: 'Diff A2', description: 'd', author: 'me', tags: [], graph: { v: 2 } } as never),
        () => b.saveWorkflow({ id: 'made-up', name: 'Diff B', description: '', author: '', tags: [], graph: {} } as never),
        () => b.saveWorkflow({ name: '   ', description: '', author: '', tags: [], graph: {} } as never),
        () => b.bootstrap().then((boot) => boot.workflows.filter((w) => w.name.startsWith('Diff ')).sort((x, y) => x.name.localeCompare(y.name))),
        () => b.deleteWorkflow(first.id),
        () => b.deleteWorkflow('wf-none'),
      ];
    });
  });

  it('keeps comics, the canvas and the screen state alike, and refuses the same bad ones', async () => {
    await same((b) => [
      () => b.saveComic('comic-1', { title: 'First', pages: [] }),
      () => b.saveComic('comic 2', {}),
      () => b.saveComic('', {}),
      () => b.saveComic('a/b', {}),
      () => b.saveComic('x'.repeat(65), {}),
      () => b.listComics().then((list) => list.map((c) => ({ id: c.id, document: c.document }))),
      () => b.deleteComic('comic-1'),
      () => b.deleteComic('comic-none'),
      () => b.listComics(),
      () => b.saveCanvas('{"version":1,"entities":[]}'),
      () => b.loadCanvas(),
      () => b.saveCanvas('[1]'),
      () => b.saveCanvas('not json'),
      () => b.loadCanvas(),
      () => b.saveUiState('{"novira.theme":"light"}'),
      () => b.adoptUiState(null),
      () => b.saveUiState('{"theme":"light"}'),
      () => b.saveUiState('{"novira.x":1}'),
    ]);
  });

  it('uploads, stars, moves, deletes and brings back pictures alike', async () => {
    await same(async (b) => {
      const board = await b.createBoard('Pictures');
      const a = await b.uploadImage(png(16, 12), { boardId: board.id });
      // Apart in time: the order of two pictures of the same millisecond is set by neither side.
      await new Promise((resolve) => setTimeout(resolve, 5));
      const c = await b.uploadImage(png(8, 8), { boardId: null });
      const gallery = async () => (await b.bootstrap()).images.filter((i) => [a.name, c.name].includes(i.name));
      return [
        () => Promise.resolve([a, c]),
        () => b.uploadImage(new Blob([new TextEncoder().encode('not a picture')]), { boardId: null }),
        () => b.updateImages([a.name], { starred: true }),
        () => b.updateImages([a.name, 'nobody.png'], { boardId: null }),
        () => b.updateImages([c.name], { boardId: board.id }),
        () => gallery(),
        () => b.deleteImages([a.name]),
        () => gallery(),
        () => b.restoreImages([a.name, 'nobody.png']),
        () => gallery(),
        () => b.deleteBoard(board.id, false),
        () => gallery(),
      ];
    });
  });
});
