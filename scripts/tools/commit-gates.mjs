// The checks every commit must pass besides the quick ones of .githooks/pre-commit.mjs: the same as the CI jobs `rust-format`,
// `clippy`, the lint of `static`, `diff-backends` and `e2e-phone`, each only when a staged file can change its result. The
// long ones of CI (vitest, cargo test, the Playwright flows in Chromium, and the visual regression `e2e-visual`, about two minutes) are not run here: `affected.mjs` and the
// skills choose those. Every gate that applies runs even when an earlier one failed, so one commit shows all of them.
// The commands and their environment are those of scripts/tools/checks.mjs (the `check` of a gate is its name there).
// Usage (the hook calls it): node scripts/tools/commit-gates.mjs [--list] [<path>...]   (no paths: the staged files)
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runCheck, specOf } from './checks.mjs';
import { upperDrive } from './harness-paths.mjs';

const ROOT = upperDrive(fileURLToPath(new URL('../..', import.meta.url)));

const RUST = /^backend\/.*\.(rs|toml)$|^backend\/Cargo\.lock$/;
const FRONTEND_LINT = /^frontend\/.*\.(tsx?|mts|m?js|css)$/;
/** What the mock and the real backend answer with: the contract, the mock, the comparison itself, the Rust. */
const DIFF = [RUST, /^frontend\/(src\/backend\/|difftest\/)/, /^contract\//, /^scripts\/tools\/(diff-backends|server-run)\.mjs$/];
/** What the phone layout is made of: the screens, their style, the phone specs and the Playwright settings. */
const PHONE = /^frontend\/(src\/|e2e\/(phone|fixtures)|playwright\.config\.ts$)/;

/**
 * The gates the staged `paths` call for, in the order they run. `name` is the CI job it stands for and `check` the check of
 * scripts/tools/checks.mjs it runs.
 */
export function gatesFor(paths) {
  const any = (re) => paths.some((p) => re.test(p));
  const gates = [];
  if (any(RUST)) {
    gates.push({ name: 'rust-format', check: 'fmt', why: 'Rust changed', fix: 'node scripts/tools/checks.mjs fmt --fix' });
    gates.push({ name: 'clippy', check: 'clippy', why: 'Rust changed' });
  }
  if (any(FRONTEND_LINT)) gates.push({ name: 'lint', check: 'lint', why: 'frontend ts, js or css changed' });
  if (DIFF.some(any)) gates.push({ name: 'diff-backends', check: 'diff-backends', why: 'the contract, the mock or the Rust changed' });
  if (any(PHONE)) gates.push({ name: 'e2e-phone', check: 'phone', why: 'screens or phone specs changed', args: ['--reporter=line'] });
  return gates;
}

function stagedPaths() {
  return execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { encoding: 'utf8', cwd: ROOT }).split('\0').filter(Boolean);
}

async function main(argv) {
  const list = argv.includes('--list');
  const given = argv.filter((a) => !a.startsWith('--'));
  const gates = gatesFor(given.length ? given : stagedPaths());
  if (list) {
    for (const g of gates) console.log(`${g.name}: ${specOf(g.check, g.args ?? []).cmd.join(' ')}  (${g.why})`);
    return 0;
  }
  const failed = [];
  for (const g of gates) {
    console.log(`commit-gates: ${g.name} (${g.why})`);
    const started = Date.now();
    const status = await runCheck(g.check, g.args ?? [], { log: () => {} });
    console.log(`commit-gates: ${g.name} ${status === 0 ? 'passed' : 'FAILED'} in ${Math.round((Date.now() - started) / 1000)} s`);
    if (status !== 0) failed.push(g);
  }
  if (failed.length) {
    const fix = failed.find((g) => g.fix);
    console.error(`commit-gates: ${failed.map((g) => g.name).join(', ')} failed. They are the CI jobs of the same names; fix what they report${fix ? ` (format with \`${fix.fix}\`)` : ''} and commit again.`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await main(process.argv.slice(2)));
