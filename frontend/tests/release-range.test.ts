// Where a release's range of commits starts (scripts/tools/release-range.mjs): a squash release leaves develop's own commits out of the tag's
// history, so the range cannot be `<tag>..develop`.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { rangeStart, releaseCommits, releaseMarks } from '../../scripts/tools/release-range.mjs';

const c = (sha: string, subject: string) => ({ sha, subject });

describe('the start of a release range', () => {
  it('is the newest commit that prepared the last release, not the tag', { tags: ['condition', 'regression'] }, () => {
    const develop = [c('e', 'feat: 新しい機能'), c('d', 'chore: v0.6.0 のリリースを用意する'), c('c', 'fix: 直す'), c('b', 'chore: v0.5.0 をリリースする'), c('a', 'feat: 古い')];
    expect(rangeStart('0.6.0', develop)).toBe('d');
    expect(rangeStart('0.5.0', develop)).toBe('b');
    expect(releaseMarks('0.6.0')).toContain('chore: v0.6.0 のリリースを用意する');
  });

  it('is nothing when no commit marks that version, and does not take another version', { tags: ['error-guessing'] }, () => {
    expect(rangeStart('0.7.0', [c('a', 'chore: v0.6.0 のリリースを用意する')])).toBeNull();
    expect(rangeStart('0.6.0', [c('a', 'chore: v0.6.01 のリリースを用意する'), c('b', 'chore: v0.6.0 のリリースを用意しない')])).toBeNull();
    expect(rangeStart('0.6.0', [])).toBeNull();
  });
});

describe('the commits of a release range', () => {
  it('leave out the squash commits that released an earlier version, which come back with main', { tags: ['equivalence'] }, () => {
    const range = [c('3', 'feat: 一つ'), c('2', 'chore: v0.6.0 をリリースする'), c('1', 'fix: 二つ'), c('0', 'chore: v0.7.0 のリリースを用意する')];
    expect(releaseCommits(range).map((x: { sha: string }) => x.sha)).toEqual(['3', '1', '0']);
  });
});

describe('the range in a real history: squash release, main merged back', () => {
  it('lists only the commits made since the release, not the ones the release already held', { tags: ['regression'] }, () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'novira-range-'));
    const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' });
    const commit = (msg: string) => {
      writeFileSync(path.join(dir, 'f.txt'), `${msg}\n${Math.random()}`);
      git('add', '-A');
      git('commit', '-q', '-m', msg);
    };
    try {
      git('init', '-q', '-b', 'main');
      commit('chore: 始まり');
      git('checkout', '-q', '-b', 'develop');
      commit('feat: 一つめ');
      commit('chore: v0.6.0 のリリースを用意する');
      // The release: a squash of develop into main (one commit with the same tree), then main merged back into develop.
      git('checkout', '-q', 'main');
      git('merge', '--squash', 'develop');
      git('commit', '-q', '-m', 'chore: v0.6.0 をリリースする');
      git('checkout', '-q', 'develop');
      git('merge', '-q', '--no-ff', '-m', 'chore: main を develop に戻す', 'main');
      commit('fix: リリースのあとの修正');
      const first = git('log', '--first-parent', '--format=%H%x09%s', 'develop').split('\n').filter(Boolean).map((l) => ({ sha: l.split('\t')[0], subject: l.split('\t')[1] }));
      const start = rangeStart('0.6.0', first);
      const since = git('log', '--no-merges', '--format=%s', `${start}..develop`).split('\n').filter(Boolean);
      expect(releaseCommits(since.map((s) => c('x', s))).map((x: { subject: string }) => x.subject)).toEqual(['fix: リリースのあとの修正']);
      // What the tag's range would give: the commits of the release again.
      const wrong = git('log', '--no-merges', '--format=%s', 'main..develop').split('\n').filter(Boolean);
      expect(wrong).toContain('feat: 一つめ');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
