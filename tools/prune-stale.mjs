// Deletes stale harness output. Everything the harness generates (verification data, reports, builds, scratch scripts and
// pictures) lives directly inside <repo>/novira-data/work/; an entry that has not been used for longer than its limit is
// deleted by default (docs/architecture/tooling.md, "Stale output"). The age is measured from the `.last-used` marker file
// inside the entry (the harness writes it each time it uses the entry; `markUsed`), or, without a marker, from the newest
// top-level modification time of the entry.
//   node tools/prune-stale.mjs [--dry-run] [--quiet]
//     --dry-run  list what would be deleted, delete nothing
//     --quiet    print only the deletions (the Stop hook uses it)
// Safety: it only deletes entries directly inside <repo>/novira-data/work/ and refuses to run for any other root; it never
// follows a symlink or junction (an entry that is a link, or has one in its first levels, is skipped and reported); it
// skips what is in use (a data folder whose `novira.lock` cannot be shown free, anything a running process names on its
// command line) and deletes nothing while a verification `novira.exe` is running. When unsure, it keeps.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mainCheckout } from './harness-paths.mjs';
import { listProcesses, verifyTarget } from './harness-process.mjs';

export { verifyTarget };

export const MARKER = '.last-used';
const DAY = 24 * 60 * 60 * 1000;

/** The age limits, first match wins. Anything that matches no earlier row is short-lived scratch (logs, pictures, one-off scripts, `live*`, other `verify-*`). */
export const POLICY = [
  { kind: 'standing environment', names: /^(verify-data|verify-webview|comfy-copy|perf-data)$/, days: 30 },
  { kind: 'heavy cache', names: /^(check-target|perf-target|server-target|tsc)$/, days: 14 },
  { kind: 'records and baselines', names: /^(perf|layout-scan)$/, days: 14 },
  { kind: 'report or build', names: /^(coverage|mutation|manual|models-sweep|e2e-build)$/, days: 7 },
  { kind: 'scratch', names: /^/, days: 3 },
];

/** The policy row of an entry name. */
export function ruleFor(name) {
  return POLICY.find((row) => row.names.test(name));
}

/** The only folder this script may delete from: <repo>/novira-data/work. */
export function workRoot(repo) {
  return path.join(path.resolve(repo), 'novira-data', 'work');
}

const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

/** Throws unless `root` is exactly <repo>/novira-data/work. */
export function assertRoot(root, repo) {
  if (!root || !same(root, workRoot(repo))) throw new Error(`refusing: ${root} is not ${workRoot(repo)}`);
}

/**
 * The verdict for each entry; pure. An entry is `{ name, usedAt (ms), link (it is, or holds near its top, a symlink or junction), busy (a reason it is in use, or '') }`.
 * Returns `[{ name, action: 'delete' | 'keep' | 'skip', reason, ageDays, limitDays }]`.
 */
export function planPrune(entries, now, { verifyRunning = false } = {}) {
  return entries.map((entry) => {
    const rule = ruleFor(entry.name);
    const ageDays = Math.max(0, (now - entry.usedAt) / DAY);
    const verdict = (action, reason) => ({ name: entry.name, action, reason, ageDays, limitDays: rule.days });
    if (ageDays <= rule.days) return verdict('keep', 'within its limit');
    if (entry.link) return verdict('skip', 'is or contains a link (never followed)');
    if (verifyRunning) return verdict('skip', 'a verification novira.exe is running');
    if (entry.busy) return verdict('skip', entry.busy);
    return verdict('delete', `unused for more than ${rule.days} days (${rule.kind})`);
  });
}

/** Writes the `.last-used` marker into a directory the harness uses now. Never throws. */
export function markUsed(dir, now = Date.now()) {
  try {
    const file = path.join(dir, MARKER);
    fs.writeFileSync(file, new Date(now).toISOString() + '\n');
    fs.utimesSync(file, new Date(now), new Date(now));
  } catch {
    // A marker is a convenience: without it the age falls back to the modification times.
  }
}

/** True when `dir` is a link, or one of its entries down `depth` levels is. A directory that cannot be read counts as a link (unsure: keep). */
export function holdsLink(dir, depth = 3) {
  let items;
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return true;
  }
  for (const item of items) {
    if (item.isSymbolicLink()) return true;
    if (item.isDirectory() && depth > 1 && holdsLink(path.join(dir, item.name), depth - 1)) return true;
  }
  return false;
}

/** The newest top-level modification time of an entry, or the marker's when it has one. */
export function usedAtOf(full, stat) {
  if (!stat.isDirectory()) return stat.mtimeMs;
  try {
    return fs.statSync(path.join(full, MARKER)).mtimeMs;
  } catch {
    let newest = stat.mtimeMs;
    for (const name of fs.readdirSync(full)) {
      try {
        newest = Math.max(newest, fs.lstatSync(path.join(full, name)).mtimeMs);
      } catch {
        // gone meanwhile
      }
    }
    return newest;
  }
}

/** Whether the data folder's `novira.lock` is held by a live process, or cannot be shown free (then true). The app holds an exclusive OS lock, so another handle cannot read the file. */
export function lockHeld(dir) {
  const file = path.join(dir, 'novira.lock');
  if (!fs.existsSync(file)) return false;
  let fd;
  try {
    fd = fs.openSync(file, 'r+');
    fs.readSync(fd, Buffer.alloc(1), 0, 1, 0);
    fs.writeSync(fd, Buffer.alloc(0));
    return false;
  } catch {
    return true;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/** True when a `novira.exe` from the verification target folder is running (`procs`: tools/harness-process.mjs listProcesses). */
export function verifyAppRunning(procs, target = verifyTarget()) {
  const needle = target.toLowerCase();
  return procs.some((p) => /^novira\.exe$/i.test(p.name) && p.path.toLowerCase().startsWith(needle));
}

/** The entry names that some process names on its command line (a ComfyUI from comfy-copy, a WebView2 on verify-webview, ...). */
export function namedByProcesses(procs, root, names) {
  const base = path.resolve(root).toLowerCase();
  const alt = base.replaceAll('\\', '/');
  const text = procs.map((p) => `${p.path} ${p.cmd}`).join('\n').toLowerCase().replaceAll('\\\\', '\\');
  return new Set(names.filter((n) => text.includes(`${base}\\${n.toLowerCase()}`) || text.includes(`${alt}/${n.toLowerCase()}`)));
}

/**
 * Prunes `<repo>/novira-data/work`. Options: `dryRun`, `now`, `log` (one line per verdict worth showing), `processes` (a function returning the
 * processes (tools/harness-process.mjs), or null; default: the real list, asked only when something is old enough to delete). Returns `{ deleted, skipped, kept }`.
 */
export function prune({ repo, root = workRoot(repo), dryRun = false, now = Date.now(), log = () => {}, processes = listProcesses } = {}) {
  assertRoot(root, repo);
  const result = { deleted: [], skipped: [], kept: [] };
  if (!fs.existsSync(root)) return result;
  if (fs.lstatSync(root).isSymbolicLink()) throw new Error(`refusing: ${root} is a link`);
  const entries = fs.readdirSync(root).map((name) => {
    const full = path.join(root, name);
    const stat = fs.lstatSync(full);
    const link = stat.isSymbolicLink() || (stat.isDirectory() && holdsLink(full));
    return { name, full, usedAt: link ? stat.mtimeMs : usedAtOf(full, stat), link, busy: '' };
  });
  const old = planPrune(entries, now).filter((v) => v.action === 'delete');
  let verifyRunning = false;
  if (old.length > 0) {
    const procs = processes();
    if (procs === null) {
      for (const e of entries) e.busy = 'running processes could not be listed';
    } else {
      verifyRunning = verifyAppRunning(procs);
      const named = namedByProcesses(procs, root, entries.map((e) => e.name));
      for (const e of entries) {
        if (named.has(e.name)) e.busy = 'a running process names it';
        else if (fs.statSync(e.full).isDirectory() && lockHeld(e.full)) e.busy = 'its novira.lock is held (or cannot be shown free)';
      }
    }
  }
  for (const verdict of planPrune(entries, now, { verifyRunning })) {
    const full = path.join(root, verdict.name);
    const days = `${verdict.ageDays.toFixed(1)} d / ${verdict.limitDays} d`;
    if (verdict.action === 'keep') result.kept.push(verdict.name);
    else if (verdict.action === 'skip') {
      result.skipped.push(verdict.name);
      log(`skipped ${full} (${days}): ${verdict.reason}`);
    } else if (dryRun) {
      result.deleted.push(verdict.name);
      log(`would delete ${full} (${days}): ${verdict.reason}`);
    } else {
      try {
        fs.rmSync(full, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
        result.deleted.push(verdict.name);
        log(`deleted ${full} (${days}): ${verdict.reason}`);
      } catch (e) {
        result.skipped.push(verdict.name);
        log(`skipped ${full}: could not delete (${String(e.message).split('\n')[0]})`);
      }
    }
  }
  return result;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => a !== '--dry-run' && a !== '--quiet');
  if (unknown.length > 0) {
    console.error('usage: node tools/prune-stale.mjs [--dry-run] [--quiet]');
    process.exitCode = 2;
  } else {
    // From a worktree too, the harness folder is the main checkout's.
    const repo = mainCheckout(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
    const quiet = args.includes('--quiet');
    try {
      const done = prune({ repo, dryRun: args.includes('--dry-run'), log: (m) => (quiet && !/^(deleted|would delete)/.test(m) ? undefined : console.log(`[prune-stale] ${m}`)) });
      if (!quiet) console.log(`[prune-stale] ${done.deleted.length} ${args.includes('--dry-run') ? 'to delete' : 'deleted'}, ${done.skipped.length} skipped, ${done.kept.length} kept`);
    } catch (e) {
      console.error(`[prune-stale] ${e.message}`);
      process.exitCode = 1;
    }
  }
}
