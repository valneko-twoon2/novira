// Decides which heavy CI jobs a push needs, from the files it changed, and writes `name=true|false` lines for
// $GITHUB_OUTPUT (docs/design/01-app/04-release/02-ci.md). The cheap jobs (static, rust-format) always run.
//   node scripts/tools/ci-scope.mjs            reads EVENT, REF, BEFORE, SHA from the environment, asks git for the diff
// The default branch, a schedule, a manual run, a new branch (BEFORE is all zeros) and a diff that cannot be read all run
// everything: a skipped job must never hide a failure that the whole run would have found.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Each job lists the path prefixes (or exact files) whose change can alter its result.
const WORKFLOW = '.github/workflows/test.yml';
export const RULES = {
  // vitest also runs the harness tests, which read scripts/ and the contract fixtures.
  vitest: ['frontend/', 'scripts/', 'contract/', WORKFLOW],
  // clippy and cargo test build the app crate, whose build script builds the frontend from its lock file.
  rust: ['backend/', 'contract/', 'frontend/package.json', 'frontend/package-lock.json', 'scripts/tools/ci-summary.mjs', WORKFLOW],
  e2e: ['frontend/', 'contract/', WORKFLOW],
  // The mock and the real server get the same calls: only the backend, the mock, the diff tests and the contract move it.
  diff: ['backend/', 'contract/', 'frontend/src/backend/', 'frontend/difftest/', 'frontend/package-lock.json', 'scripts/tools/diff-backends.mjs', WORKFLOW],
};

/** `{ job: boolean }` for the changed files (repo-relative, `/` separators). Pure. */
export function scopeOf(files) {
  const hit = (prefixes) => files.some((f) => prefixes.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p)));
  return Object.fromEntries(Object.keys(RULES).map((job) => [job, hit(RULES[job])]));
}

/** True when this run must run every job, whatever changed. Pure. */
export function runsEverything({ event, ref, defaultBranch, before }) {
  if (event !== 'push') return true;
  if (ref === `refs/heads/${defaultBranch}`) return true;
  return !before || /^0+$/.test(before);
}

export function run(env = process.env) {
  const all = Object.fromEntries(Object.keys(RULES).map((job) => [job, true]));
  const render = (scope) => Object.entries(scope).map(([job, on]) => `${job}=${on}`).join('\n');
  if (runsEverything({ event: env.EVENT, ref: env.REF, defaultBranch: env.DEFAULT_BRANCH || 'main', before: env.BEFORE })) return render(all);
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${env.BEFORE}...${env.SHA}`], { encoding: 'utf8' });
    return render(scopeOf(out.split(/\r?\n/).filter(Boolean)));
  } catch {
    return render(all);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.stdout.write(`${run()}\n`);
