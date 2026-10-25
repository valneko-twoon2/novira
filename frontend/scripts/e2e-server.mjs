// The harness build of the browser app, and its server for the Playwright runs (playwright.config.ts starts it when
// E2E_SERVER is `build`, served by `vite preview`). The dev server compiles every module on demand and answers about a
// thousand requests for each page a test opens, so many workers at once mostly wait for it; a build is a handful of files.
// The same build is what the verification app embeds and the browser server serves (tools/harness-paths.mjs,
// buildHarnessDist): it is minified like the app's, in the harness mode, so it keeps what the app's build leaves out.
//
// The build goes to novira-data/work/e2e-build/<checkout>/ of the main checkout (everything the harness writes lives
// there) and is reused while its inputs are the same: a stamp holds the mode and the hash of every file the build reads
// (src/, public/, index.html, the configs, the lockfile and the license texts the About dialog imports). Unlike the app's
// build (`npm run build` into dist/) it keeps public/ (the mock's pictures). A lock directory beside the build keeps two
// runs of one checkout from writing it at once.
//
// Usage: node scripts/e2e-server.mjs --port <port>     build when stale, then serve until stopped
//        node scripts/e2e-server.mjs --build-only       build when stale, then exit
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire } from '../../tools/e2e-lock.mjs';
import { HARNESS_MODE, harnessDistDir } from '../../tools/harness-paths.mjs';
import { markUsed } from '../../tools/prune-stale.mjs';

const FRONTEND = fileURLToPath(new URL('..', import.meta.url));
const REPO = join(FRONTEND, '..');

/** Folders and files (relative to frontend/) whose content decides the build. */
const INPUTS = ['src', 'public', 'index.html', 'vite.config.ts', 'package.json', 'package-lock.json', 'tsconfig.json', '../NOTICE', '../LICENSE', '../THIRD_PARTY_NOTICES.txt'];

/**
 * Which server a Playwright run opens: `E2E_SERVER` (`build` or `dev`) when set, otherwise the build when the run asks
 * only for the `layout` project and the dev server for the rest. The flows stay on the dev server: `devlog.spec.ts` needs
 * the development defaults, and React's development checks (keys, effects run twice) report to the console, which the
 * `errors` fixture fails on. Browser coverage (`E2E_COVERAGE`) maps the dev server's `/src/` modules, so it is always dev.
 */
export function serverMode(env = process.env, argv = process.argv) {
  if (env.E2E_COVERAGE) return 'dev';
  if (env.E2E_SERVER === 'build' || env.E2E_SERVER === 'dev') return env.E2E_SERVER;
  const projects = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project') projects.push(argv[i + 1] ?? '');
    else if (argv[i].startsWith('--project=')) projects.push(argv[i].slice('--project='.length));
  }
  return projects.length > 0 && projects.every((p) => p === 'layout') ? 'build' : 'dev';
}

/** Every file under `path` (itself when it is a file), sorted. */
function files(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .flatMap((e) => (e.isDirectory() ? files(join(path, e.name)) : [join(path, e.name)]));
}

/** The hash of every input's path and content. */
export function inputsHash(root = FRONTEND, inputs = INPUTS) {
  const hash = createHash('sha256');
  for (const file of inputs.flatMap((p) => files(join(root, p)))) {
    hash.update(relative(root, file).replaceAll('\\', '/'));
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

/** Where this checkout's harness build lives (tools/harness-paths.mjs): one folder per checkout, so two worktrees never share one. */
export function buildDir(repo = REPO) {
  return harnessDistDir(repo);
}

/** The Vite mode of the e2e build: the harness mode (tools/harness-paths.mjs), so every screen of the app is in it. */
const BUILD_MODE = HARNESS_MODE;

/** Builds into `out` unless its stamp matches the inputs. */
async function ensureBuild(out) {
  mkdirSync(join(out, '..'), { recursive: true });
  // The lock of tools/e2e-lock.mjs on its own directory: it records its owner, so a build killed half way is taken over at
  // once instead of blocking the next run, and a waiter says what it waits for.
  const release = await acquire({ dir: `${out}.lock`, what: 'the harness build of the frontend', pollMs: 500, log: (l) => console.log(`e2e-server: ${l}`) });
  try {
    const want = `${BUILD_MODE} ${inputsHash()}`;
    const stamp = join(out, '.e2e-stamp');
    if (existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === want) {
      console.log(`e2e-server: build is current (${out})`);
      return;
    }
    const started = Date.now();
    const { build } = await import('vite');
    await build({ root: FRONTEND, mode: BUILD_MODE, logLevel: 'warn', build: { outDir: out, emptyOutDir: true, copyPublicDir: true } });
    writeFileSync(stamp, want + '\n');
    console.log(`e2e-server: built in ${((Date.now() - started) / 1000).toFixed(1)} s (${out})`);
  } finally {
    release();
    markUsed(join(out, '..'));
  }
}

async function main(argv) {
  const out = buildDir();
  await ensureBuild(out);
  if (argv.includes('--build-only')) return;
  const port = Number(argv[argv.indexOf('--port') + 1]);
  if (!port) throw new Error('e2e-server: --port <port> is required');
  const { preview } = await import('vite');
  await preview({ root: FRONTEND, logLevel: 'warn', build: { outDir: out }, preview: { port, strictPort: true, host: 'localhost' } });
  console.log(`e2e-server: serving ${out} on http://localhost:${port}/`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
