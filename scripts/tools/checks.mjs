// The one way to run a check (format, clippy, lint, types, tests, the Playwright flows...): it sets what a raw command forgets,
// the folder to run in, cargo on the PATH, the build folder of the Rust checks (novira-data/work/check-target, so the user's
// running novira.exe is never touched), the e2e lock for the browser runs; and it passes your arguments through. The hook
// .claude/hooks/use-checks.mjs sends a raw `cargo test`, `npx vitest`, `npx eslint`... here. CI and the commit gates
// (scripts/tools/commit-gates.mjs) name the same checks.
// Usage, from the repository root (or any folder of the repository):
//   node scripts/tools/checks.mjs --list                       the checks and what each runs
//   node scripts/tools/checks.mjs <name> [arguments...]        run one; the arguments go to the command (see --list)
// Examples:
//   checks.mjs vitest src/state/drafts.test.ts      checks.mjs lint src/ui/Tooltip.tsx      checks.mjs cargo-test -p novira-core --lib queue
//   checks.mjs e2e e2e/mosaic.spec.ts               checks.mjs fmt --fix                    checks.mjs clippy
// A path written from the repository root (`frontend/src/a.ts`, `backend/crates/...`) is turned into the path the command
// sees (`src/a.ts`), so it does not matter which folder you think you are in.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { acquire, runCommand } from './e2e-lock.mjs';
import { harnessRoots, upperDrive } from './harness-paths.mjs';

const ROOT = upperDrive(fileURLToPath(new URL('../..', import.meta.url)));

/** The Rust packages every Rust check covers when none is named: what CI's clippy covers. */
const CI_PACKAGES = ['-p', 'novira-core', '-p', 'novira-server', '-p', 'novira'];

/**
 * name -> { cwd (folder of the repository), cmd(args) (the command line), about, rust (a cargo build), lock (a browser run) }.
 * `about` is the text of --list.
 */
export const CHECKS = {
  fmt: { cwd: 'backend', rust: true, about: 'cargo fmt --check of every crate; `--fix` formats them', cmd: (a) => (a[0] === '--fix' ? ['cargo', 'fmt', '--all'] : ['cargo', 'fmt', '--all', '--', '--check']) },
  clippy: { cwd: 'backend', rust: true, about: 'cargo clippy -D warnings with the tests; arguments replace the package list (-p ...)', cmd: (a) => ['cargo', 'clippy', ...(a.length ? a : CI_PACKAGES), '--tests', '--', '-D', 'warnings'] },
  'cargo-test': { cwd: 'backend', rust: true, about: 'cargo test; arguments replace the default `-p novira-core --no-fail-fast` (`-p x --test y`, `--lib name`...)', cmd: (a) => ['cargo', 'test', ...(a.length ? a : ['-p', 'novira-core', '--no-fail-fast'])] },
  lint: { cwd: 'frontend', about: 'eslint and stylelint of the frontend; files given: eslint on those files only', cmd: (a) => (a.length ? ['npx', 'eslint', ...a] : ['npm', 'run', 'lint']) },
  typecheck: { cwd: 'frontend', about: 'tsc over src, the tests, the e2e specs and the configs', cmd: () => ['npm', 'run', 'typecheck'] },
  vitest: { cwd: 'frontend', about: 'vitest run; files or -t filters as arguments; none: every test', cmd: (a) => ['npx', 'vitest', 'run', ...a] },
  e2e: { cwd: 'frontend', lock: true, about: 'Playwright on the mock, Chromium unless a --project is given; spec files as arguments; takes the e2e lock', cmd: (a) => ['npx', 'playwright', 'test', ...(a.some((x) => x.startsWith('--project')) ? [] : ['--project=chromium']), ...a] },
  phone: { cwd: 'frontend', lock: true, about: 'the phone layout in Chromium (Pixel 7) and WebKit (iPhone 14); takes the e2e lock', cmd: (a) => ['npx', 'playwright', 'test', '--project=phone', '--project=webkit', ...a] },
  'diff-backends': { cwd: '.', about: 'the mock against the real backend (novira-server, no engine)', cmd: (a) => ['node', 'scripts/tools/diff-backends.mjs', ...a] },
  layout: { cwd: '.', about: 'the layout scan of every screen (about three minutes; takes the e2e lock itself)', cmd: (a) => ['node', 'scripts/tools/layout-scan.mjs', ...a] },
  docs: { cwd: '.', about: 'the map and the design pages against the tree', cmd: (a) => ['node', 'scripts/tools/docs-check.mjs', ...a] },
  tla: { cwd: '.', about: 'TLC model-checks the TLA+ specs in backend/crates/novira-core/formal (a few seconds; fetches a portable JDK once)', cmd: (a) => ['node', 'scripts/tools/tla.mjs', ...a] },
};

/** A path argument written from the repository root, as the command (run in `cwd`) sees it. */
export function pathFor(cwd, arg) {
  if (cwd === '.' || arg.startsWith('-')) return arg;
  const from = `${cwd}/`;
  const slashed = arg.replaceAll('\\', '/');
  return slashed.startsWith(from) ? slashed.slice(from.length) : arg;
}

/** `{ cwd, cmd, rust, lock }` of a check with its arguments, or throws when the name is unknown. */
export function specOf(name, args = []) {
  const check = CHECKS[name];
  if (!check) throw new Error(`unknown check "${name}"; the checks are: ${Object.keys(CHECKS).join(', ')}`);
  return { cwd: check.cwd, cmd: check.cmd(args.map((a) => pathFor(check.cwd, a))), rust: Boolean(check.rust), lock: Boolean(check.lock) };
}

/** The environment of a check: cargo on the PATH and, for Rust, the harness build folder (see the header). */
export function envFor(spec, base = process.env, root = ROOT, exists = existsSync) {
  const sep = process.platform === 'win32' ? ';' : ':';
  const env = { ...base, PATH: `${join(homedir(), '.cargo', 'bin')}${sep}${base.PATH ?? base.Path ?? ''}` };
  if (spec.rust) {
    if (!env.CARGO_TARGET_DIR) env.CARGO_TARGET_DIR = join(harnessRoots(root).work, 'check-target');
    // The app crate's build script needs frontend/dist; it builds the screens itself when it is missing (a fresh worktree has none).
    if (exists(join(root, 'frontend', 'dist', 'index.html'))) env.NOVIRA_SKIP_FRONTEND_BUILD = '1';
  }
  return env;
}

/**
 * The folder a check runs in, with a Windows drive letter in capitals. A shell started in `e:\...` gives Node a lower-case
 * drive, and vitest then loads its own module once as `e:` and once as `E:`: every test file fails with "Cannot read
 * properties of undefined (reading 'config')".
 */
export function checkFolder(root, cwd) {
  return upperDrive(join(root, cwd));
}

/** Runs one check and returns its exit status. */
export async function runCheck(name, args = [], { root = ROOT, log = console.log } = {}) {
  const spec = specOf(name, args);
  const opts = { cwd: checkFolder(root, spec.cwd), env: envFor(spec, process.env, root) };
  log(`checks: ${name}: ${spec.cmd.join(' ')}  (in ${spec.cwd === '.' ? 'the repository root' : spec.cwd})`);
  if (!spec.lock) return runCommand(spec.cmd, opts);
  const release = await acquire({ what: spec.cmd.join(' ') });
  try {
    return runCommand(spec.cmd, opts);
  } finally {
    release();
  }
}

async function main(argv) {
  const [name, ...args] = argv;
  if (!name || name === '--list' || name === '--help') {
    console.log('usage: node scripts/tools/checks.mjs <name> [arguments...]\n');
    for (const [key, check] of Object.entries(CHECKS)) console.log(`  ${key.padEnd(14)} ${check.about}`);
    return name ? 0 : 2;
  }
  if (!CHECKS[name]) {
    console.error(`checks: unknown check "${name}"; the checks are: ${Object.keys(CHECKS).join(', ')} (node scripts/tools/checks.mjs --list)`);
    return 2;
  }
  return runCheck(name, args);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await main(process.argv.slice(2)));
