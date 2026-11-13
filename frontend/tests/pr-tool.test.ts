// The merge rule of a pull request (scripts/tools/pr.mjs): a work branch goes into develop on an agent review, by the signed-in account,
// that says ok for exactly the head commit (nothing is tested there); develop goes into main as a release, also on green required checks
// and CodeQL; main goes back into develop when that changes nothing in develop; only pull requests of this repository; and the title
// that becomes the squashed commit.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { BODY_SECTIONS, CODEQL_CHECKS, bodyProblems, checksState, deleteBranchArgs, freshChecks, gatingChecks, isAncestorOf, isReleaseBranch, isSyncBranch, isSyncPullRequest, mainIsAStateOfDevelop, mergeKeepsTree, releaseBranchName, syncBranchIsSafe, syncCommit, readyFrom, mergeArgs, mergeDecision, reviewFree, reviewMark, reviewProblems, reviewVerdict, titleFor, titleProblems, withMissing, withoutComments } from '../../scripts/tools/pr.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HEAD = 'a'.repeat(40);
const OLD = 'b'.repeat(40);
const ME = 'owner';
const review = (body: string, submittedAt: string, login = ME) => ({ author: { login }, body, submittedAt });
// A release: a snapshot of develop into main, the one pull request whose checks and code scanning alerts a merge waits for.
const release = (o: Record<string, unknown>) => mergeDecision({ base: 'main', head: 'release/v1.0.0', snapshot: true, ...o });

describe('the agent review mark', () => {
  it('is read back for the commit it names, and the latest review of that commit wins', { tags: ['state-transition'] }, () => {
    const reviews = [review(`${reviewMark('changes', HEAD)}\n\nfix the test`, '2026-11-12T01:00:00Z'), review(`${reviewMark('ok', HEAD)}\n\nfine now`, '2026-11-12T02:00:00Z')];
    expect(reviewVerdict(reviews, HEAD, ME)).toBe('ok');
    expect(reviewVerdict([...reviews].reverse(), HEAD, ME)).toBe('ok');
  });

  it('counts only the signed-in account: anyone can review a public pull request', { tags: ['error-guessing', 'regression'] }, () => {
    const reviews = [review(reviewMark('changes', HEAD), '2026-11-12T01:00:00Z'), review(reviewMark('ok', HEAD), '2026-11-12T02:00:00Z', 'stranger')];
    expect(reviewVerdict(reviews, HEAD, ME)).toBe('changes');
    expect(reviewVerdict(reviews, HEAD, '')).toBe('none');
  });

  it('does not count a review of an older commit, a mark that is not at the start, or a review without one', { tags: ['error-guessing'] }, () => {
    expect(reviewVerdict([review(reviewMark('ok', OLD), '1')], HEAD, ME)).toBe('none');
    expect(reviewVerdict([review(`as the bot said:\n${reviewMark('ok', HEAD)}`, '1')], HEAD, ME)).toBe('none');
    expect(reviewVerdict([review('LGTM', '1'), review('', '2')], HEAD, ME)).toBe('none');
  });

  it('does not take a short mark that matches the start of the head', { tags: ['boundary', 'regression'] }, () => {
    expect(reviewVerdict([review('<!-- agent-review verdict=ok sha=aaaaaaa -->', '1')], HEAD, ME)).toBe('none');
    expect(reviewVerdict([review(`<!-- agent-review verdict=ok sha=${'a'.repeat(39)} -->`, '1')], HEAD, ME)).toBe('none');
  });

  it('refuses a verdict other than ok or changes, and a short commit id', { tags: ['error-guessing'] }, () => {
    expect(() => reviewMark('approve', HEAD)).toThrow(/verdict/);
    expect(() => reviewMark('ok', 'abc1234')).toThrow(/full commit id/);
  });
});

describe('the required checks of a pull request', () => {
  it.each([
    [[{ name: 'static', bucket: 'pass' }, { name: 'flaky', bucket: 'skipping' }], 'pass'],
    [[{ name: 'static', bucket: 'pass' }, { name: 'vitest', bucket: 'pending' }], 'pending'],
    [[{ name: 'static', bucket: 'fail' }, { name: 'vitest', bucket: 'pending' }], 'fail'],
    [[{ name: 'static', bucket: 'cancel' }], 'fail'],
    [[], 'pending'],
  ])('%j is %s', { tags: ['equivalence'] }, (checks, state) => {
    expect(checksState(checks)).toBe(state);
  });
});

describe('the merge decision', () => {
  it('merges only an open, ready pull request with passing checks and an ok review of its head', { tags: ['decision-table'] }, () => {
    expect(release({ checks: 'pass', verdict: 'ok' })).toMatchObject({ merge: true });
    expect(release({ checks: 'pass', verdict: 'none' })).toMatchObject({ merge: false, wait: false });
    expect(release({ checks: 'pass', verdict: 'changes' })).toMatchObject({ merge: false, wait: false });
    expect(release({ checks: 'fail', verdict: 'ok' })).toMatchObject({ merge: false, wait: false });
    expect(release({ checks: 'pending', verdict: 'ok' })).toMatchObject({ merge: false, wait: true });
    expect(release({ checks: 'pass', verdict: 'ok', state: 'MERGED' })).toMatchObject({ merge: false });
  });

  it('merges only into develop or main, and never a pull request from another repository', { tags: ['condition', 'regression'] }, () => {
    expect(release({ checks: 'pass', verdict: 'ok', base: 'release/v1' })).toMatchObject({ merge: false, reason: expect.stringContaining('not develop or main') });
    expect(release({ checks: 'pass', verdict: 'ok', fork: true })).toMatchObject({ merge: false, reason: expect.stringContaining('another repository') });
  });

  it('lets only a release snapshot into main: a work branch, and develop itself, are never a release', { tags: ['condition', 'regression'] }, () => {
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', base: 'main', head: '20261112_x' })).toMatchObject({ merge: false, reason: expect.stringContaining('only a release') });
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', base: 'main', head: '' })).toMatchObject({ merge: false });
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', base: 'main', head: 'develop' })).toMatchObject({ merge: false });
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', base: 'main', head: 'release/v1.0.0', snapshot: true })).toMatchObject({ merge: true });
  });

  it('lets a release branch into main only while it holds nothing that develop does not: the name alone proves nothing', { tags: ['condition', 'regression'] }, () => {
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', base: 'main', head: 'release/x', snapshot: false })).toMatchObject({ merge: false, reason: expect.stringContaining('not a snapshot') });
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', base: 'main', head: 'release/x', snapshot: null })).toMatchObject({ merge: false, reason: expect.stringContaining('cannot be told') });
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', base: 'main', head: 'release/x' })).toMatchObject({ merge: false });
  });

  it('never takes a release snapshot as a work branch into develop', { tags: ['condition'] }, () => {
    expect(mergeDecision({ verdict: 'ok', base: 'develop', head: 'release/v1.0.0' })).toMatchObject({ merge: false, reason: expect.stringContaining('release snapshot') });
  });

  it('asks for a review before it waits for checks, so a missing review is never waited out', { tags: ['condition'] }, () => {
    expect(release({ checks: 'pending', verdict: 'none' })).toMatchObject({ merge: false, wait: false, reason: expect.stringContaining('review') });
  });
});

describe('a pull request into develop', () => {
  const into = (o: Record<string, unknown>) => mergeDecision({ base: 'develop', head: '20261112_x', ...o });

  it('needs the ok review of its head and nothing else: no CI, no CodeQL, no alerts', { tags: ['decision-table', 'regression'] }, () => {
    // The checks and alerts of a pull request into develop are never read: whatever they are, they do not decide.
    expect(into({ checks: 'pending', verdict: 'ok', alerts: 3 })).toMatchObject({ merge: true, wait: false });
    expect(into({ checks: 'fail', verdict: 'ok' })).toMatchObject({ merge: true });
    expect(into({ checks: 'pass', verdict: 'none' })).toMatchObject({ merge: false, wait: false, reason: expect.stringContaining('review') });
    expect(into({ checks: 'pass', verdict: 'changes' })).toMatchObject({ merge: false, wait: false });
  });

  it('is still refused for a bad title or description, another repository, or a draft (made ready first)', { tags: ['error-guessing'] }, () => {
    expect(into({ verdict: 'ok', title: titleProblems('update stuff') })).toMatchObject({ merge: false, reason: expect.stringContaining('title') });
    expect(into({ verdict: 'ok', body: bodyProblems('') })).toMatchObject({ merge: false, reason: expect.stringContaining('description') });
    expect(into({ verdict: 'ok', fork: true })).toMatchObject({ merge: false });
    expect(into({ verdict: 'ok', draft: true })).toMatchObject({ merge: false, ready: true });
  });
});

describe('the snapshot branch of a release', () => {
  it('is release/<name>, with the name from the version in the title or from --name', { tags: ['equivalence'] }, () => {
    expect(releaseBranchName('chore: v0.6.0 をリリースする', undefined)).toBe('release/v0.6.0');
    expect(releaseBranchName('chore: v1.0.0-rc.1 をリリースする', undefined)).toBe('release/v1.0.0-rc.1');
    expect(releaseBranchName('chore: develop の運用を main に入れる', 'develop-flow')).toBe('release/develop-flow');
  });

  it('is refused for a title without a version and no name, and for a name that is not a branch name part', { tags: ['error-guessing', 'boundary'] }, () => {
    expect(() => releaseBranchName('chore: 運用を入れる', undefined)).toThrow('version in the title');
    expect(() => releaseBranchName(undefined, undefined)).toThrow();
    expect(() => releaseBranchName('chore: v1.0.0 をリリースする', '../x')).toThrow('--name');
    expect(() => releaseBranchName('chore: v1.0.0 をリリースする', 'a b')).toThrow('--name');
  });

  it('is recognised by its prefix and nothing looser', { tags: ['boundary'] }, () => {
    expect(isReleaseBranch('release/v0.6.0')).toBe(true);
    for (const no of ['develop', 'main', 'release', 'release/', 'releases/v1', 'x/release/v1', 'release/../x', '', undefined]) expect(isReleaseBranch(no)).toBe(false);
  });
});

describe('the git questions of the merge rules, in a real repository', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'novira-pr-'));
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' });
  const put = (file: string, text: string, msg: string) => {
    writeFileSync(path.join(dir, file), text);
    git('add', '-A');
    git('commit', '-q', '-m', msg);
  };
  const lines = (...n: string[]) => `${n.join('\n')}\n`;

  it('tell a snapshot of develop from a branch with commits of its own, and whether main still changes develop', { tags: ['regression', 'state-transition'] }, () => {
    try {
      git('init', '-q', '-b', 'base');
      // syncCommit runs its own git: the repository's identity lets it commit where no global one is set (CI)
      git('config', 'user.name', 't');
      git('config', 'user.email', 't@example.com');
      put('version.txt', lines('1', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'), 'start');
      put('other.txt', 'x', 'other');
      // develop gets the release preparation; the snapshot is that commit; main is a squash of it
      git('checkout', '-q', '-b', 'develop', 'base');
      put('version.txt', lines('2', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'), 'prepare');
      git('branch', 'release/v2', 'develop');
      git('checkout', '-q', '-b', 'main', 'base');
      git('merge', '--squash', 'release/v2');
      git('commit', '-q', '-m', 'release');
      git('checkout', '-q', '-b', 'stray', 'base');
      put('stray.txt', 'x', 'stray');
      const oid = (ref: string) => git('rev-parse', ref).trim();
      // the snapshot is on develop; a branch with its own commit is not
      expect(isAncestorOf(dir, oid('release/v2'), 'develop')).toBe(true);
      expect(isAncestorOf(dir, oid('stray'), 'develop')).toBe(false);
      expect(isAncestorOf(dir, 'not-a-commit', 'develop')).toBeNull();
      // develop takes more work: in another file (clean) or at the other end of the same file (clean), then in the very line the release changed
      git('checkout', '-q', 'develop');
      put('other.txt', 'y', 'more work in another file');
      expect(mergeKeepsTree(dir, 'develop', 'main')).toBe(true);
      put('version.txt', lines('2', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'j'), 'more work at the other end');
      expect(mergeKeepsTree(dir, 'develop', 'main')).toBe(true);
      put('version.txt', lines('3', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'j'), 'more work in the line the release changed');
      expect(mergeKeepsTree(dir, 'develop', 'main')).toBe(false);
      // a change only main has is never a no-op
      git('checkout', '-q', 'main');
      put('hotfix.txt', 'z', 'a change made on main alone');
      git('checkout', '-q', 'base');
      git('checkout', '-q', '-b', 'develop2', 'release/v2');
      expect(mergeKeepsTree(dir, 'develop2', 'main')).toBe(false);
      // git answers a ref it cannot merge with the status of a conflict: read as "changes develop", the safe side
      expect(mergeKeepsTree(dir, 'develop', 'no-such-ref')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the merge back when develop changed what the release changed', () => {
  it('is a sync/<id> branch, merged like the one from main', { tags: ['equivalence', 'boundary'] }, () => {
    expect(isSyncBranch('sync/90b1d6c0')).toBe(true);
    for (const no of ['sync', 'sync/', 'syncs/x', 'x/sync/a', 'sync/../x', 'main', undefined]) expect(isSyncBranch(no)).toBe(false);
    expect(isSyncPullRequest('develop', 'main')).toBe(true);
    expect(isSyncPullRequest('develop', 'sync/90b1d6c0')).toBe(true);
    expect(isSyncPullRequest('develop', '20261112_x')).toBe(false);
    expect(isSyncPullRequest('main', 'sync/90b1d6c0')).toBe(false);
    expect(mergeDecision({ base: 'develop', head: 'sync/90b1d6c0', syncSafe: true })).toMatchObject({ merge: true });
    expect(mergeDecision({ base: 'develop', head: 'sync/90b1d6c0', syncSafe: false })).toMatchObject({ merge: false });
    expect(mergeDecision({ base: 'main', head: 'sync/90b1d6c0', checks: 'pass', verdict: 'ok', snapshot: true })).toMatchObject({ merge: false });
    expect(mergeArgs(41, { headRefOid: HEAD, title: 'chore: main を develop に戻す', baseRefName: 'develop', headRefName: 'sync/90b1d6c0' })).toContain('--merge');
  });

  it('is made only when main is a state develop once had, and keeps develop\'s tree with both as parents', { tags: ['regression', 'state-transition'] }, () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'novira-sync-'));
    const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' }).trim();
    const put = (file: string, text: string, msg: string) => {
      writeFileSync(path.join(dir, file), text);
      git('add', '-A');
      git('commit', '-q', '-m', msg);
    };
    try {
      git('init', '-q', '-b', 'base');
      // syncCommit runs its own git: the repository's identity lets it commit where no global one is set (CI)
      git('config', 'user.name', 't');
      git('config', 'user.email', 't@example.com');
      put('table.txt', 'rows: 10\n', 'start');
      git('checkout', '-q', '-b', 'develop', 'base');
      put('table.txt', 'rows: 11\n', 'work in the table, then the release');
      git('checkout', '-q', '-b', 'main', 'base');
      git('merge', '--squash', 'develop');
      git('commit', '-q', '-m', 'release');
      git('checkout', '-q', 'develop');
      put('table.txt', 'rows: 12\n', 'more work in the very line the release changed');
      // the plain merge conflicts, but main is a state develop had
      expect(mergeKeepsTree(dir, 'develop', 'main')).toBe(false);
      expect(mainIsAStateOfDevelop(dir, 'main', 'develop')).toBe(true);
      const commit = syncCommit(dir, 'main', 'develop', 'chore: main を develop に戻す');
      expect(git('rev-parse', `${commit}^{tree}`)).toBe(git('rev-parse', 'develop^{tree}'));
      expect(git('rev-list', '--parents', '-n', '1', commit).split(' ').slice(1)).toEqual([git('rev-parse', 'develop'), git('rev-parse', 'main')]);
      git('branch', 'sync/x', commit);
      expect(syncBranchIsSafe(dir, 'sync/x', 'develop', 'main')).toBe(true);
      // develop goes on after the branch was made: the branch is still only the merge back (it changes nothing against its first parent)
      git('checkout', '-q', 'develop');
      put('later.txt', 'l', 'work that came later');
      expect(syncBranchIsSafe(dir, 'sync/x', 'develop', 'main')).toBe(true);
      // a branch with a tree of its own, or a single parent, is not just the merge back
      git('checkout', '-q', 'sync/x');
      put('extra.txt', 'x', 'something else');
      expect(syncBranchIsSafe(dir, 'sync/x', 'develop', 'main')).toBe(false);
      // a main with a change develop never had is not a state of develop: no merge commit is made for it, and a branch someone made
      // with develop's tree and main as a parent (dropping the change) is refused too
      git('checkout', '-q', 'main');
      put('hotfix.txt', 'z', 'a change made on main alone');
      expect(mainIsAStateOfDevelop(dir, 'main', 'develop')).toBe(false);
      const forged = syncCommit(dir, 'main', 'develop', 'forged');
      git('branch', 'sync/forged', forged);
      expect(syncBranchIsSafe(dir, 'sync/forged', 'develop', 'main')).toBe(false);
      expect(syncBranchIsSafe(dir, 'no-such-branch', 'develop', 'main')).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('a sync branch whose first parent is older than an earlier sync', () => {
  it('is refused when merging it would revert develop\'s later work (two merge bases)', { tags: ['regression', 'state-transition'] }, () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'novira-sync2-'));
    const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' }).trim();
    const put = (file: string, msg: string) => {
      writeFileSync(path.join(dir, file), file);
      git('add', '-A');
      git('commit', '-q', '-m', msg);
    };
    try {
      git('init', '-q', '-b', 'main');
      // syncCommit runs its own git: the repository's identity lets it commit where no global one is set (CI)
      git('config', 'user.name', 't');
      git('config', 'user.email', 't@example.com');
      put('a.txt', 'a');
      git('checkout', '-q', '-b', 'develop');
      git('branch', 'c1');
      put('b.txt', 'c2');
      // the first release: main takes develop's state (a squash), and the first sync merges main back
      git('checkout', '-q', 'main');
      git('merge', '--squash', 'develop');
      git('commit', '-q', '-m', 'release 1');
      git('checkout', '-q', 'develop');
      git('merge', '-q', '--no-ff', '-m', 'sync 1', 'main');
      put('c.txt', 'c3');
      // the second release
      git('checkout', '-q', 'main');
      git('merge', '--squash', 'develop');
      git('commit', '-q', '-m', 'release 2');
      // a branch with develop's OLD tree (c1) as the first parent and the new main as the second: it passes the parent checks
      const forged = git('commit-tree', 'c1^{tree}', '-p', 'c1', '-p', 'main', '-m', 'forged');
      git('branch', 'sync/old', forged);
      expect(mainIsAStateOfDevelop(dir, 'main', 'develop')).toBe(true);
      expect(isAncestorOf(dir, 'c1', 'develop')).toBe(true);
      expect(mergeKeepsTree(dir, 'develop', 'sync/old')).toBe(false);
      expect(syncBranchIsSafe(dir, 'sync/old', 'develop', 'main')).toBe(false);
      // the branch sync makes (develop's tip as the first parent) is fine
      git('branch', 'sync/new', syncCommit(dir, 'main', 'develop', 'chore: main を develop に戻す'));
      expect(syncBranchIsSafe(dir, 'sync/new', 'develop', 'main')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('main merged back into develop after a release', () => {
  const sync = (o: Record<string, unknown>) => mergeDecision({ base: 'develop', head: 'main', ...o });

  it('needs no review, only that the merge leaves develop as it is', { tags: ['decision-table', 'regression'] }, () => {
    expect(sync({ verdict: 'none', syncSafe: true })).toMatchObject({ merge: true });
    expect(sync({ verdict: 'none', syncSafe: false })).toMatchObject({ merge: false, reason: expect.stringContaining('would change develop') });
    expect(sync({ verdict: 'ok', syncSafe: null })).toMatchObject({ merge: false, reason: expect.stringContaining('cannot be tried') });
  });

  it('is still refused for a bad title, description or another repository', { tags: ['error-guessing'] }, () => {
    expect(sync({ syncSafe: true, title: titleProblems('update stuff') })).toMatchObject({ merge: false });
    expect(sync({ syncSafe: true, body: bodyProblems('') })).toMatchObject({ merge: false });
    expect(sync({ syncSafe: true, fork: true })).toMatchObject({ merge: false });
  });
});

describe('the title of a new pull request', () => {
  it('is the only commit of the branch, and must be given for several', { tags: ['condition', 'regression'] }, () => {
    expect(titleFor(undefined, ['feat: 一つだけ'])).toBe('feat: 一つだけ');
    expect(titleFor('feat: まとめ', ['feat: a', 'docs: b'])).toBe('feat: まとめ');
    expect(() => titleFor(undefined, ['feat: a', 'docs: b'])).toThrow(/--title/);
  });

  it('follows the commit message rules, because it becomes the commit on main', { tags: ['equivalence'] }, () => {
    expect(titleProblems('feat: GitHub Flow に移る')).toEqual([]);
    expect(titleProblems('Move to GitHub Flow').length).toBeGreaterThan(0);
    expect(titleProblems(`feat: ${'あ'.repeat(80)}`).length).toBeGreaterThan(0);
    expect(titleProblems('feat: 一行目\n二行目').length).toBeGreaterThan(0);
  });
});

describe('the required checks that have not reported', () => {
  it('are pending, so a merge waits for a job that has not started yet', { tags: ['condition', 'regression'] }, () => {
    const checks = withMissing([{ name: 'static', bucket: 'pass' }], ['static', 'vitest']);
    expect(checks).toEqual([{ name: 'static', bucket: 'pass' }, { name: 'vitest', bucket: 'pending' }]);
    expect(checksState(checks)).toBe('pending');
    expect(withMissing([{ name: 'static', bucket: 'pass' }], [])).toEqual([{ name: 'static', bucket: 'pass' }]);
  });

  it('include the CodeQL analyses, so a merge waits for the scan of the head', { tags: ['condition', 'regression'] }, () => {
    const all = [
      { name: 'static', bucket: 'pass' },
      { name: 'analyze (actions)', bucket: 'pass' },
      { name: 'analyze (rust)', bucket: 'pending' },
      { name: 'flaky', bucket: 'skipping' },
    ];
    const checks = gatingChecks(all, ['static']);
    expect(checks.map((c: { name: string }) => c.name)).not.toContain('flaky');
    expect(checksState(checks)).toBe('pending');
    // An analysis that has not started yet also waits.
    const started = gatingChecks([{ name: 'static', bucket: 'pass' }], ['static']);
    expect(started.filter((c: { bucket: string }) => c.bucket === 'pending').map((c: { name: string }) => c.name)).toEqual(CODEQL_CHECKS);
  });

  it('name each language CodeQL scans', { tags: ['equivalence'] }, () => {
    const workflow = readFileSync(path.join(ROOT, '.github/workflows/codeql.yml'), 'utf8');
    const languages = (/language: \[([^\]]+)\]/.exec(workflow)?.[1] ?? '').split(',').map((l) => l.trim());
    expect(CODEQL_CHECKS).toEqual(languages.map((l) => `analyze (${l})`));
  });

  it('skip a draft, as the Test workflow does, and start when it is made ready', { tags: ['condition'] }, () => {
    const workflow = readFileSync(path.join(ROOT, '.github/workflows/codeql.yml'), 'utf8');
    expect(workflow).toContain('types: [opened, synchronize, reopened, ready_for_review]');
    expect(workflow).toContain("if: ${{ github.event_name != 'pull_request' || !github.event.pull_request.draft }}");
  });
});

describe('the squash merge', () => {
  it('writes the title as the subject and no body, for the head that was reviewed', { tags: ['regression'] }, () => {
    expect(mergeArgs(21, { headRefOid: HEAD, title: 'feat: まとめ', baseRefName: 'develop', headRefName: '20261112_x' })).toEqual(['pr', 'merge', '21', '--squash', '--match-head-commit', HEAD, '--subject', 'feat: まとめ', '--body', '']);
    expect(mergeArgs(22, { headRefOid: HEAD, title: 'chore: v1.0.0 をリリースする', baseRefName: 'main', headRefName: 'release/v1.0.0' })).toContain('--squash');
  });

  it('is a merge commit for main going back into develop, so develop then has main\'s history', { tags: ['regression'] }, () => {
    expect(mergeArgs(23, { headRefOid: HEAD, title: 'chore: main を develop に戻す', baseRefName: 'develop', headRefName: 'main' })).toEqual(['pr', 'merge', '23', '--merge', '--match-head-commit', HEAD, '--subject', 'chore: main を develop に戻す', '--body', '']);
  });

  it('is refused when the title was changed on GitHub into one that breaks the commit rules, or the description is incomplete', { tags: ['error-guessing'] }, () => {
    expect(release({ checks: 'pass', verdict: 'ok', title: titleProblems('update stuff') })).toMatchObject({ merge: false, reason: expect.stringContaining('title') });
    expect(release({ checks: 'pass', verdict: 'ok', body: bodyProblems('') })).toMatchObject({ merge: false, reason: expect.stringContaining('description') });
  });
});

const FULL = ['## 背景', '困っていた', '## 変わらないこと', '画面', '## 変更内容', '直した', '## 確認結果', '検査が通った', '## チェックリスト', '- [x] ja と en', '## 追加・変更したテスト', 'pr-tool.test.ts'].join('\n');

describe('the description of a pull request (the sections of meta/astryx, named in plain Japanese)', () => {
  it('is complete with every section in order and something in each', { tags: ['equivalence'] }, () => {
    expect(bodyProblems(FULL)).toEqual([]);
    expect(bodyProblems(FULL.replace(/\n/g, '\r\n'))).toEqual([]);
  });

  it('names a section that is missing, empty (a template comment alone is empty) or out of order', { tags: ['error-guessing'] }, () => {
    expect(bodyProblems(FULL.replace('## 確認結果\n検査が通った\n', ''))).toEqual(['the section "## 確認結果" is missing']);
    expect(bodyProblems(FULL.replace('検査が通った', '<!-- 確かめたこと -->'))).toEqual(['the section "## 確認結果" is empty']);
    const swapped = FULL.replace('## 背景\n困っていた\n', '').replace('## 追加・変更したテスト', '## 背景\n困っていた\n## 追加・変更したテスト');
    expect(bodyProblems(swapped)).toContain('the section "## 変わらないこと" is out of order');
    expect(bodyProblems('')).toHaveLength(6);
  });

  it('are the headings of .github/pull_request_template.md, in its order', { tags: ['equivalence'] }, () => {
    const template = readFileSync(path.join(ROOT, '.github/pull_request_template.md'), 'utf8');
    expect([...template.matchAll(/^## (.+)$/gm)].map((m) => (m[1] ?? '').trim())).toEqual(BODY_SECTIONS);
  });
});

describe('the template hints in a description', () => {
  it('are all removed, also when one is nested in another or left open, so a hint alone is an empty section', { tags: ['error-guessing', 'regression'] }, () => {
    expect(withoutComments('a <!-- hint --> b')).toBe('a  b');
    expect(withoutComments('<!-<!---->-')).not.toContain('<!--');
    expect(withoutComments('<!<!-- x -->-- y -->').trim()).toBe('');
    expect(withoutComments('words <!-- never closed')).toBe('words ');
    expect(bodyProblems(FULL.replace('検査が通った', '<!-<!-- x -->- hint -->'))).toEqual(['the section "## 確認結果" is empty']);
  });
});

describe('deleting the merged branch', () => {
  it('leases it at the merged head, so a commit pushed after the merge is kept', { tags: ['regression'] }, () => {
    expect(deleteBranchArgs({ headRefName: '20261112_x', headRefOid: HEAD })).toEqual(['push', `--force-with-lease=20261112_x:${HEAD}`, 'origin', '--delete', '20261112_x']);
  });

  it('never deletes develop or main, the heads of a release and of the merge back', { tags: ['regression', 'error-guessing'] }, () => {
    expect(deleteBranchArgs({ headRefName: 'release/v1.0.0', headRefOid: HEAD })).toEqual(['push', `--force-with-lease=release/v1.0.0:${HEAD}`, 'origin', '--delete', 'release/v1.0.0']);
    expect(deleteBranchArgs({ headRefName: 'develop', headRefOid: HEAD })).toBeNull();
    expect(deleteBranchArgs({ headRefName: 'main', headRefOid: HEAD })).toBeNull();
  });
});

describe('the shape of a review (a verdict box, then the sections, to read at a glance)', () => {
  const SHA = 'e8051a615184dbd2b19ef00b37a521e13b189104';
  const changes = [
    '> [!CAUTION]',
    '> **判定: NG**　指摘 1 件・任意 1 件（e8051a61 を確認）',
    '',
    '#### 総評',
    'マージ条件は直ったが、件名が main に入らない。',
    '',
    '#### 前回の指摘',
    '- 1 回目（10 件）: すべて直った',
    '',
    '#### 指摘',
    '1. **`scripts/tools/pr.mjs:173`**',
    '   - 問題: 件名を渡していない',
    '   - 直し方: `--subject` を渡す',
    '',
    '#### 任意',
    '- **`docs/a.md:3`** 言い回し',
  ].join('\n');
  const ok = [
    '> [!TIP]',
    '> **判定: OK**　指摘 0 件・任意 1 件（e8051a61 を確認）',
    '',
    '#### 総評',
    '前回の指摘は直り、ほかに要るものはない。',
    '',
    '#### 前回の指摘',
    '- 2 件とも直った',
    '',
    '#### 任意',
    '- 説明を足してもよい',
  ].join('\n');

  it('takes a changes review (NG) with a finding under 指摘, and an ok review (OK) with none', { tags: ['equivalence'] }, () => {
    expect(reviewProblems('changes', changes, SHA)).toEqual([]);
    expect(reviewProblems('ok', ok, SHA)).toEqual([]);
  });

  it('refuses a box or a 判定 that does not match the verdict, and a missing 総評 or section about the earlier findings', { tags: ['decision-table'] }, () => {
    expect(reviewProblems('ok', changes, SHA).join()).toContain('[!TIP]');
    expect(reviewProblems('changes', changes.replace('判定: NG', '判定: OK'), SHA).join()).toContain('判定: NG');
    expect(reviewProblems('changes', changes.replace('#### 総評\nマージ条件は直ったが、件名が main に入らない。\n', ''), SHA).join()).toContain('総評');
    expect(reviewProblems('changes', changes.replace('#### 前回の指摘\n- 1 回目（10 件）: すべて直った\n', ''), SHA).join()).toContain('前回の指摘');
  });

  it('refuses counts in the box that differ from the findings, and a commit other than the one reviewed', { tags: ['boundary', 'regression'] }, () => {
    expect(reviewProblems('changes', changes.replace('指摘 1 件', '指摘 2 件'), SHA).join()).toContain('指摘 1 件');
    expect(reviewProblems('changes', changes.replace('任意 1 件', '任意 0 件'), SHA).join()).toContain('任意 1 件');
    expect(reviewProblems('changes', changes, 'b'.repeat(40)).join()).toContain('bbbbbbbb');
  });

  it('refuses a blank line between the box and the 判定 line: GitHub then draws two quotes, not a coloured box', { tags: ['boundary'] }, () => {
    expect(reviewProblems('changes', changes.replace('> [!CAUTION]\n', '> [!CAUTION]\n\n'), SHA).join()).toContain('right under');
  });

  it('refuses changes without a finding, ok with one, and a finding without its place, problem or fix', { tags: ['decision-table', 'boundary'] }, () => {
    const noFinding = changes.replace(/#### 指摘\n[\s\S]*?\n\n/, '').replace('指摘 1 件', '指摘 0 件');
    expect(reviewProblems('changes', noFinding, SHA).join()).toContain('without a finding');
    const okWithOne = ok.replace('#### 任意', '#### 指摘\n1. **`a.ts:1`**\n   - 問題: 壊れる\n   - 直し方: 直す\n\n#### 任意').replace('指摘 0 件', '指摘 1 件');
    expect(reviewProblems('ok', okWithOne, SHA).join()).toContain('ok is given with a finding');
    expect(reviewProblems('changes', changes.replace('**`scripts/tools/pr.mjs:173`**', 'pr.mjs のどこか'), SHA).join()).toContain('its place alone');
    expect(reviewProblems('changes', changes.replace('**`scripts/tools/pr.mjs:173`**', '**`.githooks/pre-commit:3`**'), SHA)).toEqual([]);
    expect(reviewProblems('changes', changes.replace('   - 直し方: `--subject` を渡す\n', ''), SHA).join()).toContain('直し方');
  });

  it('refuses the sections out of order', { tags: ['boundary'] }, () => {
    const swapped = changes.replace('#### 前回の指摘\n- 1 回目（10 件）: すべて直った\n\n', '') + '\n\n#### 前回の指摘\n- なし';
    expect(reviewProblems('changes', swapped, SHA).join()).toContain('out of order');
  });
});

describe('a draft pull request', () => {
  it('is reviewed with no CI, and is made ready for its checks only once the review of its head is ok', { tags: ['decision-table'] }, () => {
    // The checks a draft shows are the ones its workflows skipped: they say nothing, whatever their bucket.
    expect(release({ checks: 'pass', verdict: 'ok', draft: true })).toMatchObject({ merge: false, wait: true, ready: true });
    expect(release({ checks: 'pending', verdict: 'ok', draft: true })).toMatchObject({ merge: false, wait: true, ready: true });
    expect(release({ checks: 'pass', verdict: 'none', draft: true })).toMatchObject({ merge: false, wait: false, reason: expect.stringContaining('review') });
    expect(release({ checks: 'pass', verdict: 'changes', draft: true })).toMatchObject({ merge: false, wait: false, reason: expect.stringContaining('changes') });
    expect(release({ checks: 'pass', verdict: 'ok' }).ready).toBeFalsy();
  });

  it('goes back to a draft when a check fails, so the pushes that fix it run no CI', { tags: ['state-transition'] }, () => {
    expect(release({ checks: 'fail', verdict: 'ok' })).toMatchObject({ merge: false, wait: false, toDraft: true });
    expect(release({ checks: 'pending', verdict: 'ok' }).toDraft).toBeFalsy();
  });
});

describe('the checks after a draft is made ready', () => {
  const READY = '2026-11-12T10:00:00Z';
  it('count only runs started after it was made ready: the earlier ones are the draft runs that skipped', { tags: ['boundary', 'regression'] }, () => {
    const checks = [
      { name: 'static', bucket: 'skipping', startedAt: '2026-11-12T09:59:59Z' },
      { name: 'vitest', bucket: 'pass', startedAt: '2026-11-12T10:00:00Z' },
      { name: 'clippy', bucket: 'pending', startedAt: '0001-01-01T00:00:00Z' },
    ];
    expect(freshChecks(checks, READY)).toEqual([
      { name: 'static', bucket: 'pending', startedAt: '2026-11-12T09:59:59Z' },
      { name: 'vitest', bucket: 'pass', startedAt: '2026-11-12T10:00:00Z' },
      { name: 'clippy', bucket: 'pending', startedAt: '0001-01-01T00:00:00Z' },
    ]);
    expect(checksState(freshChecks(checks, READY))).toBe('pending');
    // A pull request that was never a draft keeps every run.
    expect(freshChecks(checks, null)).toEqual(checks);
  });

  it('start, after `gh pr ready`, at the moment before it until the events API shows the new ready time, then at that time', { tags: ['state-transition', 'regression'] }, () => {
    const before = '2026-11-12T09:00:00Z';
    const floor = '2026-11-12T10:00:00Z';
    // The events API still shows the earlier ready time: the moment before `gh pr ready` wins.
    expect(readyFrom(before, before, floor)).toBe(floor);
    expect(readyFrom(null, null, floor)).toBe(floor);
    // It shows the new one: that time alone, so a local clock running ahead cannot hold fresh runs back.
    expect(readyFrom('2026-11-12T09:59:40Z', before, floor)).toBe('2026-11-12T09:59:40Z');
    expect(readyFrom('2026-11-12T09:59:40Z', null, floor)).toBe('2026-11-12T09:59:40Z');
    // A merge that did not make it ready itself: the events API alone.
    expect(readyFrom('2026-11-12T09:00:00Z', null, null)).toBe('2026-11-12T09:00:00Z');
    // A failed run of the earlier round is pending until the fresh runs come.
    const checks = [{ name: 'vitest', bucket: 'fail', startedAt: '2026-11-12T09:30:00Z' }];
    expect(checksState(freshChecks(checks, readyFrom(before, before, floor)))).toBe('pending');
  });
});

describe('code scanning alerts', () => {
  it('stop the merge until each is fixed or explained, whatever the checks say', { tags: ['condition', 'regression'] }, () => {
    expect(release({ checks: 'pass', verdict: 'ok', alerts: 1 })).toMatchObject({ merge: false, wait: false, reason: expect.stringContaining('code scanning') });
    expect(release({ checks: 'pass', verdict: 'ok', alerts: 0 })).toMatchObject({ merge: true });
  });

  it('send the pull request back to a draft, like a failed check, so the fix runs no CI until it is reviewed', { tags: ['state-transition'] }, () => {
    expect(release({ checks: 'pass', verdict: 'ok', alerts: 1 })).toMatchObject({ toDraft: true });
  });

  it('left from the analysis before a fix are waited out while the checks still run', { tags: ['condition'] }, () => {
    expect(release({ checks: 'pending', verdict: 'ok', alerts: 1 })).toMatchObject({ merge: false, wait: true });
  });

  it('that cannot be read stop the merge too, and it waits', { tags: ['error-guessing', 'regression'] }, () => {
    expect(release({ checks: 'pass', verdict: 'ok', alerts: null })).toMatchObject({ merge: false, wait: true, reason: expect.stringContaining('code scanning') });
  });
});

describe('a pull request into develop that changes only the changelog, the test counts or tests', { tags: [] }, () => {
  it('is told apart by its files: all of them of those kinds, none of the app', { tags: ['equivalence', 'boundary'] }, () => {
    expect(reviewFree(['CHANGELOG.md'])).toBe(true);
    expect(reviewFree(['docs/tests/README.md', 'frontend/tests/pr-tool.test.ts'])).toBe(true);
    expect(reviewFree(['frontend/src/features/drafts/flow.test.ts', 'frontend/src/ui/zoom/ZoomableImage.test.tsx'])).toBe(true);
    expect(reviewFree(['frontend/e2e/candidates.spec.ts', 'frontend/e2e/__screenshots__/visual/generate/dark/candidates-win32.png'])).toBe(true);
    expect(reviewFree(['backend/crates/novira-core/tests/models_live.rs'])).toBe(true);
    // one file of the app, the docs, a script or a rule is enough to need the review
    expect(reviewFree(['frontend/tests/pr-tool.test.ts', 'scripts/tools/pr.mjs'])).toBe(false);
    expect(reviewFree(['CHANGELOG.md', 'backend/Cargo.toml'])).toBe(false);
    expect(reviewFree(['frontend/src/features/drafts/flow.ts'])).toBe(false);
    expect(reviewFree(['docs/design/README.md'])).toBe(false);
    expect(reviewFree(['.claude/rules/tests.md'])).toBe(false);
    expect(reviewFree(['backend/crates/novira-core/src/agent/tools.rs'])).toBe(false);
    // no files listed (the list could not be read) is not free
    expect(reviewFree([])).toBe(false);
  });

  it('needs the review for a file renamed or copied (only its new name is listed) and for the lists that loosen a check', { tags: ['error-guessing', 'regression'] }, () => {
    // scripts/tools/pr.mjs moved to frontend/tests/pr.mjs shows only the new path
    expect(reviewFree([{ path: 'frontend/tests/pr.mjs', changeType: 'RENAMED' }])).toBe(false);
    expect(reviewFree([{ path: 'frontend/e2e/x.spec.ts', changeType: 'COPIED' }])).toBe(false);
    expect(reviewFree([{ path: 'frontend/e2e/x.spec.ts', changeType: 'MODIFIED' }, { path: 'CHANGELOG.md', changeType: 'ADDED' }])).toBe(true);
    expect(reviewFree([{ path: 'frontend/e2e/old.spec.ts', changeType: 'DELETED' }])).toBe(true);
    // what the checks allow, and the helpers the specs run on, are not tests of their own
    for (const p of ['frontend/e2e/a11yKnown.ts', 'frontend/e2e/perfBudget.ts', 'frontend/e2e/layoutRules.ts', 'frontend/e2e/fixtures.ts', 'frontend/tests/helper.mjs']) expect(reviewFree([p]), p).toBe(false);
  });

  it('frees a Rust test file at the top of tests/, not the helpers, the test modules in a folder or the fixtures', { tags: ['equivalence', 'regression'] }, () => {
    for (const p of ['backend/crates/novira-core/tests/models_live.rs', 'backend/crates/novira-server/tests/auth.rs']) expect(reviewFree([p]), p).toBe(true);
    for (const p of [
      'backend/crates/novira-server/tests/common/mod.rs',
      'backend/crates/novira-core/tests/backend_service/common.rs',
      'backend/crates/novira-core/tests/backend_service/main.rs',
      'backend/crates/novira-core/tests/agent_endpoint/server.rs',
      'backend/crates/novira-core/tests/fake_site/mod.rs',
      'backend/crates/novira-core/tests/fixtures/data-v0.3.0/novira.sqlite',
      'backend/crates/novira-core/tests/fixtures/data-v0.3.0/settings.json',
    ])
      expect(reviewFree([p]), p).toBe(false);
  });

  it('merges into develop with no agent review, but a review that asks for changes still stops it, and main always needs one', { tags: ['decision-table'] }, () => {
    expect(mergeDecision({ verdict: 'none', base: 'develop', head: '20261113_x', reviewFree: true })).toMatchObject({ merge: true });
    expect(mergeDecision({ verdict: 'none', base: 'develop', head: '20261113_x', reviewFree: false })).toMatchObject({ merge: false });
    expect(mergeDecision({ verdict: 'changes', base: 'develop', head: '20261113_x', reviewFree: true })).toMatchObject({ merge: false });
    expect(release({ checks: 'pass', verdict: 'none', reviewFree: true })).toMatchObject({ merge: false });
    // the title and the description are still checked
    expect(mergeDecision({ verdict: 'none', base: 'develop', head: '20261113_x', reviewFree: true, body: ['missing'] })).toMatchObject({ merge: false });
  });
});
