// Checks the folder layout rules of frontend/src that ESLint cannot see (.claude/rules/frontend.md).
// The import rules themselves are the ESLint rule in scripts/eslint-layers.mjs; this file keeps its exception list honest.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LAYER_EXCEPTIONS } from '../scripts/eslint-layers.mjs';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
/** Catch-all folder names the project does not allow: code goes to the layer and feature it belongs to. */
const FORBIDDEN_DIRS = /^(utils?|misc|helpers?)$/i;

function dirs(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? [p, ...dirs(p)] : [];
  });
}

const rel = (p: string) => relative(SRC, p).replace(/\\/g, '/');

/** The modules a file imports, relative to src/ without extension (only `@/` and relative specifiers). */
function importsOf(file: string): string[] {
  const text = readFileSync(join(SRC, file), 'utf8');
  const specs = [...text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map((m) => m[1]!);
  return specs.flatMap((spec) => {
    if (spec.startsWith('@/')) return [spec.slice(2)];
    if (spec.startsWith('.')) return [posix.join(posix.dirname(file), spec)];
    return [];
  }).map((m) => m.replace(/\.(tsx?|json)$/, ''));
}

describe('frontend source layout', () => {
  it('has no catch-all folders (utils, misc, helpers)', () => {
    const bad = dirs(SRC).filter((d) => FORBIDDEN_DIRS.test(d.split(/[\\/]/).pop()!)).map(rel);
    expect(bad).toEqual([]);
  });

  it('every layer exception is still needed', () => {
    const stale = LAYER_EXCEPTIONS.filter(([from, to]) => !existsSync(join(SRC, from)) || !importsOf(from).includes(to));
    expect(stale.map(([from, to]) => `${from} -> ${to}`)).toEqual([]);
  });
});
