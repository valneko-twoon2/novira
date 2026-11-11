// The links a worktree gets to the main checkout's node_modules (scripts/tools/worktree.mjs): made and recognised without a shell,
// so a path with a shell character in it is never run as a command; and the worktree's name is checked before it names a folder.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { isJunction, linkFolder, mergedByPullRequest, prMergedHeads, validName } from '../../scripts/tools/worktree.mjs';

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const scratch = (name: string) => {
  const dir = mkdtempSync(join(tmpdir(), `${name}-`));
  made.push(dir);
  return dir;
};

describe('worktree names', { tags: [] }, () => {
  it('takes letters, digits, dots, dashes and underscores', { tags: ['equivalence', 'boundary'] }, () => {
    for (const name of ['cand-progress', '20261110_fix', 'v0.5.0', 'a']) expect(validName(name), name).toBe(true);
  });

  it('refuses a name that could leave the folder or be read by a shell', { tags: ['error-guessing'] }, () => {
    for (const name of ['', '..', '../x', 'a/b', 'a\\b', 'x&calc', 'x|y', 'x y', 'x"y', '%PATH%', 'a;b', '.', '-x']) expect(validName(name), name).toBe(false);
  });
});

describe.runIf(process.platform === 'win32')('links to the main checkout (Windows)', { tags: [] }, () => {
  it('makes a junction that shows the target, and tells it from a real folder', { tags: ['scenario', 'error-guessing'] }, () => {
    // A shell character in the path: made through a shell, `&` would start a second command.
    const root = scratch('wt&link');
    const target = join(root, 'target');
    mkdirSync(target);
    writeFileSync(join(target, 'kept.txt'), 'x');
    const link = join(root, 'link');
    linkFolder(target, link);
    expect(isJunction(link)).toBe(true);
    expect(isJunction(target)).toBe(false);
    expect(isJunction(join(root, 'missing'))).toBe(false);
  });
});

describe('branches merged on GitHub', () => {
  const heads = (rows: { headRefName: string; headRefOid: string }[]) => prMergedHeads('.', () => JSON.stringify(rows));
  const never = () => false;

  it('are the head commits of the merged pull requests, by branch (a squash merge is invisible to git)', { tags: ['equivalence'] }, () => {
    const map = heads([{ headRefName: 'fix', headRefOid: 'c1' }, { headRefName: 'fix', headRefOid: 'c2' }, { headRefName: 'feat', headRefOid: 'c3' }]);
    expect([...map]).toEqual([['fix', ['c1', 'c2']], ['feat', ['c3']]]);
  });

  it('are none when gh fails or answers nonsense, so nothing is deleted on a guess', { tags: ['error-guessing'] }, () => {
    expect(prMergedHeads('.', () => {
      throw new Error('gh: not logged in');
    }).size).toBe(0);
    expect(prMergedHeads('.', () => 'not json').size).toBe(0);
  });

  it('count a branch whose tip is the merged head, or behind it', { tags: ['condition'] }, () => {
    const map = heads([{ headRefName: 'fix', headRefOid: 'c2' }]);
    expect(mergedByPullRequest('fix', 'c2', map, never)).toBe(true);
    expect(mergedByPullRequest('fix', 'c1', map, (a: string, b: string) => a === 'c1' && b === 'c2')).toBe(true);
  });

  it('do not count a commit made after the merge, or a new branch that reuses a merged name', { tags: ['error-guessing', 'regression'] }, () => {
    const map = heads([{ headRefName: 'fix', headRefOid: 'c2' }]);
    expect(mergedByPullRequest('fix', 'c3', map, never)).toBe(false);
    expect(mergedByPullRequest('other', 'c2', map, () => true)).toBe(false);
  });
});
