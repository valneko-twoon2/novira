---
description: How long and how shaped a Git commit message is - a point-first summary and a few one-line bullets, not a report
paths:
  - ".githooks/**"
  - ".githooks/commit-msg.mjs"
---

# Commit messages

A commit message says what the commit is, so a reader of `git log` can find it. The details are in the diff, the tests and the docs, so they do not go in the message. Messages are Japanese, with a Conventional Commits type in front (AGENTS.md section 0).

## Before committing

Stage only your own files (`git status` first, `git diff --cached` after). Run `npm run check:eol` in `frontend/`. `data/`, `outputs/`, `out/`, `novira-data/` (with the harness output in `novira-data/work/`), `config.json`, `.env*`, API keys and generated files are never committed (the pre-commit hook refuses them). A subagent's work branch is deleted after the merge (see `/gatekeeper`).

## Shape

| Part | Rule |
|---|---|
| Line 1 | `<type>: <summary>` (or `<type>(<scope>): ...`, `!` before the colon for a breaking change). The type is one of `feat` (a new feature), `fix` (a bug fix), `docs`, `style` (formatting only), `refactor`, `perf`, `test`, `build`, `ci`, `chore` (tooling, harness, upkeep), `revert`. The summary is Japanese: the point of the whole commit in one line, at most 72 characters in all, no full stop (`。` or `.`). Name what changed and, if short, what for. Do not list several unrelated changes with 「と」; if you must, the commit is probably two commits |
| Body | Only when line 1 is not enough. A blank line, then at most 8 lines, each one a Japanese bullet that starts with `- `, at most 100 characters, one line each (do not wrap). Code names, paths and commands stay as they are inside the Japanese |
| Trailers | No `Co-Authored-By:` line, ever (the hook refuses it, and `.claude/settings.json` turns off Claude Code's own co-author line). Other trailers go after a blank line and do not count toward the limits |

A small or obvious change (a typo, a rename, one fix) is **line 1 only**.

## What goes in the bullets

- The main things that were done, at the level of "what a reader would look for": a feature added, a behaviour changed, a thing removed, a decision that is not obvious from the diff and why.
- Not in the message: file lists, function names one by one, step-by-step history of the work, test commands and results (they go in the report to the user), "also fixed" lists of small things, restating the line 1.
- Not in the message: the name of a branch or tag (a subagent's `worktree-agent-...`, `claude/...`, `archive/...`, the branch you are on) or the story of old history. Say what the commit does; where it was made is in the log.
- If more than 8 bullets seem needed, keep the 8 that matter and let line 1 cover the rest, or split the commit.

## Example

```text
feat(comic): ページ帯に各ページを縮小表示する

- 幅に合わせて最大 10 ページを並べ、前後のまとまりへ矢印で移る
- ゴミ箱ボタン 1 つで選んだ吹き出し・絵・コマを消す（Delete キーも同じ）
- コマはどこを押しても運べ、最初に動かしたときにページが自由配置になる
- 吹き出しは 15 の形、線、黒塗り、揺れ。輪郭は点で形を直せる
```

A merge of a subagent's branch uses the type of what comes in: `feat: 画面状態のライブ同期を取り込む`.

## Enforcement

The `commit-msg` hook (`.githooks/commit-msg`, `.githooks/commit-msg.mjs`, tested by `frontend/tests/commit-msg.test.ts`) refuses a message that has a `Co-Authored-By:` line, whose line 1 does not start with one of the types above and a colon and a space, whose summary is over 72 characters, ends with a full stop or has no Japanese (no hiragana, katakana or kanji), whose bullets have no Japanese, whose body is over 8 lines or has a line that is not a one-line bullet over 100 characters, or that names a work branch (`worktree-agent-...`, `claude/...`, `archive/...`) or the branch being committed on (other than main). Only the messages Git writes itself are not checked (`Merge branch '...'`, `Merge remote-tracking branch`, `Revert "..."`, `fixup!`, `squash!`, `amend!`); a merge message written by hand is. It cannot judge whether the bullets are the right ones: write the shortest message that lets a reader recognise the commit.
