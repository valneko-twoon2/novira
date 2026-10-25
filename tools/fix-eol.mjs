// Puts the repository's line ends on text files in place: LF, and CRLF for .bat and .cmd (tools/eol.mjs).
// Usage: node tools/fix-eol.mjs <file-or-dir>...   (from frontend/: `npm run eol -- <path>`)
// A path is read from the folder the command was typed in, else from the repository root: the checks print paths from
// the root, and `npm run` starts in frontend/. User data, build output and binaries are never rewritten.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wantedEol, withEol } from './eol.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEXT = /\.(ts|tsx|mts|cts|js|mjs|cjs|json|css|html|md|txt|svg|yml|yaml|rs|toml|bat|cmd|lock|sh)$/i;
/** Folders never walked: dependencies, build output, user data and generated files, other repositories. */
const SKIP = new Set(['node_modules', 'dist', '.git', 'test-results', 'playwright-report', 'target', 'novira-data', 'artifacts', '.reference', 'coverage']);

/** The file or folder a command-line path names (see the header), or null. */
export function locate(arg, from = process.env.INIT_CWD || process.cwd(), root = ROOT) {
  for (const base of [from, root]) {
    const p = resolve(base, arg);
    if (existsSync(p)) return p;
  }
  return null;
}

function walk(p, out) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const name of readdirSync(p)) if (!SKIP.has(name)) walk(join(p, name), out);
  } else if (TEXT.test(p)) out.push(p);
}

function main(args) {
  const files = [];
  for (const arg of args) {
    const p = locate(arg);
    if (!p) {
      console.error(`eol: ${arg} does not exist (from ${process.env.INIT_CWD || process.cwd()} or the repository root)`);
      return 1;
    }
    walk(p, files);
  }
  let changed = 0;
  for (const f of files) {
    const bytes = readFileSync(f);
    if (bytes.includes(0)) continue; // binary
    const src = bytes.toString('utf8');
    const fixed = withEol(src, wantedEol(f));
    if (fixed !== src) {
      writeFileSync(f, fixed);
      changed++;
    }
  }
  console.log(`eol: ${changed} of ${files.length} file(s) converted`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
