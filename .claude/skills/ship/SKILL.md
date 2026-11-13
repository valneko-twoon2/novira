---
name: ship
description: "Takes a finished work branch into develop the GitHub Flow way: pushes it, opens its pull request, has a fresh reviewer agent review it on GitHub (not a pull request of only the changelog or tests), fixes what the review finds, squash-merges when the review of the head is ok (no CI or CodeQL runs on a pull request into develop), removes the worktree, and then judges whether develop calls for a release (/release-notes). Use when work on a branch is done and committed (your own or a subagent's after /gatekeeper's checks), or when the user says to take it in (PR にして, マージして, develop に入れて, 出して)."
argument-hint: "The worktree or branch to ship (default: the current one)"
user-invocable: true
disable-model-invocation: false
---

`develop` (where work happens) and `main` (what is released) change only by a merged pull request (branch protection refuses a direct push). Work branches go into `develop`; `main` takes only a release, from `develop` (`/release-notes`). Every step below is allowed without asking (AGENTS.md section 3): push the work branch, open its pull request, post the review, merge it when the rule of `scripts/tools/pr.mjs` says so. Never `--force`, never `--no-verify`, never merge by hand around `pr.mjs`.

```
Ship progress:
- [ ] 1. Branch ready: committed, local checks of the change passed
- [ ] 2. Pull request open
- [ ] 3. Reviewed by a fresh agent on GitHub; changes made and reviewed again until ok
- [ ] 4. Review ok, merged by pr.mjs, worktree removed
- [ ] 5. Release judged
- [ ] 6. Reported
```

## 1. Ready

- The work is on a branch made from `develop` (`node scripts/tools/worktree.mjs add <name>`; one branch per piece of work: one feature, one fix, one change of the harness). Everything is committed with Japanese messages (the hooks check them).
- The checks that fit the change passed locally (`node scripts/tools/affected.mjs`, `.claude/rules/tests.md`). A pull request into `develop` runs no CI and no CodeQL, so what the change needs must pass here, before it is pushed; the release pull request into `main` runs everything. Do not run every test "to be safe".
- `git fetch origin`; when `develop` moved and the branch touches the same files, bring it up to date: `git rebase origin/develop` only before the branch's first push, `git merge origin/develop` once it is pushed (a rebase of a pushed branch needs `--force`, which is not allowed; the squash merge keeps `develop`'s history clean anyway). A conflict is solved here, not on GitHub.

## 2. Open

Write the description in Japanese from `.github/pull_request_template.md` (meta/astryx's sections, named in plain Japanese) into `novira-data/work/scratch/pr/<branch>-body.md`, every section filled in:

- **背景**: what was wrong, for whom.
- **変わらないこと**: what must stay as it is (the invariant the reviewer checks the change against).
- **変更内容**: what changed and how; also what it does not do (left out, or for another pull request).
- **確認結果**: what was verified and how, before and after: the checks run and their results, numbers, shots. Not verified is written as such (未確認).
- **チェックリスト**: tick the lines that hold; an unticked line says why next to it.
- **追加・変更したテスト**: the tests added or changed and what each one proves (they stay in the repository; 確認結果 is what was run for this change).

Then `node scripts/tools/pr.mjs open --body-file <that file>` in the worktree: it pushes the branch and opens the pull request to `develop` (nothing runs on it), after checking the description has every section (`bodyProblems`) and the title. The title becomes the subject of the squashed commit on `develop`, so it follows `.claude/rules/commit-messages.md`: a branch of one commit takes that commit's subject; a branch of several needs `--title "<type>: <要約>"` naming the main change (a `feat:` branch with a later `docs:` commit is `feat:`, or `/release-notes` misjudges it). On a pull request already open, `open` pushes and updates the title or description given. It prints the number.

## 3. Review

**Skip this section for a pull request into `develop` that changes only the changelog, `docs/tests/README.md` or tests** (test files, `frontend/tests/`, `frontend/e2e/` with its baselines, `backend/crates/*/tests/`): `pr.mjs merge` merges it with no review (`reviewFree` in `scripts/tools/pr.mjs`; the user's choice, 2026-11-13, because the review made small pull requests slow). One file of anything else (the app, a script, a rule, a document, a version file) needs the review below, and so does every release pull request into `main`.

The author never reviews its own work. Start a **fresh** agent (Agent tool, a new one each round, not a fork) with:

- the pull request number and the repository path; to read the description (`gh pr view <n>`), the diff (`gh pr diff <n>`), the changed files in full where the diff is not enough, and the earlier reviews (`gh api repos/{owner}/{repo}/pulls/<n>/reviews`);
- what to judge: whether the change does what **変更内容** says and keeps what **変わらないこと** says; whether **確認結果** and **追加・変更したテスト** really show it (a claim with nothing behind it is a finding); correctness (a bug, a missed case, a broken caller); the tests (one per behaviour, they fail without the change, a bug fix has its regression test); the rules of `AGENTS.md` and `.claude/rules/` the diff touches (the table of `/gatekeeper` section 1); texts in ja and en; the map and design pages;
- to answer in exactly this shape (a verdict box GitHub draws in colour, then the sections; `pr.mjs review` refuses any other: the box, the counts against the sections, the commit against `--sha`), in Japanese except code and identifiers. Code that holds a backtick goes in double backticks (``` `` a`b `` ```), or it breaks the page:

```
SHA: <the 40-hex head commit it read: gh pr view <n> --json headRefOid>
VERDICT: changes            (or ok)
> [!CAUTION]                                                   (for ok: > [!TIP])
> **判定: NG**　指摘 1 件・任意 2 件（<the first 8 of the SHA> を確認）   (for ok: **判定: OK**, 指摘 0 件)

#### 総評
<one or two sentences: what the change gets right and what is wrong>

#### 前回の指摘
- <what became of each earlier finding; - なし in a first review>

#### 指摘                     (changes: one item or more; ok: leave the section out)
1. **`path/file.ext:line`**
   - 問題: <what goes wrong>
   - 直し方: <what to do, with the wording or the code when it helps>

#### 任意                     (findings that do not block the merge; leave out when none)
- **`path/file.ext:line`** <the finding>
```

  Few findings, each concrete; matters of taste go under 任意. No praise beyond the 総評, no summary of the diff.

Post its answer as the review: write the lines after `VERDICT` (keep the blank lines) to `novira-data/work/scratch/pr/<n>-review.md`, then `node scripts/tools/pr.mjs review <n> --verdict <ok|changes> --sha <the SHA it read> --body-file <that file>`. The tool checks the shape (`reviewProblems`), refuses when the head moved past that commit, and the merge counts only a review of the current head by the signed-in account, so a later push needs a new review.

On `changes`: fix on the branch (a bug the review found gets its test first, AGENTS.md section 4), commit, push (`pr.mjs open` pushes again), and review again with a new agent. A later round reads the earlier reviews and judges the change since the last one (`git diff <the reviewed sha>..HEAD`): whether each earlier finding was handled, and a new blocking finding only for an error in the changed lines. Findings under 任意 never block: take them now when they are small, or leave them for a later pull request and say so in the report. Disagreeing with a finding is allowed when the code or the spec shows it is wrong: say why in a reply on the pull request (`gh pr comment <n> --body-file`), then a new review.

## 4. Merge

`node scripts/tools/pr.mjs merge <n>`: into `develop` it squash-merges when the review of the head is `ok` (or none is needed, section 3) and the title and the description pass their checks (no CI, no CodeQL, no alerts are read); the commit on `develop` is the title with no body. It deletes the remote branch and fast-forwards the main checkout when that is on `develop`. When it refuses:

- (a release pull request into `main`, `/release-notes`: `merge --wait` makes it ready, which starts CI and CodeQL, waits for the required checks and the CodeQL analyses, and merges only if every one passed and no code scanning alert of the pull request is open. A failed check or an open alert sends it back to a draft: read the failure (`gh run view <id> --log-failed`) or the alert (`gh api "repos/{owner}/{repo}/code-scanning/alerts?ref=refs/pull/<n>/merge&state=open"`), fix on `develop` through a work branch, review again. A failure that is also on `develop` is reported with the evidence, not fixed by weakening the check; a false positive is reported to the user with the reason, and dismissing it is their call);
- no review of the head: section 3.

Then remove the worktree: `node scripts/tools/worktree.mjs remove <path>` (it deletes the branch, merged by the pull request).

## 5. Release?

After every merge into `develop` except the one that holds a release's version and CHANGELOG (`chore: v<version> のリリースを用意する`: go back to `/release-notes` section 3 instead), judge whether `develop` should be released now, by the rule of `/release-notes` section 1 (user-visible fix or feature since the last tag, security, nothing but development changes). If yes, run `/release-notes`; if not, say in the report why it waits.

## 6. Report

The pull request (number, link) and its merge commit; the review rounds and what they changed; the local checks run (no CI runs into develop); what was not verified and why; whether a release followed, and its tag.

Request: $ARGUMENTS
