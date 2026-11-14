// A work branch into develop with no pull request (the `/ship` skill; docs/development.md, "ブランチと PR"; the user's rule, 2026-11-14).
//   node scripts/tools/land.mjs [--review-file <f>] [--title <t>] [--dry-run]   in the work branch's worktree
// It squashes the branch into one commit on top of origin/develop (the title is its subject, checked like a commit message; a branch of
// two or more commits needs --title) and pushes it to develop as a fast-forward (nothing is forced). It refuses unless the worktree is
// clean, the branch holds origin/develop (bring it up to date first: git rebase origin/develop) and either every changed file is one that
// needs no review (`reviewFree` of pr.mjs: the changelog, the test counts, tests) or --review-file holds an agent review of this change,
// in the shape of `reviewProblems` with the verdict ok:
//   SHA: <the 40-hex commit it read>
//   VERDICT: ok
//   > [!TIP]
//   > **判定: OK**　指摘 0 件・任意 N 件（<sha8> を確認）
//   ...
// The review counts for the head when it read the head, or a commit whose change is the same as the head's (the branch brought up to
// date with develop after the review, with no conflict to solve). After the push the branch is marked landed (git config
// branch.<name>.landed <head>), which worktree.mjs reads to remove the worktree and delete the branch, and the main checkout is
// fast-forwarded when it is on develop.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { WORK_BRANCH, RELEASE_BRANCH } from './branches.mjs';
import { fastForwardMainCheckout, isAncestorOf, isReleaseBranch, isSyncBranch, reviewFree, reviewProblems, titleFor, titleProblems } from './pr.mjs';

/** The review an agent wrote, as land reads it: { sha, verdict, body }, or null when the SHA and VERDICT lines are missing. */
export function parseReview(text) {
  const lines = (text ?? '').replace(/\r\n/g, '\n').split('\n');
  const at = (re) => lines.findIndex((l) => re.test(l.trim()));
  const s = at(/^SHA: [0-9a-f]{40}$/);
  const v = at(/^VERDICT: (ok|changes)\b/);
  if (s < 0 || v < 0) return null;
  return { sha: lines[s].trim().slice(5), verdict: /^VERDICT: (ok|changes)/.exec(lines[v].trim())[1], body: lines.slice(Math.max(s, v) + 1).join('\n').trim() };
}

/** The changed files of a branch as `reviewFree` reads them, from `git diff --name-status -M` lines. */
export function changedFiles(nameStatus) {
  const kinds = { A: 'ADDED', M: 'MODIFIED', D: 'DELETED', R: 'RENAMED', C: 'COPIED', T: 'MODIFIED' };
  return nameStatus
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => l.split('\t'))
    .map((p) => ({ path: p[p.length - 1], changeType: kinds[p[0][0]] ?? 'MODIFIED' }));
}

/**
 * Why the branch may not land, or [] when it may. `review` is the parsed review or null; `sameChange` says whether the commit it read
 * changes the same as the head (true when it is the head).
 */
export function landProblems({ branch, dirty, upToDate, title, free, review, reviewShape = [], sameChange }) {
  const out = [];
  if (!branch || [WORK_BRANCH, RELEASE_BRANCH, 'HEAD'].includes(branch) || isReleaseBranch(branch) || isSyncBranch(branch)) out.push(`land a work branch, not ${branch || 'a detached head'}`);
  if (dirty) out.push('the worktree has uncommitted changes: commit them first');
  if (upToDate === false) out.push(`the branch does not hold origin/${WORK_BRANCH}: bring it up to date first (git rebase origin/${WORK_BRANCH}, or merge it), then run the checks again`);
  if (upToDate === null) out.push(`whether the branch holds origin/${WORK_BRANCH} cannot be told here (git failed)`);
  out.push(...title.map((t) => `the title cannot be the commit on ${WORK_BRANCH}: ${t}`));
  if (free) return out;
  if (!review) out.push('--review-file <f> with an agent review of this change is needed (SHA and VERDICT lines, then the review): only the changelog, the test counts and tests land without one');
  else {
    if (review.verdict !== 'ok') out.push('the review asks for changes: fix them (a finding comes with the run that showed it), then review again');
    out.push(...reviewShape.map((p) => `the review is not in the agreed shape: ${p}`));
    if (sameChange === false) out.push(`the review read ${review.sha.slice(0, 8)}, whose change is not the head's: review the head`);
    if (sameChange === null) out.push(`whether ${review.sha.slice(0, 8)} changes the same as the head cannot be told here (git failed, or that commit is not here)`);
  }
  return out;
}

const run = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

/**
 * Whether commit `read` changes the same as `head` does on top of `base`: the diff of `read` from where it left `base` against the diff
 * of `head` from `base`. True when `read` is `head`; null when git cannot answer.
 */
export function sameChange(cwd, read, head, base) {
  try {
    if (run(cwd, ['rev-parse', read]).trim() === run(cwd, ['rev-parse', head]).trim()) return true;
    const from = run(cwd, ['merge-base', read, base]).trim();
    const diff = (a, b) => run(cwd, ['diff', '--no-ext-diff', '--no-color', '--binary', a, b]);
    return diff(from, read) === diff(base, head);
  } catch {
    return null;
  }
}

const arg = (argv, flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);

export function land(argv, cwd = process.cwd()) {
  const branch = run(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const dirty = run(cwd, ['status', '--porcelain']).trim() !== '';
  run(cwd, ['fetch', 'origin', WORK_BRANCH]);
  const base = `origin/${WORK_BRANCH}`;
  const upToDate = isAncestorOf(cwd, base, 'HEAD');
  const head = run(cwd, ['rev-parse', 'HEAD']).trim();
  const subjects = run(cwd, ['log', '--format=%s', `${base}..HEAD`]).split(/\r?\n/).filter(Boolean).reverse();
  const title = titleFor(arg(argv, '--title'), subjects);
  const free = reviewFree(changedFiles(run(cwd, ['diff', '--name-status', '-M', base, 'HEAD'])));
  const file = arg(argv, '--review-file');
  const review = file ? parseReview(readFileSync(file, 'utf8')) : null;
  const problems = landProblems({
    branch,
    dirty,
    upToDate,
    title: titleProblems(title),
    free,
    review,
    reviewShape: review ? reviewProblems(review.verdict, review.body, review.sha) : [],
    sameChange: review ? sameChange(cwd, review.sha, 'HEAD', base) : true,
  });
  if (problems.length) {
    console.error(`land: ${branch} not landed:\n  ${problems.join('\n  ')}`);
    return 1;
  }
  const commit = execFileSync('git', ['commit-tree', 'HEAD^{tree}', '-p', base, '-F', '-'], { cwd, input: `${title}\n`, encoding: 'utf8' }).trim();
  if (argv.includes('--dry-run')) {
    console.log(`land: ${branch} may land as ${commit.slice(0, 8)} "${title}" (${free ? 'no review needed' : `review of ${review.sha.slice(0, 8)} ok`}); --dry-run: nothing pushed`);
    return 0;
  }
  try {
    // A fast-forward of develop: its parent is origin/develop as fetched. Never forced: a develop that moved meanwhile refuses it.
    run(cwd, ['push', 'origin', `${commit}:refs/heads/${WORK_BRANCH}`]);
  } catch (e) {
    console.error(`land: the push to ${WORK_BRANCH} was refused (${`${e.stderr ?? e.message}`.trim().split('\n').pop()}): ${WORK_BRANCH} moved? Bring the branch up to date and land again`);
    return 1;
  }
  run(cwd, ['config', `branch.${branch}.landed`, head]);
  console.log(`land: ${branch} landed on ${WORK_BRANCH} as ${commit.slice(0, 8)} "${title}"`);
  fastForwardMainCheckout('land', cwd);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exit(land(process.argv.slice(2)));
  } catch (e) {
    console.error(`land: ${e.message}`);
    process.exit(2);
  }
}
