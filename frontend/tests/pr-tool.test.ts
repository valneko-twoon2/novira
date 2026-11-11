// The merge rule of a work branch's pull request (scripts/tools/pr.mjs): green required checks and an agent review, by the signed-in
// account, that says ok for exactly the head commit; only a pull request of this repository into main; and the title that becomes the
// squashed commit on main.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { bodyProblems, checksState, mergeArgs, mergeDecision, reviewMark, reviewProblems, reviewVerdict, titleFor, titleProblems, withMissing } from '../../scripts/tools/pr.mjs';

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

describe('the required checks that have not reported', () => {
  it('are pending, so a merge waits for a job that has not started yet', { tags: ['condition', 'regression'] }, () => {
    const checks = withMissing([{ name: 'static', bucket: 'pass' }], ['static', 'vitest']);
    expect(checks).toEqual([{ name: 'static', bucket: 'pass' }, { name: 'vitest', bucket: 'pending' }]);
    expect(checksState(checks)).toBe('pending');
    expect(withMissing([{ name: 'static', bucket: 'pass' }], [])).toEqual([{ name: 'static', bucket: 'pass' }]);
  });
});

describe('the squash merge', () => {
  it('writes the title as the subject on main and no body, for the head that was reviewed', { tags: ['regression'] }, () => {
    expect(mergeArgs(21, { headRefOid: HEAD, title: 'feat: まとめ' })).toEqual(['pr', 'merge', '21', '--squash', '--match-head-commit', HEAD, '--subject', 'feat: まとめ', '--body', '']);
  });

  it('is refused when the title was changed on GitHub into one that breaks the commit rules, or the description is incomplete', { tags: ['error-guessing'] }, () => {
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', title: titleProblems('update stuff') })).toMatchObject({ merge: false, reason: expect.stringContaining('title') });
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', body: bodyProblems('') })).toMatchObject({ merge: false, reason: expect.stringContaining('description') });
  });
});

const FULL = ['## 目的', '困っていた', '## 変えないこと', '画面', '## 変更', '直した', '## 証拠', '検査が通った', '## 範囲', '- [x] ja と en', '## テスト', 'pr-tool.test.ts'].join('\n');

describe('the description of a pull request (the sections of meta/astryx)', () => {
  it('is complete with every section in order and something in each', { tags: ['equivalence'] }, () => {
    expect(bodyProblems(FULL)).toEqual([]);
    expect(bodyProblems(FULL.replace(/\n/g, '\r\n'))).toEqual([]);
  });

  it('names a section that is missing, empty (a template comment alone is empty) or out of order', { tags: ['error-guessing'] }, () => {
    expect(bodyProblems(FULL.replace('## 証拠\n検査が通った\n', ''))).toEqual(['the section "## 証拠" is missing']);
    expect(bodyProblems(FULL.replace('検査が通った', '<!-- 確かめたこと -->'))).toEqual(['the section "## 証拠" is empty']);
    const swapped = FULL.replace('## 目的\n困っていた\n', '').replace('## テスト', '## 目的\n困っていた\n## テスト');
    expect(bodyProblems(swapped)).toContain('the section "## 変えないこと" is out of order');
    expect(bodyProblems('')).toHaveLength(6);
  });
});

describe('the shape of a review (the shape of meta/astryx review bot)', () => {
  const changes = ['**変更を求めます:** マージ条件は直ったが、件名が main に入らない。', '前回の指摘: 10 件すべて直った。', '- `scripts/tools/pr.mjs:173` — 件名を渡していない — `--subject` を渡す。', '- 任意: 説明を足す。'].join('\n');
  const ok = ['**問題ありません:** 前回の指摘は直り、ほかに要るものはない。', '前回の指摘: 2 件とも直った。', '- 任意: `docs/a.md:3` の言い回し。'].join('\n');

  it('takes a changes review with a blocking finding, and an ok review with only optional ones', { tags: ['equivalence'] }, () => {
    expect(reviewProblems('changes', changes)).toEqual([]);
    expect(reviewProblems('ok', ok)).toEqual([]);
  });

  it('refuses a summary that does not match the verdict, and a missing line about the earlier findings', { tags: ['decision-table'] }, () => {
    expect(reviewProblems('ok', changes).length).toBeGreaterThan(0);
    expect(reviewProblems('changes', changes.replace('前回の指摘: 10 件すべて直った。\n', ''))).toEqual(['a line "前回の指摘: <what became of them, or なし>" is needed']);
    expect(reviewProblems('changes', changes.replace('マージ条件は直ったが、件名が main に入らない。', ''))).toHaveLength(1);
  });

  it('refuses changes without a blocking finding, ok with one, and a blocking finding without a file and line', { tags: ['decision-table', 'boundary'] }, () => {
    expect(reviewProblems('changes', changes.replace(/^- `scripts.*$/m, '')).join()).toContain('without a blocking finding');
    expect(reviewProblems('ok', `${ok}\n- \`a.ts:1\` — 壊れる — 直す。`).join()).toContain('ok is given with a blocking finding');
    expect(reviewProblems('changes', changes.replace('`scripts/tools/pr.mjs:173`', 'pr.mjs')).join()).toContain('names no file:line');
  });
});
