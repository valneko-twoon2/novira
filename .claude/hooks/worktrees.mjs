// Shared by the hooks: the work trees of this repository. Work done in a Git worktree (the main checkout is kept free while the
// user's dev server watches it) lives outside CLAUDE_PROJECT_DIR, so a hook that looks only there sees nothing of it.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parseWorktrees } from '../../tools/worktree.mjs';

/** Every work tree of the repository of `root` (at least `root` itself). Never throws. */
export function worktreeRoots(root) {
  try {
    const out = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8', timeout: 15000 });
    const found = parseWorktrees(out).map((t) => t.path);
    return found.length ? found : [resolve(root)];
  } catch {
    return [resolve(root)];
  }
}

const same = (a, b) => resolve(a).toLowerCase() === resolve(b).toLowerCase();

/** The work tree of `roots` that holds `file`, or null when it is in none of them. The longest root wins (a worktree inside another). */
export function rootHolding(file, roots) {
  const f = resolve(file).toLowerCase().replaceAll('\\', '/');
  let best = null;
  for (const r of roots) {
    const prefix = resolve(r).toLowerCase().replaceAll('\\', '/').replace(/\/$/, '') + '/';
    if ((f + '/').startsWith(prefix) || same(file, r)) if (!best || r.length > best.length) best = r;
  }
  return best;
}
