// The product is "novira", never "Novira" (tools/check-name.mjs, run by the pre-commit hook and here over every tracked file).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- a plain .mjs tool without types
import { findMisspellings, misspelledLines } from '../../tools/check-name.mjs';

describe('the product name', () => {
  it('is found when written with a capital, at the start of a sentence too', () => {
    expect(misspelledLines('Novira is an app\nthe novira app\nand Novira.exe\n# Novira')).toEqual([1, 3, 4]);
  });

  it('allows a code identifier that contains the name, and the lowercase form', () => {
    expect(misspelledLines('Decoded::Novira(id)\nNovira(u64),\nwatermarkNovira\nNOVIRA_DATA_DIR\nnovira-server')).toEqual([]);
  });

  it('is spelled in lowercase in every tracked text file', () => {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    const paths = execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean);
    const found = findMisspellings(paths, (p: string) => readFileSync(`${root}/${p}`));
    expect(found.slice(0, 10)).toEqual([]);
  });
});
