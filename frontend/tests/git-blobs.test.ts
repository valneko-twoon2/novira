// Reading many file versions in one git process (frontend/scripts/git-blobs.mjs), as the pre-commit checks of the
// languages and the terminology do: contents in order, and nothing for a version Git does not have.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { parseBatch, readBlobs } from '../scripts/git-blobs.mjs';

describe('git cat-file --batch output', () => {
  it('gives each content in order, a missing spec as null, and survives a newline inside a content', () => {
    const raw = Buffer.from('aaa blob 3\n{}\n\nHEAD:new.json missing\nbbb blob 5\na\nbé\n', 'utf8');
    const parts = parseBatch(raw, 3).map((p: Buffer | null) => (p === null ? null : p.toString('utf8')));
    expect(parts).toEqual(['{}\n', null, 'a\nbé']);
  });

  it('stops on output that ends early instead of reading past it', () => {
    expect(() => parseBatch(Buffer.from('aaa blob 3\n{}\n\n'), 2)).toThrow(/ended early/);
  });

  it('reads this repository: a tracked file at HEAD, and null for one that does not exist', () => {
    const blobs = readBlobs(['HEAD:AGENTS.md', 'HEAD:no/such/file.json']);
    expect(blobs.get('HEAD:AGENTS.md')).toContain('novira');
    expect(blobs.get('HEAD:no/such/file.json')).toBeNull();
    expect(readBlobs([]).size).toBe(0);
  });
});
