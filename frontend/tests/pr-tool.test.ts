// The merge rule of a work branch's pull request (scripts/tools/pr.mjs): green required checks and an agent review, by the signed-in
// account, that says ok for exactly the head commit; only a pull request of this repository into main; and the title that becomes the
// squashed commit on main.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { bodyProblems, checksState, deleteBranchArgs, mergeArgs, mergeDecision, reviewMark, reviewProblems, reviewVerdict, titleFor, titleProblems, withMissing, withoutComments } from '../../scripts/tools/pr.mjs';

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

describe('the template hints in a description', () => {
  it('are all removed, also when one is nested in another or left open, so a hint alone is an empty section', { tags: ['error-guessing', 'regression'] }, () => {
    expect(withoutComments('a <!-- hint --> b')).toBe('a  b');
    expect(withoutComments('<!-<!---->-')).not.toContain('<!--');
    expect(withoutComments('<!<!-- x -->-- y -->').trim()).toBe('');
    expect(withoutComments('words <!-- never closed')).toBe('words ');
    expect(bodyProblems(FULL.replace('検査が通った', '<!-<!-- x -->- hint -->'))).toEqual(['the section "## 証拠" is empty']);
  });
});

describe('deleting the merged branch', () => {
  it('leases it at the merged head, so a commit pushed after the merge is kept', { tags: ['regression'] }, () => {
    expect(deleteBranchArgs({ headRefName: '20261112_x', headRefOid: HEAD })).toEqual(['push', `--force-with-lease=20261112_x:${HEAD}`, 'origin', '--delete', '20261112_x']);
  });
});

describe('the shape of a review (after meta/astryx review bot, laid out to read at a glance)', () => {
  const changes = [
    '**変更を求めます**',
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
  const ok = ['**問題ありません**', '前回の指摘は直り、ほかに要るものはない。', '', '#### 前回の指摘', '- 2 件とも直った', '', '#### 任意', '- 説明を足してもよい'].join('\n');

  it('takes a changes review with a finding under 指摘, and an ok review with none', { tags: ['equivalence'] }, () => {
    expect(reviewProblems('changes', changes)).toEqual([]);
    expect(reviewProblems('ok', ok)).toEqual([]);
  });

  it('refuses a heading that does not match the verdict, a missing summary, and a missing section about the earlier findings', { tags: ['decision-table'] }, () => {
    expect(reviewProblems('ok', changes).join()).toContain('**問題ありません**');
    expect(reviewProblems('changes', changes.replace('マージ条件は直ったが、件名が main に入らない。\n', '')).join()).toContain('summary');
    expect(reviewProblems('changes', changes.replace('#### 前回の指摘\n- 1 回目（10 件）: すべて直った\n', '')).join()).toContain('前回の指摘');
  });

  it('refuses changes without a finding, ok with one, and a finding without its place, problem or fix', { tags: ['decision-table', 'boundary'] }, () => {
    const noFinding = changes.replace(/#### 指摘\n[\s\S]*?\n\n/, '');
    expect(reviewProblems('changes', noFinding).join()).toContain('without a finding');
    expect(reviewProblems('ok', ok.replace('#### 任意', '#### 指摘\n1. **`a.ts:1`**\n   - 問題: 壊れる\n   - 直し方: 直す\n\n#### 任意')).join()).toContain('ok is given with a finding');
    expect(reviewProblems('changes', changes.replace('**`scripts/tools/pr.mjs:173`**', 'pr.mjs のどこか')).join()).toContain('its place alone');
    expect(reviewProblems('changes', changes.replace('   - 直し方: `--subject` を渡す\n', '')).join()).toContain('直し方');
  });

  it('refuses the sections out of order', { tags: ['boundary'] }, () => {
    const swapped = changes.replace('#### 前回の指摘\n- 1 回目（10 件）: すべて直った\n\n', '') + '\n\n#### 前回の指摘\n- なし';
    expect(reviewProblems('changes', swapped).join()).toContain('out of order');
  });
});

describe('code scanning alerts', () => {
  it('stop the merge until each is fixed or explained, whatever the checks say', { tags: ['condition', 'regression'] }, () => {
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', alerts: 1 })).toMatchObject({ merge: false, wait: false, reason: expect.stringContaining('code scanning') });
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', alerts: 0 })).toMatchObject({ merge: true });
  });
});
