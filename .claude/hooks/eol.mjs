// Claude Code PostToolUse hook (Write / Edit / MultiEdit): text files in this repository are LF, and Windows batch files
// (.bat, .cmd) are CRLF (tools/eol.mjs). A file tool can write the other one (a new .bat comes out LF), so the edited
// file is converted right after the edit. Binary files and files outside the repository are left alone. Never fails the
// tool call: any problem is ignored (check:eol and the pre-commit hook still catch what slips through). A file in one of the
// repository's Git worktrees counts as inside the repository.
import { readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { wantedEol, withEol } from '../../tools/eol.mjs';
import { rootHolding, worktreeRoots } from './worktrees.mjs';

const SKIP = /(^|[\\/])(node_modules|target|\.git|dist|test-results)([\\/]|$)/;

export function shouldConvert(file, root) {
  const rel = relative(root, file);
  return rel !== '' && !rel.startsWith('..') && !/^[a-zA-Z]:/.test(rel) && !SKIP.test(rel);
}

function main(input) {
  const file = input?.tool_input?.file_path;
  if (typeof file !== 'string') return;
  const project = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const root = rootHolding(resolve(file), worktreeRoots(project)) ?? project;
  if (!shouldConvert(resolve(file), resolve(root))) return;
  const bytes = readFileSync(file);
  if (bytes.subarray(0, 8000).includes(0)) return; // binary
  const text = bytes.toString('utf8');
  const fixed = withEol(text, wantedEol(file));
  if (fixed !== text) writeFileSync(file, fixed);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
let raw = '';
if (isMain) process.stdin.on('data', (c) => (raw += c));
if (isMain) process.stdin.on('end', () => {
  try {
    main(JSON.parse(raw || '{}'));
  } catch {
    // Ignore: the commit-time checks still apply.
  }
});
