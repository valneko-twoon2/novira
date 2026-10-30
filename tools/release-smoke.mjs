// The smoke test of a release build: what scripts\release.bat put in artifacts\ starts and shows its main screen, before
// scripts\package.bat packs it (docs/development.md). It checks the files themselves, not a build of its own:
//   1. the release files are there (novira.exe, novira-server.exe, dist\index.html, server.bat);
//   2. novira-server.exe on an empty data folder serves the page, and the page reaches the Generate tab without a script error;
//   3. novira-server.exe on a copy of each old-data fixture (backend/crates/novira-core/tests/fixtures/data-<version>/)
//      answers `bootstrap` with every board, picture, workflow and model the fixture holds;
//   4. novira.exe starts on an empty data folder with no engine (a closed loopback address, as verify-real-app --no-engine)
//      and its window reaches the Generate tab.
// Nothing starts ComfyUI or uses the GPU. Every data folder and the WebView2 profile are made inside
// novira-data/work/release-smoke/ and deleted at the end; only the processes this script started are stopped.
// Usage, from the repository root:  node tools/release-smoke.mjs [--artifacts <folder>]   (default: artifacts\)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { harnessRoots } from './harness-paths.mjs';
import { isInside, stopTrees } from './harness-process.mjs';
import { startServer } from './server-run.mjs';
import { engineOff } from './verify-real-app.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
  const env = { ...process.env, NOVIRA_DATA_DIR: data, WEBVIEW2_USER_DATA_FOLDER: webview, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${CDP_PORT}` };
  const app = spawn(path.join(artifacts, 'novira.exe'), [], { env, stdio: 'ignore' });
  let browser;
  try {
    const until = Date.now() + 60_000;
    while (!browser) {
      if (app.exitCode !== null) throw new Error(`the app exited at start (exit ${app.exitCode})`);
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
  } finally {
    await browser?.close().catch(() => undefined);
    stopTrees([app.pid]);
  }
}

async function main() {
  const { artifacts } = parseArgs(process.argv.slice(2));
  const missing = missingFiles(artifacts);
  if (missing.length) throw new Error(`not in ${artifacts}: ${missing.join(', ')} (run scripts\\release.bat first)`);
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
  // The processes are stopped by now; a folder still held is left for tools/prune-stale.mjs.
  await sleep(1000);
  try {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  } catch (e) {
    log(`left ${root} (${e.code ?? e.message}); tools/prune-stale.mjs deletes it later`);
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
