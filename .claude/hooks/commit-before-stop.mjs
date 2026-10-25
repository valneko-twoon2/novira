// Claude Code Stop hook: AGENTS.md says work that changes files ends with the agent's own Git commit. When the agent is about
// to finish with changes still in the work tree, this hands the reminder back (exit 2 sends stderr to it) so it commits first,
// or says why it did not (the user said not to, a check is failing). It asks once per stop: the stop that follows the reminder
// (`stop_hook_active`) is never blocked, so a refused commit cannot loop. It never blocks during a merge or rebase.
// With everything committed, it also asks for the model sweep when model code was committed on a branch and no sweep record
// covers its HEAD (tools/models-sweep-lib.mjs; the hook only reads the records, it never runs the sweep).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { harnessRoots } from '../../tools/harness-paths.mjs';
import { readRecords, recordCoversHead, sweepReminder } from '../../tools/models-sweep-lib.mjs';
import { finished, isFresh, parseWorktrees } from '../../tools/worktree.mjs';
import { worktreeRoots } from './worktrees.mjs';

// novira-data/ (user data, and novira-data/work/ where the harness writes) is never reported as pending.
const SKIP = /(^|\/)(node_modules|target|\.git|dist|test-results|novira-data|data|outputs)\//;

/** The changed paths of `git status --porcelain` (staged, modified and new files) outside generated and user-data folders. */
export function pending(porcelain) {
  return porcelain
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^"|"$/g, '').replace(/^.* -> /, ''))
    .filter((path) => !SKIP.test(path));
}

/** The reminder to give, or null when the stop may go ahead. */
export function reminder(input, changed, inMerge, leftover = [], sweep = []) {
  if (input?.stop_hook_active || inMerge) return null;
  if (!changed.length && !leftover.length && sweep.length) return ['AGENTS.md and .claude/rules/models.md: model changes are checked in the real app.', ...sweep].join(NL);
  if (!changed.length && leftover.length) {
    return [
      'AGENTS.md: these worktrees are finished (clean, and their branch is merged into main, or the folder is gone). Remove each one now:',
      ...leftover,
      'Use `node tools/worktree.mjs remove <path>`, never `git worktree remove` by hand: it unlinks node_modules first, or the main checkout loses its own.',
    ].join('\n');
  }
  if (!changed.length) return null;
  const shown = changed.slice(0, 12).join('\n');
  const more = changed.length > 12 ? `\n... and ${changed.length - 12} more` : '';
  return [
    'AGENTS.md: work that changes files ends with your own commit. There are uncommitted changes:',
    shown + more,
    'Run the checks that fit (node tools/affected.mjs), fix what fails, commit with a message that follows .claude/rules/commit-messages.md, then report.',
    'If you must not commit now (the user said not to, or a check you cannot fix is failing), say so in the report instead.',
  ].join('\n');
}

const NL = String.fromCharCode(10);

/**
 * The sweep reminders of the work trees: model code committed on a branch (since main; on main, since its upstream) and no
 * complete sweep record whose commit, with the files it swept uncommitted, matches HEAD. `git(cwd, args)` runs Git; a work
 * tree Git cannot answer for is skipped.
 */
export function sweepReminders(roots, { git, records }) {
  const complete = records.filter((r) => r.complete).slice(0, 8);
  const out = [];
  roots.forEach((root, i) => {
    try {
      const committed = git(root, ['log', '--format=', '--name-only', `${i === 0 ? '@{upstream}' : 'main'}..HEAD`]).split(NL).map((l) => l.trim()).filter(Boolean);
      const blobAtHead = (p) => {
        try {
          return git(root, ['rev-parse', `HEAD:${p}`]).trim();
        } catch {
          return null;
        }
      };
      const covers = (r) => {
        try {
          return recordCoversHead(r, git(root, ['diff', '--name-only', r.head, 'HEAD']).split(NL).map((l) => l.trim()).filter(Boolean), blobAtHead);
        } catch {
          return false; // a commit this work tree does not have
        }
      };
      const text = sweepReminder({ root, committed, records: complete, covers });
      if (text) out.push(text);
    } catch {
      // No upstream, no main, not a Git work tree: nothing to ask for.
    }
  });
  return out;
}

/** Runs tools/prune-stale.mjs (stale harness output under novira-data/work/); returns the lines of what it deleted. Never throws, gives up after 6 s. */
export function pruneStale(script = fileURLToPath(new URL('../../tools/prune-stale.mjs', import.meta.url))) {
  try {
    const run = spawnSync(process.execPath, [script, '--quiet'], { encoding: 'utf8', timeout: 6000, windowsHide: true });
    return String(run.stdout ?? '')
      .split(NL)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('[prune-stale] deleted '));
  } catch {
    return [];
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
let raw = '';
if (isMain) process.stdin.on('data', (c) => (raw += c));
if (isMain)
  process.stdin.on('end', () => {
    try {
      const removed = pruneStale();
      if (removed.length) process.stderr.write(['Stale harness output was deleted (tools/prune-stale.mjs):', ...removed, ''].join(NL));
    } catch {
      // Pruning never blocks the stop.
    }
    try {
      const project = process.env.CLAUDE_PROJECT_DIR || process.cwd();
      // The main checkout and every worktree of it: work done in a worktree is outside CLAUDE_PROJECT_DIR.
      const roots = worktreeRoots(project);
      const changed = [];
      let inMerge = false;
      roots.forEach((root, i) => {
        const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 15000, maxBuffer: 32 * 1024 * 1024 });
        const gitDir = git(['rev-parse', '--absolute-git-dir']).trim();
        inMerge ||= ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD'].some((f) => existsSync(join(gitDir, f)));
        changed.push(...pending(git(['status', '--porcelain'])).map((p) => (i === 0 ? p : `${root}/${p}`)));
      });
      const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 15000, maxBuffer: 32 * 1024 * 1024 });
      const trees = parseWorktrees(git(roots[0], ['worktree', 'list', '--porcelain']));
      const merged = new Set(git(roots[0], ['branch', '--merged', 'main', '--format=%(refname:short)']).split(String.fromCharCode(10)).map((b) => b.trim()).filter(Boolean));
      const leftover = finished(trees, {
        merged,
        dirty: (p) => git(p, ['status', '--porcelain']).trim() !== '',
        missing: (p) => !existsSync(p),
        fresh: isFresh,
      }).map((t) => t.path);
      const input = JSON.parse(raw || '{}');
      const sweep = changed.length || leftover.length || inMerge || input?.stop_hook_active ? [] : sweepReminders(roots, { git, records: readRecords(harnessRoots(roots[0]).work) });
      const text = reminder(input, changed, inMerge, leftover, sweep);
      if (!text) return;
      process.stderr.write(text + '\n');
      process.exitCode = 2;
    } catch {
      // Never block the work on a failure of the hook itself.
    }
  });
