// Claude Code PostToolUse hook (Bash / PowerShell): a shell command that rewrites files (sed, awk, perl, python, redirects,
// Set-Content, ...) can leave CRLF behind (PowerShell writes it), and eol.mjs only sees Write / Edit. After such a command,
// changed text files whose line ends are not the repository's (LF; CRLF for .bat and .cmd) are listed back to the agent
// (exit 2 sends stderr to it) so it fixes them with `npm run eol -- <path>` at once. Other commands are not checked, so
// ordinary calls stay fast.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { wantedEol } from '../../tools/eol.mjs';
import { worktreeRoots } from './worktrees.mjs';

const REWRITES = /\b(?:sed|awk|perl|python3?|tee|Set-Content|Out-File|Add-Content|WriteAllText)\b|(?<![<>=\d&|-])>{1,2}(?!&)\s*[^\s&|]|node\s+(?:-e|\S*\.(?:cjs|mjs|js))/;
const SKIP = /(^|\/)(node_modules|target|\.git|dist|test-results|novira-data)\//;
const BINARY = /\.(png|jpe?g|webp|gif|ico|icns|woff2?|ttf|zip|gz|dll|exe|bin|onnx|psd|pdf|mp[34]|wav|webm|svg)$/i;

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

function listing(root) {
  const run = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 15000 });
  // Tracked files that changed, and new files; the whole tree is not listed.
  return [run(['ls-files', '--eol', '--modified']), run(['ls-files', '--eol', '--others', '--exclude-standard'])].join('\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
let raw = '';
if (isMain) process.stdin.on('data', (c) => (raw += c));
if (isMain) process.stdin.on('end', () => {
  try {
    if (!rewritesFiles(JSON.parse(raw || '{}')?.tool_input?.command)) return;
    // The main checkout and every worktree of it: work done in a worktree is outside CLAUDE_PROJECT_DIR.
    const roots = worktreeRoots(process.env.CLAUDE_PROJECT_DIR || process.cwd());
    const bad = roots.flatMap((root, i) => badEol(listing(root)).map((p) => (i === 0 ? p : `${root}/${p}`)));
    if (!bad.length) return;
    process.stderr.write(`AGENTS.md: these files have the wrong line ends (LF, or CRLF for .bat and .cmd). Fix with npm run eol -- <path>:\n${bad.slice(0, 20).join('\n')}\n`);
    process.exitCode = 2;
  } catch {
    // Never block the work: check:eol and the pre-commit hook still catch what slips through.
  }
});
