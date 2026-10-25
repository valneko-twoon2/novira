// Fails when a text file spells the product name with a capital: it is "novira", also at the start of a sentence or a
// heading (AGENTS.md section 3). Usage: `node tools/check-name.mjs` for every tracked file, `--staged` for the files staged
// for the next commit (the pre-commit hook).
// Allowed: this tool and its test (they write the wrong spelling to look for it), a code identifier that contains the name (`Decoded::Novira`, `Novira(` of that enum, `watermarkNovira`: the
// name is not a word there), and the generated license notices (the names of other projects' texts).
// Limit: it sees the spelling `Novira` only; "NOVIRA" is the environment variables' form and is fine.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SKIP = /^(tools\/check-name\.mjs|frontend\/tests\/product-name\.test\.ts)$|(^|\/)(ossLicenses\.json|THIRD_PARTY_NOTICES\.txt|package-lock\.json|Cargo\.lock)$|\.(png|webp|ico|jpg|jpeg|gif|svg|woff2?|ttf|zip|exe|dll|bin|onnx|pdf|icns)$|__screenshots__\/|node_modules\//;
/** `Novira` as a word, but not the Rust variant `Decoded::Novira` or its pattern `Novira(`. */
const WORD = /(?<!Decoded::)\bNovira\b(?!\()/g;

/** The 1-based line numbers of `text` that spell the name with a capital. */
export function misspelledLines(text) {
  const lines = [];
  text.split('\n').forEach((line, i) => {
    if (new RegExp(WORD.source).test(line)) lines.push(i + 1);
  });
  return lines;
}

/** `[path, line]` of every misspelling in `paths` (binary and skipped files left out). */
export function findMisspellings(paths, read = (p) => readFileSync(p)) {
  const found = [];
  for (const path of paths) {
    if (SKIP.test(path)) continue;
    let bytes;
    try {
      bytes = read(path);
    } catch {
      continue;
    }
    if (bytes.includes(0)) continue;
    for (const line of misspelledLines(bytes.toString('utf8'))) found.push([path, line]);
  }
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const root = git('rev-parse', '--show-toplevel').trim();
  const args = process.argv.includes('--staged')
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']
    : ['ls-files', '-z'];
  const paths = git('-C', root, ...args).split('\0').filter(Boolean);
  const found = findMisspellings(paths, (p) => readFileSync(`${root}/${p}`));
  if (found.length > 0) {
    console.error(`Name: ${found.length} place(s) spell the product name "Novira"; it is always "novira", also at the start of a sentence:`);
    for (const [path, line] of found.slice(0, 40)) console.error(`  ${path}:${line}`);
    if (found.length > 40) console.error(`  ... and ${found.length - 40} more`);
    process.exit(1);
  }
  console.log('Name: OK');
}
