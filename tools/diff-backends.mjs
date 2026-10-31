// The differential test of the two backends the screens can talk to: the browser mock (frontend/src/backend/mock/), which
// every end-to-end test runs on, and the real Rust backend, reached through novira-server as the browser reaches it. The
// same calls go to both and their answers are compared (frontend/difftest/). A difference means the mock no longer
// behaves like the app, so a screen flow the end-to-end tests pass can still fail in the app.
// It starts novira-server (built when missing, tools/server-run.mjs) on an empty data folder in novira-data/work/ with
// no engine, runs the comparison and stops the server; the data folder is deleted. Nothing uses the GPU or the network.
// Usage, from the repository root:  node tools/diff-backends.mjs [--build]   (--build rebuilds the server first)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { harnessRoots } from './harness-paths.mjs';
import { ensureBuilt, startServer } from './server-run.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const build = process.argv.includes('--build');
  const unknown = process.argv.slice(2).find((a) => a !== '--build');
  if (unknown) throw new Error(`unknown option ${unknown}`);
  ensureBuilt({ build });
  const data = path.join(harnessRoots(REPO).work, 'diff-backends');
  fs.rmSync(data, { recursive: true, force: true });
  fs.mkdirSync(data, { recursive: true });
  const server = await startServer({ data, engine: false });
  let status = 1;
  try {
    const frontend = path.join(REPO, 'frontend');
    const vitest = path.join(frontend, 'node_modules', 'vitest', 'vitest.mjs');
    const run = spawnSync(process.execPath, [vitest, 'run', '--config', 'vitest.difftest.config.ts'], {
      cwd: frontend,
      env: { ...process.env, NOVIRA_DIFF_ORIGIN: server.origin, NOVIRA_DIFF_TOKEN: server.token },
      stdio: 'inherit',
    });
    status = run.status ?? 1;
  } finally {
    await server.stop();
    fs.rmSync(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }
  return status;
}

main().then(
  (code) => (process.exitCode = code),
  (e) => {
    console.error(`[diff-backends] ${e.message}`);
    process.exitCode = 1;
  },
);
