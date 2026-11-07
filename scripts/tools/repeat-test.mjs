// Runs one command again and again to find a test that fails now and then (a race, a timing assumption).
//   node scripts/tools/repeat-test.mjs [--times 20] [--parallel [n]] [--no-stop-on-fail] -- <command> [args...]
//   node scripts/tools/repeat-test.mjs --times 20 -- cargo test -p novira-core --test prop_queue_worker
// --times N         how many runs (default 20, at most 1000).
// --parallel [n]    run up to n copies at once (default 4 when no number follows) to put the machine under load.
// --no-stop-on-fail keep going after a failure (by default the first failure ends the series; runs already started finish).
// It prints how many runs passed and failed and the tail of the first failing run, and exits 1 on any failure. The command
// is started without a shell, so name the program itself (`node`, `cargo`), not a `.cmd` wrapper. The full output of the
// first failing run is saved in logs/repeat-test/ (git-ignored); nothing else is written.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const DEFAULT_TIMES = 20;
export const MAX_TIMES = 1000;
const DEFAULT_PARALLEL = 4;
/** The tail of a failing run that is printed, and how much output of one run is kept in memory. */
const TAIL_LINES = 60;
const KEEP_BYTES = 4 * 1024 * 1024;

/** @returns {{times: number, parallel: number, stopOnFail: boolean, command: string[]} | {error: string}} */
export function parseArgs(argv) {
  const out = { times: DEFAULT_TIMES, parallel: 1, stopOnFail: true, command: [] };
  const split = argv.indexOf('--');
  const own = split < 0 ? argv : argv.slice(0, split);
  out.command = split < 0 ? [] : argv.slice(split + 1);
  const whole = (text, name) => (/^\d+$/.test(text ?? '') ? Number(text) : { error: `${name} needs a whole number` });
  for (let i = 0; i < own.length; i++) {
    const arg = own[i];
    if (arg === '--times') {
      const n = whole(own[++i], '--times');
      if (typeof n !== 'number') return n;
      if (n < 1 || n > MAX_TIMES) return { error: `--times must be from 1 to ${MAX_TIMES}` };
      out.times = n;
    } else if (arg === '--parallel') {
      if (/^\d+$/.test(own[i + 1] ?? '')) {
        out.parallel = Number(own[++i]);
        if (out.parallel < 1 || out.parallel > 64) return { error: '--parallel must be from 1 to 64' };
      } else out.parallel = DEFAULT_PARALLEL;
    } else if (arg === '--stop-on-fail') out.stopOnFail = true;
    else if (arg === '--no-stop-on-fail') out.stopOnFail = false;
    else return { error: `unknown option ${arg}` };
  }
  if (out.command.length === 0) return { error: 'give the command after --' };
  return out;
}

/** Runs the command once; resolves with `{ ok, code, output }` (output is the last KEEP_BYTES of stdout and stderr together). */
export function runOnce(command, cwd = process.cwd()) {
  return new Promise((resolve) => {
    let output = '';
    const child = spawn(command[0], command.slice(1), { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: false, windowsHide: true });
    const take = (chunk) => {
      output += chunk.toString('utf8');
      if (output.length > KEEP_BYTES) output = output.slice(-KEEP_BYTES);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', (e) => resolve({ ok: false, code: null, output: `${output}\ncould not start ${command[0]}: ${e.message}\n` }));
    child.on('close', (code) => resolve({ ok: code === 0, code, output }));
  });
}

/**
 * Runs `run(i)` for i in 0..times with at most `parallel` at a time. With `stopOnFail` no run starts after a failure.
 * @returns {Promise<{started: number, passed: number, failed: number, firstFailure: null | {index: number, code: number | null, output: string}}>}
 */
export async function repeat({ times, parallel = 1, stopOnFail = true, run }) {
  const result = { started: 0, passed: 0, failed: 0, firstFailure: null };
  let next = 0;
  const worker = async () => {
    while (next < times && !(stopOnFail && result.failed > 0)) {
      const index = next++;
      result.started++;
      const r = await run(index);
      if (r.ok) result.passed++;
      else {
        result.failed++;
        // The failure with the lowest number is "the first", whatever order the parallel copies finished in.
        if (!result.firstFailure || index < result.firstFailure.index) result.firstFailure = { index, code: r.code, output: r.output };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, times) }, worker));
  return result;
}

export function tail(output, lines = TAIL_LINES) {
  return output.replace(/\s+$/, '').split(/\r?\n/).slice(-lines).join('\n');
}

/** Saves the output of a failing run under logs/repeat-test/ and returns the path. */
export function saveFailure(output, root = ROOT, now = new Date()) {
  const dir = join(root, 'logs', 'repeat-test');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${now.toISOString().replace(/[:.]/g, '-')}-${process.pid}.log`);
  writeFileSync(file, output);
  return file;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if ('error' in args) {
    console.error(`repeat-test: ${args.error}`);
    process.exit(2);
  }
  const label = args.command.join(' ');
  console.log(`repeat-test: ${args.times} runs${args.parallel > 1 ? `, up to ${args.parallel} at once` : ''}: ${label}`);
  const result = await repeat({
    times: args.times,
    parallel: args.parallel,
    stopOnFail: args.stopOnFail,
    run: async (i) => {
      const r = await runOnce(args.command);
      console.log(`  run ${i + 1}: ${r.ok ? 'pass' : `FAIL (exit ${r.code})`}`);
      return r;
    },
  });
  console.log(`repeat-test: ${result.passed} passed, ${result.failed} failed of ${result.started} runs started (${args.times} asked)`);
  if (result.firstFailure) {
    const f = result.firstFailure;
    console.log(`\nfirst failing run: ${f.index + 1} (exit ${f.code}); its last lines:\n${tail(f.output)}`);
    console.log(`\nfull output of that run: ${saveFailure(f.output)}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
