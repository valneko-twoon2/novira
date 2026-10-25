// Says whether the GPU is free for a verification run, so nobody has to look before generating (AGENTS.md: never run a
// generation while the user is using the GPU, for example for a game).
//
// Usage (from the repository root): `node tools/gpu-check.mjs` prints what it saw; the exit code is 0 when the GPU
// looks free (or cannot be read), 1 when it is busy. `verify-real-app.mjs` and `models-live.mjs` run it first.
//
// What "busy" means: the mean load of the busiest GPU over a few samples (nvidia-smi, half a second apart) is at or above
// NOVIRA_GPU_BUSY_PERCENT (default 25). A held GPU lock (NOVIRA_GPU_LOCK) is reported but is not "busy": the app and
// the verification runs wait for it themselves. Limits: memory is not judged (the user's ComfyUI keeps a model loaded
// while idle), only NVIDIA GPUs are read, and a game paused at a menu may stay under the threshold.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Load in percent and memory in MiB of each GPU, from one `nvidia-smi` call; null when it cannot be read. */
export function readGpus() {
  const run = spawnSync('nvidia-smi', ['--query-gpu=name,utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'], { encoding: 'utf8' });
  if (run.status !== 0 || !run.stdout) return null;
  return parseGpus(run.stdout);
}

/** Parses `nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits`. */
export function parseGpus(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(',').map((s) => s.trim()))
    .filter((cols) => cols.length === 4 && cols.slice(1).every((c) => /^\d+$/.test(c)))
    .map(([name, load, used, total]) => ({ name, load: Number(load), used: Number(used), total: Number(total) }));
}

/** The verdict over samples (each a list of GPUs): busy when the busiest GPU's mean load reaches the threshold. */
export function judge(samples, threshold = 25) {
  const read = samples.filter((s) => s && s.length);
  if (!read.length) return { busy: false, known: false, load: null, why: 'nvidia-smi could not be read; the GPU was not checked' };
  const gpus = read[0].length;
  let load = 0;
  for (let g = 0; g < gpus; g++) {
    const mean = read.reduce((sum, s) => sum + (s[g]?.load ?? 0), 0) / read.length;
    load = Math.max(load, mean);
  }
  const busy = load >= threshold;
  load = Math.round(load);
  return busy
    ? { busy: true, known: true, load, why: `the GPU is in use (mean load ${load}% over ${read.length} samples, threshold ${threshold}%): the user may be playing or generating` }
    : { busy: false, known: true, load, why: `the GPU looks free (mean load ${load}% over ${read.length} samples)` };
}

/** Who holds the GPU lock directory, if anyone: the app writes `<lock>.owner` (process id and start time). */
export function lockState(lock = process.env.NOVIRA_GPU_LOCK) {
  if (!lock) return 'NOVIRA_GPU_LOCK is not set';
  if (!existsSync(lock)) return `the GPU lock is free (${lock})`;
  const owner = `${lock}.owner`;
  return existsSync(owner) ? `the GPU lock is held by novira (${readFileSync(owner, 'utf8').trim()})` : `the GPU lock is held by another program (${lock})`;
}

/** The busy threshold in percent: NOVIRA_GPU_BUSY_PERCENT when it is a number from 0 to 100 (0: any use counts), else 25. */
export function busyThreshold(value = process.env.NOVIRA_GPU_BUSY_PERCENT) {
  const n = value === undefined || String(value).trim() === "" ? NaN : Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : 25;
}

/** Samples the GPUs and judges them; also returns the lock state. */
export function checkGpu({ samples = 5, gapMs = 500, threshold = busyThreshold() } = {}) {
  const taken = [];
  for (let i = 0; i < samples; i++) {
    if (i) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, gapMs);
    const gpus = readGpus();
    if (!gpus) break;
    taken.push(gpus);
  }
  return { ...judge(taken, threshold), gpus: taken[0] ?? [], lock: lockState() };
}

/** For the scripts that start a GPU run: prints the verdict and returns false when it must not start. */
export function gpuFreeOrExplain(log = console.log) {
  if (process.env.NOVIRA_GPU_CHECK === '0') {
    log('gpu-check: skipped (NOVIRA_GPU_CHECK=0)');
    return true;
  }
  const result = checkGpu();
  log(`gpu-check: ${result.why}; ${result.lock}`);
  if (result.busy) log('gpu-check: not starting. Ask the user, then run again when the GPU is free (NOVIRA_GPU_CHECK=0 skips this check after they agree).');
  return !result.busy;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = checkGpu();
  for (const g of result.gpus) console.log(`${g.name}: load ${g.load}%, memory ${g.used} / ${g.total} MiB`);
  console.log(result.why);
  console.log(result.lock);
  process.exit(result.busy ? 1 : 0);
}

