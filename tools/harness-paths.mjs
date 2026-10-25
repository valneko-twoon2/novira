// Where the harness writes and which models it shares, the same from the main checkout and from any Git worktree of it.
// A worktree has no novira-data/ of its own, so everything resolves against the main checkout (the first entry of
// `git worktree list`): its novira-data/work/ holds the standing environment (verification data, ComfyUI copy) and its
// novira-data/models/ is shared read-only through the `modelRoots` setting. Nothing is linked: a junction to the models
// once let a folder removal follow it.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWorktrees } from './worktree.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

/** `{ repo, main, work, models }`: this checkout, the main one, its harness folder and its shared model folder. */
export function harnessRoots(repo = HERE, main = mainCheckout(repo)) {
  return { repo: path.resolve(repo), main, work: path.join(main, 'novira-data', 'work'), models: path.join(main, 'novira-data', 'models') };
}
