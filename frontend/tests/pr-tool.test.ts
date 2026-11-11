// The merge rule of a work branch's pull request (scripts/tools/pr.mjs): green checks and an agent review that says ok for exactly
// the head commit; and how the review's mark is written and read back.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { bodyFromCommits, checksState, mergeDecision, reviewMark, reviewVerdict } from '../../scripts/tools/pr.mjs';

const HEAD = 'a'.repeat(40);
const OLD = 'b'.repeat(40);

describe('the agent review mark', () => {
  it('is read back for the commit it names, and the latest review of that commit wins', { tags: ['state-transition'] }, () => {
    const reviews = [
      { body: `${reviewMark('changes', HEAD)}\n\nfix the test`, submittedAt: '2026-11-12T01:00:00Z' },
      { body: `${reviewMark('ok', HEAD)}\n\nfine now`, submittedAt: '2026-11-12T02:00:00Z' },
    ];
    expect(reviewVerdict(reviews, HEAD)).toBe('ok');
    expect(reviewVerdict([...reviews].reverse(), HEAD)).toBe('ok');
  });

  it('does not count a review of an older commit, a review without the mark, or a forged short mark', { tags: ['error-guessing'] }, () => {
    expect(reviewVerdict([{ body: reviewMark('ok', OLD), submittedAt: '1' }], HEAD)).toBe('none');
    expect(reviewVerdict([{ body: 'LGTM', submittedAt: '1' }, { body: '', submittedAt: '2' }], HEAD)).toBe('none');
    expect(reviewVerdict([{ body: '<!-- agent-review verdict=ok sha=bbbbbbb -->', submittedAt: '1' }], HEAD)).toBe('none');
  });

  it('refuses a verdict other than ok or changes, and a short commit id', { tags: ['error-guessing'] }, () => {
    expect(() => reviewMark('approve', HEAD)).toThrow(/verdict/);
    expect(() => reviewMark('ok', 'abc1234')).toThrow(/full commit id/);
  });
});

describe('the checks of a pull request', () => {
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

  it('asks for a review before it waits for checks, so a missing review is never waited out', { tags: ['condition'] }, () => {
    expect(mergeDecision({ checks: 'pending', verdict: 'none' })).toMatchObject({ merge: false, wait: false, reason: expect.stringContaining('review') });
  });
});

describe('the body of a new pull request', () => {
  it('lists the commits of the branch', { tags: ['equivalence'] }, () => {
    expect(bodyFromCommits(['feat: a', 'fix: b'])).toBe('Commits:\n\n- feat: a\n- fix: b');
  });
});
