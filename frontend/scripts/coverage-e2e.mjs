// Runs the Playwright tests with browser coverage recording on, then builds the report (scripts/coverage-report.mjs).
// Run `npm run coverage` first when the combined (unit + E2E) figure is wanted.
// It is a heavy run, so it holds the e2e lock (tools/e2e-lock.mjs) like the other Playwright runs, and starts Playwright's
// own CLI under node, with no shell between.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { acquire } from '../../tools/e2e-lock.mjs';

const frontend = fileURLToPath(new URL('..', import.meta.url));
const raw = fileURLToPath(new URL('../../novira-data/work/coverage/e2e-raw', import.meta.url));
rmSync(raw, { recursive: true, force: true });
const env = { ...process.env, E2E_COVERAGE: '1' };
const run = (args) => spawnSync(process.execPath, args, { cwd: frontend, stdio: 'inherit', env }).status ?? 1;
const release = await acquire({ what: 'e2e coverage' });
let tests;
try {
  tests = run(['node_modules/@playwright/test/cli.js', 'test', '--project=chromium']);
} finally {
  release();
}
const report = run(['scripts/coverage-report.mjs']);
process.exit(tests || report);
