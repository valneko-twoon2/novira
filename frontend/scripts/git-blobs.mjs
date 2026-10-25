// Reads many versions of files from Git in one process (`git cat-file --batch`) instead of one `git show` each: the
// pre-commit checks read every language's catalog at HEAD and in the index, and a process per file cost seconds on a
// commit that touches every area.
import { execFileSync } from 'node:child_process';

/**
 * The parts of `git cat-file --batch` output, one per spec in order: the content as a Buffer, or null for a spec Git does
 * not have (`<spec> missing`, such as `HEAD:<path>` of a file added in this commit).
 */
export function parseBatch(raw, count) {
  const out = [];
  let at = 0;
  for (let i = 0; i < count; i++) {
    const end = raw.indexOf(10, at);
    if (end < 0) throw new Error('git cat-file --batch: the output ended early');
    const header = raw.subarray(at, end).toString('utf8');
    if (/ (missing|ambiguous)$/.test(header)) {
      out.push(null);
      at = end + 1;
      continue;
    }
    const size = Number(header.split(' ')[2]);
    out.push(raw.subarray(end + 1, end + 1 + size));
    at = end + 1 + size + 1;
  }
  return out;
}

/** The texts of `specs` (`HEAD:<path>`, `:<path>` for the index): a Map from spec to its UTF-8 text, or null when Git has none. */
export function readBlobs(specs, cwd = process.cwd()) {
  if (!specs.length) return new Map();
  const raw = execFileSync('git', ['cat-file', '--batch'], { cwd, input: specs.join('\n') + '\n', maxBuffer: 256 * 1024 * 1024 });
  const parts = parseBatch(raw, specs.length);
  return new Map(specs.map((spec, i) => [spec, parts[i] === null ? null : parts[i].toString('utf8')]));
}
