// The layout scan and its record. Runs frontend/e2e/layout.spec.ts (every screen of the browser mock in ja and en, dark and
// light: controls sticking out of their box, text cut off or shortened to "…", buttons and fields with no gap between them,
// and text that does not fit, with the tooltips and menus of the main screens) and, when it passes, records a fingerprint
// of the layout source it ran on. The pre-commit hook (.githooks/pre-commit.mjs)
// refuses a commit that changes layout source unless the record holds the fingerprint of exactly what is staged, so the
// scan cannot be skipped silently while the hook itself stays fast (it hashes, it never starts a browser).
//
// Usage (from anywhere in the repository):
//   node tools/layout-scan.mjs                   ja and en, both themes; records a pass
//   node tools/layout-scan.mjs --locales all     every language of the app (only when asked: it takes five times as long)
//   node tools/layout-scan.mjs --locales ja,fr   these languages (a pass is recorded only when ja and en are among them)
//   node tools/layout-scan.mjs --check           only say whether the working tree has a recorded pass (exit 1 if not)
//   --workers <n>                                 Playwright workers (default: half the processors; never more than 6)
//   any other argument goes to Playwright (`--grep`, `--headed`); a run narrowed that way records nothing.
// It serves the harness build (frontend/scripts/e2e-server.mjs; minified, every screen in) on E2E_PORT (default 5191) and holds the e2e lock
// (tools/e2e-lock.mjs) while it runs, so a second heavy run waits instead of sharing the processors.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { acquire } from './e2e-lock.mjs';
import { harnessRoots } from './harness-paths.mjs';
import { markUsed } from './prune-stale.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** The languages a recorded pass must include. */
export const REQUIRED_LOCALES = ['ja', 'en'];
/** How many passes the record keeps (switching branches back and forth finds its pass again). */
const KEEP = 20;

/**
 * Source that decides the layout of the screens: every style sheet, the shared components and the composition, the
 * components of each feature, and the scan itself (with the text fit and the server it runs on). Tests and test support are
 * not layout.
 */
const LAYOUT_SOURCE = /^frontend\/(src\/(.+\.css|ui\/.+|app\/.+|features\/.+\.tsx)|e2e\/(layout(\.spec|Scan|Rules)|textFit)\.ts|scripts\/e2e-server\.mjs|playwright\.config\.ts)$/;
const NOT_LAYOUT = /(\.test\.tsx?|\.testkit\.tsx?|\.d\.ts|\.snap)$|\/__snapshots__\//;

/** Whether a repository path (`/`-separated) is layout source. */
export function isLayoutSource(path) {
  return LAYOUT_SOURCE.test(path) && !NOT_LAYOUT.test(path);
}

/** The fingerprint of a set of `[path, blob id]` pairs: only the layout source counts, in a fixed order. */
export function fingerprint(entries) {
  const lines = entries
    .filter(([path]) => isLayoutSource(path))
    .map(([path, blob]) => `${path} ${blob}`)
    .sort();
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

/** `git ls-files -s -z` output into `[path, blob id]` pairs (stage 0 only: an unmerged file has no single content). */
export function parseStage(output) {
  return output
    .split('\0')
    .filter(Boolean)
    .map((line) => /^\d+ ([0-9a-f]+) (\d)\t(.+)$/.exec(line))
    .filter((m) => m && m[2] === '0')
    .map((m) => [m[3], m[1]]);
}

const git = (args, root, input) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, input });

/** The fingerprint of what is staged (what a commit would hold). */
export function indexFingerprint(root = ROOT) {
  return fingerprint(parseStage(git(['ls-files', '-s', '-z', '--', 'frontend'], root)));
}

/** The fingerprint of the working tree: tracked and new (not ignored) files as they are on disk now. */
export function treeFingerprint(root = ROOT) {
  const listed = [...git(['ls-files', '-z', '--', 'frontend'], root).split('\0'), ...git(['ls-files', '--others', '--exclude-standard', '-z', '--', 'frontend'], root).split('\0')];
  const paths = [...new Set(listed.filter((p) => p && isLayoutSource(p) && existsSync(join(root, p))))];
  if (!paths.length) return fingerprint([]);
  const blobs = git(['hash-object', '--stdin-paths'], root, paths.join('\n') + '\n').trim().split(/\r?\n/);
  return fingerprint(paths.map((p, i) => [p, blobs[i]]));
}

/** Where the record lives: in the main checkout's novira-data/work/ (tools/harness-paths.mjs), like everything the harness writes. */
export function recordPath(root = ROOT) {
  return join(harnessRoots(root).work, 'layout-scan', 'passes.json');
}

/** The recorded passes (an empty list when there is no record or it cannot be read). */
export function readPasses(file = recordPath()) {
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(data.passes) ? data.passes : [];
  } catch {
    return [];
  }
}

/** The passes after adding one (newest first, one per fingerprint, at most KEEP). */
export function withPass(passes, pass) {
  return [pass, ...passes.filter((p) => p.fingerprint !== pass.fingerprint)].slice(0, KEEP);
}

/** Whether a recorded pass covers this fingerprint in every required language. */
export function passed(passes, print) {
  return passes.some((p) => p.fingerprint === print && REQUIRED_LOCALES.every((l) => (p.locales ?? []).includes(l)));
}

/**
 * The pre-commit verdict: null when the commit may go ahead, otherwise the text that says what to do. `staged` are the
 * staged paths (added, changed, renamed or deleted); `print` the fingerprint of the index; `passes` the record.
 */
export function gateMessage(staged, print, passes) {
  const layout = staged.filter(isLayoutSource);
  if (!layout.length || passed(passes, print)) return null;
  return [
    'pre-commit: this commit changes the layout source, and the layout scan has not passed on exactly what is staged:',
    ...layout.slice(0, 8).map((p) => `  ${p}`),
    ...(layout.length > 8 ? [`  ... and ${layout.length - 8} more`] : []),
    'Run the scan (about two minutes; it records a pass for the current working tree):',
    '  node tools/layout-scan.mjs',
    'Fix what it reports (see frontend/e2e/layoutRules.ts and textFit.ts for what each kind means), stage the same files, and commit again.',
    'Staging other changes to layout files after the scan, or editing them, needs a new scan. Do not skip the hook.',
  ].join('\n');
}

/** The most Playwright workers a scan may use: more made the user's PC too slow to work on (their rule). */
export const MAX_WORKERS = 6;

/** The default number of Playwright workers: half the processors (the browser of each worker needs about two), 2 to 6. */
export function defaultWorkers(cpus = availableParallelism()) {
  return Math.max(2, Math.min(MAX_WORKERS, Math.floor(cpus / 2)));
}

/** Splits the command line into the languages wanted, `--check`, the workers, and what goes to Playwright. */
export function parseArgs(argv) {
  const out = { locales: REQUIRED_LOCALES.join(','), check: false, workers: null, extra: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--locales') out.locales = argv[++i] ?? out.locales;
    else if (argv[i] === '--check') out.check = true;
    else if (argv[i] === '--workers' || argv[i].startsWith('--workers=')) {
      const n = Number(argv[i] === '--workers' ? argv[++i] : argv[i].slice('--workers='.length));
      if (Number.isInteger(n) && n > 0) out.workers = Math.min(n, MAX_WORKERS);
    } else out.extra.push(argv[i]);
  }
  return out;
}

async function main(argv) {
  const args = parseArgs(argv);
  const before = treeFingerprint();
  if (args.check) {
    const ok = passed(readPasses(), before);
    console.log(ok ? 'layout-scan: the working tree has a recorded pass' : 'layout-scan: no recorded pass for the working tree; run node tools/layout-scan.mjs');
    return ok ? 0 : 1;
  }
  const env = { ...process.env, LAYOUT_LOCALES: args.locales, E2E_PORT: process.env.E2E_PORT || '5191', E2E_SERVER: 'build' };
  const workers = args.workers ?? defaultWorkers();
  const release = await acquire({ what: `layout-scan (${args.locales})` });
  console.log(`layout-scan: languages ${args.locales}, themes dark and light, port ${env.E2E_PORT}, ${workers} workers`);
  // Playwright's own CLI under node, with no shell between: an argument such as `--grep "a b"` stays one argument.
  const cmd = [join(ROOT, 'frontend', 'node_modules', '@playwright', 'test', 'cli.js'), 'test', '--project=layout', `--workers=${workers}`, ...args.extra];
  const started = Date.now();
  const status = spawnSync(process.execPath, cmd, { cwd: join(ROOT, 'frontend'), env, stdio: 'inherit' }).status ?? 1;
  release();
  console.log(`layout-scan: Playwright took ${Math.round((Date.now() - started) / 1000)} s`);
  if (status !== 0) {
    console.error('layout-scan: FAILED. Each failure lists the faults as "<dark|light|fit> <step>: <kind> <element> "<text>" / <other element>".');
    console.error('  Fix them in the shared place (theme/tokens.css, ui/) where the fault comes from; a place designed to shorten text gets data-truncate-ok.');
    return status;
  }
  const locales = args.locales === 'all' ? ['all', ...REQUIRED_LOCALES] : args.locales.split(',').map((l) => l.trim());
  if (args.extra.length) {
    console.log('layout-scan: passed, but the run was narrowed by extra arguments, so no pass is recorded.');
    return 0;
  }
  if (!REQUIRED_LOCALES.every((l) => locales.includes(l))) {
    console.log(`layout-scan: passed, but without ${REQUIRED_LOCALES.join(' and ')}, so no pass is recorded.`);
    return 0;
  }
  if (treeFingerprint() !== before) {
    console.error('layout-scan: layout files changed while the scan ran; no pass is recorded. Run it again.');
    return 1;
  }
  const file = recordPath();
  mkdirSync(join(file, '..'), { recursive: true });
  const head = git(['rev-parse', 'HEAD'], ROOT).trim();
  writeFileSync(file, JSON.stringify({ passes: withPass(readPasses(file), { fingerprint: before, head, locales, at: new Date().toISOString() }) }, null, 2) + '\n');
  markUsed(join(file, '..'));
  console.log(`layout-scan: passed; recorded for this working tree in ${file}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await main(process.argv.slice(2)));
