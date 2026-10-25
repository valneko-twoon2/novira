// Runs one check against the real novira app in isolation (docs/verification.md, "Real app, isolated"), then cleans up:
// the verification window is closed (forced after 15 s, and only its own process tree), the verification ComfyUI is
// stopped, and the verification exe is deleted unless --keep is given. It never touches the user's own novira: it stops
// only the process it started, and python processes whose command line names the verification ComfyUI copy (novira-data/work/comfy-copy).
// Usage, from the repository root:
//   node tools/verify-real-app.mjs <test.mjs> [--build] [--keep] [--release] [--no-engine]
//     --build      rebuild the verification exe first (it is also built whenever it is missing)
//     --keep       leave the verification exe in place after the run
//     --release    build and run the release exe (target/release) instead of the debug one
//     --no-engine  point the data folder at a closed loopback port with no ComfyUI folder and the Civitai lookup off, so
//                  nothing starts an engine or reaches out; the GPU check is skipped (tools/perf.mjs app)
// Environment: NOVIRA_GPU_LOCK (GPU lock directory, passed to the app), NOVIRA_VERIFY_TARGET (Cargo target folder of the
// verification build, outside the repository; default <temp>/novira-verify), NOVIRA_VERIFY_DATA (isolated data folder under
// novira-data/work/; default novira-data/work/verify-data). The test script drives the window itself, at http://127.0.0.1:9333 (connectOverCDP).
// It gets NOVIRA_VERIFY_APP_PID and NOVIRA_VERIFY_STARTED_AT (epoch ms of the app's spawn).
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gpuFreeOrExplain } from './gpu-check.mjs';
import { buildHarnessDist, harnessRoots } from './harness-paths.mjs';
import { cargoCommand, isInside, listProcesses, processAlive as alive, pythonsWith, sameFile, stopTrees, verifyTarget } from './harness-process.mjs';
import { checkRefs } from './ui-refs.mjs';
import { markUsed, prune } from './prune-stale.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// From a worktree too, the harness folder and the shared models are the main checkout's (tools/harness-paths.mjs).
const ROOTS = harnessRoots(REPO);
const CDP_PORT = 9333;
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;
// The user's own executables (their running novira, and the debug build), of this checkout and the main one. This harness
// never deletes or stops them.
const USER_EXES = [...new Set([REPO, ROOTS.main])].flatMap((r) => [path.join(r, 'backend', 'target', 'debug', 'novira.exe'), path.join(r, 'target', 'debug', 'novira.exe')]);

// Set by the Ctrl+C handler that main() installs (not at import: the model sweep and models-live import this module, and
// their first Ctrl+C must stop them, not be swallowed here).
let interrupted = false;
const onInterrupt = () => {
  if (interrupted) process.exit(130);
  interrupted = true;
  console.log('[verify-real-app] interrupted: cleaning up (press Ctrl+C again to exit at once)');
};

/**
 * Whether something already answers on the debugging port: another verification run, whose window this run would drive
 * and whose ComfyUI its clean-up would stop. Checked before anything is started or changed.
 */
async function portTaken(url = CDP_URL) {
  try {
    return (await fetch(`${url}/json/version`, { signal: AbortSignal.timeout(1500) })).ok;
  } catch {
    return false;
  }
}
const PORT_TAKEN = `another app answers on the debugging port ${CDP_PORT} (a verification run already going?); wait for it to finish, or close it`;

const log = (msg) => console.log(`[verify-real-app] ${msg}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const FLAGS = ['--build', '--keep', '--release', '--no-engine'];

export function parseArgs(argv) {
  const flags = argv.filter((a) => a.startsWith('--'));
  const positional = argv.filter((a) => !a.startsWith('--'));
  const unknown = flags.filter((f) => !FLAGS.includes(f));
  if (unknown.length > 0 || positional.length !== 1) throw new Error(`usage: node tools/verify-real-app.mjs <test.mjs> ${FLAGS.map((f) => `[${f}]`).join(' ')}`);
  const has = (f) => flags.includes(f);
  return { test: path.resolve(positional[0]), build: has('--build'), keep: has('--keep'), release: has('--release'), noEngine: has('--no-engine') };
}

// Everything the harness generates lives under the main checkout's novira-data/work/ (tools/prune-stale.mjs deletes what
// goes stale there).
const WORK = ROOTS.work;
// The user's models, shared with the isolated app through `modelRoots` (nothing is copied or linked).
const SHARED_MODELS = ROOTS.models;

export function layout({ release = false } = {}) {
  const target = verifyTarget();
  const profile = release ? 'release' : 'debug';
  return {
    target,
    profile,
    exe: path.join(target, profile, 'novira.exe'),
    data: path.resolve(process.env.NOVIRA_VERIFY_DATA || path.join(WORK, 'verify-data')),
    webview: path.join(WORK, 'verify-webview'),
    comfyCopy: path.join(WORK, 'comfy-copy'),
  };
}

// Refuses before anything is started or deleted: every path the harness can touch must be a verification one. The data
// and WebView2 folders must be strictly inside novira-data/work/: never novira-data/ itself (the user's running app),
// never work/ itself, never anything outside. `roots` is tools/harness-paths.mjs's (this checkout, the main one, its work/),
// or one checkout's folder.
export function guard(L, roots = ROOTS) {
  if (typeof roots === 'string') roots = { repo: roots, main: roots, work: path.join(roots, 'novira-data', 'work') };
  const { work } = roots;
  for (const repo of [roots.repo, roots.main]) {
    if (isInside(L.target, repo) || sameFile(L.target, repo)) throw new Error(`refusing: verification target ${L.target} is inside the repository`);
  }
  for (const user of USER_EXES) if (sameFile(L.exe, user)) throw new Error(`refusing: ${L.exe} is the user's own novira`);
  if (!isInside(L.data, work)) throw new Error(`refusing: data folder ${L.data} is not inside novira-data/work/`);
  if (!isInside(L.webview, work)) throw new Error(`refusing: WebView2 profile ${L.webview} is not inside novira-data/work/`);
}

// Makes the isolated settings.json list the user's model folder as an extra model folder (merged, never duplicated), so
// the isolated app sees the same models without a copy or a junction. Tests must not delete or install files there.
// Returns false when that folder does not exist.
export function shareModels(L, models = SHARED_MODELS) {
  if (!fs.existsSync(models)) return false;
  fs.mkdirSync(L.data, { recursive: true });
  const file = path.join(L.data, 'settings.json');
  const settings = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const roots = Array.isArray(settings.modelRoots) ? settings.modelRoots : [];
  if (roots.some((r) => typeof r === 'string' && sameFile(r, models))) return true;
  fs.writeFileSync(file, JSON.stringify({ ...settings, modelRoots: [...roots, models] }, null, 2) + '\n');
  return true;
}

/** The settings of a data folder that starts no engine: ComfyUI at `url` (a closed port), no ComfyUI folder or Python,
 * the Civitai lookup off. Everything else is kept. */
export function engineOff(settings, url) {
  const { comfyuiDir: _dir, comfyuiPython: _python, ...rest } = settings;
  return { ...rest, comfyuiUrl: url, civitaiLookup: false };
}

/** A loopback port nothing listens on: one the system just handed out and took back. */
function closedPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// Writes the no-engine settings and returns the address and a function that puts the file back as it was, so a later run
// (the model sweep, a test with the engine) does not find a closed ComfyUI address in the shared data folder.
export async function turnEngineOff(L) {
  fs.mkdirSync(L.data, { recursive: true });
  const file = path.join(L.data, 'settings.json');
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const url = `http://127.0.0.1:${await closedPort()}`;
  fs.writeFileSync(file, JSON.stringify(engineOff(before === null ? {} : JSON.parse(before), url), null, 2) + '\n');
  const restore = () => (before === null ? fs.rmSync(file, { force: true }) : fs.writeFileSync(file, before));
  return { url, restore };
}

// Notes that the standing environment is in use now, so tools/prune-stale.mjs measures its age from this run.
function touchEnvironment(L) {
  fs.mkdirSync(L.data, { recursive: true });
  fs.mkdirSync(L.webview, { recursive: true });
  for (const dir of [L.data, L.webview, L.comfyCopy]) if (fs.existsSync(dir)) markUsed(dir);
}

function check(name, result) {
  if (result.status !== 0) throw new Error(`${name} failed (exit ${result.status ?? result.signal})`);
}

function build(L) {
  log('building the frontend (the harness build, reused when current)');
  const dist = buildHarnessDist(REPO);
  // The app embeds the harness build through TAURI_CONFIG, never frontend/dist: a harness build there would end up in the
  // user's own app (build.rs keeps a dist that looks current), and build.rs is told not to build that folder either.
  // Relative to tauri.conf.json: an absolute Windows path (`E:\...`) reads as a URL of the scheme `e:`, and the window then
  // shows a file listing.
  const frontendDist = path.relative(path.join(REPO, 'backend', 'src-tauri'), dist).replaceAll('\\', '/');
  const env = { ...process.env, CARGO_TARGET_DIR: L.target, TAURI_CONFIG: JSON.stringify({ build: { frontendDist } }), NOVIRA_SKIP_FRONTEND_BUILD: '1' };
  const cargo = cargoCommand();
  const args = ['build', '-p', 'novira', ...(L.profile === 'release' ? ['--release'] : [])];
  log(`building the app into ${L.target} with the frontend of ${dist} (cargo ${args.join(' ')})`);
  check('app build', spawnSync(cargo, args, { cwd: path.join(REPO, 'backend'), env, stdio: 'inherit' }));
}

function startApp(L) {
  const env = {
    ...process.env,
    NOVIRA_DATA_DIR: L.data,
    WEBVIEW2_USER_DATA_FOLDER: L.webview,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${CDP_PORT}`,
  };
  if (!process.env.NOVIRA_GPU_LOCK) log('NOVIRA_GPU_LOCK is not set: this run takes no GPU lock');
  const app = spawn(L.exe, [], { env, stdio: 'ignore' });
  app.startedAt = Date.now();
  app.on('error', (e) => log(`could not start the app: ${e.message}`));
  return app;
}

async function waitForWindow(app) {
  const until = Date.now() + 120_000;
  while (Date.now() < until) {
    if (interrupted) throw new Error('interrupted before the window opened');
    if (app.exitCode !== null) throw new Error(`the app exited early (exit ${app.exitCode})`);
    try {
      if ((await fetch(`${CDP_URL}/json/version`)).ok) return;
    } catch {
      // not listening yet
    }
    await sleep(1000);
  }
  throw new Error(`no debugging port on ${CDP_PORT} after 120 s`);
}

function taskkill(args) {
  try {
    execFileSync('taskkill', args, { stdio: 'ignore' });
  } catch {
    // Already gone, or refused: the caller checks whether the process is still alive.
  }
}

async function waitGone(pid, ms) {
  const until = Date.now() + ms;
  while (alive(pid) && Date.now() < until) await sleep(500);
  return !alive(pid);
}

async function stopApp(app) {
  if (!alive(app.pid)) return 'not running';
  taskkill(['/PID', String(app.pid)]); // asks the window to close, as the user would
  if (await waitGone(app.pid, 15_000)) return 'closed';
  taskkill(['/PID', String(app.pid), '/T', '/F']); // forced, with its own child processes only
  return (await waitGone(app.pid, 5_000)) ? 'forced' : 'STILL RUNNING';
}

// Stops python processes started from the verification ComfyUI copy. The user's ComfyUI runs from novira-data, so it never matches.
function stopComfy(L) {
  const list = listProcesses();
  if (list === null) throw new Error('the running processes could not be listed');
  return stopTrees(pythonsWith(list, path.basename(L.comfyCopy)).map((p) => p.pid));
}

// Deletes the verification exe: <profile>/novira.exe, and the copies cargo keeps in <profile>/deps (novira.exe or novira-<hash>.exe).
// Test binaries such as novira_core-<hash>.exe are not the app and stay.
function removeExe(L) {
  const debug = path.join(L.target, L.profile);
  const files = [path.join(debug, 'novira.exe')];
  const deps = path.join(debug, 'deps');
  if (fs.existsSync(deps)) {
    for (const name of fs.readdirSync(deps)) if (/^novira(-[0-9a-f]+)?\.exe$/i.test(name)) files.push(path.join(deps, name));
  }
  const removed = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    if (!isInside(file, L.target) || USER_EXES.some((user) => sameFile(file, user))) throw new Error(`refusing to delete ${file}`);
    fs.rmSync(file, { force: true, maxRetries: 5, retryDelay: 500 });
    removed.push(file);
  }
  return removed;
}

// Deletes stale output under novira-data/work/ before the run (tools/prune-stale.mjs); never fails the run.
function pruneStale() {
  try {
    prune({ repo: ROOTS.main, log });
  } catch (e) {
    log(`pruning stale output failed: ${e.message}`);
  }
}

async function main() {
  process.on('SIGINT', onInterrupt);
  const opts = parseArgs(process.argv.slice(2));
  const L = layout(opts);
  guard(L);
  if (await portTaken()) {
    console.error(`[verify-real-app] ${PORT_TAKEN}`);
    return 1;
  }
  pruneStale();
  if (!fs.existsSync(opts.test)) throw new Error(`test script not found: ${opts.test}`);
  // Before a build of minutes: a test id or text key the screens no longer have would only fail at its step.
  const stale = checkRefs(REPO, [opts.test]);
  if (stale.length) {
    for (const line of stale) console.error(`[verify] ${line}`);
    console.error('[verify] change the test script to what the screens have now (search frontend/src for the new id or key), then run again');
    return 1;
  }
  if (opts.build || !fs.existsSync(L.exe)) build(L);
  if (!fs.existsSync(L.exe)) throw new Error(`the build produced no exe at ${L.exe}`);
  touchEnvironment(L);
  log(shareModels(L) ? `models of novira-data/models are shared through modelRoots in ${path.join(L.data, 'settings.json')}` : `${SHARED_MODELS} does not exist: no shared model folder`);
  let restoreSettings = null;
  if (opts.noEngine) {
    const off = await turnEngineOff(L);
    restoreSettings = off.restore;
    log(`no engine: ComfyUI at ${off.url} (closed), no ComfyUI folder, no GPU check`);
  }
  // After the build (minutes long), right before the app may start generating. Stopping here still deletes the exe, as
  // every other end does (not when the port is taken below: that run uses the same exe).
  else if (!gpuFreeOrExplain(log)) {
    if (!opts.keep) {
      try {
        log(`deleted: ${removeExe(L).join(', ') || 'nothing'}`);
      } catch (e) {
        log(`problem: deleting the verification exe: ${e.message}`);
      }
    }
    return 1;
  }

  // Again after the build (minutes): a run that started meanwhile owns the port, and this run's clean-up must not touch it.
  if (await portTaken()) {
    console.error(`[verify-real-app] ${PORT_TAKEN}`);
    restoreSettings?.();
    return 1;
  }
  let app = null;
  let status = 1;
  const problems = [];
  try {
    app = startApp(L);
    if (app.pid === undefined) throw new Error(`could not start ${L.exe}`);
    log(`started the verification app (pid ${app.pid}) on data ${L.data}`);
    await waitForWindow(app);
    log('window is up: running the test');
    const env = { ...process.env, NOVIRA_VERIFY_APP_PID: String(app.pid), NOVIRA_VERIFY_STARTED_AT: String(app.startedAt) };
    const run = spawnSync(process.execPath, [opts.test], { stdio: 'inherit', cwd: REPO, env });
    status = run.status ?? 1;
    log(`test finished with exit ${status}`);
  } catch (e) {
    problems.push(e.message);
  } finally {
    if (app && app.pid !== undefined) log(`app: ${await stopApp(app)}`);
    if (restoreSettings) {
      try {
        restoreSettings();
        log('settings.json put back as it was before --no-engine');
      } catch (e) {
        problems.push(`putting settings.json back: ${e.message}`);
      }
    }
    try {
      const stopped = stopComfy(L);
      log(`verification ComfyUI processes stopped: ${stopped.length ? stopped.join(', ') : 'none'}`);
    } catch (e) {
      problems.push(`stopping the verification ComfyUI: ${e.message.split('\n')[0]}`);
    }
    if (opts.keep) {
      log(`kept ${L.exe} (--keep)`);
    } else {
      try {
        log(`deleted: ${removeExe(L).join(', ') || 'nothing'}`);
      } catch (e) {
        problems.push(`deleting the verification exe: ${e.message}`);
      }
    }
  }
  for (const p of problems) log(`problem: ${p}`);
  return problems.length > 0 ? 1 : status;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      console.error(`[verify-real-app] ${e.message}`);
      process.exitCode = 1;
    },
  );
}
