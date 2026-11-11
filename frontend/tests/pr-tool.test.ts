// The merge rule of a work branch's pull request (scripts/tools/pr.mjs): green required checks and an agent review, by the signed-in
// account, that says ok for exactly the head commit; only a pull request of this repository into main; and the title that becomes the
// squashed commit on main.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { bodyFromCommits, checksState, mergeDecision, reviewMark, reviewVerdict, titleFor, titleProblems } from '../../scripts/tools/pr.mjs';

const HEAD = 'a'.repeat(40);
const OLD = 'b'.repeat(40);
const ME = 'owner';
const review = (body: string, submittedAt: string, login = ME) => ({ author: { login }, body, submittedAt });

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
    expect(mergeDecision({ checks: 'pass', verdict: 'ok' })).toMatchObject({ merge: true });
    expect(mergeDecision({ checks: 'pass', verdict: 'none' })).toMatchObject({ merge: false, wait: false });
    expect(mergeDecision({ checks: 'pass', verdict: 'changes' })).toMatchObject({ merge: false, wait: false });
    expect(mergeDecision({ checks: 'fail', verdict: 'ok' })).toMatchObject({ merge: false, wait: false });
    expect(mergeDecision({ checks: 'pending', verdict: 'ok' })).toMatchObject({ merge: false, wait: true });
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', draft: true })).toMatchObject({ merge: false });
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', state: 'MERGED' })).toMatchObject({ merge: false });
  });

  it('merges only into main, and never a pull request from another repository', { tags: ['condition', 'regression'] }, () => {
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', base: 'release/v1' })).toMatchObject({ merge: false, reason: expect.stringContaining('not main') });
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', fork: true })).toMatchObject({ merge: false, reason: expect.stringContaining('another repository') });
  });

  it('asks for a review before it waits for checks, so a missing review is never waited out', { tags: ['condition'] }, () => {
    expect(mergeDecision({ checks: 'pending', verdict: 'none' })).toMatchObject({ merge: false, wait: false, reason: expect.stringContaining('review') });
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

describe('the body of a new pull request', () => {
  it('lists the commits of the branch', { tags: ['equivalence'] }, () => {
    expect(bodyFromCommits(['feat: a', 'fix: b'])).toBe('Commits:\n\n- feat: a\n- fix: b');
  });
});
