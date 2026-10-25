// Picks the checks a change needs (the tables of .claude/rules/regression-tests.md) and runs them, so nobody chooses
// tests from the table by hand and a test that imports a changed file is not forgotten.
//
// Usage (from the repository root):
//   node tools/affected.mjs                  the working tree against HEAD: staged, unstaged and untracked files
//   node tools/affected.mjs --base <ref>     also everything committed since <ref> (a branch's work: --base main)
//   node tools/affected.mjs <path>...        these paths only
//   --list   print the checks without running them
//   --e2e    also run the Playwright flows of the changed features and the visual regression (otherwise only named)
//   --text   also run the tests that read the screen text and the manual (otherwise left out: they are slow to keep green
//            while a screen is still being worked on; the pre-commit sync checks and `npm run check` still cover them)
// Every check runs even when an earlier one failed; the exit code is 1 when any failed.
//
// How the frontend tests are chosen: `vitest related` follows the import graph from each changed file, so every test
// that imports it (directly or through other modules) runs. Files read at run time rather than imported (catalogs,
// the manual, contract fixtures, the map) are mapped by path below to the tests that read them.
// How the Rust tests are chosen: a change under novira-core/src runs the library tests and every integration test
// that names the changed top-level module (`novira_core::<module>`, a grouped `use`, or a root re-export such as
// `Backend`). Limits: an integration test that reaches the module only through another module is not chosen (the
// modules use each other in cycles, so following them would choose all of them); `scripts\check.bat backend` runs all.
// `*_live.rs` tests are never run here (they need the network or the real engine).
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runCommand } from './e2e-lock.mjs';
import { harnessRoots } from './harness-paths.mjs';
import { isSweepTrigger } from './models-sweep-lib.mjs';
import { isLayoutSource } from './layout-scan.mjs';
import { referencesIn, testIdDefined, testIdsIn } from './ui-refs.mjs';
import { isScreenSource } from './visual-baselines.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CORE = 'backend/crates/novira-core';

/** Build settings and dependencies: a change here can break anything on that side, so the whole side is checked. */
const FRONTEND_WIDE = /^frontend\/(package(-lock)?\.json|tsconfig[^/]*\.json|vite[^/]*\.config\.ts|vitest\.config\.ts|eslint\.config\.[^/]+|\.stylelintrc[^/]*)$/;
const BACKEND_WIDE = /^backend\/(Cargo\.(toml|lock)|rustfmt\.toml|\.cargo\/.*|crates\/[^/]+\/Cargo\.toml|crates\/novira-core\/src\/lib\.rs)$/;

/** Files the frontend tests read at run time (not through imports), and the tests that read them. */
const READ_BY_TESTS = [
  // The third item marks the tests of the screen text and the manual, which run only with --text.
  [/^frontend\/src\/i18n\/(locales\/|glossary\.json)/, ['tests/i18n.test.ts', 'tests/i18n-glossary.test.ts', 'tests/manual.test.ts'], 'text'],
  [/^docs\/manual\//, ['tests/manual.test.ts', 'tests/i18n-glossary.test.ts'], 'text'],
  [/^(docs\/(architecture|design)\/|\.claude\/(rules|skills)\/|AGENTS\.md$)/, ['tests/docs-check.test.ts']],
  // Test ids and message keys named outside the app's code must still exist (pre-commit also runs tools/ui-refs.mjs).
  [/^frontend\/(src\/.+\.tsx?|src\/i18n\/locales\/ja\/.+|e2e\/.+|scripts\/.+)$|^tools\/|^docs\/(?!manual\/)|^\.claude\/|^AGENTS\.md$/, ['tests/ui-refs.test.ts']],
  [/^contract\//, ['src/backend/contract.test.ts', 'src/backend/tauri']],
  [/^frontend\/src\/backend\/(types|client)\.ts$|^frontend\/src\/backend\/tauri\//, ['src/backend/contract.test.ts', 'src/backend/tauri']],
  [/^backend\/src-tauri\/src\/(commands|command_list)\.rs$|^backend\/src-tauri\/capabilities\//, ['src/backend/tauri']],
  // The HTTP client's contract reads the shared command layer; the call table is shared with the Tauri test.
  [/^backend\/crates\/novira-core\/src\/api\.rs$|^frontend\/src\/backend\/calls\.testkit\.ts$/, ['src/backend/http', 'src/backend/tauri']],
  [/^frontend\/src\/backend\/http\//, ['src/backend/http']],
  // `#[ignore]` outside live tests, prompt snapshots that no test writes.
  [/(\.test\.tsx?|\.rs)$|__snapshots__\//, ['tests/test-hygiene.test.ts']],
];

/** Changed paths of the working tree (and, with a base, of the commits since it), relative to the root, `/`-separated. */
export function changedPaths(base) {
  const git = (...args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const paths = [...git('diff', '--name-only', '-z', 'HEAD'), ...git('ls-files', '--others', '--exclude-standard', '-z')];
  if (base) paths.push(...git('diff', '--name-only', '-z', `${base}...HEAD`));
  return [...new Set(paths)].sort();
}

/** The integration tests of novira-core: name → its source text (a `tests/<name>/` folder counts when it has a main.rs). */
export function readCoreTests(root = ROOT) {
  const dir = join(root, CORE, 'tests');
  const tests = new Map();
  const helpers = new Map();
  const readAll = (path) =>
    statSync(path).isDirectory()
      ? readdirSync(path).map((name) => readAll(join(path, name))).join('\n')
      : path.endsWith('.rs') ? readFileSync(path, 'utf8') : '';
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name.endsWith('.rs')) tests.set(name.slice(0, -3), readAll(path));
    else if (existsSync(join(path, 'main.rs'))) tests.set(name, readAll(path));
    else if (statSync(path).isDirectory()) helpers.set(name, true);
  }
  const reexports = new Map();
  const lib = readFileSync(join(root, CORE, 'src/lib.rs'), 'utf8');
  for (const [, module, list] of lib.matchAll(/^pub use (\w+)::\{?([^};]*)\}?;/gm)) {
    for (const item of list.split(',')) reexports.set(item.trim().split('::').pop(), module);
  }
  return { tests, helpers: [...helpers.keys()], reexports };
}

/** The top-level novira-core modules a test's source names. */
export function modulesNamed(source, reexports) {
  const named = new Set();
  const add = (first) => named.add(reexports.get(first) ?? first);
  for (const [, first] of source.matchAll(/novira_core::(\w+)/g)) add(first);
  // A grouped import: novira_core::{a::B, c, D}. Only the first segment of each top-level item counts.
  for (const match of source.matchAll(/novira_core::\{/g)) {
    let depth = 1;
    let item = '';
    for (let i = match.index + match[0].length; i < source.length && depth > 0; i++) {
      const c = source[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      if (depth === 0 || (depth === 1 && c === ',')) {
        const first = /^\s*(\w+)/.exec(item)?.[1];
        if (first) add(first);
        item = '';
      } else item += c;
    }
  }
  named.delete('self');
  return named;
}

/**
 * The checks for these changed paths. Each check: `{ side, cwd, cmd, why }`, `cwd` relative to the root.
 * `skipped` lists what was left out on purpose (Playwright without --e2e, live tests), with the command to run it.
 */
export function plan(paths, { e2e = false, text = false, core = readCoreTests(), exists = (p) => existsSync(join(ROOT, p)) } = {}) {
  const checks = [];
  const skipped = [];
  const add = (side, cwd, cmd, why) => {
    const key = `${cwd}\0${cmd.join(' ')}`;
    const found = checks.find((c) => `${c.cwd}\0${c.cmd.join(' ')}` === key);
    if (found) {
      if (!found.why.includes(why)) found.why += `; ${why}`;
    } else checks.push({ side, cwd, cmd, why });
  };
  const front = paths.filter((p) => p.startsWith('frontend/'));
  const frontendWide = paths.some((p) => FRONTEND_WIDE.test(p));
  const backendWide = paths.some((p) => BACKEND_WIDE.test(p));

  // Frontend.
  if (frontendWide) {
    add('frontend', 'frontend', ['npm', 'run', 'check'], 'build settings or dependencies changed (typecheck, lint, every vitest test)');
  } else {
    if (front.some((p) => /\.(tsx?|mts)$/.test(p))) add('frontend', 'frontend', ['npm', 'run', 'typecheck'], 'ts / tsx changed');
    const lintable = front.filter((p) => /\.(tsx?|m?js)$/.test(p) && exists(p)).map((p) => p.slice('frontend/'.length));
    if (lintable.length) add('frontend', 'frontend', ['npx', 'eslint', ...lintable], 'lint the changed files');
    const css = front.filter((p) => p.endsWith('.css') && exists(p)).map((p) => p.slice('frontend/'.length));
    if (css.length) add('frontend', 'frontend', ['npx', 'stylelint', ...css], 'css changed (colours only from tokens.css)');
    // Every existing source file outside the Rust tree may be imported by a vitest test (scripts and hooks included).
    const related = paths.filter((p) => /\.(tsx?|m?js|json)$/.test(p) && !p.startsWith('backend/') && exists(p));
    if (related.length) add('frontend', 'frontend', ['npx', 'vitest', 'related', '--run', '--passWithNoTests', ...related.map((p) => `../${p}`)], 'tests that import a changed file');
    const read = new Set();
    const leftOut = new Set();
    for (const [re, tests, kind] of READ_BY_TESTS) {
      if (!paths.some((p) => re.test(p))) continue;
      for (const t of tests) (kind === 'text' && !text ? leftOut : read).add(t);
    }
    if (read.size) add('frontend', 'frontend', ['npx', 'vitest', 'run', ...read], 'tests that read a changed file at run time');
    for (const t of read) leftOut.delete(t);
    if (leftOut.size) skipped.push({ cmd: `cd frontend && npx vitest run ${[...leftOut].join(' ')}`, why: 'the tests of the screen text and the manual are left out; pass --text to run them' });
  }

  // Playwright: named, or run with --e2e.
  const appCode = front.filter((p) => !/\.(test|testkit)\.tsx?$|\.d\.ts$/.test(p));
  const features = new Set(appCode.map((p) => /^frontend\/src\/features\/([^/]+)\//.exec(p)?.[1]).filter(Boolean));
  const shared = appCode.some((p) => /^frontend\/(src\/(app|ui|state|backend\/mock|theme)\/|index\.html$)/.test(p));
  const specs = shared ? [] : [...new Set([...features].flatMap((f) => specsFor(f)))];
  // What the browser build is made from (not the test or lint settings).
  const appBuild = paths.some((p) => /^frontend\/(package(-lock)?\.json|vite\.config\.ts|tsconfig\.json)$/.test(p));
  const flows = shared || appBuild ? ['npx', 'playwright', 'test', '--project=chromium'] : specs.length ? ['npx', 'playwright', 'test', '--project=chromium', ...specs] : null;
  const flowsWhy = appBuild ? 'the build of the app changed' : shared ? 'a shared part or the mock changed' : 'the flows of the changed features';
  const visual = paths.some(isScreenSource) || appBuild;
  for (const [cmd, why] of [
    [flows, flowsWhy],
    [visual ? ['npx', 'playwright', 'test', '--project=visual'] : null, 'a file that can change a main screen; update the baselines in the same commit when the change is intended'],
  ]) {
    if (!cmd) continue;
    if (e2e) add('e2e', 'frontend', cmd, why);
    else skipped.push({ cmd: `cd frontend && ${cmd.join(' ')}`, why: `${why}; pass --e2e to run it` });
  }

  // Model code: the sweep in the isolated real app (.claude/rules/models.md). Only named: it needs the window and the GPU.
  const modelCode = paths.filter(isSweepTrigger);
  if (modelCode.length) skipped.push({ cmd: 'node tools/models-sweep.mjs --build', why: `model code changed (${modelCode.length} file(s)): sweep every installed model in the real app (.claude/rules/models.md)` });

  // The layout scan always runs for layout source: the pre-commit hook refuses the commit without its recorded pass.
  if (paths.some(isLayoutSource)) add('e2e', '.', ['node', 'tools/layout-scan.mjs'], 'layout source changed (css, ui/, app/, feature tsx); the pre-commit hook needs its pass');

  // Backend.
  const rust = paths.filter((p) => p.startsWith('backend/'));
  if (rust.some((p) => p.endsWith('.rs')) || backendWide) add('backend', 'backend', ['cargo', 'fmt', '--all', '--', '--check'], 'Rust changed (fix with `cargo fmt --all`)');
  const coreSrc = rust.filter((p) => p.startsWith(`${CORE}/src/`));
  const coreTests = new Set();
  if (backendWide) {
    add('backend', 'backend', ['cargo', 'clippy', '-p', 'novira-core', '--tests', '--', '-D', 'warnings'], 'build settings or dependencies changed');
    add('backend', 'backend', ['cargo', 'test', '-p', 'novira-core'], 'build settings or dependencies changed (every novira-core test)');
    add('backend', 'backend', ['cargo', 'test', '-p', 'novira'], 'build settings or dependencies changed');
  } else {
    if (coreSrc.length || rust.some((p) => p.startsWith(`${CORE}/tests/`))) {
      add('backend', 'backend', ['cargo', 'clippy', '-p', 'novira-core', '--tests', '--', '-D', 'warnings'], 'novira-core changed');
    }
    if (coreSrc.length) add('backend', 'backend', ['cargo', 'test', '-p', 'novira-core', '--lib'], 'novira-core source changed (includes the graph snapshots and node_defs_check)');
    const changedModules = new Set(coreSrc.map((p) => /^[^]*?\/src\/(\w+)/.exec(p)?.[1]).filter(Boolean));
    for (const [name, source] of core.tests) {
      if (name.endsWith('_live')) continue;
      const named = modulesNamed(source, core.reexports);
      if ([...changedModules].some((m) => named.has(m))) coreTests.add(name);
    }
    for (const p of rust.filter((p) => p.startsWith(`${CORE}/tests/`))) {
      const name = /\/tests\/([^/]+?)(\.rs)?(\/|$)/.exec(p)?.[1];
      if (!name) continue;
      if (core.tests.has(name)) {
        if (name.endsWith('_live')) skipped.push({ cmd: `cd backend && cargo test -p novira-core --test ${name} -- --ignored`, why: 'a live test changed; it needs the network or the real engine, run it on purpose' });
        else coreTests.add(name);
      } else if (core.helpers.includes(name)) {
        // A helper folder shared by several tests (fake_site, prop_common): the tests that mention it.
        for (const [test, source] of core.tests) if (!test.endsWith('_live') && source.includes(name)) coreTests.add(test);
      }
    }
    if (paths.some((p) => /^contract\/|^frontend\/src\/backend\/(types|client)\.ts$|^backend\/crates\/novira-core\/src\/types(\.rs|\/)/.test(p))) coreTests.add('contract');
    if (coreTests.size) {
      const list = [...coreTests].sort();
      add('backend', 'backend', ['cargo', 'test', '-p', 'novira-core', ...list.flatMap((t) => ['--test', t])], `integration tests that name the changed module or changed themselves (${list.length})`);
    }
    if (rust.some((p) => p.startsWith('backend/src-tauri/'))) add('backend', 'backend', ['cargo', 'test', '-p', 'novira'], 'the Tauri shell changed (command list, capabilities, robustness)');
  }
  // The browser server and the parts of the core it shares with the shells.
  if (backendWide || rust.some((p) => p.startsWith('backend/crates/novira-server/') || /^backend\/crates\/novira-core\/src\/(api|startup|image_serve)\.rs$/.test(p))) {
    add('backend', 'backend', ['cargo', 'clippy', '-p', 'novira-server', '--tests', '--', '-D', 'warnings'], 'the browser server or the command layer it shares changed');
    add('backend', 'backend', ['cargo', 'test', '-p', 'novira-server'], 'the browser server or the command layer it shares changed');
  }
  if (paths.length) add('all', 'frontend', ['npm', 'run', 'check:eol'], 'line ends (always)');
  return { checks, skipped };
}

/** Specs of their own projects, never a feature's flow. */
const NOT_FLOWS = new Set(['visual.spec.ts', 'layout.spec.ts']);

/**
 * The Playwright specs of a feature folder: those whose file name starts with the feature's name, and those that name a
 * test id the folder sets (a spec is often named after its flow, not the folder: model-choice for the media packs,
 * manga-finish for the finish dialog).
 */
export function specsFor(feature, root = ROOT) {
  const dir = join(root, 'frontend/e2e');
  const folder = join(root, 'frontend/src/features', feature);
  if (!existsSync(dir)) return [];
  const sources = existsSync(folder)
    ? readdirSync(folder, { recursive: true })
        .map(String)
        .filter((f) => /\.tsx?$/.test(f) && !/\.(test|testkit)\.tsx?$|\.d\.ts$/.test(f))
        .map((f) => readFileSync(join(folder, f), 'utf8'))
    : [];
  const ids = testIdsIn(sources);
  const usesIds = (spec) => referencesIn(spec, readFileSync(join(dir, spec), 'utf8'), new Set()).some((r) => r.kind === 'testid' && testIdDefined(r, ids));
  return readdirSync(dir)
    .filter((f) => f.endsWith('.spec.ts') && !NOT_FLOWS.has(f) && (f.startsWith(feature) || usesIds(f)))
    .map((f) => `e2e/${f}`);
}

/** Whether the debug app is open (Windows locks a running exe), which makes a build of `novira` fail. */
function appExeLocked() {
  const exe = join(ROOT, 'backend/target/debug/novira.exe');
  if (process.env.CARGO_TARGET_DIR || !existsSync(exe)) return false;
  try {
    closeSync(openSync(exe, 'r+'));
    return false;
  } catch {
    return true;
  }
}

function main(argv) {
  const list = argv.includes('--list');
  const e2e = argv.includes('--e2e');
  const text = argv.includes('--text');
  const baseAt = argv.indexOf('--base');
  const base = baseAt >= 0 ? argv[baseAt + 1] : undefined;
  const given = argv.filter((a, i) => !a.startsWith('--') && (baseAt < 0 || i !== baseAt + 1)).map((p) => resolve(p)).map((p) => p.slice(resolve(ROOT).length + 1).replaceAll('\\', '/'));
  const paths = given.length ? given : changedPaths(base);
  if (!paths.length) {
    console.log('affected: nothing changed');
    return 0;
  }
  const { checks, skipped } = plan(paths, { e2e, text });
  console.log(`affected: ${paths.length} changed path(s), ${checks.length} check(s)`);
  for (const c of checks) console.log(`  [${c.side}] ${c.cmd.join(' ')}\n      why: ${c.why}`);
  for (const s of skipped) console.log(`  not run: ${s.cmd}\n      why: ${s.why}`);
  if (list) return 0;

  const env = { ...process.env, PATH: `${join(homedir(), '.cargo', 'bin')}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}` };
  if (checks.some((c) => c.cmd.includes('novira')) && appExeLocked()) {
    env.CARGO_TARGET_DIR = join(harnessRoots(ROOT).work, 'check-target');
    console.log(`affected: novira.exe is open, so the Rust checks build into ${env.CARGO_TARGET_DIR}`);
  }
  const failed = [];
  for (const c of checks) {
    console.log(`\n=== ${c.cmd.join(' ')} ===`);
    const t0 = Date.now();
    const status = runCommand(c.cmd, { cwd: join(ROOT, c.cwd), env });
    console.log(`--- exit ${status} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (status !== 0) failed.push(c.cmd.join(' '));
  }
  console.log(failed.length ? `\nFAILED:\n${failed.map((f) => `  ${f}`).join('\n')}` : '\nAll affected checks passed.');
  return failed.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
