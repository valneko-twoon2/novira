// Keeps a cargo target folder's dev builds (`<target>/debug`) from growing without end. Cargo never deletes what it built
// before: every change of a dependency, a flag or the toolchain, and every edit of a test, leaves the old copies beside the
// new ones (backend/target reached 117 GB on 2026-11-02). Once a day, before the Rust checks build, this measures
// `<target>/debug` and, past the limit, runs `cargo clean --profile dev` (cargo's own lock makes it wait for a build going
// on). The next build is a full one. It does nothing while a program from that target folder runs (the person's
// novira.exe started by scripts\start.bat, a test), since Windows would refuse to delete it halfway.
//   node scripts/tools/prune-target.mjs [--target <folder>] [--force] [--dry-run]
//     --target   the cargo target folder (default: backend/target of this checkout)
//     --force    measure now, not only once a day
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cargoCommand, isInside, listProcesses } from './harness-process.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GB = 1024 ** 3;
export const LIMIT_BYTES = 50 * GB;
export const EVERY_MS = 24 * 60 * 60 * 1000;
export const STAMP = '.novira-size-checked';

/** What to do; pure. `checkedAt` is the last measurement (ms, or null), `size` the bytes of <target>/debug (null when not measured), `busy` a reason or ''. */
export function planTargetPrune({ now, checkedAt, size, busy, limit = LIMIT_BYTES, force = false }) {
  if (!force && checkedAt !== null && now - checkedAt < EVERY_MS) return { action: 'wait', reason: 'measured less than a day ago' };
  if (size === null) return { action: 'measure', reason: 'due' };
  if (size <= limit) return { action: 'keep', reason: `${(size / GB).toFixed(1)} GB is within ${(limit / GB).toFixed(0)} GB` };
  if (busy) return { action: 'skip', reason: busy };
  return { action: 'clean', reason: `${(size / GB).toFixed(1)} GB is over ${(limit / GB).toFixed(0)} GB` };
}

/** The bytes of the files under `dir`; links are not followed. */
export function folderSize(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    let items;
    try {
      items = fs.readdirSync(stack.pop(), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const item of items) {
      const full = path.join(item.parentPath ?? item.path, item.name);
      if (item.isSymbolicLink()) continue;
      if (item.isDirectory()) stack.push(full);
      else {
        try {
          total += fs.statSync(full).size;
        } catch {
          // gone meanwhile
        }
      }
    }
  }
  return total;
}

/** A reason the target folder is in use (a running program from inside it), or ''. `procs`: harness-process.mjs listProcesses, or null. */
export function targetBusy(procs, target) {
  if (procs === null) return 'running processes could not be listed';
  const running = procs.find((p) => p.path && isInside(p.path, target));
  return running ? `${running.name} (pid ${running.pid}) runs from it` : '';
}

function readStamp(target) {
  try {
    return fs.statSync(path.join(target, STAMP)).mtimeMs;
  } catch {
    return null;
  }
}

/** Prunes `<target>/debug` when due; never throws. Returns the verdict. */
export function pruneTarget({ target = path.join(REPO, 'backend', 'target'), force = false, dryRun = false, now = Date.now(), log = () => {} } = {}) {
  try {
    const debug = path.join(target, 'debug');
    if (!fs.existsSync(debug)) return { action: 'keep', reason: 'no dev build' };
    let verdict = planTargetPrune({ now, checkedAt: readStamp(target), size: null, busy: '', force });
    if (verdict.action === 'wait') return verdict;
    const size = folderSize(debug);
    if (!dryRun) fs.writeFileSync(path.join(target, STAMP), `${new Date(now).toISOString()} ${size}\n`);
    verdict = planTargetPrune({ now, checkedAt: null, size, busy: size > LIMIT_BYTES ? targetBusy(listProcesses(), target) : '', force: true });
    if (verdict.action === 'clean' && !dryRun) {
      log(`cleaning ${debug}: ${verdict.reason}`);
      const r = spawnSync(cargoCommand(), ['clean', '--profile', 'dev', '--target-dir', target], { cwd: path.join(REPO, 'backend'), stdio: 'inherit' });
      if (r.status !== 0) return { action: 'skip', reason: `cargo clean failed (exit ${r.status ?? r.error?.message})` };
    } else log(`${verdict.action} ${debug}: ${verdict.reason}`);
    return verdict;
  } catch (e) {
    return { action: 'skip', reason: e.message };
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--target');
  const unknown = args.filter((a, i) => !['--force', '--dry-run', '--target'].includes(a) && !(at >= 0 && i === at + 1));
  if (unknown.length || (at >= 0 && !args[at + 1])) {
    console.error('usage: node scripts/tools/prune-target.mjs [--target <folder>] [--force] [--dry-run]');
    process.exitCode = 2;
  } else {
    const target = at >= 0 ? path.resolve(args[at + 1]) : undefined;
    pruneTarget({ target, force: args.includes('--force'), dryRun: args.includes('--dry-run'), log: (m) => console.log(`[prune-target] ${m}`) });
  }
}
