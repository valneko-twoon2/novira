// Where the harness writes and which models it shares, the same from the main checkout and from any Git worktree of it.
// A worktree has no novira-data/ of its own, so everything resolves against the main checkout (the first entry of
// `git worktree list`): its novira-data/work/ holds the standing environment (verification data, ComfyUI copy), its logs/
// the test results and reports a person reads, and its novira-data/models/ (or that of the data folder the app moved to)
// is shared read-only through the `modelRoots` setting.
// Nothing is linked: a junction to the models once let a folder removal follow it.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWorktrees } from './worktree.mjs';

/**
 * A path with a Windows drive letter in capitals. A shell started in `e:\...` gives Node a lower-case drive, so a folder a
 * script finds from its own place is `e:\...`; a child run there (vitest) then loads its own module once as `e:` and once as
 * `E:`, and every test file fails with "Cannot read properties of undefined (reading 'config')". The repository folder of every
 * tool goes through this.
 */
/** The local calendar day of `d` as YYYY-MM-DD (the user's day: toISOString() would give the UTC one). */
export function localDay(d = new Date()) {
  const two = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

export function upperDrive(p) {
  return p.replace(/^([a-z]):/, (_, drive) => `${drive.toUpperCase()}:`);
}

const HERE = upperDrive(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));

/**
 * The Vite mode of the harness build of the frontend (one build for the layout scan, the verification app and the browser
 * server). Not `production`: what only the app's build leaves out (`import.meta.env.MODE === 'production'`, such as the
 * media tabs hidden for now) stays in, so the scans, the model sweep and the speed runs still reach every screen. Still a
 * minified build. It never goes to frontend/dist: build.rs embeds that folder in the user's app when it looks current.
 */
export const HARNESS_MODE = 'harness';

/** A checkout's own folder inside `<work>/<kind>/` (named by the checkout, so two worktrees never share one). */
export function checkoutEntry(kind, repo = HERE, work = harnessRoots(repo).work) {
  const abs = path.resolve(repo);
  const id = createHash('sha256').update(abs.toLowerCase()).digest('hex').slice(0, 8);
  return path.join(work, kind, `${path.basename(abs)}-${id}`);
}

/** The folder of test results and reports at the top of a checkout (git-ignored). harnessRoots().logs is the main checkout's. */
export function logsDir(repo = HERE) {
  return path.join(repo, 'logs');
}

/** Where the coverage runs of a checkout write: its own logs/, also in a worktree (they measure that checkout's sources). */
export function coverageDir(repo = HERE) {
  return path.join(logsDir(repo), 'coverage');
}

/**
 * Playwright's output folder, in the main checkout's logs/: `e2e`, or `e2e-<folder name>` from a worktree. Playwright wipes
 * this folder when a run starts, so two checkouts must not share one.
 */
export function e2eOutputDir(roots = harnessRoots()) {
  const worktree = path.resolve(roots.repo).toLowerCase() !== path.resolve(roots.main).toLowerCase();
  return path.join(roots.logs, worktree ? `e2e-${path.basename(path.resolve(roots.repo))}` : 'e2e');
}

/** Where a checkout's harness build of the frontend lives. */
export function harnessDistDir(repo = HERE, work = harnessRoots(repo).work) {
  return checkoutEntry('e2e-build', repo, work);
}

/**
 * Makes the harness build when its sources changed (frontend/scripts/e2e-server.mjs --build-only, which reuses a current
 * one) and returns its folder. Throws when the build fails.
 */
export function buildHarnessDist(repo = HERE) {
  const frontend = path.join(path.resolve(repo), 'frontend');
  const r = spawnSync(process.execPath, [path.join(frontend, 'scripts', 'e2e-server.mjs'), '--build-only'], { cwd: frontend, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`the harness build of the frontend failed (exit ${r.status ?? r.signal})`);
  return harnessDistDir(repo);
}

/** The main checkout of the repository that holds `from` (itself when Git cannot tell). Never throws. */
export function mainCheckout(from = HERE, git = (cwd) => execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd, encoding: 'utf8', timeout: 15000 })) {
  try {
    const first = parseWorktrees(git(from))[0];
    if (first?.path) return path.resolve(first.path);
  } catch {
    // Not a Git checkout (a copy of the tools): fall back to the folder itself.
  }
  return path.resolve(from);
}

/**
 * The data folder the user's app opens when the Settings screen moved it out of the repository: the `dataDir` of the
 * pointer in `%LOCALAPPDATA%\novira` (the debug build's first, as `cargo tauri dev` is how this checkout's app runs).
 * `null` without a pointer. Never throws.
 */
export function movedDataDir(env = process.env, read = (f) => fs.readFileSync(f, 'utf8')) {
  const base = env.LOCALAPPDATA || env.XDG_CONFIG_HOME;
  if (!base) return null;
  for (const file of ['data-location-dev.json', 'data-location.json']) {
    try {
      const dir = JSON.parse(read(path.join(base, 'novira', file))).dataDir;
      if (typeof dir === 'string' && dir) return path.resolve(dir);
    } catch {
      // No pointer, or not one the app wrote: try the next.
    }
  }
  return null;
}

/**
 * `{ repo, main, work, logs, models, moved }`: this checkout, the main one, its harness folder, its folder of test results
 * and reports, its shared model folder and the data folder the user's app moved to (or null). The models are the main
 * checkout's novira-data/models, or the moved data folder's when that one is gone (the move takes the models along). The
 * harness folder stays in the repository.
 */
export function harnessRoots(repo = HERE, main = mainCheckout(repo), moved = movedDataDir(), exists = fs.existsSync) {
  const own = path.join(main, 'novira-data', 'models');
  const models = !exists(own) && moved && exists(path.join(moved, 'models')) ? path.join(moved, 'models') : own;
  return { repo: path.resolve(repo), main, work: path.join(main, 'novira-data', 'work'), logs: logsDir(main), models, moved };
}
