// Runs one job on the real engine without a window (backend/crates/novira-core/tests/models_live.rs; docs/verification.md,
// "Real engine, no window"), with the set-up done for you: the isolated data folder, the GPU check, cargo on PATH.
//
// Usage (from the repository root):
//   node tools/models-live.mjs <part of the model name> [--image <file>] [--out <folder>]
// Other knobs pass through from the shell: NOVIRA_LIVE_STEPS, _CFG, _SIZE, _FRAMES, _PROMPT, _NEGATIVE, _REGION_MASK,
// _REGION_PROMPT, _SEAMLESS (see the test file). NOVIRA_LIVE_DATA (default: NOVIRA_VERIFY_DATA, or novira-data/work/verify-data)
// must hold a settings.json that points at a ComfyUI copy. NOVIRA_GPU_LOCK is passed on; the worker takes the lock itself,
// so do not hold it by hand. It refuses to start while the GPU is in use (tools/gpu-check.mjs).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gpuFreeOrExplain } from './gpu-check.mjs';
import { harnessRoots } from './harness-paths.mjs';
import { cargoCommand } from './harness-process.mjs';
import { markUsed } from './prune-stale.mjs';
import { shareModels } from './verify-real-app.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// The main checkout's harness folder and models, also from a worktree (tools/harness-paths.mjs).
const ROOTS = harnessRoots(ROOT);
const log = (msg) => console.log(`[models-live] ${msg}`);

function main(argv) {
  const value = (flag) => {
    const at = argv.indexOf(flag);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  const flagValues = new Set(['--image', '--out'].map(value).filter(Boolean));
  const model = argv.find((a) => !a.startsWith('--') && !flagValues.has(a));
  if (!model) {
    log('usage: node tools/models-live.mjs <part of the model name> [--image <file>] [--out <folder>]');
    return 2;
  }
  const data = resolve(process.env.NOVIRA_LIVE_DATA || process.env.NOVIRA_VERIFY_DATA || join(ROOTS.work, 'verify-data'));
  if (!data.toLowerCase().startsWith(`${resolve(ROOTS.work).toLowerCase()}${sep}`)) {
    log(`refusing: the data folder must be inside novira-data/work/, never the user's own data (${data})`);
    return 2;
  }
  if (!existsSync(join(data, 'settings.json'))) {
    log(`no settings.json in ${data}: write {"comfyuiDir": "<copy>/ComfyUI"} there first (docs/verification.md)`);
    return 2;
  }
  markUsed(data);
  shareModels({ data }, ROOTS.models);
  if (!process.env.NOVIRA_GPU_LOCK) log('NOVIRA_GPU_LOCK is not set: the job takes no GPU lock');
  if (!gpuFreeOrExplain((m) => log(m.replace(/^gpu-check: /, '')))) return 1;

  const env = {
    ...process.env,
    PATH: `${join(homedir(), '.cargo', 'bin')}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
    NOVIRA_LIVE_DATA: data,
    NOVIRA_LIVE_MODEL: model,
  };
  if (value('--image')) env.NOVIRA_LIVE_IMAGE = resolve(value('--image'));
  if (value('--out')) env.NOVIRA_LIVE_OUT = resolve(value('--out'));
  log(`model "${model}" on ${data}`);
  const run = spawnSync(cargoCommand(), ['test', '-p', 'novira-core', '--test', 'models_live', '--', '--ignored', '--nocapture'], {
    cwd: join(ROOT, 'backend'),
    env,
    stdio: 'inherit',
  });
  return run.status ?? 1;
}

process.exit(main(process.argv.slice(2)));
