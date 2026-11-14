// A work branch into develop with no pull request (scripts/tools/land.mjs): it lands as one squashed commit on top of origin/develop,
// pushed as a fast-forward, only from a clean worktree that holds origin/develop, with the agent review of its change (ok, in the shape
// whose findings on a program were shown by a run) or with only files that need no review; the landed branch is then marked for
// worktree.mjs.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { changedFiles, land, landProblems, parseReview, sameChange } from '../../scripts/tools/land.mjs';
// @ts-expect-error -- plain ESM script without types
import { joinHeads, landedHeads } from '../../scripts/tools/worktree.mjs';

const okReview = (sha: string) =>
  [
    `SHA: ${sha}`,
    'VERDICT: ok',
    '> [!TIP]',
    `> **判定: OK**\u3000指摘 0 件・任意 0 件（${sha.slice(0, 8)} を確認）`,
    '',
    '#### 総評',
    '変更は説明どおり。',
    '',
    '#### 前回の指摘',
    '- なし',
  ].join('\n');

describe('the decision to land', () => {
  const base = { branch: '20261114_x', dirty: false, upToDate: true, title: [], free: false, review: { sha: 'a'.repeat(40), verdict: 'ok', body: '' }, reviewShape: [], sameChange: true };

  it('lands a clean, up-to-date work branch with an ok review of its change', { tags: ['decision-table'] }, () => {
    expect(landProblems(base)).toEqual([]);
    expect(landProblems({ ...base, review: { ...base.review, verdict: 'changes' } }).join()).toContain('asks for changes');
    expect(landProblems({ ...base, review: null }).join()).toContain('--review-file');
    expect(landProblems({ ...base, reviewShape: ['x'] }).join()).toContain('agreed shape');
    expect(landProblems({ ...base, sameChange: false }).join()).toContain('review the head');
    expect(landProblems({ ...base, sameChange: null }).join()).toContain('cannot be told');
  });

  it('needs no review for the changelog, the test counts and tests, but still a clean, up-to-date branch and a good title', { tags: ['decision-table'] }, () => {
    expect(landProblems({ ...base, free: true, review: null })).toEqual([]);
    expect(landProblems({ ...base, free: true, review: null, dirty: true }).join()).toContain('uncommitted');
    expect(landProblems({ ...base, free: true, review: null, upToDate: false }).join()).toContain('bring it up to date');
    expect(landProblems({ ...base, free: true, review: null, title: ['bad'] }).join()).toContain('title');
  });

  it('lands only a work branch: never develop, main, a detached head, a release snapshot or a sync branch', { tags: ['equivalence', 'error-guessing'] }, () => {
    for (const branch of ['develop', 'main', 'HEAD', 'release/v1.0.0', 'sync/abc', '']) expect(landProblems({ ...base, branch }).join(), branch).toContain('land a work branch');
  });
});

describe('what land reads', () => {
  it('reads the SHA and VERDICT lines and the review after them, and nothing without both', { tags: ['equivalence', 'error-guessing'] }, () => {
    const sha = 'c'.repeat(40);
    expect(parseReview(okReview(sha))).toMatchObject({ sha, verdict: 'ok', body: expect.stringMatching(/^> \[!TIP\]/) });
    expect(parseReview(okReview(sha).replace('VERDICT: ok\n', ''))).toBeNull();
    expect(parseReview(okReview(sha).replace(`SHA: ${sha}`, 'SHA: abc'))).toBeNull();
  });

  it('lists a rename or a copy as such, so reviewFree asks a review for a file moved among the tests', { tags: ['equivalence'] }, () => {
    expect(changedFiles('M\tCHANGELOG.md\nR100\tscripts/a.mjs\tfrontend/tests/a.test.ts\nA\tx.ts\n')).toEqual([
      { path: 'CHANGELOG.md', changeType: 'MODIFIED' },
      { path: 'frontend/tests/a.test.ts', changeType: 'RENAMED' },
      { path: 'x.ts', changeType: 'ADDED' },
    ]);
  });

  it('reads the branches land marked, and joins them with the ones GitHub merged', { tags: ['equivalence'] }, () => {
    const a = 'a'.repeat(40);
    const heads = landedHeads('.', () => `branch.20261114_x.landed ${a}\nbranch.weird.landed nothex\n`);
    expect([...heads]).toEqual([['20261114_x', [a]]]);
    expect(landedHeads('.', () => { throw new Error('exit 1'); }).size).toBe(0);
    expect([...joinHeads(heads, new Map([['20261114_x', ['b']], ['y', ['c']]]))]).toEqual([['20261114_x', [a, 'b']], ['y', ['c']]]);
  });
});

describe('landing in a real repository with a remote', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'novira-land-'));
  const remote = path.join(root, 'origin.git');
  const dir = path.join(root, 'work');
  const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const put = (file: string, text: string, msg: string) => {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), text);
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', msg);
  };
  const head = () => git(dir, 'rev-parse', 'HEAD').trim();
  const remoteDevelop = () => git(remote, 'rev-parse', 'develop').trim();
  const quiet = () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  };
  afterAll(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it('squashes a reviewed branch onto develop, refuses what is not ready, and takes a review of the same change after an update', { tags: ['scenario', 'state-transition', 'regression'], timeout: 60_000 }, () => {
    quiet();
    mkdirSync(dir);
    git(root, 'init', '-q', '--bare', '-b', 'develop', remote);
    git(dir, 'init', '-q', '-b', 'develop');
    git(dir, 'config', 'user.name', 't');
    git(dir, 'config', 'user.email', 't@example.com');
    git(dir, 'remote', 'add', 'origin', remote);
    put('app.ts', 'one\n', 'chore: 最初');
    git(dir, 'push', '-q', 'origin', 'develop');

    // a branch of the app: no review, refused; nothing pushed
    git(dir, 'checkout', '-q', '-b', '20261114_feat');
    put('app.ts', 'two\n', 'feat: 二にする');
    const before = remoteDevelop();
    expect(land([], dir)).toBe(1);
    expect(remoteDevelop()).toBe(before);

    // a review that asks for changes, or of a commit whose change differs, is refused too
    const reviewFile = path.join(root, 'review.md');
    writeFileSync(reviewFile, okReview(head()).replace('VERDICT: ok', 'VERDICT: changes'));
    expect(land(['--review-file', reviewFile], dir)).toBe(1);
    const reviewed = head();
    writeFileSync(reviewFile, okReview(reviewed));
    put('app.ts', 'three\n', 'feat: 三にする');
    expect(land(['--review-file', reviewFile, '--title', 'feat: 三にする'], dir)).toBe(1);
    git(dir, 'reset', '-q', '--hard', reviewed);

    // develop moved meanwhile: the branch must be brought up to date first; after a rebase with no conflict the review still counts
    git(dir, 'checkout', '-q', 'develop');
    put('other.ts', 'x\n', 'chore: ほかの変更');
    git(dir, 'push', '-q', 'origin', 'develop');
    git(dir, 'checkout', '-q', '20261114_feat');
    expect(land(['--review-file', reviewFile], dir)).toBe(1);
    git(dir, 'rebase', '-q', 'origin/develop');
    expect(sameChange(dir, reviewed, 'HEAD', 'origin/develop')).toBe(true);

    // an uncommitted file stops it
    writeFileSync(path.join(dir, 'stray.ts'), 'x\n');
    expect(land(['--review-file', reviewFile], dir)).toBe(1);
    rmSync(path.join(dir, 'stray.ts'));

    expect(land(['--review-file', reviewFile, '--dry-run'], dir)).toBe(0);
    expect(remoteDevelop()).toBe(git(dir, 'rev-parse', 'origin/develop').trim());
    const tip = head();
    const baseBefore = git(dir, 'rev-parse', 'origin/develop').trim();
    expect(land(['--review-file', reviewFile], dir)).toBe(0);
    // one commit on top of the old develop, with the branch's tree and its subject alone
    const landed = remoteDevelop();
    expect(git(remote, 'log', '-1', '--format=%s%n%b', landed).trim()).toBe('feat: 二にする');
    expect(git(remote, 'rev-parse', `${landed}^`).trim()).toBe(baseBefore);
    expect(git(remote, 'rev-parse', `${landed}^{tree}`).trim()).toBe(git(dir, 'rev-parse', 'HEAD^{tree}').trim());
    expect(landedHeads(dir).get('20261114_feat')).toEqual([tip]);

    // a branch of tests only lands with no review
    git(dir, 'fetch', '-q', 'origin');
    git(dir, 'checkout', '-q', '-b', '20261114_test', 'origin/develop');
    put('frontend/tests/a.test.ts', 'test\n', 'test: 例を足す');
    expect(land([], dir)).toBe(0);
    expect(git(remote, 'log', '-1', '--format=%s', 'develop').trim()).toBe('test: 例を足す');
  });
});
