// What the harness needs to know about the processes of this machine and its tools, written once: the running processes
// (to find and stop the verification ComfyUI, to see whether the verification app runs, to read a process tree), stopping
// them, whether one is alive, and where cargo is. Windows lists processes through one PowerShell call that returns JSON;
// nothing of the caller is put into that script, so a folder name never becomes part of a command or a wildcard.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** `{ pid, ppid, name, path, cmd }` from the JSON of Win32_Process (one object when only one process matched). */
export function parseProcessJson(out) {
  const raw = out.trim() ? JSON.parse(out) : [];
  return (Array.isArray(raw) ? raw : [raw]).map((p) => ({
    pid: p.ProcessId,
    ppid: p.ParentProcessId,
    name: p.Name ?? '',
    path: p.ExecutablePath ?? '',
    cmd: (p.CommandLine ?? '').replace(/[\r\n]+/g, ' '),
  }));
}

/** Every running process (see parseProcessJson), or null when they cannot be listed (not Windows, or PowerShell failed). */
export function listProcesses({ timeout = 20000 } = {}) {
  if (process.platform !== 'win32') return null;
  try {
    const script = 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,CommandLine | ConvertTo-Json -Compress';
    return parseProcessJson(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout, maxBuffer: 64 * 1024 * 1024 }));
  } catch {
    return null;
  }
}

/** The python processes whose command line holds every one of `needles` (letter case ignored). */
export function pythonsWith(list, ...needles) {
  const wanted = needles.map((n) => n.toLowerCase());
  return (list ?? []).filter((p) => /^python(w)?\.exe$/i.test(p.name) && wanted.every((n) => p.cmd.toLowerCase().includes(n)));
}

/** Stops processes and their children (taskkill /T /F); returns the ids it stopped. */
export function stopTrees(pids) {
  const stopped = [];
  for (const pid of pids) {
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      stopped.push(pid);
    } catch {
      // Already gone.
    }
  }
  return stopped;
}

/** Whether a process with this id exists. */
export function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

/** `cargo` of the rustup install in the user's profile (a shell started by Git may not have it on PATH), else from PATH. */
export function cargoCommand(home = os.homedir()) {
  const installed = path.join(home, '.cargo', 'bin', 'cargo.exe');
  return existsSync(installed) ? installed : 'cargo';
}

/** Whether `child` is inside `parent` (and not `parent` itself). */
export function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** Whether two paths name the same file, letter case ignored as on Windows. */
export function sameFile(a, b) {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

/** The folder the verification exe is built into: NOVIRA_VERIFY_TARGET, else <temp>/novira-verify (outside the repository). */
export function verifyTarget(env = process.env) {
  return path.resolve(env.NOVIRA_VERIFY_TARGET || path.join(os.tmpdir(), 'novira-verify'));
}
