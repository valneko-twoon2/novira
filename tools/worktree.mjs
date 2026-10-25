// Git worktrees for work that must not touch the main checkout (the user's dev server watches it).
//   node tools/worktree.mjs add <name>        a sibling folder ../novira-wt-<name> on a new branch, with frontend/node_modules linked
//   node tools/worktree.mjs remove <path>     takes the links out first, then removes the worktree and its branch (merged only);
//                                             refuses a worktree with uncommitted changes unless --force
//   node tools/worktree.mjs list              worktrees that are finished and should be removed
// `git worktree remove` follows a junction and empties the folder it points to, so the main checkout's node_modules is lost
// when the junction is still there. `remove` unlinks it first; never remove a worktree by hand.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, rmdirSync, statSync, unlinkSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const LINKED = [['frontend', 'node_modules'], ['backend', 'target']];

/** [{path, branch}] of `git worktree list --porcelain`; the main checkout is first, a detached head has branch null. */
export function parseWorktrees(porcelain) {
  const trees = [];
  for (const block of porcelain.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/);
    const path = lines.find((l) => l.startsWith('worktree '))?.slice(9).trim();
    if (!path) continue;
    const branch = lines.find((l) => l.startsWith('branch '))?.slice(7).trim().replace(/^refs\/heads\//, '') ?? null;
    trees.push({ path: resolve(path), branch, prunable: lines.some((l) => l.startsWith('prunable')) });
  }
  return trees;
}

/** The worktrees that are done with: the folder is gone, or it is clean, its branch is merged into main, and it is not one made
 * a moment ago that nobody has used yet (`fresh`: an idle new worktree looks exactly like a finished one). */
export function finished(trees, { merged, dirty, missing, fresh = () => false }) {
  return trees.slice(1).filter((t) => missing(t.path) || (!dirty(t.path) && (t.branch === null || merged.has(t.branch)) && !fresh(t.path)));
}

/** Whether the worktree was made less than an hour ago and has no commit of its own yet. A worktree with its own commit that is
 * merged is finished work, however young. */
export function isFresh(path, now = Date.now()) {
  try {
    const born = statSync(path).birthtimeMs;
    const tip = Number(git(path, 'log', '-1', '--format=%ct').trim()) * 1000;
    return now - born < 3600_000 && tip <= born;
  } catch {
    return false;
  }
}

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024 });

/** Removes a link (junction or symlink) without following it. A real folder is left alone. */
function unlink(path) {
  try {
    if (!lstatSync(path).isSymbolicLink()) {
      // On Windows a junction is reported as a directory by some Node versions: an empty-or-not check cannot tell it apart, so ask `fsutil`.
      if (process.platform !== 'win32' || !isJunction(path)) return false;
    }
    try {
      unlinkSync(path);
    } catch {
      rmdirSync(path); // a junction is removed like an empty directory, and its target is untouched
    }
    return true;
  } catch {
    return false;
  }
}

function isJunction(path) {
  try {
    return /Junction|Symbolic/i.test(execFileSync('cmd', ['/c', 'dir', '/AL', dirname(path)], { encoding: 'utf8' }).split(/\r?\n/).filter((l) => l.includes(`[`) && l.includes(basename(path))).join('\n'));
  } catch {
    return false;
  }
}

function main(argv) {
  const root = git(process.cwd(), 'rev-parse', '--show-toplevel').trim();
  const trees = parseWorktrees(git(root, 'worktree', 'list', '--porcelain'));
  const main = trees[0].path;
  const [cmd, arg] = argv;
  if (cmd === 'add' && arg) {
    const dir = resolve(main, '..', `novira-wt-${arg}`);
    git(main, 'worktree', 'add', '-b', `${new Date().toISOString().slice(0, 10).replaceAll('-', '')}_${arg}`, dir, 'main');
    for (const [a, b] of LINKED) {
      const src = join(main, a, b);
      if (existsSync(src) && a === 'frontend') execFileSync('cmd', ['/c', 'mklink', '/J', join(dir, a, b), src], { stdio: 'ignore' });
    }
    console.log(dir);
  } else if (cmd === 'remove' && arg) {
    const dir = resolve(arg);
    const tree = trees.find((t) => t.path.toLowerCase() === dir.toLowerCase());
    if (!tree || tree === trees[0]) throw new Error(`${dir} is not a linked worktree of this repository`);
    // `git worktree remove -f -f` below drops uncommitted work without a word: refuse it unless asked.
    const changed = existsSync(dir) ? git(dir, 'status', '--porcelain').trim() : '';
    if (changed && !argv.includes('--force')) throw new Error(`${dir} has uncommitted changes; commit or merge them first, or add --force to drop them:\n${changed}`);
    if (existsSync(dir)) {
      for (const [a, b] of LINKED) unlink(join(dir, a, b));
      for (const [a, b] of LINKED) if (existsSync(join(dir, a, b)) && readdirSync(join(dir, a, b)).length && isJunction(join(dir, a, b))) throw new Error(`could not unlink ${join(dir, a, b)}`);
    }
    git(main, 'worktree', 'remove', '-f', '-f', dir);
    git(main, 'worktree', 'prune');
    if (tree.branch) console.log(git(main, 'branch', '-d', tree.branch).trim()); // refuses an unmerged branch: ask the user
    console.log(`removed ${dir}`);
  } else if (cmd === 'list') {
    const merged = new Set(git(main, 'branch', '--merged', 'main', '--format=%(refname:short)').split(/\r?\n/).filter(Boolean));
    const done = finished(trees, { merged, dirty: (p) => git(p, 'status', '--porcelain').trim() !== '', missing: (p) => !existsSync(p), fresh: isFresh });
    for (const t of done) console.log(t.path);
  } else {
    console.error('usage: node tools/worktree.mjs add <name> | remove <path> | list');
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
