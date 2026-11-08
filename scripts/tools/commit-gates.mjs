// The checks every commit must pass besides the quick ones of .githooks/pre-commit.mjs: the same as the CI jobs `rust-format`,
// `clippy`, the lint of `static`, `diff-backends` and `e2e-phone`, each only when a staged file can change its result. The
// three long ones of CI (vitest, cargo test, the Playwright flows in Chromium) are not run here: `affected.mjs` and the
// skills choose those. Every gate that applies runs even when an earlier one failed, so one commit shows all of them.
// Usage (the hook calls it): node scripts/tools/commit-gates.mjs [--list] [<path>...]   (no paths: the staged files)
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { acquire, runCommand } from './e2e-lock.mjs';
import { harnessRoots } from './harness-paths.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const RUST = /^backend\/.*\.(rs|toml)$|^backend\/Cargo\.lock$/;
const FRONTEND_LINT = /^frontend\/.*\.(tsx?|mts|m?js|css)$/;
/** What the mock and the real backend answer with: the contract, the mock, the comparison itself, the Rust. */
const DIFF = [RUST, /^frontend\/(src\/backend\/|difftest\/)/, /^contract\//, /^scripts\/tools\/(diff-backends|server-run)\.mjs$/];
/** What the phone layout is made of: the screens, their style, the phone specs and the Playwright settings. */
const PHONE = /^frontend\/(src\/|e2e\/(phone|fixtures)|playwright\.config\.ts$)/;

/**
 * The gates the staged `paths` call for, in the order they run. `cmd` is the command, `cwd` its folder from the repository
 * root, `lock` true for a Playwright run (one heavy browser run at a time on the machine), `rust` for a cargo build.
 */
export function gatesFor(paths) {
  const any = (re) => paths.some((p) => re.test(p));
  const gates = [];
  if (any(RUST)) {
    gates.push({ name: 'rust-format', why: 'Rust changed', cmd: ['cargo', 'fmt', '--all', '--', '--check'], cwd: 'backend', fix: 'cargo fmt --all' });
    gates.push({ name: 'clippy', why: 'Rust changed', cmd: ['cargo', 'clippy', '-p', 'novira-core', '-p', 'novira-server', '-p', 'novira', '--tests', '--', '-D', 'warnings'], cwd: 'backend', rust: true });
  }
  if (any(FRONTEND_LINT)) gates.push({ name: 'lint', why: 'frontend ts, js or css changed', cmd: ['npm', 'run', 'lint'], cwd: 'frontend' });
  if (DIFF.some(any)) gates.push({ name: 'diff-backends', why: 'the contract, the mock or the Rust changed', cmd: ['node', 'scripts/tools/diff-backends.mjs'], cwd: '.' });
  if (any(PHONE)) gates.push({ name: 'e2e-phone', why: 'screens or phone specs changed', cmd: ['npx', 'playwright', 'test', '--project=phone', '--project=webkit', '--reporter=line'], cwd: 'frontend', lock: true });
  return gates;
}

/** The environment of a gate: cargo on PATH, and Rust builds in the harness folder so the user's running app is never touched. */
function envOf(gate, base = process.env, root = ROOT) {
  const sep = process.platform === 'win32' ? ';' : ':';
  const env = { ...base, PATH: `${join(homedir(), '.cargo', 'bin')}${sep}${base.PATH ?? base.Path ?? ''}` };
  if (gate.rust) {
    env.CARGO_TARGET_DIR = join(harnessRoots(root).work, 'check-target');
    env.NOVIRA_SKIP_FRONTEND_BUILD = '1';
  }
  return env;
}

function stagedPaths() {
  return execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { encoding: 'utf8', cwd: ROOT }).split('\0').filter(Boolean);
}

async function runGate(gate) {
  const opts = { cwd: join(ROOT, gate.cwd), env: envOf(gate) };
  if (!gate.lock) return runCommand(gate.cmd, opts);
  const release = await acquire({ what: gate.cmd.join(' ') });
  try {
    return runCommand(gate.cmd, opts);
  } finally {
    release();
  }
}

async function main(argv) {
  const list = argv.includes('--list');
  const given = argv.filter((a) => !a.startsWith('--'));
  const gates = gatesFor(given.length ? given : stagedPaths());
  if (list) {
    for (const g of gates) console.log(`${g.name}: ${g.cmd.join(' ')}  (${g.why})`);
    return 0;
  }
  const failed = [];
  for (const g of gates) {
    console.log(`commit-gates: ${g.name} (${g.why})`);
    const started = Date.now();
    const status = await runGate(g);
    console.log(`commit-gates: ${g.name} ${status === 0 ? 'passed' : 'FAILED'} in ${Math.round((Date.now() - started) / 1000)} s`);
    if (status !== 0) failed.push(g);
  }
  if (failed.length) {
    const fix = failed.find((g) => g.fix);
    console.error(`commit-gates: ${failed.map((g) => g.name).join(', ')} failed. They are the CI jobs of the same names; fix what they report${fix ? ` (format with \`${fix.fix}\` in backend/)` : ''} and commit again.`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await main(process.argv.slice(2)));
