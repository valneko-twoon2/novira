// Fails when a text file in the working tree has the wrong line ends (AGENTS.md: text files are LF; .bat and .cmd are CRLF).
// Usage (from frontend/): `npm run check:eol` for the whole repository, `node tools/check-eol.mjs --staged` for the
// files staged for the next commit (the pre-commit hook).
//
// Scope: the working-tree column of `git ls-files --eol` (Git reads the bytes, so unstaged edits count) for
//   - tracked files, and
//   - untracked files that are not ignored (`--others --exclude-standard`; a new file is checked before `git add`).
// Files Git treats as binary (attribute `-text`, or a NUL byte in the first 8000 bytes) and files without any line end
// are skipped. A file whose attributes ask for `eol=crlf` (.gitattributes: `*.bat`, `*.cmd`) must be CRLF; every other text file must be LF.
// Limits: it reads the working tree, not the staged blob, so with --staged a file staged with the right line ends and then rewritten
// with the wrong ones is reported by its working-tree state.
import { execFileSync } from 'node:child_process';

const staged = process.argv.includes('--staged');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const root = git('rev-parse', '--show-toplevel').trim();
const list = (...args) => git('-C', root, ...args).split('\0').filter(Boolean);

const args = staged ? ['ls-files', '--eol', '-z'] : ['ls-files', '--eol', '-z', '--cached', '--others', '--exclude-standard'];
// With --staged the whole list is read and filtered: every staged path as an argument can exceed Windows' limit.
const only = staged ? new Set(list('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z')) : null;

const problems = [];
for (const line of list(...args)) {
  const tab = line.indexOf('\t');
  const path = line.slice(tab + 1);
  if (only && !only.has(path)) continue;
  const info = /^i\/\S*\s+w\/(\S*)\s+attr\/(.*)$/.exec(line.slice(0, tab).trimEnd());
  if (!info) continue;
  const [, w, attr] = info;
  if (w === '' || w === 'none' || w === '-text' || /(^|\s)-text\b/.test(attr)) continue;
  const want = /(^|\s)eol=crlf\b/.test(attr) ? 'crlf' : 'lf';
  if (w !== want) problems.push(`${w.padEnd(5)} ${path}  (expected ${want})`);
}

if (problems.length > 0) {
  console.error(`Line ends: ${problems.length} file(s) do not have the repository line ends (LF; CRLF for .bat and .cmd). Fix with \`npm run eol -- <path>\` in frontend/:`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`Line ends: OK (${staged ? `${only.size} staged file(s)` : 'tracked and untracked files'}).`);
