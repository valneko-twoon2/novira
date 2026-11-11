// The pull request of a work branch, from opening to merge (the `/ship` skill; docs/development.md, "ブランチと PR").
//   node scripts/tools/pr.mjs open --body-file <f> [--title <t>]   push the current branch and open its pull request to main; on an open
//                                                    one, push and update the title or the description given. The description has the
//                                                    sections of .github/pull_request_template.md (bodyProblems). A branch of two or more
//                                                    commits needs --title: the title becomes the subject of the squashed commit on main,
//                                                    so it is checked like a commit message.
//   node scripts/tools/pr.mjs review <n> --verdict ok|changes --sha <commit read> --body-file <f>   (the shape: reviewProblems)
//                                                    post an agent's review of the commit it read (a comment review: GitHub lets nobody
//                                                    approve their own pull request, and the agents act as the user). Refused when the
//                                                    head moved past that commit.
//   node scripts/tools/pr.mjs status <n>             the required checks, the agent review of the current head and whether it may merge
//   node scripts/tools/pr.mjs merge <n> [--wait]     squash-merge when every required check passed and the agent review of the current
//                                                    head is ok; --wait waits for running checks (up to 60 minutes). Then deletes the
//                                                    branch on origin and fast-forwards the main checkout when it is on main.
// The merge rule is `mergeDecision`: only a pull request of this repository into main, on green required checks and an `ok` verdict
// written by the signed-in user's account for exactly its head commit; a push after the review needs a new review.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { messageProblems } from '../../.githooks/commit-msg.mjs';
import { upperDrive } from './harness-paths.mjs';

const ROOT = upperDrive(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
// Only at the very start of the body: a mark quoted further down a review does not count.
const MARK = /^<!--\s*agent-review\s+verdict=(ok|changes)\s+sha=([0-9a-f]{40})\s*-->/;

/** The first line of an agent review's body: what `reviewVerdict` reads back. */
export function reviewMark(verdict, sha) {
  if (!['ok', 'changes'].includes(verdict)) throw new Error(`verdict is ok or changes, not ${verdict}`);
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`a full commit id is needed, not ${sha}`);
  return `<!-- agent-review verdict=${verdict} sha=${sha} -->`;
}

/**
 * The verdict of the latest agent review of commit `sha` by `author` ('ok', 'changes'), or 'none'.
 * `reviews`: [{ author: { login }, body, submittedAt }]. A review by anyone else is ignored: the repository is public, and anybody may
 * leave a review with a mark in it.
 */
export function reviewVerdict(reviews, sha, author) {
  const mine = reviews
    .filter((r) => author && r.author?.login === author)
    .map((r) => ({ at: r.submittedAt ?? '', m: MARK.exec((r.body ?? '').trimStart()) }))
    .filter((r) => r.m && r.m[2] === sha)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return mine.length ? mine[mine.length - 1].m[1] : 'none';
}

/** 'pass', 'fail' or 'pending' from `gh pr checks --required --json name,bucket` (a skipped job passes; none at all is pending). */
export function checksState(checks) {
  if (!checks.length) return 'pending';
  if (checks.some((c) => c.bucket === 'fail' || c.bucket === 'cancel')) return 'fail';
  if (checks.some((c) => c.bucket === 'pending')) return 'pending';
  return 'pass';
}

/** The required checks that have not reported yet, added as pending: GitHub lists a check only once its job has started. */
export function withMissing(checks, required) {
  const seen = new Set(checks.map((c) => c.name));
  return [...checks, ...required.filter((name) => !seen.has(name)).map((name) => ({ name, bucket: 'pending' }))];
}

/** { merge, wait, reason } from the required checks, the review verdict of the head and the pull request itself. */
export function mergeDecision({ checks, verdict, state = 'OPEN', draft = false, base = 'main', fork = false, title = [], body = [] }) {
  if (state !== 'OPEN') return { merge: false, wait: false, reason: `the pull request is ${state.toLowerCase()}` };
  if (base !== 'main') return { merge: false, wait: false, reason: `the pull request goes to ${base}, not main` };
  if (fork) return { merge: false, wait: false, reason: 'the pull request comes from another repository: a person merges it' };
  if (draft) return { merge: false, wait: false, reason: 'the pull request is a draft' };
  if (title.length) return { merge: false, wait: false, reason: `the title cannot be the commit on main (${title[0]}): fix it with pr.mjs open --title` };
  if (body.length) return { merge: false, wait: false, reason: `the description is not complete (${body[0]}): fill in .github/pull_request_template.md` };
  if (verdict === 'changes') return { merge: false, wait: false, reason: 'the agent review of the current head asks for changes' };
  if (verdict !== 'ok') return { merge: false, wait: false, reason: 'no agent review of the current head (pushed after the review?): review it first' };
  if (checks === 'fail') return { merge: false, wait: false, reason: 'a required check failed' };
  if (checks === 'pending') return { merge: false, wait: true, reason: 'required checks are still running' };
  return { merge: true, wait: false, reason: 'every required check passed and the agent review of the head is ok' };
}

/** Why `title` cannot be the subject of the squashed commit on main (the rules of .githooks/commit-msg.mjs), or [] when it can. */
export function titleProblems(title) {
  return title.includes('\n') ? ['The title is one line.'] : messageProblems(title);
}

/** The title of a new pull request: the one given, or the only commit's subject; a branch of several commits must name it. */
export function titleFor(given, subjects) {
  if (!subjects.length) throw new Error('the branch has no commit that origin/main lacks: nothing to open');
  if (given) return given;
  if (subjects.length === 1) return subjects[0];
  throw new Error(`the branch has ${subjects.length} commits: give the pull request a title with --title "<type>: <要約>" (it becomes the commit on main)`);
}

/** The sections of a pull request's description, in order (.github/pull_request_template.md; the shape of meta/astryx's). */
export const BODY_SECTIONS = ['目的', '変えないこと', '変更', '証拠', '範囲', 'テスト'];

/** Why `body` is not a complete description: a section missing, out of order, or empty (an HTML comment alone is empty). */
export function bodyProblems(body) {
  const text = (body ?? '').replace(/\r\n/g, '\n');
  const problems = [];
  let last = -1;
  for (const name of BODY_SECTIONS) {
    const at = text.search(new RegExp(`^## ${name}\\s*$`, 'm'));
    if (at < 0) {
      problems.push(`the section "## ${name}" is missing`);
      continue;
    }
    if (at < last) problems.push(`the section "## ${name}" is out of order`);
    last = at;
    const rest = text.slice(at).split('\n').slice(1);
    const end = rest.findIndex((l) => l.startsWith('## '));
    const content = (end < 0 ? rest : rest.slice(0, end)).join('\n').replace(/<!--[\s\S]*?-->/g, '').trim();
    if (!content) problems.push(`the section "## ${name}" is empty`);
  }
  return problems;
}

/** The arguments of the squash merge: the title is the commit's subject on main, with no body (GitHub would list every commit). */
export function mergeArgs(n, pr) {
  return ['pr', 'merge', String(n), '--squash', '--match-head-commit', pr.headRefOid, '--subject', pr.title, '--body', ''];
}

/**
 * Why `text` is not a review in the agreed shape (the shape of meta/astryx's review bot), for `verdict`:
 *   **変更を求めます:** <one sentence: what is right and what is wrong>      (or **問題ありません:** ...)
 *   前回の指摘: <what became of the earlier findings, or なし>
 *   - `path/to/file.ext:12` — what goes wrong — what to do              (a finding that blocks the merge)
 *   - 任意: ...                                                          (a finding that does not)
 * A `changes` verdict needs at least one blocking finding and an `ok` one none; a blocking finding names a file and a line.
 */
export function reviewProblems(verdict, text) {
  const lines = (text ?? '').replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  const problems = [];
  const lead = verdict === 'ok' ? '**問題ありません:**' : '**変更を求めます:**';
  if (!lines[0]?.startsWith(lead) || lines[0].length <= lead.length + 1) problems.push(`the first line is the summary "${lead} <one sentence>"`);
  if (!lines.some((l) => l.startsWith('前回の指摘:'))) problems.push('a line "前回の指摘: <what became of them, or なし>" is needed');
  const blocking = lines.filter((l) => l.startsWith('- ') && !l.startsWith('- 任意:'));
  if (verdict === 'changes' && !blocking.length) problems.push('changes is asked without a blocking finding ("- `file:line` — ... — ...")');
  if (verdict === 'ok' && blocking.length) problems.push('ok is given with a blocking finding; mark it "- 任意:" or ask for changes');
  for (const b of blocking) if (!/[\w./-]+\.[\w]+:\d+/.test(b)) problems.push(`a blocking finding names no file:line: "${b.slice(0, 50)}"`);
  return problems;
}

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', cwd: opts.cwd ?? process.cwd(), maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const gh = (args, opts) => run('gh', args, opts);
const git = (args, opts) => run('git', args, opts);

function view(n) {
  return JSON.parse(gh(['pr', 'view', String(n), '--json', 'number,title,body,state,isDraft,headRefOid,headRefName,baseRefName,isCrossRepository,reviews,url']));
}

function requiredChecks(n) {
  try {
    return JSON.parse(gh(['pr', 'checks', String(n), '--required', '--json', 'name,bucket']));
  } catch (e) {
    // `gh pr checks` exits non-zero while checks fail or run; its JSON is still on stdout.
    const out = e.stdout?.toString() ?? '';
    if (out.trim().startsWith('[')) return JSON.parse(out);
    if (/no (required )?checks reported/i.test(`${e.stderr}`)) return [];
    throw e;
  }
}

let login;
const me = () => (login ??= gh(['api', 'user', '--jq', '.login']).trim());

/** The checks the branch protection of main requires; empty when it cannot be read (the merge then still meets GitHub's own refusal). */
let required;
function requiredNames() {
  try {
    required ??= JSON.parse(gh(['api', 'repos/{owner}/{repo}/branches/main/protection/required_status_checks', '--jq', '.contexts']));
  } catch {
    required = [];
  }
  return required;
}

function decisionOf(n) {
  const pr = view(n);
  const checks = withMissing(requiredChecks(n), requiredNames());
  const verdict = reviewVerdict(pr.reviews ?? [], pr.headRefOid, me());
  const decision = mergeDecision({
    checks: checksState(checks),
    verdict,
    state: pr.state,
    draft: pr.isDraft,
    base: pr.baseRefName,
    fork: pr.isCrossRepository,
    title: titleProblems(pr.title),
    body: bodyProblems(pr.body),
  });
  return { pr, checks, decision, verdict };
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const arg = (argv, flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);

function main(argv) {
  const [cmd, n] = argv;
  if (cmd === 'open') {
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    if (branch === 'main' || branch === 'HEAD') throw new Error('open a pull request from a work branch, not from main');
    git(['fetch', 'origin', 'main']);
    const subjects = git(['log', '--format=%s', 'origin/main..HEAD']).split(/\r?\n/).filter(Boolean).reverse();
    const open = JSON.parse(gh(['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number,url']));
    // Checked before anything leaves the machine: the title becomes the commit on main, the body is the description.
    const given = arg(argv, '--title');
    const bodyFile = arg(argv, '--body-file');
    const title = open.length ? given : titleFor(given, subjects);
    const titleIssues = title ? titleProblems(title) : [];
    if (titleIssues.length) throw new Error(`the title cannot be the commit on main:\n  ${titleIssues.join('\n  ')}`);
    const body = bodyFile ? readFileSync(bodyFile, 'utf8') : null;
    if (!open.length && body === null) throw new Error('--body-file <description> is needed: fill in .github/pull_request_template.md');
    const bodyIssues = body === null ? [] : bodyProblems(body);
    if (bodyIssues.length) throw new Error(`the description is not complete:\n  ${bodyIssues.join('\n  ')}`);
    git(['push', '-u', 'origin', 'HEAD']);
    if (open.length) {
      const edit = [...(title ? ['--title', title] : []), ...(body !== null ? ['--body', body] : [])];
      if (edit.length) gh(['pr', 'edit', String(open[0].number), ...edit]);
      console.log(`pr: pushed${edit.length ? ' and updated' : ''}; #${open[0].number} is open: ${open[0].url}`);
      return 0;
    }
    console.log(gh(['pr', 'create', '--base', 'main', '--head', branch, '--title', title, '--body', body]).trim());
    return 0;
  }
  if (cmd === 'review' && n) {
    const verdict = arg(argv, '--verdict');
    const read = arg(argv, '--sha');
    const file = arg(argv, '--body-file');
    if (!file || !read) throw new Error('--sha <the commit the reviewer read> and --body-file <review text> are needed');
    const text = readFileSync(file, 'utf8').trim();
    const shape = reviewProblems(verdict, text);
    if (shape.length) throw new Error(`the review is not in the agreed shape:\n  ${shape.join('\n  ')}`);
    const pr = view(n);
    if (pr.headRefOid !== read) throw new Error(`the head is ${pr.headRefOid.slice(0, 8)}, not the ${read.slice(0, 8)} that was reviewed: review the new head`);
    const body = `${reviewMark(verdict, read)}\n${text}`;
    gh(['pr', 'review', String(n), '--comment', '--body', body]);
    console.log(`pr: review of #${n} at ${read.slice(0, 8)}: ${verdict}`);
    return 0;
  }
  if (cmd === 'status' && n) {
    const { checks, decision, verdict, pr } = decisionOf(n);
    for (const c of checks) console.log(`  ${c.bucket.padEnd(8)} ${c.name}`);
    console.log(`pr: #${n} head ${pr.headRefOid.slice(0, 8)}, required checks ${checksState(checks)}, agent review ${verdict}: ${decision.reason}`);
    return decision.merge ? 0 : 1;
  }
  if (cmd === 'merge' && n) {
    const deadline = Date.now() + 60 * 60_000;
    let state = decisionOf(n);
    while (argv.includes('--wait') && state.decision.wait && Date.now() < deadline) {
      sleep(30_000);
      state = decisionOf(n);
    }
    if (!state.decision.merge) {
      console.error(`pr: #${n} not merged: ${state.decision.reason}`);
      for (const c of state.checks.filter((x) => x.bucket !== 'pass' && x.bucket !== 'skipping')) console.error(`  ${c.bucket} ${c.name}`);
      return 1;
    }
    // --match-head-commit: GitHub refuses the merge if a commit arrived after the review was read.
    gh(mergeArgs(n, state.pr));
    try {
      // The head branch is in this repository (mergeDecision refuses a fork), so this is the branch the pull request merged.
      git(['push', 'origin', '--delete', state.pr.headRefName]);
    } catch {
      // already deleted (the repository may delete merged branches itself)
    }
    console.log(`pr: #${n} merged (${state.pr.url})`);
    try {
      const mainTree = git(['worktree', 'list', '--porcelain'], { cwd: ROOT }).split(/\r?\n/).find((l) => l.startsWith('worktree '))?.slice(9).trim();
      if (mainTree && git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: mainTree }).trim() === 'main') {
        git(['pull', '--ff-only', 'origin', 'main'], { cwd: mainTree });
        console.log(`pr: ${mainTree} fast-forwarded to origin/main`);
      }
    } catch (e) {
      console.error(`pr: could not fast-forward the main checkout (${`${e.stderr ?? e.message}`.trim().split('\n')[0]}); run git pull --ff-only there`);
    }
    return 0;
  }
  console.error('usage: node scripts/tools/pr.mjs open [--title t] | review <n> --verdict ok|changes --sha <commit> --body-file <f> | status <n> | merge <n> [--wait]');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    if (e.code === 'ENOENT') console.error(`pr: ${e.path ?? 'a command'} is not on PATH (gh: C:\\Program Files\\GitHub CLI)`);
    else console.error(`pr: ${e.message}`);
    process.exit(2);
  }
}
