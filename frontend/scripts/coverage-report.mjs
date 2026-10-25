// Turns the browser coverage recorded by the end-to-end tests (E2E_COVERAGE=1, novira-data/work/coverage/e2e-raw/*.json) into a report,
// and adds it to the unit-test coverage: `node scripts/coverage-report.mjs`. Both are mapped back to src/ through source maps.
// The combined figure counts a line as covered when either run executed it; statements and branches cannot be merged
// that way (the two tools split them differently), so only lines are combined.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve } from 'node:path';
import { CoverageReport } from 'monocart-coverage-reports';

const FRONTEND = fileURLToPath(new URL('..', import.meta.url));
const OUT = resolve(FRONTEND, '..', 'novira-data', 'work', 'coverage');
const RAW = join(OUT, 'e2e-raw');
const E2E_DIR = join(OUT, 'e2e');
const UNIT_LCOV = join(OUT, 'frontend', 'lcov.info');

if (!existsSync(RAW)) {
  console.error('No E2E coverage found. Run: npm run coverage:e2e');
  process.exit(1);
}

const report = new CoverageReport({
  name: 'novira E2E coverage',
  outputDir: E2E_DIR,
  reports: [['lcovonly'], ['console-summary'], ['html']],
  entryFilter: (entry) => entry.url.includes('/src/'),
  sourceFilter: (path) => /src\/.+\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path),
  sourcePath: (path) => path.replace(/^.*?(?=src\/)/, ''),
});
/** Vite's inline source maps name a module by its file name only; name it by its path under src/ so the files can be told apart. */
function namedBySrcPath(entry) {
  const marker = '//# sourceMappingURL=data:application/json;base64,';
  const at = entry.source?.lastIndexOf(marker) ?? -1;
  if (at < 0) return entry;
  const map = JSON.parse(Buffer.from(entry.source.slice(at + marker.length).trim(), 'base64').toString('utf8'));
  map.sources = [new URL(entry.url).pathname];
  return { ...entry, source: entry.source.slice(0, at) + marker + Buffer.from(JSON.stringify(map)).toString('base64') };
}
for (const file of readdirSync(RAW)) {
  const entries = JSON.parse(readFileSync(join(RAW, file), 'utf8'));
  // A test that never loaded the app (a timeout, a test without a page) leaves `[]`, which the report tool rejects.
  if (entries.length > 0) await report.add(entries.map(namedBySrcPath));
}
await report.generate();

/** `path -> Map(line -> hits)` of an lcov file, with paths relative to frontend/ and `/` separators. */
function parseLcov(path) {
  const files = new Map();
  let lines = null;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (raw.startsWith('SF:')) {
      const file = relative(FRONTEND, resolve(FRONTEND, raw.slice(3))).replaceAll('\\', '/');
      lines = files.get(file) ?? new Map();
      files.set(file, lines);
    } else if (raw.startsWith('DA:') && lines) {
      const [n, hits] = raw.slice(3).split(',').map(Number);
      lines.set(n, Math.max(lines.get(n) ?? 0, hits));
    }
  }
  return files;
}

const e2e = parseLcov(join(E2E_DIR, 'lcov.info'));
const unit = existsSync(UNIT_LCOV) ? parseLcov(UNIT_LCOV) : new Map();
const all = new Set([...e2e.keys(), ...unit.keys()]);
const count = (maps) => {
  let total = 0;
  let hit = 0;
  for (const file of all) {
    if (!file.startsWith('src/') || /\.test\.tsx?$|\.d\.ts$/.test(file)) continue;
    const lines = new Set(maps.flatMap((m) => [...(m.get(file)?.keys() ?? [])]));
    for (const n of lines) {
      total++;
      if (maps.some((m) => (m.get(file)?.get(n) ?? 0) > 0)) hit++;
    }
  }
  return { total, hit, pct: total ? ((hit / total) * 100).toFixed(2) : '0' };
};
const rows = { 'unit (vitest)': count([unit]), 'E2E (Playwright)': count([e2e]), 'combined': count([unit, e2e]) };
const text = Object.entries(rows).map(([k, v]) => `${k.padEnd(18)} lines ${v.pct}% (${v.hit}/${v.total})`).join('\n');
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'combined-summary.txt'), `${text}\n`);
console.log(`\n${text}`);
