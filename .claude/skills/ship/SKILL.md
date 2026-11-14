---
name: ship
description: "Takes a finished work branch into develop with no pull request: a light review by a fresh agent whose every suspected problem on a program is checked by a run (a test that fails, the program driven) before it counts, fixes what the run showed real, then lands the branch as one squashed commit on develop with scripts/tools/land.mjs, removes the worktree, and judges whether develop calls for a release (/release-notes). Changelog- and test-only branches land with no review. Use when work on a branch is done and committed (your own or a subagent's after /gatekeeper's checks), or when the user says to take it in (マージして, develop に入れて, 出して)."
argument-hint: "The worktree or branch to ship (default: the current one)"
user-invocable: true
disable-model-invocation: false
---

`develop` (where work happens) takes a work branch with no pull request: `scripts/tools/land.mjs` squashes it into one commit on top of `origin/develop` and pushes it as a fast-forward. `main` (what is released) changes only by the release pull request (`/release-notes`). The review is light and a run decides (the user's rule, 2026-11-14): a suspected problem in a program counts only when a test or a run shows it, so a review does not stall on cases that hardly happen. Every step below is allowed without asking (AGENTS.md section 3). Never `--force`, never `--no-verify`, never push `develop` by hand around `land.mjs`.

```
Ship progress:
- [ ] 1. Branch ready: committed, local checks of the change passed, up to date with origin/develop
- [ ] 2. Reviewed by a fresh agent; each suspicion on a program run, only the real ones are findings
- [ ] 3. Findings fixed (with the test that showed them), reviewed again until ok
- [ ] 4. Landed by land.mjs, worktree removed
- [ ] 5. Release judged
- [ ] 6. Reported
```

## 1. Ready

- The work is on a branch made from `develop` (`node scripts/tools/worktree.mjs add <name>`; one branch per piece of work: one feature, one fix, one change of the harness). Everything is committed with Japanese messages (the hooks check them).
- The checks that fit the change passed locally (`node scripts/tools/affected.mjs`, `.claude/rules/tests.md`). Nothing runs on GitHub for `develop`; the release pull request into `main` runs everything. Do not run every test "to be safe".
- `git fetch origin`; when `develop` moved, `git rebase origin/develop` (the branch is never pushed, so a rebase is fine) and solve conflicts here; then run the checks the conflict touched again.

## 2. Review (light, then a run decides)

Branches that change only the changelog, `docs/tests/README.md` and tests (`reviewFree` of `scripts/tools/pr.mjs`) skip to section 4 with no review.

The author never reviews its own work. Start a **fresh** agent (Agent tool, a new one each round, not a fork) with:

- the worktree's absolute path and the base: `git diff origin/develop...HEAD`, `git log origin/develop..HEAD`, the changed files in full where the diff is not enough, the earlier reviews of this branch (`novira-data/work/scratch/review/<branch>-<round>.md`), and what the change is meant to do (one paragraph from you: the request, what must stay as it is);
- what to look at, briefly: does the change do what it says, does it keep what must stay, a bug or a missed case a user would really meet, a broken caller, missing tests (one per behaviour, a bug fix with its regression test), the rules of `AGENTS.md` and `.claude/rules/` the diff touches (the table of `/gatekeeper` section 1), ja and en texts, the map and the design pages;
- **how to decide a finding**: a suspicion about a program (code, scripts, hooks, tests) becomes a finding only when the reviewer showed it by a run: a test written for it that fails (put it next to the code as the project's tests are, run it with `node scripts/tools/checks.mjs vitest <file>` or the fitting check, and leave it in the worktree uncommitted so the author keeps it as the regression test), or the program run with the input that breaks it. What a run did not bear out goes under 退けた候補 with what was run, and the test written for it is deleted. What cannot be run in reasonable time is not a finding: it may go under 任意 as one line. A finding about a document (the manual, `docs/`, rules and skills, screen texts) is judged by reading, as before;
- not to change anything else in the worktree, and not to commit;
- to answer in exactly this shape, in Japanese except code and identifiers (`land.mjs` checks it with `reviewProblems`; code that holds a backtick goes in double backticks):

```
SHA: <the 40-hex commit it read: git rev-parse HEAD in the worktree>
VERDICT: changes            (or ok)
> [!CAUTION]                                                   (for ok: > [!TIP])
> **判定: NG**　指摘 1 件・任意 2 件（<the first 8 of the SHA> を確認）   (for ok: **判定: OK**, 指摘 0 件)

#### 総評
<one or two sentences>

#### 前回の指摘
- <what became of each earlier finding; - なし in a first review>

#### 指摘                     (changes: one item or more; ok: leave the section out)
1. **`path/file.ext:line`**
   - 問題: <what goes wrong, for whom>
   - 検証: <a program: `the test file or command run` and what it showed, 再現した; a document: why the text is wrong>
   - 直し方: <what to do>

#### 退けた候補               (suspicions a run did not bear out; leave out when none)
- **`path/file.ext:line`** <the suspicion> 検証: <what was run and what it showed>

#### 任意                     (findings that do not block; leave out when none)
- **`path/file.ext:line`** <the finding>
```

Save its answer, the SHA and VERDICT lines included, to `novira-data/work/scratch/review/<branch>-<round>.md`.

## 3. Fix

On `changes`: commit the reproducing test the reviewer left with the fix (AGENTS.md section 4: the test fails before, passes after), run the checks again, and review again with a new agent. A later round reads the earlier reviews and judges the change since the last one (`git diff <the reviewed sha>..HEAD`): whether each earlier finding was handled, and a new finding only for an error in the changed lines, shown by a run as before. Findings under 任意 never block: take them now when they are small, or name them in the report. Disagreeing with a finding is allowed when its run does not show what it says: run it yourself and say why in the next review's brief.

## 4. Land

In the worktree: `node scripts/tools/land.mjs --review-file <the last review> [--title "<type>: <要約>"]` (no `--review-file` for a review-free branch). It refuses a dirty worktree, a branch that does not hold `origin/develop`, a title that breaks the commit rules (a branch of several commits needs `--title` naming the main change: a `feat:` branch with a later `docs:` commit is `feat:`, or `/release-notes` misjudges it), and a review that is not ok, not in the shape, or of another change (a review of the head, or of a commit before a rebase with no conflict, counts). It then pushes one commit, the title with no body, to `develop`, marks the branch landed, and fast-forwards the main checkout. When `develop` moved meanwhile, the push is refused: rebase, run the checks the update touched, and land again.

Never pipe `land.mjs` into another command when something follows (a hidden failure once removed a worktree whose work had not gone in): chain with `&&`, or write its output to a file and check the exit code.

Then remove the worktree: `node scripts/tools/worktree.mjs remove <path>` (it deletes the landed branch).

## 5. Release?

After every land except the one that holds a release's version and CHANGELOG (`chore: v<version> のリリースを用意する`: go back to `/release-notes` section 3 instead), judge whether `develop` should be released now, by the rule of `/release-notes` section 1. If yes, run `/release-notes`; if not, say in the report why it waits.

## 6. Report

The commit on `develop`; the review rounds, the findings each one showed by a run, and the suspicions it set aside; the local checks run; what was not verified and why; whether a release followed, and its tag.
