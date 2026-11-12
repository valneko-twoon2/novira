// The pull request of a work branch, from opening to merge (the `/ship` skill; docs/development.md, "ブランチと PR").
//   node scripts/tools/pr.mjs open --body-file <f> [--title <t>]   push the current branch and open its pull request to develop; on an open
//                                                    one, push and update the title or the description given. The description has the
//                                                    sections of .github/pull_request_template.md (bodyProblems). A branch of two or more
//                                                    commits needs --title: the title becomes the subject of the squashed commit on develop,
//                                                    so it is checked like a commit message.
//   node scripts/tools/pr.mjs open --release --title <t> --body-file <f> [--name <n>]   the release pull request: a snapshot of origin/develop
//                                                    (the branch release/<n>; n is the version in the title, v1.2.3) into main, as a draft (CI and
//                                                    CodeQL run once it is ready, as for any pull request to main). A snapshot, so develop goes on
//                                                    taking work while the release is reviewed and tested; run it again to bring the snapshot up to
//                                                    develop (a fast-forward).
//   node scripts/tools/pr.mjs sync                   after a release: the pull request that merges main back into develop (no review: merging
//                                                    main must leave develop's own tree as it is, `syncSafe`). When develop changed lines the
//                                                    release also changed (a generated table, say), that merge conflicts: the pull request then comes
//                                                    from sync/<id>, a merge commit of develop and main that keeps develop's tree, made only when
//                                                    main's tree is a state develop once had (the release was a snapshot of develop).
//   node scripts/tools/pr.mjs review <n> --verdict ok|changes --sha <commit read> --body-file <f>   (the shape: reviewProblems)
//                                                    post an agent's review of the commit it read (a comment review: GitHub lets nobody
//                                                    approve their own pull request, and the agents act as the user). Refused when the
//                                                    head moved past that commit.
//   node scripts/tools/pr.mjs status <n>             the checks, the agent review of the current head and whether it may merge
//   node scripts/tools/pr.mjs merge <n> [--wait]     into develop: squash-merge when the review of the head is ok (no CI or CodeQL is required).
//                                                    Into main (a release): a draft with an ok review is made ready (the checks start); then
//                                                    squash-merge when every check (required and CodeQL) passed and the review of the head is ok;
//                                                    --wait waits for running checks (up to 60 minutes). A failed check makes it a draft again.
//                                                    Then deletes the branch on origin (never develop or main) and fast-forwards the main
//                                                    checkout when it is on develop.
// The merge rule is `mergeDecision`: only a pull request of this repository, from a work branch into develop, from a release branch
// (release/<n>, a snapshot of develop) into main (a release, on green required checks and CodeQL) or from main into develop (`sync`), on an `ok` verdict written by the signed-in user's
// account for exactly its head commit (not for `sync`); a push after the review needs a new review.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { messageProblems } from '../../.githooks/commit-msg.mjs';
import { RELEASE_BRANCH, WORK_BRANCH } from './branches.mjs';
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

/** 'pass', 'fail' or 'pending' from the gating checks, as `gh pr checks --json name,bucket` gives them (a skipped job passes; none at all is pending). */
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

/** The jobs of .github/workflows/codeql.yml: not required by the branch protection, but the alerts are only known once they end. */
export const CODEQL_CHECKS = ['analyze (actions)', 'analyze (javascript-typescript)', 'analyze (python)', 'analyze (rust)'];

/** The branch a release pull request comes from: a snapshot of develop, so develop can go on taking work while it is reviewed and tested. */
export const RELEASE_PREFIX = 'release/';

/** The branch of a merge of main into develop made by `sync` when the plain merge conflicts. */
export const SYNC_PREFIX = 'sync/';

/** Whether `name` is such a branch (sync/<id>). */
export function isSyncBranch(name) {
  return typeof name === 'string' && /^sync\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name);
}

/** Whether the pull request merges main back into develop: from main itself, or from a sync/<id> branch. */
export function isSyncPullRequest(base, head) {
  return base === WORK_BRANCH && (head === RELEASE_BRANCH || isSyncBranch(head));
}

/** Whether `name` is the snapshot branch of a release (release/<n>). */
export function isReleaseBranch(name) {
  return typeof name === 'string' && /^release\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name);
}

/** The branch of a release pull request: release/<name>, or release/v<version> from a title "chore: v1.2.3 をリリースする". */
export function releaseBranchName(title, name) {
  if (name) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) throw new Error(`--name is letters, digits, ., _ and - only, not ${name}`);
    return `${RELEASE_PREFIX}${name}`;
  }
  const version = /^chore: (v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?) /.exec(title ?? '')?.[1];
  if (!version) throw new Error('the release branch is named by the version in the title ("chore: v1.2.3 をリリースする"), or by --name <n>');
  return `${RELEASE_PREFIX}${version}`;
}

/** The checks a merge waits for, out of every check of the pull request: the required ones and the CodeQL analyses, those not started as pending. */
export function gatingChecks(all, required) {
  const names = new Set([...required, ...CODEQL_CHECKS]);
  return withMissing(all.filter((c) => names.has(c.name)), [...names]);
}

/**
 * { merge, wait, reason, ready?, toDraft? } from the gating checks, the review verdict of the head and the pull request itself; `alerts`
 * null is unknown. A draft is reviewed with no CI: once the review of its head is ok, `ready` asks to make it ready for review, which
 * starts the checks. A failed check or an open code scanning alert sends it back to a draft (`toDraft`), so the pushes that fix it
 * run no CI until the next ok review.
 */
export function mergeDecision({ checks, verdict, state = 'OPEN', draft = false, base = WORK_BRANCH, head = '', fork = false, title = [], body = [], alerts = 0, syncSafe = null, snapshot = null }) {
  if (state !== 'OPEN') return { merge: false, wait: false, reason: `the pull request is ${state.toLowerCase()}` };
  if (fork) return { merge: false, wait: false, reason: 'the pull request comes from another repository: a person merges it' };
  if (base !== WORK_BRANCH && base !== RELEASE_BRANCH) return { merge: false, wait: false, reason: `the pull request goes to ${base}, not ${WORK_BRANCH} or ${RELEASE_BRANCH}` };
  if (base === RELEASE_BRANCH && !isReleaseBranch(head)) return { merge: false, wait: false, reason: `only a release (from a ${RELEASE_PREFIX}<n> snapshot of ${WORK_BRANCH}) goes into ${RELEASE_BRANCH}, not ${head || 'this branch'}` };
  // A release is develop's own content: its branch must hold nothing that develop does not (a name alone proves nothing).
  if (base === RELEASE_BRANCH && snapshot !== true) return { merge: false, wait: false, reason: snapshot === false ? `${head} holds commits that ${WORK_BRANCH} does not: it is not a snapshot of ${WORK_BRANCH}` : `whether ${head} is a snapshot of ${WORK_BRANCH} cannot be told here (git failed)` };
  // A snapshot branch is opened with --release, never as a work branch into develop.
  if (base === WORK_BRANCH && isReleaseBranch(head)) return { merge: false, wait: false, reason: `${head} is a release snapshot: it goes into ${RELEASE_BRANCH}, not ${WORK_BRANCH}` };
  if (title.length) return { merge: false, wait: false, reason: `the title cannot be the commit on ${base} (${title[0]}): fix it with pr.mjs open --title` };
  if (body.length) return { merge: false, wait: false, reason: `the description is not complete (${body[0]}): fill in .github/pull_request_template.md` };
  // main into develop: nothing new to review when merging main changes nothing in develop's tree.
  if (isSyncPullRequest(base, head)) {
    if (syncSafe === null) return { merge: false, wait: false, reason: 'the merge of main into develop cannot be tried here (git failed)' };
    if (!syncSafe) return { merge: false, wait: false, reason: 'merging main into develop would change develop (a conflict, or a change only main has): a person looks at it' };
    return { merge: true, wait: false, reason: "merging main into develop leaves develop's tree as it is" };
  }
  if (verdict === 'changes') return { merge: false, wait: false, reason: 'the agent review of the current head asks for changes' };
  if (verdict !== 'ok') return { merge: false, wait: false, reason: 'no agent review of the current head (pushed after the review?): review it first' };
  // Into develop nothing runs on the pull request (a work branch is reviewed, not tested here): the ok review is the whole condition.
  if (base === WORK_BRANCH && draft) return { merge: false, wait: true, ready: true, reason: 'the review of the draft is ok: it is made ready for review' };
  if (base === WORK_BRANCH) return { merge: true, wait: false, reason: `the agent review of the head is ok (no CI or CodeQL is required into ${WORK_BRANCH})` };
  if (draft) return { merge: false, wait: true, ready: true, reason: 'the review of the draft is ok: it is made ready for review, which starts the checks' };
  if (alerts === null) return { merge: false, wait: true, reason: 'the code scanning alerts cannot be read (gh failed): no merge until they can' };
  if (checks === 'fail') return { merge: false, wait: false, toDraft: true, reason: 'a check failed (required or CodeQL): it goes back to a draft; fix, push, review again' };
  if (checks === 'pending') return { merge: false, wait: true, reason: 'checks (required and CodeQL) are still running' };
  if (alerts > 0) return { merge: false, wait: false, toDraft: true, reason: `${alerts} open code scanning alert(s) on the pull request: it goes back to a draft; fix each, or report why it is a false positive` };
  return { merge: true, wait: false, reason: 'every check (required and CodeQL) passed and the agent review of the head is ok' };
}

/**
 * The checks with the runs started before the pull request was last made ready for review (`since`, an ISO time) counted as pending:
 * those are the runs of the draft, whose jobs skipped. Null `since` (never a draft) keeps every run.
 */
export function freshChecks(checks, since) {
  if (!since) return checks;
  return checks.map((c) => (c.startedAt && !c.startedAt.startsWith('0001-') && c.startedAt >= since ? c : { ...c, bucket: 'pending' }));
}

/** Why `title` cannot be the subject of the squashed commit (the rules of .githooks/commit-msg.mjs), or [] when it can. */
export function titleProblems(title) {
  return title.includes('\n') ? ['The title is one line.'] : messageProblems(title);
}

/** The title of a new pull request: the one given, or the only commit's subject; a branch of several commits must name it. */
export function titleFor(given, subjects) {
  if (!subjects.length) throw new Error(`the branch has no commit that origin/${WORK_BRANCH} lacks: nothing to open`);
  if (given) return given;
  if (subjects.length === 1) return subjects[0];
  throw new Error(`the branch has ${subjects.length} commits: give the pull request a title with --title "<type>: <要約>" (it becomes the commit on ${WORK_BRANCH})`);
}

/** The pull request that merges main back into develop after a release (`pr.mjs sync`); its description is the same every time. */
export const SYNC_TITLE = 'chore: main を develop に戻す';
export const SYNC_BODY = [
  '## 背景',
  '',
  'develop から main へのリリースは squash マージなので、main の履歴は develop の履歴を含まない。そのままだと次のリリースの差分に、すでに出した変更が混ざる。',
  '',
  '## 変わらないこと',
  '',
  'develop の中身。マージの結果が develop の今のツリーと等しいことを、マージの前に `pr.mjs` が確かめる。',
  '',
  '## 変更内容',
  '',
  'main の履歴を develop にマージコミットで取り込む（コードは変わらない）。',
  '',
  '## 確認結果',
  '',
  '`git merge-tree` で、main を develop に入れた結果のツリーが develop のツリーと等しいことを `pr.mjs merge` が確かめる。',
  '',
  '## チェックリスト',
  '',
  '- [x] 利用者に見える文言は ja と en を同じ変更で書いた（または、文言の変更はない）',
  '- [x] 不具合の修正は、先に落ちるのを見た再現テストを伴う（または、修正ではない）',
  '- [x] 動き・境界・限界が変わるなら、設計ページ（`docs/design/`）を直した（または、変わらない）',
  '- [x] 秘密情報、ユーザーのデータ、`novira-data/` を含まない',
  '',
  '## 追加・変更したテスト',
  '',
  'なし（履歴だけのマージ）。',
  '',
].join('\n');

/** The sections of a pull request's description, in order (.github/pull_request_template.md; the shape of meta/astryx's). */
export const BODY_SECTIONS = ['背景', '変わらないこと', '変更内容', '確認結果', 'チェックリスト', '追加・変更したテスト'];

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
    if (!withoutComments((end < 0 ? rest : rest.slice(0, end)).join('\n')).trim()) problems.push(`the section "## ${name}" is empty`);
  }
  return problems;
}

/** The push that deletes the merged branch on origin only while it is still at the merged head. */
export function deleteBranchArgs(pr) {
  if (pr.headRefName === WORK_BRANCH || pr.headRefName === RELEASE_BRANCH) return null;
  return ['push', `--force-with-lease=${pr.headRefName}:${pr.headRefOid}`, 'origin', '--delete', pr.headRefName];
}

/**
 * `text` without its HTML comments (the hints of the template), removed until none is left: one pass over `<!-<!---->-` would leave
 * `<!--` behind. Only used to tell whether a section has words of its own; nothing here is shown as HTML.
 */
export function withoutComments(text) {
  let out = text;
  for (;;) {
    const open = out.indexOf('<!--');
    if (open < 0) return out;
    const close = out.indexOf('-->', open + 4);
    // An unclosed comment hides everything after it, as it does on GitHub.
    out = close < 0 ? out.slice(0, open) : out.slice(0, open) + out.slice(close + 3);
  }
}

/**
 * The arguments of the merge: a squash whose title is the commit's subject, with no body (GitHub would list every commit); the pull
 * request that merges main back into develop is a merge commit instead (a squash would leave main's history out of develop's again).
 */
export function mergeArgs(n, pr) {
  const how = isSyncPullRequest(pr.baseRefName, pr.headRefName) ? '--merge' : '--squash';
  return ['pr', 'merge', String(n), how, '--match-head-commit', pr.headRefOid, '--subject', pr.title, '--body', ''];
}

/** The headings of a review, in order; 指摘 holds the findings that block the merge, 任意 the ones that do not. */
export const REVIEW_SECTIONS = ['総評', '前回の指摘', '指摘', '任意'];

/**
 * Why `text` is not a review in the agreed shape, for `verdict` and the commit `sha` it read: a GitHub alert box with the verdict,
 * the counts and the commit, then the sections in order.
 *   > [!CAUTION]                              (ok: > [!TIP])
 *   > **判定: NG**　指摘 1 件・任意 2 件（e8051a61 を確認）     (ok: **判定: OK**; the counts are those of the sections below)
 *
 *   #### 総評
 *   <one or two sentences, what is right and what is wrong>
 *
 *   #### 前回の指摘
 *   - <what became of the earlier findings, or なし>
 *
 *   #### 指摘                                 (changes: one item or more; ok: none, the section left out)
 *   1. **`path/to/file.ext:12`**
 *      - 問題: <what goes wrong>
 *      - 直し方: <what to do>
 *
 *   #### 任意                                 (optional)
 *   - **`path/to/file.ext:3`** <a finding that does not block the merge>
 */
export function reviewProblems(verdict, text, sha) {
  const lines = (text ?? '').replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd());
  const solid = lines.filter((l) => l.trim());
  const problems = [];
  const box = verdict === 'ok' ? '> [!TIP]' : '> [!CAUTION]';
  const word = verdict === 'ok' ? 'OK' : 'NG';
  if (solid[0]?.trim() !== box) problems.push(`the first line is "${box}" alone`);
  const first = lines.findIndex((l) => l.trim());
  if (first >= 0 && !lines[first + 1]?.trim()) problems.push('the 判定 line goes right under the box line, with no blank line (or GitHub draws no box)');
  const head = /^> \*\*判定: (OK|NG)\*\*\s+指摘 (\d+) 件・任意 (\d+) 件（([0-9a-f]{8}) を確認）$/.exec(solid[1]?.trim() ?? '');
  if (!head) problems.push(`the second line is "> **判定: ${word}**　指摘 N 件・任意 M 件（<the first 8 of the commit> を確認）"`);
  else if (head[1] !== word) problems.push(`the verdict is "判定: ${word}" for ${verdict}`);
  const section = (name) => {
    const at = lines.findIndex((l) => l.trim() === `#### ${name}`);
    if (at < 0) return null;
    const end = lines.findIndex((l, i) => i > at && /^#{1,4} /.test(l.trim()));
    return lines.slice(at + 1, end < 0 ? lines.length : end).filter((l) => l.trim());
  };
  let last = -1;
  for (const name of REVIEW_SECTIONS) {
    const at = lines.findIndex((l) => l.trim() === `#### ${name}`);
    if (at >= 0 && at < last) problems.push(`the section "#### ${name}" is out of order`);
    if (at >= 0) last = at;
  }
  if (!section('総評')?.length) problems.push('the section "#### 総評" is needed: one or two sentences');
  const earlier = section('前回の指摘');
  if (!earlier?.length) problems.push('the section "#### 前回の指摘" is needed, with "- なし" in a first review');
  const findings = section('指摘') ?? [];
  const items = [];
  for (const l of findings) {
    if (/^\d+\. /.test(l)) items.push({ head: l, problem: false, fix: false });
    else if (items.length && /^\s+- 問題: \S/.test(l)) items[items.length - 1].problem = true;
    else if (items.length && /^\s+- 直し方: \S/.test(l)) items[items.length - 1].fix = true;
  }
  const optional = (section('任意') ?? []).filter((l) => l.startsWith('- ')).length;
  if (verdict === 'changes' && !items.length) problems.push('changes is asked without a finding under "#### 指摘"');
  if (verdict === 'ok' && items.length) problems.push('ok is given with a finding under "#### 指摘"; move it to "#### 任意" or ask for changes');
  for (const it of items) {
    if (!/^\d+\. \*\*`[^`\s]+:\d+`\*\*$/.test(it.head)) problems.push(`a finding starts with its place alone, "1. **\`file.ext:line\`**": "${it.head.slice(0, 50)}"`);
    if (!it.problem || !it.fix) problems.push(`a finding needs the lines "   - 問題: ..." and "   - 直し方: ...": "${it.head.slice(0, 50)}"`);
  }
  if (head && Number(head[2]) !== items.length) problems.push(`the box says 指摘 ${head[2]} 件; the section has 指摘 ${items.length} 件`);
  if (head && Number(head[3]) !== optional) problems.push(`the box says 任意 ${head[3]} 件; the section has 任意 ${optional} 件`);
  if (head && sha && head[4] !== sha.slice(0, 8)) problems.push(`the box names ${head[4]}; the commit reviewed is ${sha.slice(0, 8)}`);
  return problems;
}

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', cwd: opts.cwd ?? process.cwd(), maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const gh = (args, opts) => run('gh', args, opts);
const git = (args, opts) => run('git', args, opts);

function view(n) {
  return JSON.parse(gh(['pr', 'view', String(n), '--json', 'number,title,body,state,isDraft,headRefOid,headRefName,baseRefName,isCrossRepository,reviews,url']));
}

function allChecks(n) {
  try {
    return JSON.parse(gh(['pr', 'checks', String(n), '--json', 'name,bucket,startedAt']));
  } catch (e) {
    // `gh pr checks` exits non-zero while checks fail or run; its JSON is still on stdout.
    const out = e.stdout?.toString() ?? '';
    if (out.trim().startsWith('[')) return JSON.parse(out);
    if (/no checks reported/i.test(`${e.stderr}`)) return [];
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

/** Whether `oid` is an ancestor of `ref` in the repository at `cwd`: true, false, or null when git cannot answer. */
export function isAncestorOf(cwd, oid, ref) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', oid, ref], { cwd, stdio: 'ignore' });
    return true;
  } catch (e) {
    return e.status === 1 ? false : null;
  }
}

/**
 * Whether merging `theirs` into `ours` leaves the tree of `ours` as it is (`git merge-tree`, nothing is written to a branch): true when
 * `theirs` brings nothing new. False for a conflict or a change only `theirs` has; null when git cannot answer.
 */
export function mergeKeepsTree(cwd, ours, theirs) {
  const g = (args) => execFileSync('git', args, { encoding: 'utf8', cwd, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const merged = g(['merge-tree', '--write-tree', ours, theirs]).trim().split(/\r?\n/)[0];
    return merged === g(['rev-parse', `${ours}^{tree}`]).trim();
  } catch (e) {
    return e.status === 1 ? false : null;
  }
}

/** Whether the tree of `mainRef` is the tree of some commit in the history of `developRef`: true after a release that was a snapshot of develop. */
export function mainIsAStateOfDevelop(cwd, mainRef, developRef) {
  const g = (args) => execFileSync('git', args, { encoding: 'utf8', cwd, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const tree = g(['rev-parse', `${mainRef}^{tree}`]).trim();
    return g(['log', '--format=%T', developRef]).split(/\r?\n/).includes(tree);
  } catch {
    return null;
  }
}

/** The merge commit `sync` pushes when the plain merge conflicts: develop's own tree, with develop and main as parents. Nothing is checked out. */
export function syncCommit(cwd, mainRef, developRef, message) {
  const g = (args) => execFileSync('git', args, { encoding: 'utf8', cwd, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return g(['commit-tree', `${developRef}^{tree}`, '-p', developRef, '-p', mainRef, '-m', message]);
}

/**
 * Whether `headRef` (a sync/<id> branch) is only the merge of main into develop: develop's own tree, with develop and main both in its
 * history. True, false, or null when git cannot answer.
 */
export function syncBranchIsSafe(cwd, headRef, developRef, mainRef) {
  const g = (args) => execFileSync('git', args, { encoding: 'utf8', cwd, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    const same = g(['rev-parse', `${headRef}^{tree}`]) === g(['rev-parse', `${developRef}^{tree}`]);
    return same && isAncestorOf(cwd, developRef, headRef) === true && isAncestorOf(cwd, mainRef, headRef) === true;
  } catch {
    return null;
  }
}

/**
 * Whether merging main into develop leaves develop's tree as it is (`git merge-tree` of the two, against develop's own tree): true after a
 * squash release whose content develop already has. False for a conflict or a change only main has; null when git cannot answer.
 */
function syncIsSafe(headOid) {
  try {
    git(['fetch', 'origin', WORK_BRANCH, RELEASE_BRANCH]);
    // The tree tried is that of the pull request's own head, not of a main that moved since.
    if (git(['rev-parse', `origin/${RELEASE_BRANCH}`]).trim() !== headOid) return null;
    return mergeKeepsTree(process.cwd(), `origin/${WORK_BRANCH}`, `origin/${RELEASE_BRANCH}`);
  } catch {
    return null;
  }
}

/** Whether the sync/<id> branch at `headOid` is only the merge of main into develop (`syncBranchIsSafe`); null when git cannot answer. */
function syncBranchSafe(headOid) {
  try {
    git(['fetch', 'origin', WORK_BRANCH, RELEASE_BRANCH]);
    return syncBranchIsSafe(process.cwd(), headOid, `origin/${WORK_BRANCH}`, `origin/${RELEASE_BRANCH}`);
  } catch {
    return null;
  }
}

/** The open code scanning (CodeQL) alerts of the pull request's merge result (GitHub answers [] before any scan); null when gh fails. */
function openAlerts(n) {
  try {
    const count = Number(gh(['api', `repos/{owner}/{repo}/code-scanning/alerts?ref=refs/pull/${n}/merge&state=open&per_page=100`, '--jq', 'length']).trim());
    return Number.isInteger(count) ? count : null;
  } catch {
    return null;
  }
}

/** When the pull request was last made ready for review (ISO time), or null when it never was a draft. */
function readySince(n) {
  const times = gh(['api', '--paginate', `repos/{owner}/{repo}/issues/${n}/events`, '--jq', '.[] | select(.event == "ready_for_review") | .created_at']);
  return times.split(/\r?\n/).filter(Boolean).sort().pop() ?? null;
}

/**
 * The time from which runs count (`freshChecks`): `shown` is the last ready time the events API shows now, `before` the one it showed
 * before this `merge` ran `gh pr ready`, `floor` the local moment before that call (null when this `merge` did not make it ready). The
 * events API can lag: until it shows a time after `before`, the floor holds the runs of an earlier round back; once it does, that time
 * alone, so a local clock running ahead cannot hold the fresh runs back. A `merge` run again later has no floor and trusts the events.
 */
export function readyFrom(shown, before, floor) {
  if (!floor) return shown ?? null;
  return shown && (!before || shown > before) ? shown : floor;
}

function decisionOf(n, guard = { before: null, floor: null }) {
  const pr = view(n);
  // Only a pull request into main (a release) is tested: into develop nothing runs, so there is nothing to wait for.
  const gated = pr.baseRefName === RELEASE_BRANCH;
  const since = pr.isDraft || !gated ? null : readyFrom(readySince(n), guard.before, guard.floor);
  const checks = gated ? gatingChecks(freshChecks(allChecks(n), since), requiredNames()) : [];
  const verdict = reviewVerdict(pr.reviews ?? [], pr.headRefOid, me());
  const sync = isSyncPullRequest(pr.baseRefName, pr.headRefName);
  let snapshot = null;
  if (gated) {
    try {
      git(['fetch', 'origin', WORK_BRANCH]);
      snapshot = isAncestorOf(process.cwd(), pr.headRefOid, `origin/${WORK_BRANCH}`);
    } catch {
      snapshot = null;
    }
  }
  const decision = mergeDecision({
    checks: gated ? checksState(checks) : 'pass',
    verdict,
    state: pr.state,
    draft: pr.isDraft,
    base: pr.baseRefName,
    head: pr.headRefName,
    fork: pr.isCrossRepository,
    title: titleProblems(pr.title),
    body: bodyProblems(pr.body),
    alerts: gated ? openAlerts(n) : 0,
    syncSafe: sync ? (pr.headRefName === RELEASE_BRANCH ? syncIsSafe(pr.headRefOid) : syncBranchSafe(pr.headRefOid)) : null,
    snapshot,
  });
  return { pr, checks, decision, verdict };
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const arg = (argv, flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);

function main(argv) {
  const [cmd, n] = argv;
  if (cmd === 'open') {
    const release = argv.includes('--release');
    // A release is a snapshot of the remote develop (a release/<n> branch) into main, whatever this checkout holds; a work branch is the checked out one.
    let branch = release ? null : git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    if (!release && [RELEASE_BRANCH, WORK_BRANCH, 'HEAD'].includes(branch)) throw new Error(`open a pull request from a work branch, not from ${branch}`);
    if (!release && isReleaseBranch(branch)) throw new Error(`${branch} is a release snapshot: open it with --release`);
    if (!release && isSyncBranch(branch)) throw new Error(`${branch} is made by pr.mjs sync: run that instead`);
    const base = release ? RELEASE_BRANCH : WORK_BRANCH;
    git(['fetch', 'origin', WORK_BRANCH, base]);
    if (release) {
      // an open release pull request, to update its description or bring its snapshot up to develop
      const opened = JSON.parse(gh(['pr', 'list', '--base', RELEASE_BRANCH, '--state', 'open', '--json', 'headRefName'])).map((p) => p.headRefName).filter(isReleaseBranch);
      if (arg(argv, '--title') || arg(argv, '--name')) {
        branch = releaseBranchName(arg(argv, '--title'), arg(argv, '--name'));
        const other = opened.filter((b) => b !== branch);
        if (other.length) throw new Error(`the release pull request ${other[0]} is open: finish or close it first (or run this with no --title to update it)`);
      } else {
        if (opened.length !== 1) throw new Error(`--title "chore: v<version> をリリースする" (or --name) is needed: ${opened.length} release pull requests are open`);
        branch = opened[0];
      }
    }
    const subjects = release ? ['release'] : git(['log', '--format=%s', `origin/${WORK_BRANCH}..HEAD`]).split(/\r?\n/).filter(Boolean).reverse();
    const open = JSON.parse(gh(['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number,url']));
    // Checked before anything leaves the machine: the title becomes the commit on the base, the body is the description.
    const given = arg(argv, '--title');
    const bodyFile = arg(argv, '--body-file');
    const title = open.length ? given : titleFor(given, subjects);
    const titleIssues = title ? titleProblems(title) : [];
    if (titleIssues.length) throw new Error(`the title cannot be the commit on ${base}:\n  ${titleIssues.join('\n  ')}`);
    const body = bodyFile ? readFileSync(bodyFile, 'utf8') : null;
    if (!open.length && body === null) throw new Error('--body-file <description> is needed: fill in .github/pull_request_template.md');
    const bodyIssues = body === null ? [] : bodyProblems(body);
    if (bodyIssues.length) throw new Error(`the description is not complete:\n  ${bodyIssues.join('\n  ')}`);
    // The snapshot: origin/develop as it is now, onto the release branch (a fast-forward: nothing is forced).
    if (release) git(['push', 'origin', `origin/${WORK_BRANCH}:refs/heads/${branch}`]);
    else git(['push', '-u', 'origin', 'HEAD']);
    if (open.length) {
      const edit = [...(title ? ['--title', title] : []), ...(body !== null ? ['--body', body] : [])];
      if (edit.length) gh(['pr', 'edit', String(open[0].number), ...edit]);
      console.log(`pr: pushed${edit.length ? ' and updated' : ''}; #${open[0].number} is open: ${open[0].url}`);
      return 0;
    }
    // Into main a draft: reviewed with no CI; `merge` makes it ready once the review of its head is ok (mergeDecision). Into develop it is
    // a plain pull request: nothing runs on it.
    console.log(gh(['pr', 'create', ...(release ? ['--draft'] : []), '--base', base, '--head', branch, '--title', title, '--body', body]).trim());
    return 0;
  }
  if (cmd === 'sync') {
    git(['fetch', 'origin', WORK_BRANCH, RELEASE_BRANCH]);
    const behind = git(['rev-list', '--count', `origin/${WORK_BRANCH}..origin/${RELEASE_BRANCH}`]).trim();
    if (behind === '0') {
      console.log(`pr: ${WORK_BRANCH} already has everything of ${RELEASE_BRANCH}: nothing to merge back`);
      return 0;
    }
    const open = JSON.parse(gh(['pr', 'list', '--base', WORK_BRANCH, '--state', 'open', '--json', 'number,url,headRefName'])).filter((p) => isSyncPullRequest(WORK_BRANCH, p.headRefName));
    if (open.length) {
      console.log(`pr: #${open[0].number} is open: ${open[0].url}`);
      return 0;
    }
    let head = RELEASE_BRANCH;
    if (syncIsSafe(git(['rev-parse', `origin/${RELEASE_BRANCH}`]).trim()) !== true) {
      // The plain merge conflicts (develop changed lines the release changed too). Safe only when main is a state develop once had: then
      // the merge commit that keeps develop's tree loses nothing of main.
      if (mainIsAStateOfDevelop(process.cwd(), `origin/${RELEASE_BRANCH}`, `origin/${WORK_BRANCH}`) !== true) {
        console.error(`pr: merging ${RELEASE_BRANCH} into ${WORK_BRANCH} conflicts, and ${RELEASE_BRANCH} is not a state ${WORK_BRANCH} once had: a person looks at it`);
        return 1;
      }
      const sha = git(['rev-parse', '--short=8', `origin/${RELEASE_BRANCH}`]).trim();
      head = `${SYNC_PREFIX}${sha}`;
      const commit = syncCommit(process.cwd(), `origin/${RELEASE_BRANCH}`, `origin/${WORK_BRANCH}`, SYNC_TITLE);
      git(['push', 'origin', `${commit}:refs/heads/${head}`]);
    }
    console.log(gh(['pr', 'create', '--base', WORK_BRANCH, '--head', head, '--title', SYNC_TITLE, '--body', SYNC_BODY]).trim());
    return 0;
  }
  if (cmd === 'review' && n) {
    const verdict = arg(argv, '--verdict');
    const read = arg(argv, '--sha');
    const file = arg(argv, '--body-file');
    if (!file || !read) throw new Error('--sha <the commit the reviewer read> and --body-file <review text> are needed');
    const text = readFileSync(file, 'utf8').trim();
    const shape = reviewProblems(verdict, text, read);
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
    console.log(`pr: #${n} head ${pr.headRefOid.slice(0, 8)}, checks ${checksState(checks)}, agent review ${verdict}: ${decision.reason}`);
    return decision.merge ? 0 : 1;
  }
  if (cmd === 'merge' && n) {
    const deadline = Date.now() + 60 * 60_000;
    let state = decisionOf(n);
    // The events API can lag behind `gh pr ready`: until it shows this ready_for_review, the runs of an earlier round would count as
    // fresh (readyFrom). This holds within one `merge`; a `merge` started again right after `gh pr ready` trusts the events API.
    const guard = { before: null, floor: null };
    const ready = () => {
      guard.before = readySince(n);
      guard.floor = new Date(Date.now() - 30_000).toISOString().replace(/\.\d+Z$/, 'Z');
      gh(['pr', 'ready', String(n)]);
      console.log(`pr: #${n} made ready for review: the checks start`);
      state = decisionOf(n, guard);
    };
    if (state.decision.ready) ready();
    while (argv.includes('--wait') && state.decision.wait && Date.now() < deadline) {
      sleep(30_000);
      state = decisionOf(n, guard);
      if (state.decision.ready) ready();
    }
    if (!state.decision.merge) {
      console.error(`pr: #${n} not merged: ${state.decision.reason}`);
      for (const c of state.checks.filter((x) => x.bucket !== 'pass' && x.bucket !== 'skipping')) console.error(`  ${c.bucket} ${c.name}`);
      if (state.decision.toDraft && !state.pr.isDraft) {
        gh(['pr', 'ready', String(n), '--undo']);
        console.error(`pr: #${n} is a draft again: fix, push, review, then merge again`);
      }
      return 1;
    }
    // --match-head-commit: GitHub refuses the merge if a commit arrived after the review was read.
    gh(mergeArgs(n, state.pr));
    try {
      // The head branch is in this repository (mergeDecision refuses a fork). The lease deletes it only while it is still at the merged
      // head: a commit pushed to it after the merge is kept. develop and main are never deleted.
      const del = deleteBranchArgs(state.pr);
      if (del) git(del);
    } catch {
      // already deleted (the repository may delete merged branches itself), or moved since the merge (kept)
    }
    console.log(`pr: #${n} merged (${state.pr.url})`);
    try {
      const mainTree = git(['worktree', 'list', '--porcelain'], { cwd: ROOT }).split(/\r?\n/).find((l) => l.startsWith('worktree '))?.slice(9).trim();
      if (mainTree && git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: mainTree }).trim() === WORK_BRANCH) {
        git(['pull', '--ff-only', 'origin', WORK_BRANCH], { cwd: mainTree });
        console.log(`pr: ${mainTree} fast-forwarded to origin/${WORK_BRANCH}`);
      }
    } catch (e) {
      console.error(`pr: could not fast-forward the main checkout (${`${e.stderr ?? e.message}`.trim().split('\n')[0]}); run git pull --ff-only there`);
    }
    return 0;
  }
  console.error('usage: node scripts/tools/pr.mjs open [--release] --body-file <f> [--title t] | sync | review <n> --verdict ok|changes --sha <commit> --body-file <f> | status <n> | merge <n> [--wait]');
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
