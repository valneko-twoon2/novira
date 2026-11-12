// The merge rule of a work branch's pull request (scripts/tools/pr.mjs): green required checks and an agent review, by the signed-in
// account, that says ok for exactly the head commit; only a pull request of this repository into main; and the title that becomes the
// squashed commit on main.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { BODY_SECTIONS, CODEQL_CHECKS, bodyProblems, checksState, deleteBranchArgs, freshChecks, gatingChecks, readyFrom, mergeArgs, mergeDecision, reviewMark, reviewProblems, reviewVerdict, titleFor, titleProblems, withMissing, withoutComments } from '../../scripts/tools/pr.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
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
  it('writes the title as the subject on main and no body, for the head that was reviewed', { tags: ['regression'] }, () => {
    expect(mergeArgs(21, { headRefOid: HEAD, title: 'feat: まとめ' })).toEqual(['pr', 'merge', '21', '--squash', '--match-head-commit', HEAD, '--subject', 'feat: まとめ', '--body', '']);
  });

  it('is refused when the title was changed on GitHub into one that breaks the commit rules, or the description is incomplete', { tags: ['error-guessing'] }, () => {
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', title: titleProblems('update stuff') })).toMatchObject({ merge: false, reason: expect.stringContaining('title') });
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', body: bodyProblems('') })).toMatchObject({ merge: false, reason: expect.stringContaining('description') });
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
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', draft: true })).toMatchObject({ merge: false, wait: true, ready: true });
    expect(mergeDecision({ checks: 'pending', verdict: 'ok', draft: true })).toMatchObject({ merge: false, wait: true, ready: true });
    expect(mergeDecision({ checks: 'pass', verdict: 'none', draft: true })).toMatchObject({ merge: false, wait: false, reason: expect.stringContaining('review') });
    expect(mergeDecision({ checks: 'pass', verdict: 'changes', draft: true })).toMatchObject({ merge: false, wait: false, reason: expect.stringContaining('changes') });
    expect(mergeDecision({ checks: 'pass', verdict: 'ok' }).ready).toBeFalsy();
  });

  it('goes back to a draft when a check fails, so the pushes that fix it run no CI', { tags: ['state-transition'] }, () => {
    expect(mergeDecision({ checks: 'fail', verdict: 'ok' })).toMatchObject({ merge: false, wait: false, toDraft: true });
    expect(mergeDecision({ checks: 'pending', verdict: 'ok' }).toDraft).toBeFalsy();
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
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', alerts: 1 })).toMatchObject({ merge: false, wait: false, reason: expect.stringContaining('code scanning') });
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', alerts: 0 })).toMatchObject({ merge: true });
  });

  it('send the pull request back to a draft, like a failed check, so the fix runs no CI until it is reviewed', { tags: ['state-transition'] }, () => {
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', alerts: 1 })).toMatchObject({ toDraft: true });
  });

  it('left from the analysis before a fix are waited out while the checks still run', { tags: ['condition'] }, () => {
    expect(mergeDecision({ checks: 'pending', verdict: 'ok', alerts: 1 })).toMatchObject({ merge: false, wait: true });
  });

  it('that cannot be read stop the merge too, and it waits', { tags: ['error-guessing', 'regression'] }, () => {
    expect(mergeDecision({ checks: 'pass', verdict: 'ok', alerts: null })).toMatchObject({ merge: false, wait: true, reason: expect.stringContaining('code scanning') });
  });
});
