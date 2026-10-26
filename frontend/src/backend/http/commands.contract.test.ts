// @vitest-environment jsdom
// Contract between the HTTP calls `HttpBackend` makes and the shared command layer of the server
// (`backend/crates/novira-core/src/api.rs`): every command name must exist there (or be one the desktop shell implements
// itself, which the server answers "not available in the browser yet"), and the argument names must be the layer's
// parameters in camelCase.
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { CALLS, camel, fixture, read } from '../calls.testkit';
import { HttpBackend, isServedByServer, isServerImageUrl } from './HttpBackend';

/** Commands of the layer that the frontend does not call, and why. */
const NOT_CALLED: Record<string, string> = {
  pack_status: 'pack states arrive with bootstrap and as `pack` events',
  upload_image: 'a picture is posted to /upload/image, not to /api',
  export_images: 'the copies come back as a download from /export/images, not from /api',
  set_ui_zoom: 'the browser zooms by itself',
  first_run_info: 'the first-start screen exists only in the desktop app, before a backend does',
  first_run_choose: 'see first_run_info',
  first_run_reset: 'see first_run_info',
  first_run_finish: 'see first_run_info',
};

const api = read('backend/crates/novira-core/src/api.rs');

/** The commands of the shared layer with their parameter names (camelCase), from the `commands!` list. */
function layerCommands(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const m of api.matchAll(/^ {4}(?:sync|async) (\w+)\(b((?:, \w+: [^,)]+)*)\)/gm)) {
    out.set(
      m[1]!,
      [...m[2]!.matchAll(/, (\w+):/g)].map((p) => camel(p[1]!)),
    );
  }
  return out;
}

/** The commands the desktop shell implements itself (`SHELL_ONLY`). */
function shellOnly(): string[] {
  const list = api.slice(api.indexOf('pub const SHELL_ONLY'));
  return [...list.slice(0, list.indexOf('];')).matchAll(/"([a-z_]+)"/g)].map((m) => m[1]!);
}

/** The IPC argument names of the shell's own commands (camelCase), from `commands.rs` and `first_run.rs`. */
function shellArguments(): Map<string, string[]> {
  const src = read('backend/src-tauri/src/commands.rs') + read('backend/src-tauri/src/first_run.rs');
  const out = new Map<string, string[]>();
  for (const m of src.matchAll(/#\[tauri::command\]\s*pub (?:async )?fn (\w+)\(([^)]*)\)/g)) {
    const params = [...m[2]!.matchAll(/(?<![:\w])(\w+)\s*:(?!:)\s*/g)]
      .filter(
        (p) =>
          !/^(State<|tauri::ipc::Request<|tauri::Webview\b)/.test(
            m[2]!.slice(p.index! + p[0].length),
          ),
      )
      .map((p) => camel(p[1]!));
    out.set(m[1]!, params);
  }
  return out;
}

let calls: { cmd: string; body: unknown; method: string; url: string }[] = [];
let uploads: { headers: unknown; method: string }[] = [];
let reply: (cmd: string) => { status: number; body: unknown } = () => ({ status: 200, body: null });

beforeEach(() => {
  calls = [];
  uploads = [];
  reply = (cmd) => ({
    status: 200,
    body:
      cmd === 'bootstrap'
        ? fixture('bootstrap')
        : cmd === 'enqueue'
          ? [fixture('queue-item')]
          : cmd === 'delete_board'
            ? []
            : null,
  });
  // The pages outside the app open in a new tab, which jsdom does not have.
  vi.stubGlobal('open', vi.fn(() => null));
  // No event socket in these tests: one that closes at once.
  vi.stubGlobal(
    'WebSocket',
    class {
      onclose: (() => void) | null = null;
      constructor() {
        queueMicrotask(() => this.onclose?.());
      }
    },
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
      if (url === '/upload/image') {
        uploads.push({ headers: init.headers, method: String(init.method) });
        return json({ name: 'up.png', url: '/novira-image/full/up.png' });
      }
      // A picture of the page (the fixtures name desktop picture URLs) is read to be posted.
      if (!url.startsWith('/api/')) return new Response(new Blob(['x']));
      const cmd = url.replace('/api/', '');
      calls.push({ cmd, body: JSON.parse(String(init.body)), method: String(init.method), url });
      const r = reply(cmd);
      return new Response(JSON.stringify(r.body), {
        status: r.status,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('HTTP command contract', () => {
  it('lists the layer and the shell-only commands without overlap', () => {
    const names = [...layerCommands().keys()];
    expect(names.length).toBeGreaterThan(60);
    expect(names.filter((n) => shellOnly().includes(n))).toEqual([]);
    for (const n of shellOnly()) expect(shellArguments().has(n), n).toBe(true);
  });

  it('calls every command of the layer and the shell (except the listed ones) and nothing else', async () => {
    const b = new HttpBackend();
    for (const call of Object.values(CALLS)) await call(b).catch(() => undefined);
    const known = [...layerCommands().keys(), ...shellOnly()];
    const called = new Set(calls.map((c) => c.cmd));
    expect([...called].filter((c) => !known.includes(c))).toEqual([]);
    expect(known.filter((c) => !called.has(c) && !(c in NOT_CALLED))).toEqual([]);
    expect(Object.keys(NOT_CALLED).every((c) => known.includes(c))).toBe(true);
  });

  it('posts JSON to /api/<command> with exactly the layer parameters as camelCase arguments', async () => {
    const b = new HttpBackend();
    for (const call of Object.values(CALLS)) await call(b).catch(() => undefined);
    const layer = layerCommands();
    const shell = shellArguments();
    const mismatched = calls
      .map((c) => ({
        cmd: c.cmd,
        sent: Object.keys(c.body as object).sort(),
        expected: [...(layer.get(c.cmd) ?? shell.get(c.cmd) ?? ['?'])].sort(),
      }))
      .filter((c) => c.sent.join() !== c.expected.join());
    expect(mismatched).toEqual([]);
    expect(calls.every((c) => c.method === 'POST' && c.url === `/api/${c.cmd}`)).toBe(true);
  });
});

describe('HttpBackend', () => {
  it('turns the server message into an error, and a body that is not JSON into a status message', async () => {
    const b = new HttpBackend();
    reply = () => ({
      status: 501,
      body: {
        error: 'not available in the browser yet: enqueue',
        code: 'not_available_in_browser',
      },
    });
    await expect(b.pruneQueue()).rejects.toThrow('not available in the browser yet: enqueue');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>', { status: 502 })),
    );
    await expect(b.pruneQueue()).rejects.toThrow('prune_queue failed (502)');
  });

  it('keeps the queue of the last bootstrap and adds the built-in workflows', async () => {
    const b = new HttpBackend();
    const boot = await b.bootstrap();
    expect(boot.workflows.length).toBeGreaterThan(0);
    expect(b.listQueue()).toEqual(
      (fixture('bootstrap') as { queue: { items: unknown[] } }).queue.items,
    );
    expect(b.kind).toBe('http');
  });

  it('posts a picture to the upload route, not to a command, and ignores zoom', async () => {
    const b = new HttpBackend();
    const image = await b.uploadImage(new Blob(['x']), { boardId: null });
    expect(image.url).toBe('/novira-image/full/up.png');
    await b.saveImageFromUrl('/novira-image/full/a.png', { boardId: null });
    expect(uploads.map((u) => u.method)).toEqual(['POST', 'POST']);
    await b.setUiZoom(1.5);
    expect(calls).toEqual([]);
  });

  it('downloads an export from the export route under the name the server gives, and passes its refusal on', async () => {
    const options = { format: 'png', quality: 90, maxSide: null, removeInfo: true, watermark: false } as const;
    const sent: { url: string; body: unknown }[] = [];
    const clicked: string[] = [];
    // jsdom has no object URLs.
    const { createObjectURL, revokeObjectURL } = URL;
    URL.createObjectURL = () => 'blob:x';
    URL.revokeObjectURL = () => undefined;
    onTestFinished(() => {
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = revokeObjectURL;
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download);
    });
    onTestFinished(() => click.mockRestore());
    const result = { count: 2, skipped: 1, watermarked: 0, folder: '' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        sent.push({ url, body: JSON.parse(String(init.body)) });
        return new Response(new Blob(['zip']), {
          headers: {
            'content-type': 'application/zip',
            'content-disposition': 'attachment; filename="novira-export-20261022-120000.zip"',
            'x-novira-export': JSON.stringify(result),
          },
        });
      }),
    );
    const b = new HttpBackend();
    expect(await b.exportImages(['a.png', 'b.png', 'gone.png'], options)).toEqual(result);
    expect(sent).toEqual([{ url: '/export/images', body: { names: ['a.png', 'b.png', 'gone.png'], options } }]);
    expect(clicked).toEqual(['novira-export-20261022-120000.zip']);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'choose fewer pictures', code: 'failed' }), { status: 422 })),
    );
    await expect(b.exportImages(['a.png'], options)).rejects.toThrow('choose fewer pictures');
    expect(clicked).toHaveLength(1);
  });

  it('knows the picture route and the page the server marked', () => {
    expect(isServerImageUrl('/novira-image/full/a.png')).toBe(true);
    expect(isServerImageUrl('http://novira-image.localhost/full/a.png')).toBe(false);
    expect(isServedByServer()).toBe(false);
    window.__NOVIRA_SERVER__ = true;
    expect(isServedByServer()).toBe(true);
    delete window.__NOVIRA_SERVER__;
  });
});
