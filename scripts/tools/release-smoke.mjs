// The smoke test of a release build: what `scripts\release\package.bat build` put in artifacts\ starts and shows its main screen,
// before the zip is made (docs/development.md). It checks the files themselves, not a build of its own:
//   1. the release files are there (novira.exe, novira-server.exe, dist\index.html, server.bat);
//   2. novira-server.exe on an empty data folder serves the page, and the page reaches the Generate tab without a script error;
//   3. novira-server.exe on a copy of each old-data fixture (backend/crates/novira-core/tests/fixtures/data-<version>/)
//      answers `bootstrap` with every board, picture, workflow and model the fixture holds;
//   4. novira.exe starts on an empty data folder with no engine (a closed loopback address, as verify-real-app --no-engine)
//      and its window reaches the Generate tab.
// Nothing starts ComfyUI or uses the GPU. Every data folder and the WebView2 profile are made inside
// novira-data/work/release-smoke/ and deleted at the end; only the processes this script started are stopped. On a GitHub
// runner only, novira.exe is started with a normal user's token at Medium integrity (see startLowered).
// Usage, from the repository root:  node scripts/tools/release-smoke.mjs [--artifacts <folder>]   (default: artifacts\)
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { harnessRoots } from './harness-paths.mjs';
import { isInside, stopTrees } from './harness-process.mjs';
import { startServer } from './server-run.mjs';
import { engineOff } from './verify-real-app.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORK = harnessRoots(REPO).work;
const FIXTURES = path.join(REPO, 'backend', 'crates', 'novira-core', 'tests', 'fixtures');
const CDP_PORT = 9334; // not verify-real-app's 9333, so a verification run going on is never driven by mistake
const { chromium } = createRequire(path.join(REPO, 'frontend', 'package.json'))('@playwright/test');

const log = (m) => console.log(`[release-smoke] ${m}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The artifacts folder from `--artifacts <folder>`, else artifacts\ of the repository. */
export function parseArgs(argv) {
  const i = argv.indexOf('--artifacts');
  if (i >= 0 && !argv[i + 1]) throw new Error('--artifacts needs a folder');
  const unknown = argv.filter((a, j) => a.startsWith('--') && a !== '--artifacts' && !(i >= 0 && j === i + 1));
  if (unknown.length) throw new Error(`unknown option ${unknown[0]}`);
  return { artifacts: path.resolve(i >= 0 ? argv[i + 1] : path.join(REPO, 'artifacts')) };
}

/** The release files that must be in the artifacts folder; returns the missing ones. */
export function missingFiles(artifacts, exists = fs.existsSync) {
  return ['novira.exe', 'novira-server.exe', path.join('dist', 'index.html'), 'server.bat'].filter((f) => !exists(path.join(artifacts, f)));
}

/** The old-data fixtures, by version (`data-v0.3.0` gives `v0.3.0`). */
export function fixtureVersions(dir = FIXTURES) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => n.startsWith('data-'))
    .map((n) => n.slice('data-'.length))
    .sort();
}

/**
 * What a fixture's bootstrap must hold (the fixture is written by examples/make_old_data_fixture.rs): returns the
 * problems found, empty when it is all there.
 */
export function checkFixtureBootstrap(boot) {
  const problems = [];
  const boards = (boot.boards ?? []).map((b) => b.name).sort();
  if (boards.join(',') !== 'Portraits,Scenery') problems.push(`boards ${JSON.stringify(boards)}`);
  if ((boot.images ?? []).length !== 3) problems.push(`${(boot.images ?? []).length} pictures, not 3`);
  if (!(boot.images ?? []).some((i) => i.starred)) problems.push('no starred picture');
  if ((boot.workflows ?? []).map((w) => w.name).join(',') !== 'Old workflow') problems.push('the workflow is missing');
  if ((boot.models ?? []).length !== 2) problems.push(`${(boot.models ?? []).length} models, not 2`);
  if ((boot.queue?.items ?? []).length !== 3) problems.push(`${(boot.queue?.items ?? []).length} queue items, not 3`);
  return problems;
}

function copyDir(from, to) {
  fs.cpSync(from, to, { recursive: true });
}

/** A fresh folder inside novira-data/work/release-smoke/. */
function freshFolder(root, name) {
  const dir = path.join(root, name);
  if (!isInside(dir, WORK)) throw new Error(`refusing: ${dir} is not inside ${WORK}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** The last `lines` lines of `text`, trimmed and cut to `max` characters (the end is what says why a program stopped). */
export function tailOf(text, lines = 15, max = 2000) {
  const kept = String(text ?? '').trim().split(/\r?\n/).slice(-lines).join('\n');
  return kept.length > max ? kept.slice(kept.length - max) : kept;
}

/** The installed WebView2 runtime's version, or why it could not be read (the window needs it). */
function webview2Runtime() {
  if (process.platform !== 'win32') return 'not Windows';
  const client = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  for (const key of [`HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\${client}`, `HKLM\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\${client}`]) {
    const r = spawnSync('reg', ['query', key, '/v', 'pv'], { encoding: 'utf8', windowsHide: true });
    const found = /pv\s+REG_SZ\s+(\S+)/.exec(r.stdout ?? '');
    if (found) return found[1];
  }
  return 'not installed (no EdgeUpdate client key)';
}

/** Whether `port` lies in a range `netsh int ipv4 show excludedportrange protocol=tcp` lists (Windows keeps such ranges for itself). */
export function portIsExcluded(text, port) {
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const range = /^\s*(\d+)\s+(\d+)\s*\*?\s*$/.exec(line);
    if (range && port >= Number(range[1]) && port <= Number(range[2])) return true;
  }
  return false;
}

/** The output of a fixed program with fixed arguments, or why there is none (a diagnostic never throws). */
function run(command, args) {
  const r = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, timeout: 20_000 });
  return r.error ? `${command}: ${r.error.message}` : `${r.stdout ?? ''}${r.stderr ?? ''}`;
}

/**
 * Whether the app is started with its rights lowered: only on a GitHub runner, where the job runs as an administrator.
 * On a person's machine the app starts as it always does.
 */
export function onRunner(env = process.env) {
  return env.GITHUB_ACTIONS === 'true';
}

/**
 * The .cmd that starts `exe` with `vars`, its output into `outFile`, after writing the groups of its token into
 * `groupsFile` (they show whether the lowering took). A value a .cmd would read as syntax is refused.
 */
export function launchScript(exe, vars, outFile, groupsFile) {
  const unsafe = /["%^&|<>!\r\n]/;
  for (const value of [exe, outFile, groupsFile, ...Object.values(vars)]) if (unsafe.test(value)) throw new Error(`refusing to write ${value} into a .cmd`);
  const lines = ['@echo off', ...Object.entries(vars).map(([name, value]) => `set "${name}=${value}"`), `whoami /groups > "${groupsFile}" 2>&1`, `"${exe}" > "${outFile}" 2>&1`];
  return `${lines.join('\r\n')}\r\n`;
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

/** Starts the app as a child of this script; `exited` is null while it runs. */
function startDirect(exe, vars) {
  const app = spawn(exe, [], { env: { ...process.env, ...vars }, stdio: ['ignore', 'pipe', 'pipe'] });
  let text = '';
  for (const stream of [app.stdout, app.stderr]) stream.on('data', (chunk) => (text = (text + chunk).slice(-8000)));
  return { pid: () => app.pid, stop: () => stopTrees([app.pid]), exited: () => (app.exitCode === null ? null : `exit ${app.exitCode}`), output: () => text, groups: () => '' };
}

/**
 * Starts the app through start-medium.ps1 (the administrators' group deny-only, Medium integrity): WebView2 opened no
 * debugging port for the elevated app on the runner, from the environment or from its policy key, nor for one with the
 * group deny-only at High integrity (runas /trustlevel, 2026-11-02), while the same build took the port on a desktop.
 * A .cmd sets the variables and records the token's groups.
 */
async function startLowered(exe, vars, dir) {
  const script = path.join(dir, 'launch.cmd');
  const outFile = path.join(dir, 'output.txt');
  const groupsFile = path.join(dir, 'groups.txt');
  fs.writeFileSync(script, launchScript(exe, vars, outFile, groupsFile));
  const started = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(REPO, 'scripts', 'tools', 'start-medium.ps1')], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    env: { ...process.env, SMOKE_SCRIPT: script },
  });
  if (started.status !== 0) log(`start-medium.ps1 failed (exit ${started.status}): ${tailOf(`${started.stdout ?? ''}${started.stderr ?? ''}`, 6)}`);
  // Only the novira.exe under the cmd.exe that runs this script's own launch.cmd: another novira.exe of the same path
  // (the person's own app started from artifacts\) must never be taken for it.
  let cmd;
  let pid;
  for (const until = Date.now() + 15_000; !pid && Date.now() < until; ) {
    const r = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "$c = Get-CimInstance Win32_Process -Filter \"Name='cmd.exe'\" | Where-Object { ([string]$_.CommandLine).Contains($env:SMOKE_SCRIPT) } | Select-Object -First 1; if ($c) { $n = Get-CimInstance Win32_Process -Filter \"ParentProcessId=$($c.ProcessId) AND Name='novira.exe'\" | Select-Object -First 1; \"$($c.ProcessId) $($n.ProcessId)\" }",
      ],
      { encoding: 'utf8', windowsHide: true, env: { ...process.env, SMOKE_SCRIPT: script } },
    );
    const [c, n] = String(r.stdout ?? '').trim().split(/\s+/).map(Number);
    cmd = c || cmd;
    pid = n || undefined;
    if (!pid) await sleep(500);
  }
  const groups = () => readText(groupsFile).split(/\r?\n/).filter((l) => /Mandatory Label|BUILTIN\\Administrators/.test(l)).join('\n');
  return {
    pid: () => pid,
    stop: () => stopTrees([cmd, pid].filter(Boolean)),
    exited: () => (pid && alive(pid) ? null : pid ? 'exited' : 'never started'),
    output: () => readText(outFile).slice(-8000),
    groups,
  };
}

/** What the machine says about the debugging port and the programs that should be using it. */
function machineFacts() {
  if (process.platform !== 'win32') return [];
  const listening = run('netstat', ['-ano', '-p', 'tcp'])
    .split(/\r?\n/)
    .filter((l) => l.includes(`:${CDP_PORT} `));
  const programs = run('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    // The browser process of the WebView2 (no --type=) is the one that takes the debugging port; the helpers only repeat its flags.
    "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'novira.exe' -or ($_.Name -eq 'msedgewebview2.exe' -and $_.CommandLine -notmatch '--type=') } | Select-Object -First 4 | ForEach-Object { $c = [string]$_.CommandLine; '{0} pid={1} remote-debugging-port={2} {3}' -f $_.Name, $_.ProcessId, ($c -match 'remote-debugging-port'), $c }",
  ]);
  const interactive = run('powershell', ['-NoProfile', '-NonInteractive', '-Command', '[Environment]::UserInteractive']).trim();
  const elevated = run('powershell', ['-NoProfile', '-NonInteractive', '-Command', '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)']).trim();
  return [
    `this script is elevated: ${elevated || 'unknown'}`,
    `port ${CDP_PORT} in Windows' excluded ranges: ${portIsExcluded(run('netsh', ['int', 'ipv4', 'show', 'excludedportrange', 'protocol=tcp']), CDP_PORT) ? 'YES' : 'no'}`,
    `port ${CDP_PORT} in netstat: ${listening.length ? tailOf(listening.join('\n'), 4) : 'not listening'}`,
    `session is interactive: ${interactive || 'unknown'}`,
    `programs:\n${tailOf(programs, 8, 3000) || 'none'}`,
  ];
}

/** What to read when the app's window did not come up: the runtime, the machine, the app's own output and log, and the profile folder. */
function appDiagnostics(app, data, webview) {
  const parts = [`WebView2 runtime: ${webview2Runtime()}`, `app: ${app.exited() ?? 'still running'}`, ...machineFacts()];
  if (app.groups()) parts.push(`the app's token:\n${app.groups()}`);
  let profile = [];
  try {
    profile = fs.readdirSync(webview);
  } catch {
    // the folder is made by the runtime; none means it never started
  }
  parts.push(`WebView2 profile folder: ${profile.length ? `${profile.length} entries` : 'empty (the runtime did not start)'}`);
  try {
    // DevToolsActivePort is written by the browser process once the debugging port is open.
    parts.push(`EBWebView: ${fs.readdirSync(path.join(webview, 'EBWebView')).slice(0, 30).join(', ')}`);
  } catch {
    parts.push('EBWebView: none');
  }
  const out = tailOf(app.output());
  if (out) parts.push(`app output:\n${out}`);
  try {
    const log = tailOf(fs.readFileSync(path.join(data, 'logs', 'novira.log'), 'utf8'));
    if (log) parts.push(`logs/novira.log:\n${log}`);
  } catch {
    parts.push('logs/novira.log: none');
  }
  return parts.join('\n  ');
}

async function callApi(server, command) {
  const res = await fetch(`${server.origin}/api/${command}`, { method: 'POST', headers: { 'x-novira-token': server.token, 'content-type': 'application/json' }, body: '{}' });
  if (!res.ok) throw new Error(`${command}: HTTP ${res.status}`);
  return res.json();
}

/** Waits for the Generate tab, opening the splash when it asks; throws on a script error of the page. */
async function reachGenerate(page, errors) {
  const until = Date.now() + 90_000;
  while (Date.now() < until) {
    if (errors.length) throw new Error(`script error: ${errors[0]}`);
    if (await page.getByTestId('tab-generate').isVisible().catch(() => false)) return;
    const open = page.getByTestId('splash-open');
    if (await open.isVisible().catch(() => false)) await open.click().catch(() => undefined);
    await sleep(250);
  }
  throw new Error('the Generate tab did not show within 90 s');
}

async function serverOnEmptyData(artifacts, root) {
  const layout = { exe: path.join(artifacts, 'novira-server.exe'), dist: path.join(artifacts, 'dist') };
  const server = await startServer({ data: freshFolder(root, 'server-empty'), engine: false, layout });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url);
    await reachGenerate(page, errors);
    const boot = await callApi(server, 'bootstrap');
    if (!Array.isArray(boot.images)) throw new Error('bootstrap has no picture list');
  } finally {
    await browser.close();
    await server.stop();
  }
}

async function serverOnFixture(artifacts, root, version) {
  const data = freshFolder(root, `server-${version}`);
  copyDir(path.join(FIXTURES, `data-${version}`), data);
  const layout = { exe: path.join(artifacts, 'novira-server.exe'), dist: path.join(artifacts, 'dist') };
  const server = await startServer({ data, engine: false, layout });
  try {
    const problems = checkFixtureBootstrap(await callApi(server, 'bootstrap'));
    if (problems.length) throw new Error(`the ${version} data is not all there: ${problems.join('; ')}`);
  } finally {
    await server.stop();
  }
}

async function appOnEmptyData(artifacts, root) {
  try {
    if ((await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`, { signal: AbortSignal.timeout(1500) })).ok) throw new Error(`something already answers on the debugging port ${CDP_PORT}`);
  } catch (e) {
    if (e.message.startsWith('something')) throw e;
  }
  const data = freshFolder(root, 'app-data');
  const webview = freshFolder(root, 'app-webview');
  fs.writeFileSync(path.join(data, 'settings.json'), JSON.stringify(engineOff({}, 'http://127.0.0.1:9'), null, 2) + '\n');
  const vars = { NOVIRA_DATA_DIR: data, WEBVIEW2_USER_DATA_FOLDER: webview, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${CDP_PORT}` };
  const exe = path.join(artifacts, 'novira.exe');
  const app = onRunner() ? await startLowered(exe, vars, freshFolder(root, 'app-launch')) : startDirect(exe, vars);
  let browser;
  try {
    const until = Date.now() + 60_000;
    while (!browser) {
      if (app.exited()) throw new Error(`the app exited at start (${app.exited()})`);
      if (Date.now() > until) throw new Error('the app opened no window within 60 s');
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`).catch(() => undefined);
      if (!browser) await sleep(1000);
    }
    let page;
    while (!page && Date.now() < until) {
      page = browser.contexts().flatMap((c) => c.pages()).find((p) => !/^(about|devtools):/.test(p.url()));
      if (!page) await sleep(250);
    }
    if (!page) throw new Error('the app window has no page');
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await reachGenerate(page, errors);
  } catch (e) {
    throw new Error(`${e.message}\n  ${appDiagnostics(app, data, webview)}`);
  } finally {
    await browser?.close().catch(() => undefined);
    app.stop();
  }
}

async function main() {
  const { artifacts } = parseArgs(process.argv.slice(2));
  const missing = missingFiles(artifacts);
  if (missing.length) throw new Error(`not in ${artifacts}: ${missing.join(', ')} (run scripts\\release\\package.bat build first)`);
  const root = path.join(WORK, 'release-smoke');
  const steps = [
    ['the server on an empty data folder', () => serverOnEmptyData(artifacts, root)],
    ...fixtureVersions().map((v) => [`the server on the ${v} data`, () => serverOnFixture(artifacts, root, v)]),
    ['the app on an empty data folder', () => appOnEmptyData(artifacts, root)],
  ];
  let failed = 0;
  for (const [name, run] of steps) {
    try {
      await run();
      log(`ok    ${name}`);
    } catch (e) {
      failed += 1;
      log(`FAIL  ${name}: ${e.message}`);
    }
  }
  // The processes are stopped by now; a folder still held is left for scripts/tools/prune-stale.mjs.
  await sleep(1000);
  try {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  } catch (e) {
    log(`left ${root} (${e.code ?? e.message}); scripts/tools/prune-stale.mjs deletes it later`);
  }
  log(failed ? `${failed} of ${steps.length} failed` : `all ${steps.length} passed`);
  process.exitCode = failed ? 1 : 0;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    log(e.message);
    process.exitCode = 1;
  });
}
