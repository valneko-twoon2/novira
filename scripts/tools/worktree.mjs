// Git worktrees for work that must not touch the main checkout (the user's dev server watches it).
//   node scripts/tools/worktree.mjs add <name>        a sibling folder ../novira-wt-<name> on a new branch, with frontend/node_modules linked
//   node scripts/tools/worktree.mjs remove <path>     takes the links out first, then removes the worktree and its branch (merged only: into main,
//                                             or by a pull request that GitHub merged, which a squash merge hides from git);
//                                             refuses a worktree with uncommitted changes unless --force
//   node scripts/tools/worktree.mjs list              worktrees that are finished and should be removed
// `git worktree remove` follows a junction and empties the folder it points to, so the main checkout's node_modules is lost
// when the junction is still there. `remove` unlinks it first; never remove a worktree by hand.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readlinkSync, rmdirSync, statSync, symlinkSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { localDay } from './harness-paths.mjs';

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

/**
 * The head commits of the pull requests GitHub merged, by branch name (a squash merge leaves no merge in git): Map<branch, commit[]>.
 * Empty when `gh` cannot say, so nothing is deleted on a guess.
 */
export function prMergedHeads(cwd, run = (args) => execFileSync('gh', args, { cwd, encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'ignore'] })) {
  try {
    const heads = new Map();
    for (const p of JSON.parse(run(['pr', 'list', '--state', 'merged', '--limit', '200', '--json', 'headRefName,headRefOid']))) {
      heads.set(p.headRefName, [...(heads.get(p.headRefName) ?? []), p.headRefOid]);
    }
    return heads;
  } catch {
    return new Map();
  }
}

/**
 * Whether the local branch `branch` at commit `tip` is all in a merged pull request: its tip is the head that was merged, or behind it.
 * A commit made after the merge, or a new branch that reuses an old name, is not: such a branch is deleted only with -d (refused).
 */
export function mergedByPullRequest(branch, tip, heads, isAncestor) {
  return (heads.get(branch) ?? []).some((head) => head === tip || isAncestor(tip, head));
}

/**
 * The branches of `trees` that are done with: merged into main (`mergedIntoMain`, from `git branch --merged main`), or all in a
 * pull request GitHub merged (`heads` from `prMergedHeads`; a squash merge is invisible to git). Shared by `list` and the Stop hook.
 */
export function mergedBranches(trees, { mergedIntoMain, heads, tipOf, isAncestor }) {
  const out = new Set(mergedIntoMain);
  for (const t of trees) if (t.branch && !out.has(t.branch) && heads.has(t.branch) && mergedByPullRequest(t.branch, tipOf(t.branch), heads, isAncestor)) out.add(t.branch);
  return out;
}

export function isAncestorIn(cwd) {
  return (a, b) => {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', a, b], { cwd, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
}

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024 });

/** Removes a link (junction or symlink) without following it. A real folder is left alone. */
function unlink(path) {
  try {
    if (!lstatSync(path).isSymbolicLink()) {
      // On Windows a junction is reported as a directory by some Node versions: an empty-or-not check cannot tell it apart, so read the link.
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

/**
 * Whether `path` is a junction or a symbolic link. Reading the link's target works for both and fails for a real folder or a
 * missing path, whatever `lstat` reports for a junction. No shell is involved, so a path with `&` in it is only a path.
 */
export function isJunction(path) {
  try {
    readlinkSync(path);
    return true;
  } catch {
    return false;
  }
}

/** Makes `link` a junction to the folder `target` (no administrator rights needed, unlike a symbolic link). */
export function linkFolder(target, link) {
  symlinkSync(target, link, 'junction');
}

/** A worktree name names a folder and a branch: letters, digits, `.`, `_` and `-` only, not starting with a dot or a dash. */
/** The branch of a new worktree: the local calendar day (not the UTC one), then the name. */
export function branchName(name, d = new Date()) {
  return `${localDay(d).replaceAll('-', '')}_${name}`;
}

export function validName(name) {
  return /^[A-Za-z0-9_][\w.-]*$/.test(name) && !name.includes('..');
}

function main(argv) {
  const root = git(process.cwd(), 'rev-parse', '--show-toplevel').trim();
  const trees = parseWorktrees(git(root, 'worktree', 'list', '--porcelain'));
  const main = trees[0].path;
  const [cmd, arg] = argv;
  if (cmd === 'add' && arg) {
    if (!validName(arg)) throw new Error(`${arg} is not a worktree name: use letters, digits, ., _ and - only`);
    const dir = resolve(main, '..', `novira-wt-${arg}`);
    // From GitHub's main, not the local one: the main checkout may lag behind merged pull requests (GitHub Flow, docs/development.md).
    let base = 'main';
    try {
      git(main, 'fetch', 'origin', 'main');
      base = 'origin/main';
    } catch {
      console.error('worktree: could not fetch origin; the branch starts from the local main');
    }
    git(main, 'worktree', 'add', '--no-track', '-b', branchName(arg), dir, base);
    for (const [a, b] of LINKED) {
      const src = join(main, a, b);
      if (existsSync(src) && a === 'frontend') linkFolder(src, join(dir, a, b));
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
    if (tree.branch) {
      // -d refuses an unmerged branch (ask the user); a branch all in a pull request GitHub squash-merged is merged too.
      const tip = git(main, 'rev-parse', tree.branch).trim();
      const squashed = mergedByPullRequest(tree.branch, tip, prMergedHeads(main), isAncestorIn(main));
      console.log(git(main, 'branch', squashed ? '-D' : '-d', tree.branch).trim());
    }
    console.log(`removed ${dir}`);
  } else if (cmd === 'list') {
    const merged = mergedBranches(trees, {
      mergedIntoMain: git(main, 'branch', '--merged', 'main', '--format=%(refname:short)').split(/\r?\n/).filter(Boolean),
      heads: prMergedHeads(main),
      tipOf: (b) => git(main, 'rev-parse', b).trim(),
      isAncestor: isAncestorIn(main),
    });
    const done = finished(trees, { merged, dirty: (p) => git(p, 'status', '--porcelain').trim() !== '', missing: (p) => !existsSync(p), fresh: isFresh });
    for (const t of done) console.log(t.path);
  } else {
    console.error('usage: node scripts/tools/worktree.mjs add <name> | remove <path> | list');
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
