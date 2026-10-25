// Starts novira-server (the browser server, docs/design/browser-server.md) on an isolated data folder for a check that drives
// the real backend from Chromium, and stops it again with the engine it started. The twin of tools/verify-real-app.mjs for
// the browser path: same data folder rules (strictly inside novira-data/work/ of the main checkout), same shared models
// (settings.json `modelRoots`), the GPU lock comes from NOVIRA_GPU_LOCK like the app's.
//
//   import { startServer, ensureBuilt } from './server-run.mjs';
//   ensureBuilt({ build: false });
//   const server = await startServer({ data });   // server.url carries the token; server.origin is http://127.0.0.1:<port>
//   ... drive server.url with Playwright ...
//   await server.stop();
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHarnessDist, harnessDistDir, harnessRoots } from './harness-paths.mjs';
import { cargoCommand, isInside, listProcesses, pythonsWith, stopTrees } from './harness-process.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = harnessRoots(REPO);
const log = (m) => console.log(`[server-run] ${m}`);

/** Where the server is built and what it serves. The target is outside the repository, like the verification build's. */
export function serverLayout(env = process.env, roots = ROOTS, repo = REPO) {
  const target = path.resolve(env.NOVIRA_SERVER_TARGET || path.join(roots.work, 'server-target'));
  return { target, exe: path.join(target, 'debug', 'novira-server.exe'), dist: harnessDistDir(repo, roots.work) };
}

/**
 * Brings the harness build of the frontend up to date (reused when its sources are unchanged; never frontend/dist, which
 * may be the user's app build) and builds the server when it is missing (or always with `build`). Throws when a build fails.
 */
export function ensureBuilt({ build = false, layout = serverLayout(), repo = REPO } = {}) {
  const run = (name, cmd, args, cwd, env) => {
    const r = spawnSync(cmd, args, { cwd, env, stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`${name} failed (exit ${r.status ?? r.signal})`);
  };
  log('building the frontend (the harness build, reused when current)');
  buildHarnessDist(repo);
  if (build || !fs.existsSync(layout.exe)) {
    log(`building the server into ${layout.target}`);
    run('server build', cargoCommand(), ['build', '-p', 'novira-server', '-j', '4'], path.join(repo, 'backend'), { ...process.env, CARGO_TARGET_DIR: layout.target });
  }
}

/** Stops python processes whose command line names this data folder (the engine the server started for it). */
function stopEngine(data) {
  return stopTrees(pythonsWith(listProcesses(), data).map((p) => p.pid));
}

/**
 * Starts the server on `data` with the image engine (unless `engine: false`) and resolves when it prints its address.
 * Refuses a data folder outside novira-data/work/ of the main checkout, so it can never open the user's own data.
 */
export async function startServer({ data, engine = true, layout = serverLayout(), roots = ROOTS, env = process.env, timeoutMs = 240_000 }) {
  data = path.resolve(data);
  if (!isInside(data, roots.work)) throw new Error(`refusing: the data folder ${data} is not inside ${roots.work}`);
  if (!fs.existsSync(layout.exe)) throw new Error(`no server at ${layout.exe} (ensureBuilt first)`);
  const args = ['--data', data, '--dist', layout.dist, ...(engine ? ['--engine'] : [])];
  const child = spawn(layout.exe, args, { env: { ...env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let out = '';
  let err = '';
  child.stderr.on('data', (d) => (err += d));
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    stopTrees([child.pid]);
    const left = stopEngine(data);
    if (left.length) log(`stopped ${left.length} leftover engine process(es) of ${data}`);
  };
  // A server that never printed its address is stopped too, with the engine it may have started on the data folder.
  let address;
  try {
    address = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`the server printed no address within ${Math.round(timeoutMs / 1000)} s: ${out} ${err}`)), timeoutMs);
      child.stdout.on('data', (d) => {
        out += d;
        const m = /novira-server: (http:\/\/127\.0\.0\.1:\d+\/\?token=[0-9a-f]+)/.exec(out);
        if (m) {
          clearTimeout(timer);
          resolve(m[1]);
        }
      });
      child.on('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`the server exited early (exit ${code}): ${out} ${err}`));
      });
    });
  } catch (e) {
    await stop();
    throw e;
  }
  const url = new URL(address);
  return { url: address, origin: url.origin, token: url.searchParams.get('token'), child, stop, stderr: () => err };
}
