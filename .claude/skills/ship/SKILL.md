---
name: ship
description: "Takes a finished work branch into main the GitHub Flow way: pushes it, opens its pull request, has a fresh reviewer agent review it on GitHub, fixes what the review or CI finds, squash-merges when every check passed and the review of the head is ok, removes the worktree, and then judges whether the merged work calls for a release (/release-notes). Use when work on a branch is done and committed (your own or a subagent's after /gatekeeper's checks), or when the user says to take it in (PR にして, マージして, main に入れて, 出して)."
argument-hint: "The worktree or branch to ship (default: the current one)"
user-invocable: true
disable-model-invocation: false
---

`main` changes only by a merged pull request (branch protection refuses a direct push). Every step below is allowed without asking (AGENTS.md section 3): push the work branch, open its pull request, post the review, merge it when the rule of `scripts/tools/pr.mjs` says so. Never `--force`, never `--no-verify`, never merge by hand around `pr.mjs`.

```
Ship progress:
- [ ] 1. Branch ready: committed, local checks of the change passed
- [ ] 2. Pull request open
- [ ] 3. Reviewed by a fresh agent on GitHub; changes made and reviewed again until ok
- [ ] 4. Checks green, merged by pr.mjs, worktree removed
- [ ] 5. Release judged
- [ ] 6. Reported
```

## 1. Ready

- The work is on a branch made from `main` (`node scripts/tools/worktree.mjs add <name>`; one branch per piece of work: one feature, one fix, one change of the harness). Everything is committed with Japanese messages (the hooks check them).
- The checks that fit the change passed locally (`node scripts/tools/affected.mjs`, `.claude/rules/tests.md`). CI runs the rest; do not run every test "to be safe".
- `git fetch origin`; when `main` moved and the branch touches the same files, bring it up to date: `git rebase origin/main` only before the branch's first push, `git merge origin/main` once it is pushed (a rebase of a pushed branch needs `--force`, which is not allowed; the squash merge keeps `main`'s history clean anyway). A conflict is solved here, not on GitHub.

## 2. Open

`node scripts/tools/pr.mjs open` in the worktree: pushes the branch and opens the pull request to `main` (body: the commits). The title becomes the subject of the squashed commit on `main`, so it follows `.claude/rules/commit-messages.md` (the tool checks it before pushing): a branch of one commit takes that commit's subject; a branch of several needs `--title "<type>: <要約>"` naming the main change (a `feat:` branch with a later `docs:` commit is `feat:`, or `/release-notes` misjudges it). Give a body with `--body-file` when the commits do not say what changed and why, in Japanese. It prints the number.

## 3. Review

The author never reviews its own work. Start a **fresh** agent (Agent tool, a new one each round, not a fork) with:

- the pull request number and the repository path, and the instruction to read the diff with `gh pr diff <n>` and the changed files in full where the diff is not enough;
- what to judge: correctness (a bug, a missed case, a broken caller), the tests (one per behaviour, they fail without the change, a bug fix has its regression test), the rules of `AGENTS.md` and `.claude/rules/` the diff touches (the table of `/gatekeeper` section 1), texts in ja and en, the map and design pages;
- to report the head commit it read (`gh pr view <n> --json headRefOid`) on its first line as `SHA: <40 hex>`;
- to answer with a verdict `ok` or `changes` and a Japanese review: each finding with the file and line, what goes wrong, and what to do; no praise, no summary of the diff. Findings that are only taste do not make `changes`.

Post its answer as the review: write it to `novira-data/work/scratch/pr/<n>-review.md`, then `node scripts/tools/pr.mjs review <n> --verdict <ok|changes> --sha <the SHA it read> --body-file <that file>`. The tool refuses when the head moved past that commit, and the merge counts only a review of the current head by the signed-in account, so a later push needs a new review.

On `changes`: fix on the branch (a bug the review found gets its test first, AGENTS.md section 4), commit, push (`pr.mjs open` pushes again), and review again with a new agent. Disagreeing with a finding is allowed when the code or the spec shows it is wrong: say why in a reply on the pull request (`gh pr comment <n> --body-file`), then a new review.

## 4. Merge

`node scripts/tools/pr.mjs merge <n> --wait`: waits for the checks, then squash-merges only if every check passed and the review of the head is `ok`, deletes the remote branch and fast-forwards the main checkout. When it refuses:

- a check failed: read it (`gh run view <id> --log-failed`), fix on the branch, push, review again. A failure that is also on `main` is reported with the evidence, not fixed by weakening the check;
- no review of the head: section 3.

Then remove the worktree: `node scripts/tools/worktree.mjs remove <path>` (it deletes the branch, merged by the pull request).

## 5. Release?

After every merge except the release pull request's own (`chore: v<version> をリリースする`: go back to `/release-notes` section 4 instead), judge whether `main` should be released now, by the rule of `/release-notes` section 1 (user-visible fix or feature since the last tag, security, nothing but development changes). If yes, run `/release-notes`; if not, say in the report why it waits.

## 6. Report

The pull request (number, link) and its merge commit; the review rounds and what they changed; the checks (CI) and the local ones run; what was not verified and why; whether a release followed, and its tag.

Request: $ARGUMENTS
