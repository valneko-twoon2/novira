// Measures the start-up of a production frontend build in Chromium (Playwright), and optionally its screen switches: the
// timings, the long tasks, the heap and the backend calls of each start. Several builds are compared by interleaving their
// runs (the machine is shared, so one build is never measured in a quiet minute and the other in a busy one); medians are
// reported. Outputs go to novira-data/work/perf/ of the main checkout.
//
//   node tools/perf-startup.mjs [--via server|mock] [--dist <label>=<folder>]... [--runs 7] [--switch] [--keep-floor]
//                               [--data <folder>] [--exe <novira-server.exe>] [--cpu <rate>] [--out <name>] [--trace]
//
// --via server (default) starts novira-server (release build; `--exe`, default <work>/perf-target/release/novira-server.exe,
// build it with CARGO_TARGET_DIR=<work>/perf-target cargo build --release -p novira-server) without the engine, once per build,
// each on its own copy of `--data` (default <work>/perf-data, a copy of real data) made under <work>/perf/. No ComfyUI, no GPU.
// Calls that would start or install the engine or reach the internet (`OFFLINE_CALLS`) are answered as failed, other hosts aborted.
// --via mock serves the folder as static files (missing files from frontend/public, the mock's pictures) on the browser mock.
// Without an engine the start-up screen would wait its 12 s engine grace; the page's timer of exactly that length is shortened
// to 0, and so is its 1.8 s minimum unless --keep-floor, so the numbers are the frontend's own cost.
// --trace records a Chrome trace of each build's first start (<out>-<label>.trace.json) and sums its main thread by event;
// on a build whose react-dom is the profiling one, also each component's own render time (React's Components track).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { harnessRoots } from './harness-paths.mjs';
import { markUsed } from './prune-stale.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ENGINE_GRACE_MS = 12_000;
export const SPLASH_FLOOR_MS = 1800;
/** The screens a switch run visits, in order, by the test id of their entry. */
export const SWITCH_STEPS = ['tab-canvas', 'tab-upscaling', 'tab-workflows', 'tab-models', 'tab-browse', 'tab-queue', 'tab-extensions', 'tab-generate',
  'media-video', 'media-music', 'media-voice', 'media-logo', 'media-text', 'media-comic', 'media-image'];

/** The median of numbers (the upper middle for an even count); null for none. */
export function median(values) {
  const v = values.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
}

/** Total blocking time and counts of long tasks (`[{start, duration}]`) that start inside `[from, to)`. */
export function blocking(tasks, from = 0, to = Infinity) {
  const inside = tasks.filter((t) => t.start >= from && t.start < to);
  return {
    count: inside.length,
    tbt: Math.round(inside.reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0)),
    longest: Math.round(inside.reduce((max, t) => Math.max(max, t.duration), 0)),
    total: Math.round(inside.reduce((sum, t) => sum + t.duration, 0)),
  };
}

/**
 * For each backend call (`[{name, start, end}]`, sorted or not), the call it most likely waited for: the latest one that ended
 * before it started (within `slackMs`), when this one started no earlier than that end. `null` means it started while every
 * earlier call was still running (it ran in parallel) or nothing came before it.
 */
export function waitedFor(calls, slackMs = 3) {
  const sorted = [...calls].sort((a, b) => a.start - b.start);
  return sorted.map((call) => {
    const before = sorted.filter((c) => c !== call && c.start <= call.start && c.end <= call.start + slackMs);
    const running = sorted.some((c) => c !== call && c.start <= call.start && c.end > call.start + slackMs);
    const last = before.sort((a, b) => b.end - a.end)[0];
    return { ...call, after: last && !running && call.start - last.end <= 50 ? last.name : null };
  });
}

/** Per key, the median of the runs' values (`[{key: number}]`), rounded to a tenth. */
export function medians(runs) {
  const keys = [...new Set(runs.flatMap((r) => Object.keys(r)))];
  return Object.fromEntries(keys.map((k) => {
    const m = median(runs.map((r) => r[k]));
    return [k, m === null ? null : Math.round(m * 10) / 10];
  }));
}

const TRACE_EVENTS = new Set(['EvaluateScript', 'v8.compile', 'v8.compileModule', 'v8.evaluateModule', 'FunctionCall', 'RunMicrotasks', 'TimerFire', 'FireAnimationFrame', 'EventDispatch',
  'ParseHTML', 'ParseAuthorStyleSheet', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize', 'Decode Image', 'MajorGC', 'MinorGC', 'HitTest']);

/**
 * Sums a Chrome trace's main renderer thread (`traceEvents`) by event name between `from` and `to` ms after the first
 * navigation event, and React's per-component render time (its "Components" track; own time, nested children taken out).
 */
export function traceSummary(traceEvents, from = 0, to = Infinity) {
  const main = traceEvents.find((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain' && traceEvents.some((x) => x.pid === e.pid && x.name === 'navigationStart'));
  if (!main) return { events: {}, components: {} };
  const zero = traceEvents.filter((e) => e.pid === main.pid && e.name === 'navigationStart').reduce((min, e) => Math.min(min, e.ts), Infinity);
  const inside = (ts) => (ts - zero) / 1000 >= from && (ts - zero) / 1000 < to;
  const events = {};
  for (const e of traceEvents) {
    if (e.ph !== 'X' || e.pid !== main.pid || e.tid !== main.tid || !TRACE_EVENTS.has(e.name) || !inside(e.ts)) continue;
    events[e.name] = (events[e.name] ?? 0) + (e.dur ?? 0) / 1000;
  }
  const spans = traceEvents
    .filter((e) => e.name === 'TimeStamp' && e.pid === main.pid && String(e.args?.data?.track ?? '').includes('Components') && e.args.data.start !== undefined)
    .map((e) => ({ name: e.args.data.message, start: Number(e.args.data.start), end: Number(e.args.data.end) }))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const own = {};
  const stack = [];
  for (const s of spans) {
    while (stack.length && stack.at(-1).end <= s.start) stack.pop();
    const parent = stack.at(-1);
    if (parent) own[parent.name] = (own[parent.name] ?? 0) - (s.end - s.start);
    own[s.name] = (own[s.name] ?? 0) + (s.end - s.start);
    stack.push(s);
  }
  const round = (o, div = 1) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round((v / div) * 10) / 10]).sort((a, b) => b[1] - a[1]));
  // The track's start and end are in microseconds of the same clock as the trace.
  return { events: round(events), components: Object.fromEntries(Object.entries(round(own, 1000)).slice(0, 40)) };
}

/** `--name value` and repeatable `--dist label=folder` options. */
export function parseArgs(argv) {
  const opts = { via: 'server', dists: [], runs: 7, switch: false, keepFloor: false, cpu: 1, out: null, data: null, exe: null, trace: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--via') opts.via = next();
    else if (a === '--dist') {
      const v = next();
      const eq = v.indexOf('=');
      opts.dists.push(eq > 0 ? { label: v.slice(0, eq), dir: path.resolve(v.slice(eq + 1)) } : { label: path.basename(v), dir: path.resolve(v) });
    } else if (a === '--runs') opts.runs = Number(next());
    else if (a === '--switch') opts.switch = true;
    else if (a === '--keep-floor') opts.keepFloor = true;
    else if (a === '--trace') opts.trace = true;
    else if (a === '--cpu') opts.cpu = Number(next());
    else if (a === '--out') opts.out = next();
    else if (a === '--data') opts.data = path.resolve(next());
    else if (a === '--exe') opts.exe = path.resolve(next());
    else throw new Error(`unknown option ${a}`);
  }
  if (opts.via !== 'server' && opts.via !== 'mock') throw new Error('--via is server or mock');
  if (!(opts.runs >= 1)) throw new Error('--runs is a positive number');
  return opts;
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.wasm': 'application/wasm', '.txt': 'text/plain' };

/** A static server of `dir` (then `fallback`) on a free port, for the mock build. */
function staticServer(dir, fallback) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    if (rel.split('/').some((s) => s === '..')) return res.writeHead(400).end();
    const file = [dir, fallback].map((root) => path.join(root, rel)).find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
    if (!file) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}/`, stop: () => server.close() })));
}

/** novira-server on `data` serving `dist`, without the engine; resolves with the address that carries the token. */
function novServer(exe, data, dist) {
  const child = spawn(exe, ['--data', data, '--dist', dist], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let out = '';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no address from the server: ${out}`)), 60_000);
    child.stdout.on('data', (d) => {
      out += d;
      const m = /novira-server: (http:\/\/127\.0\.0\.1:\d+\/\?token=[0-9a-f]+)/.exec(out);
      if (m) {
        clearTimeout(timer);
        resolve({ url: m[1], stop: () => child.kill() });
      }
    });
    child.stderr.on('data', (d) => (out += d));
    child.on('exit', (code) => reject(new Error(`the server exited (${code}): ${out}`)));
  });
}

/** Backend calls that would start (or install) the engine or reach the internet; a measurement answers them as failed. */
export const OFFLINE_CALLS = ['node_defs', 'comfy_ui_locale', 'restart_engine', 'switch_comfy_version', 'search_civitai', 'registry_nodes', 'node_pack_info',
  'node_pack_versions', 'comfy_versions', 'list_hugging_face_files', 'lookup_reference', 'face_rig_preview', 'agent_endpoint_models', 'agent_endpoint_test'];

/** Keeps a page local: other hosts are aborted, the calls above get the server's "failed" answer without reaching it. */
async function offline(ctx, origin) {
  await ctx.route((url) => url.origin !== origin && !url.protocol.startsWith('data') && !url.protocol.startsWith('blob'), (route) => route.abort());
  await ctx.route((url) => url.origin === origin && OFFLINE_CALLS.includes(url.pathname.replace(/^\/api\//, '')), (route) =>
    route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'not during a measurement', code: 'failed' }) }));
}

/** Runs in the page before its scripts: observers for the long tasks and the moments the start-up is judged by. */
function pageProbe({ grace, floor, keepFloor }) {
  const realTimeout = window.setTimeout.bind(window);
  window.setTimeout = (fn, delay, ...rest) => realTimeout(fn, delay === grace || (!keepFloor && delay === floor) ? 0 : delay, ...rest);
  performance.setResourceTimingBufferSize(5000);
  const perf = (window.__perf = { long: [], loaf: [], marks: {} });
  new PerformanceObserver((list) => list.getEntries().forEach((e) => perf.long.push({ start: e.startTime, duration: e.duration }))).observe({ type: 'longtask', buffered: true });
  try {
    new PerformanceObserver((list) => list.getEntries().forEach((e) => perf.loaf.push({
      start: e.startTime, duration: e.duration, blocking: e.blockingDuration,
      scripts: e.scripts.map((s) => ({ d: Math.round(s.duration), f: s.sourceFunctionName, u: (s.sourceURL || '').split('/').pop(), c: s.sourceCharPosition, i: s.invoker })),
    }))).observe({ type: 'long-animation-frame', buffered: true });
  } catch {
    // older Chromium
  }
  const mark = (k) => (perf.marks[k] ??= performance.now());
  const visibleThumbs = () => {
    const grid = document.querySelector('[data-testid="gallery-grid"]');
    if (!grid) return [];
    const box = grid.getBoundingClientRect();
    return [...grid.querySelectorAll('[data-testid="gallery-thumb"] img')].filter((img) => {
      const r = img.getBoundingClientRect();
      return r.bottom > box.top && r.top < box.bottom && r.width > 0;
    });
  };
  const check = () => {
    if (document.querySelector('[data-testid="splash"]')) mark('splash');
    // The shell may be built hidden under the start-up screen; it counts once it shows.
    if (document.querySelector('.app')?.checkVisibility()) mark('app');
    if ([...document.querySelectorAll('[data-testid="gallery-thumb"]')].some((e) => e.checkVisibility())) mark('thumbDom');
    const thumbs = visibleThumbs();
    if (thumbs.some((i) => i.complete && i.naturalWidth > 0)) mark('thumbFirst');
    if (thumbs.length && thumbs.every((i) => i.complete && i.naturalWidth > 0)) {
      mark('thumbsAll');
      perf.thumbCount = thumbs.length;
    }
  };
  new MutationObserver(check).observe(document, { childList: true, subtree: true });
  const poll = () => {
    check();
    if (!perf.marks.thumbsAll) requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}

/** One start in a fresh context; returns its numbers. */
async function measureStart(browser, url, opts) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 960 } });
  await offline(ctx, new URL(url).origin);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (opts.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: opts.cpu });
  await cdp.send('Network.enable');
  const sockets = {};
  let docStart = null;
  cdp.on('Network.requestWillBeSent', (e) => {
    if (e.type === 'Document' && docStart === null) docStart = e.timestamp;
  });
  cdp.on('Network.webSocketCreated', (e) => (sockets[e.requestId] = { created: e.url ? Date.now() : 0, ts: null }));
  cdp.on('Network.webSocketWillSendHandshakeRequest', (e) => sockets[e.requestId] && (sockets[e.requestId].sent = e.timestamp));
  cdp.on('Network.webSocketHandshakeResponseReceived', (e) => sockets[e.requestId] && (sockets[e.requestId].open = e.timestamp));
  await page.addInitScript(pageProbe, { grace: ENGINE_GRACE_MS, floor: SPLASH_FLOOR_MS, keepFloor: opts.keepFloor });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // React logs its Components track only when a devtools hook is present; this stub is enough.
  if (opts.traceFile) await page.addInitScript(() => {
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { isDisabled: false, supportsFiber: true, renderers: new Map(), inject: () => 1, onCommitFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, onScheduleFiberRoot() {}, setStrictMode() {}, checkDCE() {} };
  });
  if (opts.traceFile) await browser.startTracing(page, { path: opts.traceFile, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'blink.user_timing', 'loading', 'disabled-by-default-v8.cpu_profiler'] });
  await page.goto(url);
  try {
    await page.waitForFunction(() => window.__perf?.marks.thumbsAll || (document.querySelector('.app') && !document.querySelector('[data-testid="gallery-thumb"]') && performance.now() > 15000), null, { timeout: 60_000, polling: 50 });
  } catch (err) {
    if (opts.shotOnFail) await page.screenshot({ path: opts.shotOnFail }).catch(() => undefined);
    const first = String(err.message).split(/\r?\n/)[0];
    throw new Error(`the gallery showed no thumbnails (${first})${opts.shotOnFail ? `; screenshot ${opts.shotOnFail}` : ''}`);
  }
  await page.waitForTimeout(2000);
  if (opts.traceFile) await browser.stopTracing();
  const heap = await cdp.send('Runtime.getHeapUsage');
  const r = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, p.startTime]));
    const res = performance.getEntriesByType('resource');
    const calls = res.filter((e) => /\/api\//.test(e.name)).map((e) => ({ name: e.name.split('/api/').pop(), start: e.startTime, end: e.responseEnd, bytes: e.encodedBodySize, decoded: e.decodedBodySize }));
    const scripts = res.filter((e) => /\.(js|css)$/.test(e.name)).map((e) => ({ name: e.name.split('/').pop(), start: e.startTime, end: e.responseEnd, bytes: e.encodedBodySize }));
    const thumbs = res.filter((e) => /novira-image|mock-images/.test(e.name));
    return { nav: { responseEnd: nav.responseEnd, dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd }, paint, marks: window.__perf.marks, thumbCount: window.__perf.thumbCount ?? 0, long: window.__perf.long, loaf: window.__perf.loaf, calls, scripts, thumbRequests: thumbs.length, heapJs: performance.memory?.usedJSHeapSize ?? null, now: performance.now(), rec: window.__noviraPerf?.snapshot() ?? null };
  });
  await ctx.close();
  const ws = Object.values(sockets)[0];
  if (ws && docStart !== null) r.socket = { start: ((ws.sent ?? docStart) - docStart) * 1000, open: ws.open ? (ws.open - docStart) * 1000 : null };
  r.heapUsed = heap.usedSize;
  r.errors = errors;
  return r;
}

/** The flat numbers of one start, for the medians. */
export function startNumbers(r) {
  const m = r.marks;
  const at = (k) => (m[k] === undefined ? null : m[k]);
  const app = at('app');
  const appEnd = (app ?? 0) + 0;
  const lt = r.long.map((t) => ({ start: t.start, duration: t.duration }));
  const bootstrap = r.calls.find((c) => c.name === 'bootstrap');
  const lastCall = r.calls.filter((c) => c.start < (app ?? Infinity)).reduce((max, c) => Math.max(max, c.end), 0);
  return {
    responseEnd: r.nav.responseEnd,
    domContentLoaded: r.nav.dcl,
    firstPaint: r.paint['first-paint'] ?? null,
    firstContentfulPaint: r.paint['first-contentful-paint'] ?? null,
    splashShown: at('splash'),
    appShown: app,
    thumbDom: at('thumbDom'),
    thumbFirstLoaded: at('thumbFirst'),
    thumbsVisibleLoaded: at('thumbsAll'),
    bootstrapStart: bootstrap?.start ?? null,
    bootstrapEnd: bootstrap?.end ?? null,
    bootstrapKB: bootstrap ? Math.round(bootstrap.bytes / 1024) : null,
    startCallsBeforeApp: r.calls.filter((c) => c.start < (app ?? Infinity)).length,
    startCallsEnd: lastCall || null,
    callsTotal: r.calls.length,
    longTasksBeforeApp: blocking(lt, 0, appEnd).count,
    tbtBeforeApp: blocking(lt, 0, appEnd).tbt,
    longestBeforeApp: blocking(lt, 0, appEnd).longest,
    longTasksAfterApp: blocking(lt, appEnd).count,
    tbtAfterApp: blocking(lt, appEnd).tbt,
    longestAfterApp: blocking(lt, appEnd).longest,
    tbtAll: blocking(lt).tbt,
    // The task that showed the app (it ends where the shell appears).
    revealTask: Math.round(lt.filter((t) => app !== null && t.start <= app && t.start + t.duration >= app - 5).reduce((max, t) => Math.max(max, t.duration), 0)),
    heapUsedMB: Math.round((r.heapUsed / 1048576) * 10) / 10,
    ...recorded(r.rec),
  };
}

/** The app's own start marks and the duration of the first call of each command (frontend/src/backend/perf.ts). */
export function recorded(rec) {
  if (!rec) return {};
  const out = Object.fromEntries(Object.entries(rec.marks).map(([k, v]) => [`mark ${k}`, v]));
  for (const c of rec.calls) out[`call ${c.name}`] ??= c.duration;
  return out;
}

/** Clicks through the screens twice (cold, then warm) in one started page; per step the first paint and the changed screen. */
async function measureSwitches(browser, url, opts) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 960 } });
  await offline(ctx, new URL(url).origin);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (opts.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: opts.cpu });
  await page.addInitScript(pageProbe, { grace: ENGINE_GRACE_MS, floor: SPLASH_FLOOR_MS, keepFloor: false });
  await page.goto(url);
  await page.locator('.app').waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForTimeout(2500);
  const out = {};
  const missing = new Set();
  for (const pass of ['cold', 'warm']) {
    for (const id of SWITCH_STEPS) {
      const ms = await page.evaluate((id) => new Promise((resolve) => {
        // A screen kept mounted while hidden has the same entries; the shown one is clicked.
        const el = [...document.querySelectorAll(`[data-testid="${id}"]`)].find((e) => e.checkVisibility());
        const main = document.querySelector('.app__content');
        if (!el || !main) return resolve([null, null]);
        const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
        let changedAt = null;
        const watch = new MutationObserver(() => (changedAt ??= performance.now()));
        watch.observe(main, { childList: true, subtree: true, attributes: true });
        const t0 = performance.now();
        el.click();
        frame().then(async () => {
          const paint = performance.now() - t0;
          if (changedAt !== null) {
            watch.disconnect();
            return resolve([paint, paint]);
          }
          const until = t0 + 3000;
          while (changedAt === null && performance.now() < until) await new Promise((r) => setTimeout(r, 0));
          await frame();
          watch.disconnect();
          resolve([paint, performance.now() - t0]);
        });
      }), id);
      out[`${pass} ${id}`] = ms[1];
      if (ms[0] === null) missing.add(id);
      await page.waitForTimeout(400);
    }
  }
  await ctx.close();
  // A step whose entry is not on the screen is recorded as null; say so, or a build that hides it reads as a fast switch.
  if (missing.size) console.warn(`perf-startup: not measured, no visible entry in ${url}: ${[...missing].join(', ')} (the app's own build hides some media tabs: HIDDEN_TABS in frontend/src/state/ui.ts)`);
  return out;
}

/** Measures as `opts` (parseArgs) say; writes <work>/perf/<out>.json and returns `{ file, summary, raw }`. */
export async function runStartup(opts) {
  const roots = harnessRoots(REPO);
  const perfDir = path.join(roots.work, 'perf');
  fs.mkdirSync(perfDir, { recursive: true });
  markUsed(perfDir);
  if (!opts.dists.length) opts.dists.push({ label: 'current', dir: path.join(REPO, 'frontend', 'dist') });
  for (const d of opts.dists) if (!fs.existsSync(path.join(d.dir, 'index.html'))) throw new Error(`no index.html in ${d.dir} (npm run build)`);
  const require = createRequire(path.join(REPO, 'frontend', 'package.json'));
  const { chromium } = require('@playwright/test');
  const servers = [];
  try {
    for (const d of opts.dists) {
      if (opts.via === 'mock') {
        servers.push(await staticServer(d.dir, path.join(REPO, 'frontend', 'public')));
        continue;
      }
      const exe = opts.exe ?? path.join(roots.work, 'perf-target', 'release', 'novira-server.exe');
      if (!fs.existsSync(exe)) throw new Error(`no server at ${exe}: build it in release (see the head of this file) or pass --exe`);
      const source = opts.data ?? path.join(roots.work, 'perf-data');
      const data = path.join(perfDir, `data-${d.label}`);
      if (!path.relative(roots.work, source).split(path.sep)[0] || path.relative(roots.work, source).startsWith('..')) throw new Error(`refusing: --data ${source} is not inside ${roots.work}`);
      fs.rmSync(data, { recursive: true, force: true });
      fs.cpSync(source, data, { recursive: true });
      servers.push(await novServer(exe, data, d.dir));
    }
    const browser = await chromium.launch();
    const raw = Object.fromEntries(opts.dists.map((d) => [d.label, { starts: [], switches: [] }]));
    try {
      for (let run = 0; run < opts.runs; run++) {
        // Alternate the order, so neither build always goes first.
        const order = opts.dists.map((d, i) => i);
        if (run % 2) order.reverse();
        for (const i of order) {
          const d = opts.dists[i];
          const traceFile = opts.trace && run === 0 ? path.join(perfDir, `${opts.out ?? 'startup'}-${d.label}.trace.json`) : null;
          const r = await measureStart(browser, servers[i].url, { ...opts, traceFile, shotOnFail: path.join(perfDir, `${opts.out ?? 'startup'}-${d.label}-fail.png`) });
          if (traceFile) {
            raw[d.label].trace = traceSummary(JSON.parse(fs.readFileSync(traceFile, 'utf8')).traceEvents, 0, (r.marks.thumbsAll ?? r.now) + 500);
            console.log(`[perf] ${d.label} trace: ${JSON.stringify(raw[d.label].trace)}`);
          }
          raw[d.label].starts.push(r);
          const n = startNumbers(r);
          console.log(`[perf] ${d.label} run ${run + 1}: app ${Math.round(n.appShown)} ms, thumbs ${Math.round(n.thumbsVisibleLoaded ?? -1)} ms, tbt ${n.tbtAll} ms${r.errors.length ? `, ${r.errors.length} page error(s)` : ''}`);
          if (opts.switch) raw[d.label].switches.push(await measureSwitches(browser, servers[i].url, opts));
        }
      }
    } finally {
      await browser.close();
    }
    const summary = Object.fromEntries(opts.dists.map((d) => {
      const starts = raw[d.label].starts;
      const last = starts.at(-1);
      return [d.label, {
        start: medians(starts.map(startNumbers)),
        switches: opts.switch ? medians(raw[d.label].switches) : undefined,
        calls: waitedFor(last.calls).map((c) => ({ ...c, start: Math.round(c.start), end: Math.round(c.end), kb: Math.round(c.bytes / 1024) })),
        socket: last.socket,
        trace: raw[d.label].trace,
        errors: [...new Set(starts.flatMap((s) => s.errors))],
      }];
    }));
    const name = opts.out ?? `startup-${opts.via}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const file = path.join(perfDir, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify({ opts: { ...opts, dists: opts.dists }, summary, raw }, null, 1));
    console.log(JSON.stringify(Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, { start: v.start, switches: v.switches }])), null, 1));
    console.log(`[perf] written ${file}`);
    return { file, summary, raw };
  } finally {
    servers.forEach((s) => s.stop());
  }
}

async function main(argv) {
  await runStartup(parseArgs(argv));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
    console.error(`[perf] ${err.message}`);
    process.exit(1);
  });
}
