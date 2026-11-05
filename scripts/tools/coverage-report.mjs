// One graphical coverage report for the whole repository, built by ReportGenerator (a .NET tool pinned in
// .config/dotnet-tools.json) from what the coverage runs leave in novira-data/work/coverage/:
//   frontend/  the vitest run (`npm run coverage`)
//   e2e/       the Playwright run (`npm run coverage:e2e`)
//   backend/   cargo llvm-cov (`scripts\checks\coverage.bat backend`)
// Each run writes Cobertura XML, whose packages (folders) become the report's groups; an lcov file is the fallback (it
// has no packages, so every file lands in one flat group). It takes the runs that exist (a line counts as covered when any
// run executed it), and writes the HTML report with its
// charts to novira-data/work/coverage/report/index.html. Each run is also kept in coverage/history/, so the report shows
// how the figures moved over the runs. Nothing is measured here; run the coverage first.
//   node scripts/tools/coverage-report.mjs [--open]
// Needs the .NET SDK (`dotnet`); the tool itself is fetched by `dotnet tool restore` on the first run.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The coverage runs: the files they may leave (best first), and the folder their relative source paths start from. */
export const INPUTS = [
  { name: 'frontend unit', files: ['frontend/cobertura-coverage.xml', 'frontend/lcov.info'], sources: 'frontend' },
  { name: 'frontend E2E', files: ['e2e/cobertura-coverage.xml', 'e2e/lcov.info'], sources: 'frontend' },
  { name: 'backend', files: ['backend/cobertura.xml', 'backend/lcov.info'], sources: 'backend' },
];

/** The file to read for each run that left one (`exists` is asked with a path under `coverage`). */
export function pickInputs(coverage, exists) {
  return INPUTS.flatMap((input) => {
    const file = input.files.map((f) => path.join(coverage, f)).find(exists);
    return file ? [{ ...input, file }] : [];
  });
}

/** ReportGenerator's arguments for the given lcov files (absolute paths), one `-name:value` each, as it wants them. */
export function reportArgs({ reports, target, history, sourceDirs, tag }) {
  return [
    `-reports:${reports.join(';')}`,
    `-targetdir:${target}`,
    `-historydir:${history}`,
    `-sourcedirs:${sourceDirs.join(';')}`,
    // Html: the browsable report with its charts; Badges: small pictures of the figures; TextSummary: Summary.txt for a terminal.
    '-reporttypes:Html;Badges;TextSummary',
    // Style sheets, test snapshots and pictures have no coverable lines; they only add empty rows.
    '-filefilters:-*.css;-*__snapshots__*;-*.json;-*.svg;-*.png;-*.webp',
    '-title:novira',
    `-tag:${tag}`,
    '-verbosity:Warning',
  ];
}

function main() {
  // Where the coverage runs of this checkout write (frontend/vitest.config.ts, coverage.bat), also in a worktree.
  const coverage = path.join(REPO, 'novira-data', 'work', 'coverage');
  const found = pickInputs(coverage, existsSync);
  if (!found.length) {
    console.error('coverage-report: no coverage in novira-data/work/coverage/. Run scripts\\checks\\coverage.bat (or npm run coverage in frontend/) first.');
    process.exit(1);
  }
  const dotnet = (args) => spawnSync('dotnet', args, { cwd: REPO, stdio: 'inherit', env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' } });
  if (dotnet(['--version']).status !== 0) {
    console.error('coverage-report: the .NET SDK (dotnet) is not installed; get it from https://dotnet.microsoft.com/download');
    process.exit(1);
  }
  if (dotnet(['tool', 'restore']).status !== 0) process.exit(1);
  const target = path.join(coverage, 'report');
  const history = path.join(coverage, 'history');
  rmSync(target, { recursive: true, force: true });
  mkdirSync(history, { recursive: true });
  let tag = 'local';
  try {
    tag = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
  } catch {
    // Not a Git checkout: the history entry is just "local".
  }
  const args = reportArgs({
    reports: found.map((i) => i.file),
    target,
    history,
    sourceDirs: [...new Set(found.map((i) => path.join(REPO, i.sources)))],
    tag,
  });
  if (dotnet(['tool', 'run', 'reportgenerator', '--', ...args]).status !== 0) process.exit(1);
  const index = path.join(target, 'index.html');
  console.log(`coverage-report: ${found.map((i) => i.name).join(', ')} -> ${index}`);
  if (process.argv.includes('--open')) spawnSync('explorer.exe', [index], { stdio: 'ignore' });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
