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

Write the description in Japanese from `.github/pull_request_template.md` (the sections of meta/astryx's pull requests) into `novira-data/work/scratch/pr/<branch>-body.md`, every section filled in:

- **目的**: what was wrong, for whom.
- **変えないこと**: what must stay as it is (the invariant the reviewer checks the change against).
- **変更**: what changed and how; also what it does not do (left out, or for another pull request).
- **証拠**: what was verified and how, before and after: the checks run and their results, numbers, shots. Not verified is written as such.
- **範囲**: tick the lines that hold; an unticked line says why next to it.
- **テスト**: the tests added or changed and what each one proves.

Then `node scripts/tools/pr.mjs open --body-file <that file>` in the worktree: it pushes the branch and opens the pull request to `main`, after checking the description has every section (`bodyProblems`) and the title. The title becomes the subject of the squashed commit on `main`, so it follows `.claude/rules/commit-messages.md`: a branch of one commit takes that commit's subject; a branch of several needs `--title "<type>: <要約>"` naming the main change (a `feat:` branch with a later `docs:` commit is `feat:`, or `/release-notes` misjudges it). On a pull request already open, `open` pushes and updates the title or description given. It prints the number.

## 3. Review

The author never reviews its own work. Start a **fresh** agent (Agent tool, a new one each round, not a fork) with:

- the pull request number and the repository path; to read the description (`gh pr view <n>`), the diff (`gh pr diff <n>`), the changed files in full where the diff is not enough, and the earlier reviews (`gh api repos/{owner}/{repo}/pulls/<n>/reviews`);
- what to judge: whether the change does what **変更** says and keeps what **変えないこと** says; whether **証拠** and **テスト** really show it (a claim with nothing behind it is a finding); correctness (a bug, a missed case, a broken caller); the tests (one per behaviour, they fail without the change, a bug fix has its regression test); the rules of `AGENTS.md` and `.claude/rules/` the diff touches (the table of `/gatekeeper` section 1); texts in ja and en; the map and design pages;
- to answer in exactly this shape (after meta/astryx's review bot, laid out to read at a glance; `pr.mjs review` refuses any other), in Japanese except code and identifiers:

```
SHA: <the 40-hex head commit it read: gh pr view <n> --json headRefOid>
VERDICT: changes            (or ok)
**変更を求めます**            (for ok: **問題ありません**)
<the summary: one or two sentences, what the change gets right and what is wrong>

#### 前回の指摘
- <what became of each earlier finding; - なし in a first review>

#### 指摘                     (changes: one item or more; ok: leave the section out)
1. **`path/file.ext:line`**
   - 問題: <what goes wrong>
   - 直し方: <what to do, with the wording or the code when it helps>

#### 任意                     (findings that do not block the merge; leave out when none)
- **`path/file.ext:line`** <the finding>
```

  Few findings, each concrete; matters of taste go under 任意. No praise beyond the summary, no summary of the diff.

Post its answer as the review: write the lines after `VERDICT` (keep the blank lines) to `novira-data/work/scratch/pr/<n>-review.md`, then `node scripts/tools/pr.mjs review <n> --verdict <ok|changes> --sha <the SHA it read> --body-file <that file>`. The tool checks the shape (`reviewProblems`), refuses when the head moved past that commit, and the merge counts only a review of the current head by the signed-in account, so a later push needs a new review.

On `changes`: fix on the branch (a bug the review found gets its test first, AGENTS.md section 4), commit, push (`pr.mjs open` pushes again), and review again with a new agent. Disagreeing with a finding is allowed when the code or the spec shows it is wrong: say why in a reply on the pull request (`gh pr comment <n> --body-file`), then a new review.

## 4. Merge

`node scripts/tools/pr.mjs merge <n> --wait`: waits for the required checks (also the ones not started yet), then squash-merges only if every one passed, the review of the head is `ok`, the title and the description still pass their checks, and no code scanning alert is open on the pull request; the commit on `main` is the title with no body. It deletes the remote branch and fast-forwards the main checkout. When it refuses:

- a check failed: read it (`gh run view <id> --log-failed`), fix on the branch, push, review again. A failure that is also on `main` is reported with the evidence, not fixed by weakening the check;
- an open code scanning alert (CodeQL) on the pull request: read it (`gh api "repos/{owner}/{repo}/code-scanning/alerts?ref=refs/pull/<n>/merge&state=open"`), and fix the code yourself with a test (do not commit the suggested autofix unread). A false positive is reported to the user with the reason; dismissing it is their call;
- no review of the head: section 3.

Then remove the worktree: `node scripts/tools/worktree.mjs remove <path>` (it deletes the branch, merged by the pull request).

## 5. Release?

After every merge except the release pull request's own (`chore: v<version> をリリースする`: go back to `/release-notes` section 4 instead), judge whether `main` should be released now, by the rule of `/release-notes` section 1 (user-visible fix or feature since the last tag, security, nothing but development changes). If yes, run `/release-notes`; if not, say in the report why it waits.

## 6. Report

The pull request (number, link) and its merge commit; the review rounds and what they changed; the checks (CI) and the local ones run; what was not verified and why; whether a release followed, and its tag.

Request: $ARGUMENTS
