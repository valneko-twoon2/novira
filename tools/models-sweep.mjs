// The model sweep: checks every installed model in the isolated real app, so a model that is listed wrongly, shows no picture,
// is missing from its screen's picker, or is not what a job really loads is found before the user finds it.
//
// Usage (from the repository root, also from a worktree):
//   node tools/models-sweep.mjs [--category <folder|type|rail|base>] [--model <part of the name>] [--no-gpu] [--build]
//                               [--lookup] [--lookup-wait <seconds>] [--via app|server]
// --via server (default app) runs the same checks through novira-server and Playwright's Chromium instead of the desktop window
// (tools/server-run.mjs; docs/design/browser-server.md): what a browser cannot see (native dialogs, the novira-image:// scheme,
// WebView2 rendering) is not checked, see docs/verification.md.
// It runs the isolated app (tools/verify-real-app.mjs) with the Civitai lookup off, and drives it with tools/models-sweep-app.mjs.
// With --lookup it runs a second round with the lookup ON. That round SENDS THE HASH OF EVERY MODEL FILE to Civitai (the shared
// model folder included), so it never runs by itself, also not with --model or --category: only on request. Without it the check
// "b cover (lookup on)" is "not run (use --lookup)", never "pass". Every model gets (a) listed on the Models screen with its rail
// entry and base, (b) its cover (lookup off; lookup on with --lookup), (c) offered by the screen that draws with it. With the GPU
// free and NOVIRA_GPU_LOCK set, one model per kind and base also gets (d) one short job from its screen and (e) the graph ComfyUI received checked for that file, and the picture for
// blankness; otherwise d and e are "not run" with the reason, never "pass". Model files on disk that the app does not list are
// rows of their own, and folders of the shared model root that novira reads as neither a category nor a pack are named. Each model pack (video, music, voice...; found in every model root) is a row too, with checks a and b only.
// Output: novira-data/work/models-sweep/<time>/ of the main checkout: sweep.md (the table), sweep.json (the record the Stop hook
// reads: the commit swept and the uncommitted model files), and the screenshots, graphs and pictures of each run.
// Environment: NOVIRA_GPU_LOCK (needed for d and e), NOVIRA_VERIFY_DATA, NOVIRA_VERIFY_TARGET (as verify-real-app.mjs).
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkGpu } from './gpu-check.mjs';
import { harnessRoots } from './harness-paths.mjs';
import { comfyNameOf, isSweepTrigger, markdownTable, overall, packRows, porcelainPaths, readCode, summaryLines, unscannedFolders, walkModels } from './models-sweep-lib.mjs';
import { acquire } from './e2e-lock.mjs';
import { ensureBuilt, startServer } from './server-run.mjs';
import { layout, shareModels } from './verify-real-app.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = harnessRoots(REPO);
const log = (m) => console.log(`[models-sweep] ${m}`);

export function parseArgs(argv) {
  const opts = { category: null, model: null, gpu: true, build: false, lookup: false, lookupWait: 900, via: 'app' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--category') opts.category = argv[++i];
    else if (a === '--model') opts.model = argv[++i];
    else if (a === '--no-gpu') opts.gpu = false;
    else if (a === '--build') opts.build = true;
    else if (a === '--lookup') opts.lookup = true;
    else if (a === '--lookup-wait') opts.lookupWait = Number(argv[++i]);
    else if (a === '--via') opts.via = argv[++i];
    else throw new Error(`unknown argument ${a}; usage: node tools/models-sweep.mjs [--category <name>] [--model <part>] [--no-gpu] [--build] [--lookup] [--lookup-wait <s>] [--via app|server]`);
  }
  if (opts.via !== 'app' && opts.via !== 'server') throw new Error('--via takes app or server');
  if ((opts.category === undefined) || (opts.model === undefined) || !Number.isFinite(opts.lookupWait)) throw new Error('a flag is missing its value');
  return opts;
}

const git = (...args) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8' }).trim();

/** The commit swept, and the model files that differ from it in the work tree (path → blob id of the working file, null when deleted). */
function sweptState() {
  const dirty = {};
  const status = execFileSync('git', ['-C', REPO, 'status', '--porcelain', '-z', '--untracked-files=all'], { encoding: 'utf8' });
  for (const p of porcelainPaths(status)) {
    if (!isSweepTrigger(p)) continue;
    dirty[p] = fs.existsSync(path.join(REPO, p)) ? git('hash-object', '--', p) : null;
  }
  return { head: git('rev-parse', 'HEAD'), branch: git('rev-parse', '--abbrev-ref', 'HEAD'), worktree: REPO, dirty };
}

/** Writes keys into the isolated data's settings.json, keeping the others. */
function patchSettings(data, patch) {
  const file = path.join(data, 'settings.json');
  const settings = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  fs.writeFileSync(file, JSON.stringify({ ...settings, ...patch }, null, 2) + '\n');
}

/** Runs `node <args>` and resolves with its exit status (an async spawn: the server this run started must keep being served). */
const runNode = (args, env) => new Promise((resolve) => spawn(process.execPath, args, { cwd: REPO, env, stdio: 'inherit' }).on('exit', (code) => resolve(code ?? 1)).on('error', () => resolve(1)));

async function runPhase(phase, { out, data, roots, opts, gpu, build, keep }) {
  patchSettings(data, { civitaiLookup: phase === 'on' });
  // The lookup sends every model's hash to Civitai: it must not stay on for the next run, whatever ends this one (a throw,
  // or Ctrl+C, which the e2e lock turns into process.exit and so skips a finally).
  const off = () => patchSettings(data, { civitaiLookup: false });
  if (phase === 'on') process.on('exit', off);
  try {
    return await runPhaseWith(phase, { out, data, roots, opts, gpu, build, keep });
  } finally {
    if (phase === 'on') {
      off();
      process.off('exit', off);
    }
  }
}

async function runPhaseWith(phase, { out, data, roots, opts, gpu, build, keep }) {
  const env = {
    ...process.env,
    NOVIRA_SWEEP_OUT: out,
    NOVIRA_SWEEP_PHASE: phase,
    NOVIRA_SWEEP_DATA: data,
    NOVIRA_SWEEP_ROOTS: JSON.stringify(roots),
    NOVIRA_SWEEP_CATEGORY: opts.category ?? '',
    NOVIRA_SWEEP_MODEL: opts.model ?? '',
    NOVIRA_SWEEP_GPU: gpu ? '1' : '0',
    NOVIRA_SWEEP_LOOKUP_WAIT: String(opts.lookupWait),
  };
  // A run that queues no job does not need the GPU free; the harness's own check would stop the offline checks too.
  if (!gpu) env.NOVIRA_GPU_CHECK = '0';
  log(`run "${phase}" via ${opts.via} (Civitai lookup ${phase}${phase === 'on' ? ': file hashes are sent to Civitai' : ''}${gpu ? ', with the GPU part' : ''})`);
  let status;
  if (opts.via === 'server') {
    // One heavy browser run at a time (e2e lock); the server opens the data folder itself, so the app must not be running on it.
    ensureBuilt({ build });
    const release = await acquire({ what: `models-sweep via server (${phase})` });
    const server = await startServer({ data });
    try {
      status = await runNode([path.join(REPO, 'tools', 'models-sweep-app.mjs')], { ...env, NOVIRA_SWEEP_VIA: 'server', NOVIRA_SWEEP_URL: server.url });
    } finally {
      await server.stop();
      release();
    }
  } else {
    const args = [path.join(REPO, 'tools', 'verify-real-app.mjs'), path.join(REPO, 'tools', 'models-sweep-app.mjs')];
    if (build) args.push('--build');
    if (keep) args.push('--keep');
    status = spawnSync(process.execPath, args, { cwd: REPO, env, stdio: 'inherit' }).status ?? 1;
  }
  const file = path.join(out, `${phase}.json`);
  return { status, data: fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null };
}

/** Joins the two runs into one row per model, and adds the files on disk that the app does not list. */
export function mergeRuns({ off, on, lookup = true, gpuWhy, files, code, roots, has = fs.existsSync, filter = {} }) {
  const notRun = (why) => ({ status: 'not run', why });
  const models = new Map();
  for (const run of lookup ? [off, on] : [off]) for (const m of run.data?.models ?? []) models.set(m.key, m);
  const rows = [...models.values()].sort((a, b) => a.type.localeCompare(b.type) || a.base.localeCompare(b.base) || a.name.localeCompare(b.name)).map((m) => {
    const a = off.data?.results?.[m.key];
    const b = on.data?.results?.[m.key];
    const coverOn = (model, result) => {
      if (!code.pictureTypes.has(model.type)) return { status: 'n/a', why: 'this kind shows an icon' };
      if (!lookup) return notRun('not run (use --lookup)');
      return result?.cover ?? missing(on, 'on');
    };
    const missing = (run, phase) => notRun(run.data ? 'not in this run' : `the "${phase}" run failed (exit ${run.status})`);
    const gpu = (k) => a?.[k] ?? notRun(gpuWhy ?? 'not one of the models the GPU part runs (one per kind and base)');
    return {
      key: m.key,
      name: m.name,
      type: m.type,
      base: m.base,
      path: m.path,
      checks: {
        listed: a?.listed ?? b?.listed ?? missing(off, 'off'),
        coverOff: a?.cover ?? missing(off, 'off'),
        coverOn: coverOn(m, b),
        picker: a?.picker ?? b?.picker ?? missing(off, 'off'),
        generate: gpu('generate'),
        graph: gpu('graph'),
        picture: gpu('picture'),
      },
    };
  });
  const listed = new Set(rows.map((r) => r.path.replaceAll('\\', '/').toLowerCase()));
  // The files on disk are checked against the whole list: a narrowed run lists only its own models, so every other file would fail.
  const narrowed = Boolean(filter.category || filter.model);
  if (!narrowed && (off.data || (lookup && on.data))) {
    for (const file of files) {
      if (listed.has(file.replaceAll('\\', '/').toLowerCase())) continue;
      const where = comfyNameOf(file, roots, code.categories);
      rows.push({
        key: null,
        name: path.basename(file),
        type: where?.kind ?? '?',
        base: '?',
        path: file,
        checks: { listed: { status: 'fail', why: `on disk in ${where?.alias ?? '?'}/ but not in the app's model list` } },
      });
    }
  }
  // The model packs (video, music, voice...) are not in the model list: one row each, found in every model root.
  if (off.data) {
    const wanted = (p) => {
      const name = `${p.kind} pack`;
      if (filter.model && !name.includes(filter.model.toLowerCase())) return false;
      const c = filter.category?.toLowerCase();
      return !c || ['pack', 'packs', p.kind, p.dir].includes(c);
    };
    rows.push(...packRows({ packs: code.packs.filter(wanted), status: off.data.packs, roots, has }));
  }
  return rows;
}

async function main(argv) {
  const opts = parseArgs(argv);
  const L = layout();
  const data = L.data;
  const rel = path.relative(ROOTS.work, data);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`refusing: the data folder ${data} is not inside ${ROOTS.work}`);
  fs.mkdirSync(data, { recursive: true });
  const copy = path.join(ROOTS.work, 'comfy-copy', 'portable', 'ComfyUI');
  if (!fs.existsSync(path.join(data, 'settings.json'))) {
    if (!fs.existsSync(path.join(copy, 'main.py'))) throw new Error(`no settings.json in ${data} and no ComfyUI copy at ${copy}: copy one there first (docs/verification.md)`);
    patchSettings(data, { comfyuiDir: copy });
  }
  if (!shareModels({ data }, ROOTS.models)) log(`${ROOTS.models} does not exist: only the data folder's own models are swept`);
  const code = readCode(REPO);
  const roots = [path.join(data, 'models'), ...(fs.existsSync(ROOTS.models) ? [ROOTS.models] : [])];
  const files = roots.flatMap((r) => walkModels(r, code));
  // Pack folders (video/, music/...) are rows of their own, not "unscanned".
  const packDirs = new Set(code.packs.map((p) => p.dir));
  const unscanned = fs.existsSync(ROOTS.models) ? unscannedFolders(fs.readdirSync(ROOTS.models, { withFileTypes: true }).filter((d) => d.isDirectory() && !packDirs.has(d.name.toLowerCase())).map((d) => d.name), code.categories) : [];

  let gpuWhy = null;
  if (!opts.gpu) gpuWhy = 'not run: --no-gpu';
  else if (!process.env.NOVIRA_GPU_LOCK) gpuWhy = 'not run: NOVIRA_GPU_LOCK is not set';
  else {
    const g = checkGpu();
    log(`gpu-check: ${g.why}; ${g.lock}`);
    if (g.busy) gpuWhy = `not run (GPU busy): ${g.why}`;
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const out = path.join(ROOTS.work, 'models-sweep', stamp);
  fs.mkdirSync(out, { recursive: true });
  const record = { version: 1, ...sweptState(), startedAt: new Date().toISOString(), filter: { category: opts.category, model: opts.model }, lookup: opts.lookup, via: opts.via, gpu: gpuWhy ?? 'ran', complete: false };
  fs.writeFileSync(path.join(out, 'sweep.json'), JSON.stringify(record, null, 2));
  log(`sweeping ${record.branch} at ${record.head.slice(0, 8)} into ${out}`);

  const common = { out, data, roots, opts };
  // The GPU part runs in the lookup-off round: a job does not depend on the lookup, and the round that sends hashes is optional.
  const off = await runPhase('off', { ...common, gpu: !gpuWhy, build: opts.build, keep: opts.lookup });
  const on = opts.lookup ? await runPhase('on', { ...common, gpu: false, build: false, keep: false }) : { status: 0, data: null, skipped: true };
  patchSettings(data, { civitaiLookup: false });

  const results = mergeRuns({ off, on, lookup: opts.lookup, gpuWhy, files, code, roots, filter: { category: opts.category, model: opts.model } });
  const md = [
    `# Model sweep ${stamp}`,
    '',
    `Commit ${record.head} on ${record.branch} (${REPO})${Object.keys(record.dirty).length ? `, with uncommitted model files: ${Object.keys(record.dirty).join(', ')}` : ''}.`,
    `Runs via ${opts.via}: lookup off exit ${off.status}, lookup on ${opts.lookup ? `exit ${on.status}` : 'not run (use --lookup; it sends file hashes to Civitai)'}. GPU part: ${gpuWhy ?? 'ran (one model per kind and base)'}.`,
    unscanned.length ? `Folders of the shared model root that novira reads as neither a category nor a pack: ${unscanned.join(', ')}.` : '',
    `Screenshots, graphs and pictures: ${out}`,
    '',
    markdownTable(results),
  ].join('\n');
  fs.writeFileSync(path.join(out, 'sweep.md'), md);
  // An OFF-only run is complete: the lookup-on round is optional and never part of the gate (.claude/rules/models.md).
  const complete = Boolean(off.data && (!opts.lookup || on.data));
  fs.writeFileSync(path.join(out, 'sweep.json'), JSON.stringify({ ...record, finishedAt: new Date().toISOString(), complete, unscanned, results }, null, 2));
  for (const line of summaryLines(results)) console.log(line);
  log(`table: ${path.join(out, 'sweep.md')}`);
  return complete && results.every((r) => overall(r.checks) !== 'fail') ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(
    (code) => (process.exitCode = code),
    (e) => {
      console.error(`[models-sweep] ${e.message}`);
      process.exitCode = 1;
    },
  );
}
