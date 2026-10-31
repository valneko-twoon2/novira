// The whole test suite in one run, to be started by hand now and then (there is no CI): what scripts\check.bat runs, plus
// what it leaves out because it is slow: the browser server's tests, the mock compared with the real backend, every
// Playwright project (the screen flows, the phone layout in Chromium and WebKit, the visual regression) and the layout
// scan. Every step runs even when an earlier one failed. The result goes to novira-data/work/full-check/<time>.md (step,
// result, minutes, the last lines of a failed step) and the exit code is 1 when any step failed.
// Nothing here uses the GPU, the network beyond what the tests' fakes serve on loopback, or the user's data folder.
// Usage, from the repository root:  node tools/full-check.mjs [--no-browser] [--list]   (scripts\full-check.bat)
//   --no-browser  skips the Playwright steps and the layout scan
//   --list        prints the steps and runs nothing
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { harnessRoots } from './harness-paths.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_TAIL = 40;

export function parseArgs(argv) {
  const known = new Set(['--no-browser', '--list']);
  const unknown = argv.find((a) => !known.has(a));
  if (unknown) throw new Error(`unknown option ${unknown}`);
  return { browser: !argv.includes('--no-browser'), list: argv.includes('--list') };
}

/** The steps, in order: `{ name, cwd (relative to the repository), command, args }`. */
export function plan({ browser = true } = {}) {
  const steps = [
    { name: 'scripts\\check.bat (frontend check, cargo fmt, clippy, novira-core and novira tests)', cwd: '.', command: 'cmd.exe', args: ['/d', '/c', 'scripts\\check.bat'] },
    { name: 'cargo test novira-server', cwd: 'backend', command: 'cargo', args: ['test', '-p', 'novira-server'] },
    { name: 'the mock against the real backend (tools/diff-backends.mjs)', cwd: '.', command: process.execPath, args: ['tools/diff-backends.mjs'] },
  ];
  if (browser) {
    steps.push(
      {
        name: 'Playwright: chromium, phone, webkit and visual projects',
        cwd: 'frontend',
        command: process.execPath,
        args: [path.join(REPO, 'tools', 'e2e-lock.mjs'), '--', 'npx', 'playwright', 'test', '--project=chromium', '--project=phone', '--project=webkit', '--project=visual'],
      },
      { name: 'layout scan (ja and en)', cwd: '.', command: process.execPath, args: ['tools/layout-scan.mjs'] },
    );
  }
  return steps;
}

/** The report of a run: one line per step, then the last lines of each failed step. */
export function formatReport(results, startedAt) {
  const failed = results.filter((r) => r.code !== 0);
  const lines = [
    `# Full check, ${startedAt}`,
    '',
    failed.length ? `**${failed.length} of ${results.length} steps failed.**` : `All ${results.length} steps passed.`,
    '',
    '| Step | Result | Minutes |',
    '|---|---|---|',
    ...results.map((r) => `| ${r.name} | ${r.code === 0 ? 'pass' : `FAIL (exit ${r.code})`} | ${(r.ms / 60000).toFixed(1)} |`),
  ];
  for (const r of failed) lines.push('', `## ${r.name}`, '', '```text', ...r.tail, '```');
  return lines.join('\n') + '\n';
}

/** Runs one step with its output shown as it goes; resolves to its exit code and its last lines. */
function run(step) {
  return new Promise((resolve) => {
    const started = Date.now();
    const env = { ...process.env, PATH: `${path.join(process.env.USERPROFILE ?? '', '.cargo', 'bin')}${path.delimiter}${process.env.PATH}` };
    const child = spawn(step.command, step.args, { cwd: path.join(REPO, step.cwd), env, windowsHide: true });
    let tail = [];
    const keep = (chunk) => {
      process.stdout.write(chunk);
      tail = tail.concat(String(chunk).split(/\r?\n/)).slice(-OUTPUT_TAIL);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    child.on('error', (e) => keep(`could not start: ${e.message}\n`));
    child.on('close', (code) => resolve({ name: step.name, code: code ?? 1, ms: Date.now() - started, tail }));
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const steps = plan(opts);
  if (opts.list) {
    for (const s of steps) console.log(`${s.name}: ${s.command === process.execPath ? 'node' : s.command} ${s.args.join(' ')}`);
    return 0;
  }
  const startedAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const results = [];
  for (const step of steps) {
    console.log(`\n[full-check] === ${step.name} ===`);
    results.push(await run(step));
  }
  const dir = path.join(harnessRoots(REPO).work, 'full-check');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${startedAt.replaceAll(':', '')}.md`);
  fs.writeFileSync(file, formatReport(results, startedAt));
  const failed = results.filter((r) => r.code !== 0).length;
  console.log(`\n[full-check] ${failed ? `${failed} of ${results.length} steps failed` : `all ${results.length} steps passed`}; report: ${file}`);
  return failed ? 1 : 0;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => (process.exitCode = code),
    (e) => {
      console.error(`[full-check] ${e.message}`);
      process.exitCode = 1;
    },
  );
}
