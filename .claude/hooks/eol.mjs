// Claude Code PostToolUse hook: text files in this repository are LF, and Windows batch files (.bat, .cmd) are CRLF
// (scripts/tools/eol.mjs). Two modes:
//   edit   (Write / Edit / MultiEdit): a file tool can write the other one (a new .bat comes out LF), so the edited file is
//          converted right after the edit. Binary files and files outside the repository are left alone.
//   shell  (Bash / PowerShell): a command that rewrites files (sed, awk, perl, python, redirects, Set-Content, ...) can leave
//          CRLF behind (PowerShell writes it). After such a command, changed text files with the wrong line ends are listed
//          back to the agent (exit 2 sends stderr to it) so it fixes them with `npm run eol -- <path>` at once. Other commands
//          are not checked, so ordinary calls stay fast.
// A file in one of the repository's Git worktrees counts as inside the repository. Never fails the tool call on its own
// error: check:eol and the pre-commit hook still catch what slips through.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { wantedEol, withEol } from '../../scripts/tools/eol.mjs';
import { rootHolding, worktreeRoots } from './worktrees.mjs';

const GENERATED = /(^|[\\/])(node_modules|target|\.git|dist|test-results)([\\/]|$)/;
const REWRITES = /\b(?:sed|awk|perl|python3?|tee|Set-Content|Out-File|Add-Content|WriteAllText)\b|(?<![<>=\d&|-])>{1,2}(?!&)\s*[^\s&|]|node\s+(?:-e|\S*\.(?:cjs|mjs|js))/;
const SKIP = /(^|\/)(node_modules|target|\.git|dist|test-results|novira-data)\//;
const BINARY = /\.(png|jpe?g|webp|gif|ico|icns|woff2?|ttf|zip|gz|dll|exe|bin|onnx|psd|pdf|mp[34]|wav|webm|svg)$/i;

/** Whether an edited file is one this hook converts: inside the repository, outside generated folders. */
export function shouldConvert(file, root) {
  const rel = relative(root, file);
  return rel !== '' && !rel.startsWith('..') && !/^[a-zA-Z]:/.test(rel) && !GENERATED.test(rel);
}

/** Whether a shell command can rewrite files, so its result is worth listing. */
export function rewritesFiles(command) {
  return typeof command === 'string' && REWRITES.test(command);
}

/** Paths from `git ls-files --eol` whose work tree copy is not LF (CRLF for .bat and .cmd) or is mixed. */
export function badEol(listing) {
  const bad = [];
  for (const line of listing.split(/\r?\n/)) {
    const [info, path] = line.split('\t');
    const work = /\bw\/(\S+)/.exec(info ?? '')?.[1];
    if (path && work && work !== wantedEol(path) && ['lf', 'crlf', 'mixed'].includes(work) && !SKIP.test(path) && !BINARY.test(path)) bad.push(path);
  }
  return bad;
}

function afterEdit(input, project) {
  const file = input?.tool_input?.file_path;
  if (typeof file !== 'string') return;
  const root = rootHolding(resolve(file), worktreeRoots(project)) ?? project;
  if (!shouldConvert(resolve(file), resolve(root))) return;
  const bytes = readFileSync(file);
  if (bytes.subarray(0, 8000).includes(0)) return; // binary
  const text = bytes.toString('utf8');
  const fixed = withEol(text, wantedEol(file));
  if (fixed !== text) writeFileSync(file, fixed);
}

function changedFiles(root) {
  const run = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 15000 });
  // Tracked files that changed, and new files; the whole tree is not listed.
  return [run(['ls-files', '--eol', '--modified']), run(['ls-files', '--eol', '--others', '--exclude-standard'])].join('\n');
}

function afterShell(input, project) {
  if (!rewritesFiles(input?.tool_input?.command)) return;
  // The main checkout and every worktree of it: work done in a worktree is outside CLAUDE_PROJECT_DIR.
  const roots = worktreeRoots(project);
  const bad = roots.flatMap((root, i) => badEol(changedFiles(root)).map((p) => (i === 0 ? p : `${root}/${p}`)));
  if (!bad.length) return;
  process.stderr.write(`AGENTS.md: these files have the wrong line ends (LF, or CRLF for .bat and .cmd). Fix with npm run eol -- <path>:\n${bad.slice(0, 20).join('\n')}\n`);
  process.exitCode = 2;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
let raw = '';
if (isMain) process.stdin.on('data', (c) => (raw += c));
if (isMain) process.stdin.on('end', () => {
  try {
    const project = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const input = JSON.parse(raw || '{}');
    if (process.argv[2] === 'shell') afterShell(input, project);
    else afterEdit(input, project);
  } catch {
    // Ignore: the commit-time checks still apply.
  }
});
