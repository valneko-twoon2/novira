// Repository-wide checks on the tests themselves (.claude/rules/test-maintenance.md section 3), frontend and backend
// in one place so `npm run check` and CI run them without a Rust build.
//   - `#[ignore]` only in backend `tests/*_live.rs` (live tests that need the network or a real engine).
//   - Every ComfyUI prompt snapshot file is still produced by a test case (frontend `__snapshots__/<builder>/` and
//     backend `src/comfy/__snapshots__/graph/`). A missing file already fails the snapshot test itself; this catches
//     the opposite: a file left behind after its case was renamed or removed.
// Committed `.only` is an ESLint rule (scripts/eslint-test-hygiene.mjs); contract/ fixtures already have their own
// orphan checks (src/backend/contract.test.ts and backend tests/contract/).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const SRC = join(REPO, 'frontend', 'src');
const BACKEND = join(REPO, 'backend');
const GRAPH_SNAPSHOT_TEST = join(BACKEND, 'crates', 'novira-core', 'src', 'comfy', 'graph_snapshots.rs');
const GRAPH_SNAPSHOT_FAMILIES_TEST = join(BACKEND, 'crates', 'novira-core', 'src', 'comfy', 'graph_snapshots_families.rs');
const SKIP_DIRS = new Set(['node_modules', 'target', 'dist', '.git']);

const rel = (p: string) => relative(REPO, p).replace(/\\/g, '/');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function walk(dir: string, keep: (path: string, name: string, isDir: boolean) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP_DIRS.has(name)) return [];
    const p = join(dir, name);
    const isDir = statSync(p).isDirectory();
    const self = keep(p, name, isDir) ? [p] : [];
    return isDir ? [...self, ...walk(p, keep)] : self;
  });
}

const jsonNames = (dir: string) => readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length));

/**
 * The snapshot names a frontend test file writes into `__snapshots__/<folder>/`, or null when a name is built from a
 * value the scan cannot read (then the file must check for orphans itself).
 * Understood forms: a literal path, and a one-argument helper `const snap = (name) => \`./__snapshots__/<folder>/${name}.json\``
 * called with literal names.
 */
function frontendSnapshotNames(source: string, folder: string): string[] | null {
  const prefix = `__snapshots__/${escape(folder)}/`;
  const names = [...source.matchAll(new RegExp(`['"\`]\\./${prefix}([^'"\`$]+)\\.json['"\`]`, 'g'))].map((m) => m[1]!);
  let rest = source;
  for (const helper of source.matchAll(new RegExp(`const (\\w+) = \\((\\w+)[^)]*\\) => \`\\./${prefix}\\$\\{\\2\\}\\.json\``, 'g'))) {
    rest = rest.replace(helper[0], '');
    names.push(...[...source.matchAll(new RegExp(`\\b${helper[1]}\\('([^']+)'\\)`, 'g'))].map((m) => m[1]!));
  }
  return new RegExp(`\`\\./${prefix}[^\`]*\\$\\{`).test(rest) ? null : names;
}

describe('test hygiene', () => {
  it('uses #[ignore] only in backend tests/*_live.rs', () => {
    const rust = walk(BACKEND, (_p, name, isDir) => !isDir && name.endsWith('.rs'));
    const offenders = rust.flatMap((file) => {
      const live = /[\\/]tests[\\/][^\\/]+_live\.rs$/.test(file);
      return readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .map((line, i) => ({ line: line.trim(), at: `${rel(file)}:${i + 1}` }))
        .filter(({ line }) => !live && line.startsWith('#[ignore'))
        .map(({ at }) => at);
    });
    expect(offenders).toEqual([]);
  });

  it('every frontend snapshot file is written by a test case', () => {
    const folders = walk(SRC, (_p, name, isDir) => isDir && name === '__snapshots__').flatMap((snaps) =>
      readdirSync(snaps).map((folder) => join(snaps, folder)).filter((p) => statSync(p).isDirectory()),
    );
    expect(folders.length).toBeGreaterThan(0);
    const orphans = folders.flatMap((folder) => {
      const name = basename(folder);
      const owner = dirname(dirname(folder));
      const tests = readdirSync(owner)
        .filter((f) => /\.test\.tsx?$/.test(f))
        .map((f) => readFileSync(join(owner, f), 'utf8'))
        .filter((src) => src.includes(`__snapshots__/${name}/`));
      if (tests.length === 0) return [`${rel(folder)}/ (no test refers to this folder)`];
      const found = tests.map((src) => frontendSnapshotNames(src, name));
      // A test that builds names at run time lists its own cases and checks this folder (`readdirSync`).
      if (found.some((n) => n === null)) {
        return tests.some((src) => src.includes('readdirSync')) ? [] : [`${rel(folder)}/ (names built at run time without an orphan check)`];
      }
      const used = new Set(found.flat());
      return jsonNames(folder).filter((n) => !used.has(n)).map((n) => `${rel(folder)}/${n}.json`);
    });
    expect(orphans).toEqual([]);
  });

  it('every backend graph snapshot file is written by a test case', () => {
    const source = [GRAPH_SNAPSHOT_TEST, GRAPH_SNAPSHOT_FAMILIES_TEST].map((f) => readFileSync(f, 'utf8')).join('\n');
    const calls = [...source.matchAll(/(?<!fn )\b(?:snapshot_built|snapshot_guided|assert_snapshot|snap|controlled|gguf)\(\s*("|\w+)/g)];
    // Names must be string literals so this scan can read them (`case` is snapshot_built or snapshot_guided forwarding its parameter).
    expect(calls.filter((c) => c[1] !== '"' && c[1] !== 'case').map((c) => c[0])).toEqual([]);
    const used = new Set([...source.matchAll(/\b(?:snapshot_built|snapshot_guided|assert_snapshot|snap|controlled|gguf)\(\s*"([^"]+)"/g)].map((m) => m[1]!));
    const folder = join(dirname(GRAPH_SNAPSHOT_TEST), '__snapshots__', 'graph');
    expect(jsonNames(folder).filter((n) => !used.has(n))).toEqual([]);
  });
});
