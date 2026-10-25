// The e2e lock: one heavy Playwright run at a time on this machine, across every checkout and session, so each run can
// use many workers without two runs starving each other (which made cases time out together). Like the GPU lock
// (docs/verification.md) it is a directory: `mkdir` takes it, removing it releases it, and a waiter polls while it exists.
// The holder writes `owner.json` into it (process id, what runs, which checkout, when); a lock whose process is gone, or
// that is older than OLD_MS, is taken over, so a crashed run does not block the next one.
//
// Where: NOVIRA_E2E_LOCK, or `e2e-lock/` in the main checkout's novira-data/work/ (tools/harness-paths.mjs), so the
// worktrees share it. tools/layout-scan.mjs takes it itself. Usage for any other run:
//   node tools/e2e-lock.mjs -- npx playwright test --project=chromium     run a command while holding the lock
//   node tools/e2e-lock.mjs --status                                      say who holds it
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { harnessRoots } from './harness-paths.mjs';
import { processAlive } from './harness-process.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** A lock held longer than this is left over from a run that never released it. */
export const OLD_MS = 2 * 60 * 60_000;
/** A lock directory without an owner record for this long was left by a crash between `mkdir` and the write. */
const NO_OWNER_MS = 60_000;

/** The lock directory. */
export function lockPath(env = process.env, repo = ROOT) {
  return env.NOVIRA_E2E_LOCK || join(harnessRoots(repo).work, 'e2e-lock');
}


/**
 * Whether a held lock may be taken over. `owner` is the parsed `owner.json` (null when missing or unreadable), `since` the
 * time (ms) the directory was made.
 */
export function isStale(owner, since, now = Date.now(), alive = processAlive, host = hostname()) {
  if (!owner) return now - since > NO_OWNER_MS;
  const at = Date.parse(owner.at);
  if (!Number.isFinite(at) || now - at > OLD_MS) return true;
  if (owner.host && owner.host !== host) return false;
  return !(Number.isInteger(owner.pid) && alive(owner.pid));
}

function readOwner(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, 'owner.json'), 'utf8'));
  } catch {
    return null;
  }
}

/** One line about the lock's state. */
export function describeLock(dir = lockPath()) {
  let since;
  try {
    since = statSync(dir).mtimeMs;
  } catch {
    return `the e2e lock is free (${dir})`;
  }
  const owner = readOwner(dir);
  if (!owner) return `the e2e lock is held, owner unknown since ${new Date(since).toISOString()} (${dir})`;
  return `the e2e lock is held by ${owner.what} (pid ${owner.pid}, ${owner.checkout}, since ${owner.at})`;
}

/**
 * Takes the lock, waiting while another run holds it (up to `waitMs`). Returns the function that releases it; the lock is
 * also released when this process exits.
 */
/**
 * Removes the stale lock `dir` whose owner record was `owner`. Two waiters may judge it stale at once; the first takes it
 * over and makes a fresh lock, which the second must not remove. So the lock is first renamed to a name of this process
 * (only one rename of a directory wins), and removed only when it is still the lock that was judged; a fresh one moved by
 * mistake is put back.
 */
export function takeOver(dir, owner) {
  const moved = `${dir}.stale-${process.pid}-${Date.now()}`;
  try {
    renameSync(dir, moved);
  } catch {
    return; // Gone or taken meanwhile: the next turn of the loop sees which.
  }
  const now = readOwner(moved);
  if (now?.pid === owner?.pid && now?.at === owner?.at) {
    rmSync(moved, { recursive: true, force: true });
    return;
  }
  try {
    renameSync(moved, dir);
  } catch {
    rmSync(moved, { recursive: true, force: true });
  }
}

export async function acquire({ dir = lockPath(), what = 'an e2e run', waitMs = 60 * 60_000, pollMs = 3000, log = console.log } = {}) {
  const started = Date.now();
  let told = false;
  for (;;) {
    try {
      mkdirSync(join(dir, '..'), { recursive: true });
      mkdirSync(dir);
      writeFileSync(join(dir, 'owner.json'), JSON.stringify({ pid: process.pid, host: hostname(), what, checkout: ROOT, at: new Date().toISOString() }) + '\n');
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    let since = Date.now();
    try {
      since = statSync(dir).mtimeMs;
    } catch {
      continue; // Released meanwhile.
    }
    const owner = readOwner(dir);
    if (isStale(owner, since)) {
      log(`e2e-lock: taking over a stale lock: ${describeLock(dir)}`);
      takeOver(dir, owner);
      continue;
    }
    if (Date.now() - started > waitMs) throw new Error(`e2e-lock: gave up waiting: ${describeLock(dir)}`);
    if (!told) log(`e2e-lock: waiting, ${describeLock(dir)}`);
    told = true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  let held = true;
  const release = () => {
    if (!held) return;
    held = false;
    if (readOwner(dir)?.pid === process.pid) rmSync(dir, { recursive: true, force: true });
  };
  process.once('exit', release);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => process.exit(130));
  return release;
}

/**
 * The command line cmd.exe gets for `cmd` (an npm or npx shim needs cmd.exe on Windows): each argument with a space or a
 * character cmd.exe acts on is put in double quotes, so `a b` stays one argument and `x&y` runs nothing. An argument with a
 * double quote of its own is refused: cmd.exe would end the quoting there.
 */
export function commandLine(cmd) {
  return cmd
    .map((arg) => {
      if (arg.includes('"')) throw new Error(`cannot pass an argument with a double quote through cmd.exe: ${arg}`);
      return arg !== '' && !/[\s&|<>^()%!,;=]/.test(arg) ? arg : `"${arg}"`;
    })
    .join(' ');
}

/** Runs a command with its arguments kept as given (see commandLine); returns its exit status. */
export function runCommand(cmd, opts = {}) {
  const r = process.platform === 'win32' ? spawnSync(commandLine(cmd), { stdio: 'inherit', ...opts, shell: true }) : spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', ...opts });
  return r.status ?? 1;
}

async function main(argv) {
  if (argv[0] === '--status') {
    console.log(describeLock());
    return 0;
  }
  const cmd = argv[0] === '--' ? argv.slice(1) : argv;
  if (!cmd.length) {
    console.error('usage: node tools/e2e-lock.mjs -- <command> [args...] | --status');
    return 2;
  }
  const release = await acquire({ what: cmd.join(' ') });
  try {
    return runCommand(cmd);
  } finally {
    release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await main(process.argv.slice(2)));
