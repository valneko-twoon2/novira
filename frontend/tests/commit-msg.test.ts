// The commit message check (.githooks/commit-msg.mjs): "<type>: <summary>" in Japanese and a few one-line bullets.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { BULLETS_MAX, messageProblems } from '../../.githooks/commit-msg.mjs';

const problems = (message: string) => messageProblems(message) as string[];
const TRAILER = 'Claude-Session: https://example.com/s';

describe('commit message shape', () => {
  it('refuses a Co-Authored-By trailer in any case', () => {
    expect(problems('fix: 直す\n\nCo-Authored-By: Someone <noreply@example.com>\n').join()).toContain('Co-Authored-By');
    expect(problems('fix: 直す\n\n- ひとつ\n\nco-authored-by: Someone <a@b.c>\n').join()).toContain('Co-Authored-By');
  });

  it('accepts a summary alone, with or without a trailer', () => {
    expect(problems('fix: ページ帯の矢印を直す\n')).toEqual([]);
    expect(problems(`fix: ページ帯の矢印を直す\n\n${TRAILER}\n`)).toEqual([]);
  });

  it('accepts a summary with bullets and a trailer, and ignores comment lines', () => {
    expect(problems(`feat: 吹き出しを足す\n\n- 15 の形\n- 手描きの揺れ\n\n${TRAILER}\nClaude-Session: https://example.com/s\n# a comment git removes\n`)).toEqual([]);
  });

  it('accepts exactly the largest allowed body', () => {
    const bullets = Array.from({ length: BULLETS_MAX }, (_, i) => `- 要点 ${i}`).join('\n');
    expect(problems(`feat: いろいろ足す\n\n${bullets}\n`)).toEqual([]);
  });

  it('refuses a long summary and a summary ending with a full stop', () => {
    expect(problems(`fix: ${'あ'.repeat(68)}\n`).join()).toContain('73 characters');
    expect(problems(`fix: ${'あ'.repeat(67)}\n`)).toEqual([]);
    expect(problems('fix: 直す。\n').join()).toContain('full stop');
    expect(problems('fix: 直す.\n').join()).toContain('full stop');
  });

  it('refuses a body that is too long, has paragraphs, wrapped lines or no blank line after the summary', () => {
    const many = Array.from({ length: BULLETS_MAX + 1 }, (_, i) => `- 要点 ${i}`).join('\n');
    expect(problems(`feat: いろいろ足す\n\n${many}\n`).join()).toContain('at most 8 bullets');
    expect(problems('feat: 足す\n\n- ひとつ\n\n- ふたつ\n').join()).toContain('one block');
    expect(problems('feat: 足す\n\nこの変更は理由があって足す。\n').join()).toContain('not a bullet');
    expect(problems('feat: 足す\n- ひとつ\n').join()).toContain('blank line');
    expect(problems(`feat: 足す\n\n- ${'あ'.repeat(99)}\n`).join()).toContain('at most 100');
    expect(problems(`feat: 足す\n\n- ${'あ'.repeat(98)}\n`)).toEqual([]);
  });

  it('refuses an empty message and lets the merge, revert and fixup messages Git writes through', () => {
    expect(problems('\n# only a comment\n')).toHaveLength(1);
    expect(problems(`Merge branch 'x'\n\nlong long long\n\nparagraph\n`)).toEqual([]);
    expect(problems(`Merge remote-tracking branch 'origin/main'\n`)).toEqual([]);
    expect(problems('Revert "feat: 足す"\n\nThis reverts commit abc.\n')).toEqual([]);
    expect(problems('fixup! feat: 足す\n')).toEqual([]);
  });

  it('starts line 1 with a Conventional Commits type and an optional scope and "!"', () => {
    expect(problems('feat(phone)!: 画面を変える\n')).toEqual([]);
    expect(problems('chore: 依存を上げる\n')).toEqual([]);
    expect(problems('スマホの画面を変える\n').join()).toContain('type');
    expect(problems('feature: 画面を変える\n').join()).toContain('type');
    expect(problems('Feat: 画面を変える\n').join()).toContain('type');
    expect(problems('feat:画面を変える\n').join()).toContain('type');
    // A merge message written by hand is checked like any other.
    expect(problems('Merge the live sync\n').join()).toContain('type');
  });

  it('wants the summary and every bullet in Japanese', () => {
    expect(problems('feat: Add the browse menu\n').join()).toContain('Japanese');
    expect(problems('feat: カードの大きさを変える\n\n- `cardSize` を足す\n- English only\n').join()).toContain('Japanese');
    expect(problems('feat: カードの大きさを変える\n\n- `cardSize` を足す\n')).toEqual([]);
  });

  it('refuses a message that names a work branch, an archive tag or the branch it is made on', () => {
    expect(problems('fix: worktree-agent-a34a815d77bfd42e6 の帯を直す\n')).toHaveLength(1);
    expect(problems('feat: ページ帯を移す\n\n- claude/backend から持ってくる\n')).toHaveLength(1);
    expect(problems('feat: archive/legacy-ui のページを戻す\n')).toHaveLength(1);
    expect(messageProblems('fix: feature-x の帯を直す\n', { branch: 'feature-x' })).toHaveLength(1);
    expect(messageProblems('fix: 帯を直す\n', { branch: 'main' })).toEqual([]);
    expect(messageProblems('fix: main の帯を直す\n', { branch: 'main' })).toEqual([]);
  });

  it('handles Windows line ends', () => {
    expect(problems('feat: 足す\r\n\r\n- ひとつ\r\n- ふたつ\r\n')).toEqual([]);
  });
});
