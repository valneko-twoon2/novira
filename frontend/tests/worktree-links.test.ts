// The links a worktree gets to the main checkout's node_modules (scripts/tools/worktree.mjs): made and recognised without a shell,
// so a path with a shell character in it is never run as a command; and the worktree's name is checked before it names a folder.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { isJunction, linkFolder, validName } from '../../scripts/tools/worktree.mjs';

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const scratch = (name: string) => {
  const dir = mkdtempSync(join(tmpdir(), `${name}-`));
  made.push(dir);
  return dir;
};

describe('worktree names', () => {
  it('takes letters, digits, dots, dashes and underscores', () => {
    for (const name of ['cand-progress', '20261110_fix', 'v0.5.0', 'a']) expect(validName(name), name).toBe(true);
  });

  it('refuses a name that could leave the folder or be read by a shell', () => {
    for (const name of ['', '..', '../x', 'a/b', 'a\\b', 'x&calc', 'x|y', 'x y', 'x"y', '%PATH%', 'a;b', '.', '-x']) expect(validName(name), name).toBe(false);
  });
});

describe.runIf(process.platform === 'win32')('links to the main checkout (Windows)', () => {
  it('makes a junction that shows the target, and tells it from a real folder', () => {
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
