// What the Dependabot triage (scripts/tools/dependabot-triage.mjs) does with a pull request: a small update that passed is merged, a
// major or a stale one is closed with its reason, a security update is never closed by a rule, and the rest wait.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { bumpKind, ciState, decide, run, STALE_DAYS } from '../../scripts/tools/dependabot-triage.mjs';

describe('bumpKind', { tags: [] }, () => {
  it.each([
    ['chore: Bump serde from 1.0.200 to 1.0.201 in /backend', 'patch'],
    ['chore: Bump vite from 7.1.0 to 7.2.0 in /frontend', 'minor'],
    ['chore: Bump react from 18.3.1 to 19.0.0 in /frontend', 'major'],
    ['chore: Bump actions/checkout from 6 to 7', 'major'],
    ['chore: Bump actions/cache from v5.0.1 to v5.1.0', 'minor'],
    ['chore: Bump the minor-and-patch group across 1 directory with 4 updates', 'group'],
  ])('%s is %s', { tags: ['equivalence'] }, (title, kind) => {
    expect(bumpKind(title)).toBe(kind);
  });

  it('counts a minor bump of a 0.x version as major, and a patch bump of it as patch', { tags: ['boundary'] }, () => {
    expect(bumpKind('Bump tauri from 0.4.1 to 0.5.0')).toBe('major');
    expect(bumpKind('Bump tauri from 0.4.1 to 0.4.2')).toBe('patch');
  });

  it('is null for a title with no versions', { tags: ['error-guessing'] }, () => {
    expect(bumpKind('Update dependencies')).toBeNull();
    expect(bumpKind('')).toBeNull();
  });
});

describe('decide', { tags: [] }, () => {
  const small = { title: 'Bump serde from 1.0.200 to 1.0.201', labels: ['dependencies'], ageDays: 1 };

  it('merges a small update whose checks passed', { tags: ['equivalence'] }, () => {
    expect(decide({ ...small, ci: 'success' }).action).toBe('merge');
    expect(decide({ title: 'Bump the minor-and-patch group with 3 updates', labels: [], ageDays: 0, ci: 'success' }).action).toBe('merge');
  });

  it('waits while the checks run, are missing or have failed', { tags: ['equivalence'] }, () => {
    for (const ci of ['pending', 'none', 'failure']) expect(decide({ ...small, ci }).action).toBe('leave');
  });

  it('closes a major update, whatever the checks say', { tags: ['decision-table'] }, () => {
    for (const ci of ['success', 'failure', 'pending', 'none']) expect(decide({ title: 'Bump react from 18.3.1 to 19.0.0', labels: [], ageDays: 0, ci }).action).toBe('close');
  });

  it('closes a small update that stays open past the limit without passing, but not one on the limit', { tags: ['boundary'] }, () => {
    expect(decide({ ...small, ageDays: STALE_DAYS, ci: 'failure' }).action).toBe('leave');
    expect(decide({ ...small, ageDays: STALE_DAYS + 0.1, ci: 'failure' }).action).toBe('close');
  });

  it('merges a stale update whose checks pass instead of closing it', { tags: ['condition'] }, () => {
    expect(decide({ ...small, ageDays: STALE_DAYS + 5, ci: 'success' }).action).toBe('merge');
  });

  it('never closes a security update: it merges a small one that passed and leaves every other one', { tags: ['decision-table'] }, () => {
    const security = { labels: ['dependencies', 'security'], ageDays: 99 };
    expect(decide({ ...security, title: 'Bump serde from 1.0.200 to 1.0.201', ci: 'success' }).action).toBe('merge');
    expect(decide({ ...security, title: 'Bump serde from 1.0.200 to 1.0.201', ci: 'failure' }).action).toBe('leave');
    expect(decide({ ...security, title: 'Bump react from 18.3.1 to 19.0.0', ci: 'success' }).action).toBe('leave');
  });

  it('leaves a title it cannot read, and always says why', { tags: ['error-guessing'] }, () => {
    const d = decide({ title: 'Update dependencies', labels: [], ageDays: 99, ci: 'success' });
    expect(d.action).toBe('leave');
    expect(d.reason.length).toBeGreaterThan(0);
  });
});

describe('ciState', { tags: [] }, () => {
  const r = (workflow: string, status: string, conclusion: string | null, headSha = 'abc') => ({ workflow, headSha, status, conclusion });
  const passed = [r('test.yml', 'completed', 'success'), r('supply-chain.yml', 'completed', 'success')];

  it('is success when the required workflows passed on this commit', { tags: ['equivalence'] }, () => {
    expect(ciState(passed, 'abc')).toBe('success');
  });

  it('is none until both required workflows have a run for this commit', { tags: ['boundary'] }, () => {
    expect(ciState([r('test.yml', 'completed', 'success')], 'abc')).toBe('none');
    expect(ciState(passed, 'other')).toBe('none');
    expect(ciState([], 'abc')).toBe('none');
  });

  it('is pending while a run is going, and failure when any run failed', { tags: ['condition'] }, () => {
    expect(ciState([r('test.yml', 'in_progress', null), ...passed.slice(1)], 'abc')).toBe('pending');
    expect(ciState([r('test.yml', 'completed', 'failure'), ...passed.slice(1)], 'abc')).toBe('failure');
    expect(ciState([r('test.yml', 'in_progress', null), r('supply-chain.yml', 'completed', 'failure')], 'abc')).toBe('failure');
  });

  it('ignores a run that was cancelled by a newer push', { tags: ['condition'] }, () => {
    expect(ciState([r('test.yml', 'completed', 'cancelled'), ...passed], 'abc')).toBe('success');
  });

  it('counts the audit only when it ran, and a failed audit stops the merge', { tags: ['condition'] }, () => {
    expect(ciState([...passed, r('audit.yml', 'completed', 'success')], 'abc')).toBe('success');
    expect(ciState([...passed, r('audit.yml', 'completed', 'failure')], 'abc')).toBe('failure');
  });
});

describe('run', { tags: [] }, () => {
  const pr = (number: number, title: string, labels: string[] = []) => ({
    number,
    title,
    labels: labels.map((name) => ({ name })),
    createdAt: '2026-11-01T00:00:00Z',
    headRefName: 'dependabot/n' + number,
    headRefOid: 'sha' + number,
  });
  const now = Date.parse('2026-11-03T00:00:00Z');

  /** A stand-in for `gh`: the listed pull requests, and the checks of the commits in `passed` all green. */
  function fake(prs: ReturnType<typeof pr>[], passed: string[]) {
    const calls: string[][] = [];
    const exec = (args: string[]) => {
      calls.push(args);
      if (args[0] === 'pr' && args[1] === 'list') return JSON.stringify(prs);
      if (args[0] === 'run') {
        const sha = 'sha' + String(args[5]).split('/n')[1];
        return JSON.stringify(passed.includes(sha) ? [{ headSha: sha, status: 'completed', conclusion: 'success' }] : []);
      }
      return '';
    };
    return { calls, exec };
  }
  const changes = (calls: string[][]) => calls.filter((c) => c[0] === 'pr' && c[1] !== 'list');
  const prs = [pr(1, 'Bump serde from 1.0.1 to 1.0.2'), pr(2, 'Bump react from 18.0.0 to 19.0.0'), pr(3, 'Bump vite from 7.0.0 to 7.1.0')];

  it(
    'merges the small one that passed, closes the major one with its reason and leaves the one still waiting',
    { tags: ['scenario'] },
    () => {
      const { calls, exec } = fake(prs, ['sha1']);
      const lines: string[] = [];
      run({ now, log: (m: string) => lines.push(m), exec });
      expect(changes(calls).map((c) => c.slice(0, 3))).toEqual([
        ['pr', 'merge', '1'],
        ['pr', 'close', '2'],
      ]);
      expect(changes(calls)[1]).toContain('--comment');
      expect(lines).toHaveLength(3);
      expect(lines[2]).toContain('leave');
    },
  );

  it('only logs what it would do with --dry', { tags: ['condition'] }, () => {
    const { calls, exec } = fake(prs, ['sha1']);
    run({ dry: true, now, log: () => undefined, exec });
    expect(changes(calls)).toEqual([]);
  });

  it('does nothing when no pull request is open', { tags: ['boundary'] }, () => {
    const { calls, exec } = fake([], []);
    run({ now, log: () => undefined, exec });
    expect(calls).toHaveLength(1);
  });
});
