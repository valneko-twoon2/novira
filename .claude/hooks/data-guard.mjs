// Claude Code hook: the harness writes only under novira-data/work/ (AGENTS.md). The rest of novira-data/ is the user's:
// their database, pictures, settings and the model folder that checks share read-only. Two layers:
//   pre   (PreToolUse, Write / Edit / MultiEdit / NotebookEdit / Bash / PowerShell): refuses an edit of a file there, and a
//         shell command that names a path there together with something that writes, moves or deletes.
//   post  (PostToolUse, Bash / PowerShell): a script can write anywhere without naming the path on the command line, so the
//         entries of novira-data/ and every file under novira-data/models/ are listed before a shell command and compared
//         after it; what appeared is reported back (exit 2) so the agent moves it to novira-data/work/ at once.
// Paths resolve against the main checkout (a worktree has no novira-data/ of its own; tools/harness-paths.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { harnessRoots } from '../../tools/harness-paths.mjs';

/** Whether `file` is in `dataDir` but not in its work/ folder. Case and slashes do not matter (Windows). */
export function isProtected(file, dataDir) {
  const norm = (p) => path.resolve(p).replaceAll('\\', '/').toLowerCase();
  const f = norm(file);
  const d = norm(dataDir);
  if (f !== d && !f.startsWith(`${d}/`)) return false;
  return f !== `${d}/work` && !f.startsWith(`${d}/work/`);
}

// Verbs and calls that change what a path they name holds (write, move, delete, create): with any protected path in the
// command, it is refused. Copies are judged by their last path (the target) instead, redirects by what follows `>`.
const CHANGES =
  /\b(?:mv|rm|rmdir|del|erase|touch|mkdir|tee|ln|move|ren|rename|Move-Item|Remove-Item|Rename-Item|New-Item|Set-Content|Add-Content|Out-File|Clear-Content)\b|\bsed\s+-i|writeFile|appendFile|renameSync|rmSync|unlink|mkdirSync|createWriteStream|\.write_(?:text|bytes)\(|shutil\.(?:move|rmtree)|os\.(?:remove|rename|replace|makedirs|mkdir|unlink)|open\([^)]*['"][wax]b?\+?['"]/;
const COPIES = /\b(?:cp|copy|robocopy|xcopy|Copy-Item|copyFile(?:Sync)?|shutil\.copy\w*)\b/;
const REDIRECT = /(?<![<>=\d&|-])>{1,2}(?!&)\s*["']?([^\s"';|&)]+)/g;

/** Every path-like word of `text` that names a folder called novira-data, with the rest of it (to the next space or quote). */
export function dataPaths(text) {
  return [...text.matchAll(/(?:[A-Za-z]:)?[^\s"'`=(,]*novira-data(?:[\\/][^\s"'`;|&),]*)?/gi)].map((m) => m[0]);
}

/**
 * Whether a shell command writes into the protected part of the data folder: a redirect into it, a copy whose target (its
 * last path) is in it, or any other change (move, delete, create, inline write call) to a command that names a path in it.
 * Reading from it, and copying from it into work/, are allowed. Relative names resolve against `cwd`.
 */
export function shellWritesProtected(command, dataDir, cwd) {
  if (typeof command !== 'string') return false;
  const guarded = (p) => isProtected(path.resolve(cwd, p), dataDir);
  for (const m of command.matchAll(REDIRECT)) if (/novira-data/i.test(m[1]) && guarded(m[1])) return true;
  const named = dataPaths(command);
  if (!named.some(guarded)) return false;
  if (CHANGES.test(command)) return true;
  // A copy's target is the last word of its own part of the command (between `;`, `&&`, `|` and line breaks).
  return command
    .split(/;|&&|\|\||\||\r?\n/)
    .filter((part) => COPIES.test(part))
    .some((part) => {
      const last = part.trim().split(/\s+/).pop()?.replace(/^["']|["']$/g, '') ?? '';
      return /novira-data/i.test(last) && guarded(last);
    });
}

const SKIP_NAMES = /\.(?:part|resume)$|^\.complete$/i;

/** The entries of `dataDir` (top level) and every file under its models/ folder, as paths relative to `dataDir`. */
export function listProtected(dataDir) {
  const out = [];
  let top = [];
  try {
    top = fs.readdirSync(dataDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of top) if (e.name !== 'work') out.push(e.name);
  const walk = (rel) => {
    let entries = [];
    try {
      entries = fs.readdirSync(path.join(dataDir, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(child);
      else if (!SKIP_NAMES.test(e.name)) out.push(child);
    }
  };
  walk('models');
  return out;
}

/** What is in `after` and not in `before`. */
export function appeared(before, after) {
  const had = new Set(before);
  return after.filter((p) => !had.has(p));
}

const SHELLS = new Set(['Bash', 'PowerShell']);

function snapshotFile(work, input) {
  const key = String(input.tool_use_id || input.agent_id || input.session_id || 'session').replace(/[^\w-]/g, '_');
  return path.join(work, '.data-guard', `${key}.json`);
}

function refuse(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
}

export function run(mode, input, roots = harnessRoots()) {
  const dataDir = path.dirname(roots.work);
  const tool = input.tool_name;
  const args = input.tool_input ?? {};
  if (mode === 'pre' && !SHELLS.has(tool)) {
    const file = args.file_path ?? args.notebook_path;
    if (file && isProtected(file, dataDir)) {
      refuse(`AGENTS.md: the harness writes only under novira-data/work/. ${file} is the user's data; write it under ${roots.work} instead.`);
    }
    return;
  }
  if (!SHELLS.has(tool)) return;
  const snap = snapshotFile(roots.work, input);
  if (mode === 'pre') {
    if (shellWritesProtected(args.command, dataDir, input.cwd || process.cwd())) {
      refuse(
        `AGENTS.md: this command writes, moves or deletes inside novira-data/ outside work/ (the user's data and the shared models, read-only for the harness). Put outputs under ${roots.work}; copy from the user's data into work/ only.`,
      );
      return;
    }
    fs.mkdirSync(path.dirname(snap), { recursive: true });
    // A command that was refused or interrupted never reaches `post`; its list is dropped after a day.
    for (const name of fs.readdirSync(path.dirname(snap))) {
      const old = path.join(path.dirname(snap), name);
      if (Date.now() - fs.statSync(old).mtimeMs > 86_400_000) fs.rmSync(old, { force: true });
    }
    fs.writeFileSync(snap, JSON.stringify(listProtected(dataDir)));
    return;
  }
  let before;
  try {
    before = JSON.parse(fs.readFileSync(snap, 'utf8'));
  } catch {
    return;
  }
  fs.rmSync(snap, { force: true });
  const fresh = appeared(before, listProtected(dataDir));
  if (!fresh.length) return;
  refuse(
    [
      `AGENTS.md: these appeared in novira-data/ outside work/ while your command ran. If your command made them, move them under ${roots.work} now and say so in your report; if the user's app made them (a model install), leave them:`,
      ...fresh.slice(0, 20).map((p) => `  ${path.join(dataDir, p)}`),
    ].join('\n'),
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  let raw = '';
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    try {
      run(process.argv[2], JSON.parse(raw || '{}'));
    } catch {
      // A broken guard must not stop the work; the pre-commit hook still refuses staged novira-data/.
    }
  });
}
