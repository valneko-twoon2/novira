// Speed measurements for AI sessions, the same way every time: measure, save a baseline, change the code, compare. Nothing
// here shows on a screen of the app; the app's own timings come from its recorder (frontend/src/backend/perf.ts).
//
//   node tools/perf.mjs <backend|startup|app|all> [--runs 7] [--save <name>] [--compare <name>] [--no-build] [--data <folder>]
//                       [--out <name>] [startup options: --via, --dist, --switch, --cpu, --keep-floor, --trace]
//   node tools/perf.mjs compare <baseline> [<result name or file>]       (default: the latest result)
//
// backend  novira-core's examples/backend_timing.rs in release (CARGO_TARGET_DIR <work>/perf-target): the steps of
//          Backend::open, each run on a fresh copy, and every sample of the commands the screens call at start and often.
// startup  tools/perf-startup.mjs: a production frontend build in Chromium on novira-server (release, same target), or
//          `--via mock`; its options pass through. Adds the app's own marks and call times.
// app      the real desktop app in release, isolated (tools/verify-real-app.mjs --release --no-engine: ComfyUI at a closed
//          loopback port, no ComfyUI folder, no GPU). Each run is a new process; over CDP the probe reads the app's marks,
//          every IPC call's duration, navigation and paint times, then reloads once (warm, the splash's timers cut to 0),
//          and on the last run once more with the size of each answer recorded. A python process under the app fails it.
// all      the three in turn.
// Data: --data (default <work>/perf-data, a copy of real data) is copied to <work>/perf/source with its model roots
// written as this system's paths: the database stores them with backslashes, and a root written with forward slashes
// made every open read all model headers again (about 250 ms), which a user's app does not do.
// Results: <work>/perf/<name>.json and <name>.md (and latest.json); --save keeps the result as <work>/perf/baselines/<name>.json;
// --compare prints the medians against a baseline and flags what moved beyond the noise (judge()). Each part notes the
// processor load before and during it, since a busy machine moves every number. The probe of `app`
// is this file again, run by verify-real-app with NOVIRA_PERF_PROBE set.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { harnessRoots } from './harness-paths.mjs';
import { cargoCommand, isInside, listProcesses } from './harness-process.mjs';
import { ENGINE_GRACE_MS, median, parseArgs as parseStartupArgs, runStartup, SPLASH_FLOOR_MS, startNumbers } from './perf-startup.mjs';
import { markUsed } from './prune-stale.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARTS = ['backend', 'startup', 'app'];
const CDP_URL = 'http://127.0.0.1:9333';
/** frontend/src/backend/perf.ts */
const RECORD_FLAG = 'novira-perf-record';
const SIZE_UNITS = new Set(['bytes', 'chars', 'kB']);
/** The smallest difference that counts, per unit, besides 10 % of the baseline. */
const FLOOR = { ms: 2, count: 1, MB: 2 };
/** Metrics that time other programs (agent_status runs the assistant CLIs, which take 45 or 270 ms by their own whim):
 * compared and shown, never flagged. */
const EXTERNAL = [/^backend agent_status /];
/** Shown on the console after a comparison even when they did not move. */
const HEADLINES = [/^backend open total$/, /^backend bootstrap call$/, /^startup \S+ (appShown|thumbsVisibleLoaded|bootstrapEnd)$/, /^app cold (page-start|stores-filled|call bootstrap)$/, /^app warm (stores-filled|shell-visible|call bootstrap)$/];

// ---- pure parts (tests: frontend/tests/perf.test.ts) ----

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = { command, runs: 7, save: null, compare: null, build: true, data: null, out: null, startup: [], positional: [] };
  if (!['backend', 'startup', 'app', 'all', 'compare'].includes(command)) throw new Error('usage: node tools/perf.mjs <backend|startup|app|all|compare> [options] (see the head of tools/perf.mjs)');
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const next = () => {
      const v = rest[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--runs') opts.runs = Number(next());
    else if (a === '--save') opts.save = baselineName(next());
    else if (a === '--compare') opts.compare = next();
    else if (a === '--no-build') opts.build = false;
    else if (a === '--data') opts.data = path.resolve(next());
    else if (a === '--out') opts.out = baselineName(next());
    else if (['--via', '--dist', '--cpu', '--exe'].includes(a)) opts.startup.push(a, next());
    else if (['--switch', '--keep-floor', '--trace'].includes(a)) opts.startup.push(a);
    else if (!a.startsWith('--') && command === 'compare') opts.positional.push(a);
    else throw new Error(`unknown option ${a}`);
  }
  if (!(Number.isInteger(opts.runs) && opts.runs >= 1)) throw new Error('--runs is a whole number of at least 1');
  if (command === 'compare' && (opts.positional.length < 1 || opts.positional.length > 2)) throw new Error('usage: node tools/perf.mjs compare <baseline> [<result>]');
  return opts;
}

/** A baseline or result name: letters, digits, `.`, `_`, `-`. */
export function baselineName(name) {
  if (!/^[\w.-]+$/.test(name) || name.startsWith('.')) throw new Error(`not a usable name: ${name}`);
  return name;
}

/** Median, lowest and highest of the samples that are numbers. */
export function stats(samples) {
  const v = samples.filter((x) => typeof x === 'number' && Number.isFinite(x));
  return { n: v.length, median: median(v), min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null };
}

/**
 * Whether a metric moved beyond the noise, from the samples of the baseline and of now. A time or count moved when the
 * new median is outside the baseline's lowest–highest sample and differs by at least 10 % of the baseline median and at
 * least FLOOR of its unit (2 ms); a size (deterministic on the same data) when it differs by more than 1 %.
 * `flag`: '' (same), 'slower' / 'faster' (ms), 'higher' / 'lower' (other units), 'changed' (a size), 'new', 'gone'.
 */
export function judge(unit, base, cur) {
  const b = stats(base);
  const c = stats(cur);
  if (!b.n || !c.n) return { flag: b.n ? 'gone' : c.n ? 'new' : '', base: b, cur: c, diff: null, pct: null };
  const diff = c.median - b.median;
  const pct = b.median ? (diff / Math.abs(b.median)) * 100 : null;
  let flag = '';
  if (SIZE_UNITS.has(unit)) {
    if (Math.abs(diff) > Math.abs(b.median) * 0.01) flag = 'changed';
  } else {
    const outside = c.median < b.min || c.median > b.max;
    const big = Math.abs(diff) >= Math.max(FLOOR[unit] ?? FLOOR.ms, Math.abs(b.median) * 0.1);
    if (outside && big) flag = unit === 'ms' ? (diff > 0 ? 'slower' : 'faster') : diff > 0 ? 'higher' : 'lower';
  }
  return { flag, base: b, cur: c, diff, pct };
}

/** One row per metric of either side (`{key: {unit, samples}}`), sorted by key. */
export function compareMetrics(base, cur) {
  const keys = [...new Set([...Object.keys(base), ...Object.keys(cur)])].sort();
  return keys.map((key) => {
    const unit = cur[key]?.unit ?? base[key]?.unit ?? 'ms';
    const row = { key, unit, ...judge(unit, base[key]?.samples ?? [], cur[key]?.samples ?? []) };
    return EXTERNAL.some((e) => e.test(key)) && row.flag !== 'new' && row.flag !== 'gone' ? { ...row, flag: '', note: 'other programs' } : row;
  });
}

/** A number for a table: three decimals below 1, two below 10, one above (or `digits`). */
export const num = (v, digits) => {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return '-';
  const a = Math.abs(v);
  return Number(v).toFixed(digits ?? (a < 1 ? 3 : a < 10 ? 2 : 1));
};

/** The comparison as a Markdown table. */
export function compareTable(rows) {
  const lines = ['| metric | unit | before (min–max) | now (min–max) | diff | % | |', '|---|---|---:|---:|---:|---:|---|'];
  for (const r of rows) {
    const range = (s) => (s.n ? `${num(s.median)} (${num(s.min)}–${num(s.max)})` : '-');
    lines.push(`| ${r.key} | ${r.unit} | ${range(r.base)} | ${range(r.cur)} | ${num(r.diff)} | ${num(r.pct, 0)} | ${r.flag ? `**${r.flag}**` : (r.note ?? '')} |`);
  }
  return lines.join('\n');
}

/** Each metric's median and range as a Markdown table. */
export function metricsTable(metrics, filter = () => true) {
  const lines = ['| metric | unit | median | min–max | n |', '|---|---|---:|---:|---:|'];
  for (const [key, m] of Object.entries(metrics).sort(([a], [b]) => a.localeCompare(b))) {
    if (!filter(key)) continue;
    const s = stats(m.samples);
    lines.push(`| ${key} | ${m.unit} | ${num(s.median)} | ${num(s.min)}–${num(s.max)} | ${s.n} |`);
  }
  return lines.join('\n');
}

/** `settings` with its model roots written as this system's paths (`resolve`), so they equal the database's. */
export function normalizeRoots(settings, resolve = path.resolve) {
  if (!Array.isArray(settings.modelRoots)) return settings;
  return { ...settings, modelRoots: settings.modelRoots.map((r) => (typeof r === 'string' ? resolve(r) : r)) };
}

/** The metrics of backend_timing's --json file. */
export function backendMetrics(report) {
  const out = {};
  for (const [phase, samples] of Object.entries(report.open ?? {})) out[`backend open ${phase}`] = { unit: 'ms', samples };
  out['backend open total'] = { unit: 'ms', samples: report.openTotal ?? [] };
  for (const [name, c] of Object.entries(report.commands ?? {})) {
    out[`backend ${name} call`] = { unit: 'ms', samples: c.call };
    out[`backend ${name} json`] = { unit: 'ms', samples: c.json };
    if (c.dispatch) out[`backend ${name} dispatch`] = { unit: 'ms', samples: c.dispatch };
    out[`backend ${name} bytes`] = { unit: 'bytes', samples: [c.bytes] };
  }
  return out;
}

const COUNTS = new Set(['startCallsBeforeApp', 'callsTotal', 'longTasksBeforeApp', 'longTasksAfterApp']);

/** The unit of one of startNumbers()'s keys. */
export function startupUnit(key) {
  if (key.endsWith('KB')) return 'kB';
  if (key.endsWith('MB')) return 'MB';
  return COUNTS.has(key) ? 'count' : 'ms';
}

/** The metrics of perf-startup's raw runs (`{label: {starts, switches}}`), every run a sample. */
export function startupMetrics(raw, numbers = startNumbers) {
  const out = {};
  const add = (key, unit, value) => {
    out[key] ??= { unit, samples: [] };
    out[key].samples.push(value);
  };
  for (const [label, r] of Object.entries(raw)) {
    for (const start of r.starts) for (const [k, v] of Object.entries(numbers(start))) add(`startup ${label} ${k}`, startupUnit(k), v);
    for (const sw of r.switches ?? []) for (const [k, v] of Object.entries(sw)) add(`startup ${label} switch ${k}`, 'ms', v);
  }
  return out;
}

/** The flat numbers of one page start the probe read (`{marks, calls, nav, paint, clickAt}`), ms since the page's origin. */
export function appStartNumbers(s) {
  const out = {};
  for (const [k, v] of Object.entries(s.marks ?? {})) out[k] = v;
  out.responseEnd = s.nav?.responseEnd ?? null;
  out.domContentLoaded = s.nav?.dcl ?? null;
  out.firstContentfulPaint = s.paint?.['first-contentful-paint'] ?? null;
  const shown = s.marks?.['shell-visible'];
  if (typeof s.clickAt === 'number' && shown !== undefined) out.reveal = shown - s.clickAt;
  const thumb = s.marks?.['first-thumbnail'];
  if (thumb !== undefined && shown !== undefined) out['shown-to-thumbnail'] = thumb - Math.max(shown, s.clickAt ?? 0);
  for (const c of s.calls ?? []) out[`call ${c.name}`] ??= c.duration;
  return out;
}

/** The metrics of the probe's runs: the cold start of each process, its warm reload, and the sizes of the recorded run. */
export function appMetrics(probes) {
  const out = {};
  const add = (key, unit, value) => {
    if (value === null || value === undefined) return;
    out[key] ??= { unit, samples: [] };
    out[key].samples.push(value);
  };
  for (const p of probes) {
    add('app cold page-start', 'ms', p.cold && p.startedAt ? p.cold.timeOrigin - p.startedAt : null);
    for (const phase of ['cold', 'warm']) if (p[phase]) for (const [k, v] of Object.entries(appStartNumbers(p[phase]))) add(`app ${phase} ${k}`, 'ms', v);
    for (const c of p.recorded?.calls ?? []) if (typeof c.size === 'number' && !out[`app size ${c.name}`]) add(`app size ${c.name}`, 'chars', c.size);
  }
  return out;
}

/**
 * Per command the app called at start: its time in the window (cold and warm, frontend/src/backend/perf.ts) against the
 * backend's own time for it (backend_timing: the call plus turning the answer into JSON). The difference is what the
 * IPC way costs: the shell's command, the transfer, parsing in the WebView, and waiting behind other work of the page.
 */
export function ipcRows(metrics) {
  const med = (key) => (metrics[key] ? stats(metrics[key].samples).median : null);
  const names = Object.keys(metrics).filter((k) => k.startsWith('app cold call ')).map((k) => k.slice('app cold call '.length));
  return names.sort().map((name) => {
    const cold = med(`app cold call ${name}`);
    const warm = med(`app warm call ${name}`);
    const call = med(`backend ${name} call`);
    const json = med(`backend ${name} json`);
    const service = call === null ? null : call + (json ?? 0);
    return { name, cold, warm, service, overhead: warm !== null && service !== null ? warm - service : null, size: med(`app size ${name}`) ?? med(`backend ${name} bytes`) };
  });
}

export function ipcTable(rows) {
  const lines = ['| command | window cold ms | window warm ms | backend (call + JSON) ms | IPC overhead (warm − backend) ms | size |', '|---|---:|---:|---:|---:|---:|'];
  for (const r of rows) lines.push(`| ${r.name} | ${num(r.cold)} | ${num(r.warm)} | ${num(r.service)} | ${num(r.overhead)} | ${num(r.size, 0)} |`);
  return lines.join('\n');
}

/** The processes below `pid` in a process list (tools/harness-process.mjs listProcesses). */
export function descendants(list, pid) {
  const out = [];
  const queue = [pid];
  const seen = new Set(queue);
  while (queue.length) {
    const parent = queue.shift();
    for (const p of list) {
      if (p.ppid === parent && !seen.has(p.pid)) {
        seen.add(p.pid);
        out.push({ pid: p.pid, name: p.name });
        queue.push(p.pid);
      }
    }
  }
  return out;
}

/** How busy all processors were between two `os.cpus()` readings, in % (null when nothing passed). */
export function busyPercent(before, after) {
  let idle = 0;
  let total = 0;
  after.forEach((cpu, i) => {
    const was = before[i]?.times;
    if (!was) return;
    for (const [k, v] of Object.entries(cpu.times)) {
      total += v - was[k];
      if (k === 'idle') idle += v - was[k];
    }
  });
  return total > 0 ? Math.round((1 - idle / total) * 100) : null;
}

/** A python or ComfyUI process among them: the app started an engine. */
export const engineProcesses = (procs) => procs.filter((p) => /python|comfy/i.test(p.name ?? ''));

// ---- running ----

const log = (msg) => console.log(`[perf] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOTS = harnessRoots(REPO);
const PERF_DIR = path.join(ROOTS.work, 'perf');
const TARGET = path.join(ROOTS.work, 'perf-target');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) throw new Error(`${path.basename(cmd)} ${args.join(' ')} failed (exit ${r.status ?? r.signal})`);
  return r;
}

const cargo = () => cargoCommand();

const insideWork = (p) => isInside(p, ROOTS.work);

/** <work>/perf/source: a fresh copy of the measured data with its model roots normalised. */
function prepareSource(data) {
  const from = data ?? path.join(ROOTS.work, 'perf-data');
  if (!insideWork(from)) throw new Error(`refusing: --data ${from} is not inside ${ROOTS.work}`);
  if (!fs.existsSync(path.join(from, 'novira.sqlite'))) throw new Error(`no novira.sqlite in ${from}`);
  markUsed(from);
  const source = path.join(PERF_DIR, 'source');
  fs.rmSync(source, { recursive: true, force: true });
  fs.cpSync(from, source, { recursive: true, filter: (f) => path.basename(f) !== 'novira.lock' });
  const file = path.join(source, 'settings.json');
  const settings = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  fs.writeFileSync(file, JSON.stringify(normalizeRoots(settings), null, 2) + '\n');
  log(`data: ${from} copied to ${source}`);
  return source;
}

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

async function measureBackend(opts, source) {
  const exe = path.join(TARGET, 'release', 'examples', 'backend_timing.exe');
  if (opts.build) run(cargo(), ['build', '--release', '-p', 'novira-core', '--example', 'backend_timing'], { cwd: path.join(REPO, 'backend'), env: { ...process.env, CARGO_TARGET_DIR: TARGET } });
  if (!fs.existsSync(exe)) throw new Error(`no ${exe}: run without --no-build`);
  const json = path.join(PERF_DIR, 'backend-samples.json');
  const scratch = path.join(PERF_DIR, 'backend-scratch');
  log('backend: Backend::open and the commands (backend_timing)');
  const r = spawnSync(exe, [source, scratch, '--runs', String(opts.runs), '--json', json], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  if (r.status !== 0) throw new Error(`backend_timing failed (exit ${r.status}): ${r.stdout}`);
  fs.rmSync(scratch, { recursive: true, force: true });
  const report = JSON.parse(fs.readFileSync(json, 'utf8'));
  return { metrics: backendMetrics(report), report, text: r.stdout };
}

async function measureStartup(opts, source, name) {
  const sopts = parseStartupArgs([...opts.startup, '--runs', String(opts.runs), '--out', `${name}-startup`]);
  if (opts.build) {
    run('npm', ['run', 'build'], { cwd: path.join(REPO, 'frontend'), shell: true });
    if (sopts.via === 'server' && !sopts.exe) run(cargo(), ['build', '--release', '-p', 'novira-server'], { cwd: path.join(REPO, 'backend'), env: { ...process.env, CARGO_TARGET_DIR: TARGET } });
  }
  if (sopts.via === 'server') sopts.data ??= source;
  const { file, raw } = await runStartup(sopts);
  return { metrics: startupMetrics(raw), file };
}

async function measureApp(opts, source) {
  const data = path.join(PERF_DIR, 'app-data');
  fs.rmSync(data, { recursive: true, force: true });
  fs.cpSync(source, data, { recursive: true });
  // Without the export watermark's files the app downloads them at start: the verification data's copy is used.
  const trustmark = path.join(ROOTS.work, 'verify-data', 'models', 'trustmark');
  if (fs.existsSync(trustmark)) fs.cpSync(trustmark, path.join(data, 'models', 'trustmark'), { recursive: true });
  else log(`no ${trustmark}: the app will download the watermark files on its first start`);
  const probes = [];
  for (let i = 0; i < opts.runs; i++) {
    // Every start on the same top-level files (database, settings) as the first.
    for (const f of fs.readdirSync(source, { withFileTypes: true })) if (f.isFile()) fs.copyFileSync(path.join(source, f.name), path.join(data, f.name));
    for (const f of ['novira.sqlite-wal', 'novira.sqlite-shm']) if (!fs.existsSync(path.join(source, f))) fs.rmSync(path.join(data, f), { force: true });
    const out = path.join(PERF_DIR, `app-probe-${i}.json`);
    fs.rmSync(out, { force: true });
    const last = i === opts.runs - 1;
    const args = [path.join(REPO, 'tools', 'verify-real-app.mjs'), path.join(REPO, 'tools', 'perf.mjs'), '--release', '--no-engine'];
    if (opts.build && i === 0) args.push('--build');
    if (!last) args.push('--keep');
    log(`app: run ${i + 1} of ${opts.runs}`);
    const env = { ...process.env, NOVIRA_VERIFY_DATA: data, NOVIRA_PERF_PROBE: out, NOVIRA_PERF_PROBE_RECORD: last ? '1' : '' };
    const r = spawnSync(process.execPath, args, { cwd: REPO, env, stdio: 'inherit' });
    if (!fs.existsSync(out)) throw new Error(`the app run gave no result (exit ${r.status})`);
    const probe = JSON.parse(fs.readFileSync(out, 'utf8'));
    if (probe.error) throw new Error(`app probe: ${probe.error}`);
    const engines = engineProcesses(probe.processes);
    if (engines.length) throw new Error(`the app started an engine process: ${JSON.stringify(engines)}`);
    log(`app run ${i + 1}: stores filled ${Math.round(probe.cold.marks['stores-filled'])} ms after the page started (page ${Math.round(probe.cold.timeOrigin - probe.startedAt)} ms after spawn), ${probe.cold.calls.length} calls; processes under the app: ${[...new Set(probe.processes.map((p) => p.name))].join(', ') || 'none'}`);
    probes.push(probe);
  }
  return { metrics: appMetrics(probes), probes };
}

/** The processor load of the baseline and of now, per part, as one line. */
export function loadLine(before = {}, now = {}) {
  const parts = [...new Set([...Object.keys(before), ...Object.keys(now)])];
  const one = (l) => (l ? `${l.before ?? '-'} % before, ${l.during ?? '-'} % during` : 'not noted');
  return `Processor load: ${parts.map((p) => `${p} ${one(before[p])} then ${one(now[p])}`).join('; ')}.`;
}

function report(result, comparison) {
  const m = result.metrics;
  const lines = [`# Speed measurement ${result.name}`, '', `${result.at}, ${result.git.head}${result.git.dirty ? ' (uncommitted changes)' : ''}, ${result.runs} runs, parts: ${result.parts.join(', ')}.`, ''];
  if (comparison) lines.push(`## Against ${comparison.baseline}`, '', `${comparison.rows.filter((r) => r.flag && r.flag !== 'new' && r.flag !== 'gone').length} moved beyond the noise. ${comparison.load}`, '', compareTable(comparison.rows), '');
  if (result.parts.includes('app')) lines.push('## Tauri IPC per call at start', '', ipcTable(ipcRows(m)), '');
  for (const part of result.parts) lines.push(`## ${part}`, '', metricsTable(m, (k) => k.startsWith(`${part} `)), '');
  return lines.join('\n');
}

function loadResult(nameOrFile, dir) {
  const candidates = [nameOrFile, path.join(dir, `${nameOrFile}.json`), path.join(PERF_DIR, `${nameOrFile}.json`)];
  const file = candidates.find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
  if (!file) throw new Error(`no result ${nameOrFile} (looked for ${candidates.slice(1).join(', ')})`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function printComparison(rows, baseline, load) {
  const moved = rows.filter((r) => r.flag && r.flag !== 'new' && r.flag !== 'gone');
  const shown = rows.filter((r) => moved.includes(r) || HEADLINES.some((h) => h.test(r.key)));
  console.log(`\nAgainst baseline ${baseline}: ${moved.length} of ${rows.length} metrics moved beyond the noise${moved.length ? '' : ' (none)'}; ${rows.filter((r) => r.flag === 'new').length} new, ${rows.filter((r) => r.flag === 'gone').length} gone.`);
  if (load) console.log(load);
  console.log(compareTable(shown));
}

async function main(argv) {
  const opts = parseArgs(argv);
  const baselines = path.join(PERF_DIR, 'baselines');
  if (opts.command === 'compare') {
    const base = loadResult(opts.positional[0], baselines);
    const cur = loadResult(opts.positional[1] ?? 'latest', baselines);
    const rows = compareMetrics(base.metrics, cur.metrics);
    printComparison(rows, opts.positional[0], loadLine(base.load, cur.load));
    return 0;
  }
  fs.mkdirSync(baselines, { recursive: true });
  markUsed(PERF_DIR);
  if (fs.existsSync(TARGET)) markUsed(TARGET);
  const base = opts.compare ? loadResult(opts.compare, baselines) : null;
  const parts = opts.command === 'all' ? PARTS : [opts.command];
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = opts.out ?? `${opts.command}-${stamp}`;
  const source = prepareSource(opts.data);
  const result = { version: 1, name, at: new Date().toISOString(), git: { head: git('rev-parse', '--short', 'HEAD'), dirty: Boolean(git('status', '--porcelain')) }, runs: opts.runs, parts, metrics: {}, details: {} };
  result.load = {};
  for (const part of parts) {
    // The machine is shared: a busy one moves every number, so the load is noted beside them.
    const quiet = os.cpus();
    await sleep(2000);
    const idle = busyPercent(quiet, os.cpus());
    if (idle > 20) log(`warning: the processors are ${idle} % busy before ${part}; its numbers will be slower than on a quiet machine`);
    const started = Date.now();
    const cpus = os.cpus();
    const r = part === 'backend' ? await measureBackend(opts, source) : part === 'startup' ? await measureStartup(opts, source, name) : await measureApp(opts, source);
    Object.assign(result.metrics, r.metrics);
    result.details[part] = part === 'backend' ? { text: r.text } : part === 'startup' ? { file: r.file } : { probes: r.probes };
    result.load[part] = { before: idle, during: busyPercent(cpus, os.cpus()) };
    log(`${part}: ${Object.keys(r.metrics).length} metrics in ${Math.round((Date.now() - started) / 1000)} s; processors ${idle} % busy before, ${result.load[part].during} % during (with the measurement itself)`);
  }
  const comparison = base ? { baseline: opts.compare, rows: compareMetrics(base.metrics, result.metrics), load: loadLine(base.load, result.load) } : null;
  const file = path.join(PERF_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 1));
  fs.writeFileSync(path.join(PERF_DIR, 'latest.json'), JSON.stringify(result, null, 1));
  fs.writeFileSync(path.join(PERF_DIR, `${name}.md`), report(result, comparison));
  if (parts.includes('app')) console.log(`\n${ipcTable(ipcRows(result.metrics))}`);
  if (comparison) printComparison(comparison.rows, opts.compare, comparison.load);
  if (opts.save) {
    fs.writeFileSync(path.join(baselines, `${opts.save}.json`), JSON.stringify(result, null, 1));
    log(`saved as baseline ${opts.save}`);
  }
  log(`written ${file} and ${name}.md`);
  return 0;
}

// ---- the probe: runs inside verify-real-app while the isolated app is up ----

/** Before the page's scripts on a reload: the splash's engine grace and minimum time cut to 0 (as perf-startup does). */
function cutSplashTimers({ grace, floor }) {
  const realTimeout = window.setTimeout.bind(window);
  window.setTimeout = (fn, delay, ...rest) => realTimeout(fn, delay === grace || delay === floor ? 0 : delay, ...rest);
}

/** Waits for one start of the page and reads it: marks, calls, navigation and paint; opens the splash when it asks. */
async function readStart(page) {
  await page.waitForFunction(() => window.__noviraPerf?.snapshot().marks['stores-filled'] !== undefined, null, { timeout: 90_000, polling: 50 });
  let clickAt = null;
  const until = Date.now() + 45_000;
  while (Date.now() < until) {
    const state = await page.evaluate(() => {
      if (window.__noviraPerf.snapshot().marks['shell-visible'] !== undefined) return 'shown';
      const open = document.querySelector('[data-testid="splash-open"]');
      if (!open) return null;
      const at = performance.now();
      open.click();
      return at;
    });
    if (state === 'shown') break;
    if (typeof state === 'number') {
      clickAt = state;
      break;
    }
    await sleep(50);
  }
  await page.waitForFunction(() => window.__noviraPerf.snapshot().marks['shell-visible'] !== undefined, null, { timeout: 30_000, polling: 50 });
  // An empty gallery has no thumbnail.
  await page.waitForFunction(() => window.__noviraPerf.snapshot().marks['first-thumbnail'] !== undefined, null, { timeout: 15_000, polling: 50 }).catch(() => undefined);
  // The calls that follow the start (fonts, comics, the engine's state) settle.
  await sleep(2000);
  const read = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      timeOrigin: performance.timeOrigin,
      ...window.__noviraPerf.snapshot(),
      nav: nav ? { responseEnd: nav.responseEnd, dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd } : null,
      paint: Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, p.startTime])),
    };
  });
  return { ...read, clickAt };
}

function processList() {
  return listProcesses() ?? [];
}

async function probe(out) {
  const result = { startedAt: Number(process.env.NOVIRA_VERIFY_STARTED_AT) || null, pid: Number(process.env.NOVIRA_VERIFY_APP_PID) || null, processes: [] };
  const require = createRequire(path.join(REPO, 'frontend', 'package.json'));
  const { chromium } = require('@playwright/test');
  let browser = null;
  try {
    browser = await chromium.connectOverCDP(CDP_URL);
    let page = null;
    const until = Date.now() + 60_000;
    while (!page && Date.now() < until) {
      page = browser.contexts().flatMap((c) => c.pages()).find((p) => !/^(about|devtools):/.test(p.url())) ?? null;
      if (!page) await sleep(200);
    }
    if (!page) throw new Error('no page in the app window');
    result.cold = await readStart(page);
    const seen = new Map();
    const look = () => result.pid && descendants(processList(), result.pid).forEach((p) => seen.set(p.pid, p));
    look();
    await page.addInitScript(cutSplashTimers, { grace: ENGINE_GRACE_MS, floor: SPLASH_FLOOR_MS });
    await page.reload();
    result.warm = await readStart(page);
    if (process.env.NOVIRA_PERF_PROBE_RECORD === '1') {
      await page.evaluate((flag) => sessionStorage.setItem(flag, '1'), RECORD_FLAG);
      await page.reload();
      result.recorded = await readStart(page);
      await page.evaluate((flag) => sessionStorage.removeItem(flag), RECORD_FLAG);
    }
    look();
    result.processes = [...seen.values()];
  } catch (e) {
    result.error = String(e.message ?? e).split('\n')[0];
  } finally {
    // Only the connection: verify-real-app closes the window.
    await browser?.close().catch(() => undefined);
  }
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
  return result.error ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const job = process.env.NOVIRA_PERF_PROBE ? probe(process.env.NOVIRA_PERF_PROBE) : main(process.argv.slice(2));
  job.then(
    (code) => (process.exitCode = code),
    (err) => {
      console.error(`[perf] ${err.message}`);
      process.exitCode = 1;
    },
  );
}
