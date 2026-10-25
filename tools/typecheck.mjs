// The type check of the frontend (`tsc --noEmit` over frontend/tsconfig.json: src, the tests, the e2e specs and the
// configs), incremental so that the pre-commit hook can run it on every commit that stages its inputs. The build info lives
// in novira-data/work/tsc/ (one file per checkout), never next to the sources. A cold run takes about 20 s, a warm one 4 s.
//   node tools/typecheck.mjs            check the working tree
//   node tools/typecheck.mjs --staged   check only when a staged path is an input (pre-commit); exit 0 otherwise
// It checks the files of the working tree, not the index: a partly staged file is checked as it is on disk.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkoutEntry, harnessRoots } from './harness-paths.mjs';
import { markUsed } from './prune-stale.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * What can change the result: any ts / tsx / mts of the frontend (tests and declarations of scripts included) and any JSON
 * there (the `t()` keys are typed from the ja catalog, tsconfig.json and package.json set the check up).
 */
const INPUT = /^frontend\/.+\.(tsx?|mts|json)$/;

/** Whether one of the changed paths (repository-relative, forward slashes) can change the type check. */
export function needsTypecheck(paths) {
  return paths.some((p) => INPUT.test(p));
}

/** Runs tsc incrementally and returns its exit code. */
export function typecheck(repo = ROOT) {
  const dir = checkoutEntry('tsc', repo, harnessRoots(repo).work);
  mkdirSync(dir, { recursive: true });
  markUsed(path.dirname(dir));
  const frontend = path.join(repo, 'frontend');
  const tsc = path.join(frontend, 'node_modules', 'typescript', 'bin', 'tsc');
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--incremental', '--tsBuildInfoFile', path.join(dir, 'tsbuildinfo')], { cwd: frontend, stdio: 'inherit' });
  return r.status ?? 1;
}

function main() {
  if (process.argv.includes('--staged')) {
    const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMRD', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
    if (!needsTypecheck(staged)) return 0;
  }
  const status = typecheck();
  if (status === 0) console.log('Typecheck: OK');
  else console.error('typecheck: tsc found errors (above); fix them, then commit again. Run by hand: `node tools/typecheck.mjs`.');
  return status;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) process.exit(main());
