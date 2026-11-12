---
name: release-notes
description: "Releases novira from develop the GitHub Flow way: judges whether the changes since the last tag call for a release and which version, writes the version's CHANGELOG section from the commits, ships it into develop (/ship), opens the release pull request develop into main (agent review, CI and CodeQL, squash merge), tags the merge commit on main, waits for the release workflow, publishes the release and merges main back into develop. Use after a merge into develop (/ship section 5 asks for it), or when the user asks for a release (リリースして, 版を出して, リリースノート)."
argument-hint: "Optional: the version to release (default: judged from the commits)"
user-invocable: true
disable-model-invocation: false
---

# Release: from develop to a published release

The whole release is the agent's: deciding that one is due, the changelog, the pull request, the tag and the publication (the user's standing word, 2026-11-12). Release as soon as section 1 says one is due, after each merge into `develop` that makes it due: do not wait for changes to pile up (the user's word, 2026-11-12: go fast, `develop` is not a place to collect a batch). Do not stop to ask between the steps; stop only on a failed check below, and say why. `CHANGELOG.md` is written only here (section 6).

```
Release progress:
- [ ] 1. Judged: release due, version chosen (or: waits, and why)
- [ ] 2. Release branch: version set, [Unreleased] written and cut, shipped into develop
- [ ] 3. Release pull request (a snapshot of develop) into main: reviewed, CI and CodeQL green, merged
- [ ] 4. Tag pushed on main, release workflow passed
- [ ] 5. Release published, main merged back into develop
- [ ] 6. Reported
```

`gh` may not be on PATH: `C:\Program Files\GitHub CLI\gh.exe`.

## 1. Judge

1. `git fetch origin --tags`. The last release: `git describe --tags --abbrev=0 origin/main`. The range: `node scripts/tools/release-range.mjs` (the commits on `develop` since its commit that prepared the last release, newest first; `<last>..origin/develop` would list every earlier release again, because a squash release leaves `develop`'s own commits out of the tag's history). Without a start commit it fails: then take the commits since the tag's date (`git log --no-merges --since`) and say so in the report.
2. Sort the range as section 6 says (what a user of the app sees). The release is due when the range holds a security fix (release now) or a user-visible fix or feature (a line section 6 would write). Only development changes (tests, CI, hooks, skills, docs, refactors, dependency updates nobody notices): **wait**, say so in the report, and do nothing else.
3. The version, from the last tag `X.Y.Z`: a feature or a changed behaviour raises the minor (`X.Y+1.0`), fixes only raise the patch (`X.Y.Z+1`); before 1.0 a breaking change raises the minor too. A version named in the argument wins. When `backend/Cargo.toml` already declares a version above the last tag that no tag has, release that one.
4. Not taken: `git ls-remote --tags origin v<version>` prints nothing and `gh release view v<version>` fails. If the tag exists with no published release (a failed run), stop and report: a pushed tag is not moved without the user.

## 2. Release branch

1. `node scripts/tools/worktree.mjs add release-v<version>` (from `develop`) and work there.
2. `node scripts/tools/set-version.mjs <version>` unless the version is already set; `node scripts/tools/package-release.mjs --check-tag v<version>` must pass.
3. Write `[Unreleased]` from the range, as section 6 says:
   1. Sort the commits by what the user of the app sees, not by the prefix alone; a `test:` or `chore:` subject that says a defect of the app was fixed (直す, 不具合) can hold a product fix: read it.
   2. For each user-visible change, one line under `[Unreleased]`. When a subject does not say what the user can now do, read the commit (`git show --stat <id>`, then the relevant part); quote screen words from `frontend/src/i18n/locales/ja/`, numbers from the code.
   3. Skip changes that were reverted, merge lines about the same thing, and keep it short.
   4. A change you could not confirm is written cautiously or left out, and named in the report.
4. `node scripts/tools/changelog.mjs --release <version>` (`[Unreleased]` becomes `## [<version>] - <today>`, the links are rewritten), then `node scripts/tools/changelog.mjs --check`.
5. Commit: `chore: v<version> のリリースを用意する` (the version files and `CHANGELOG.md`), then `/ship` it into `develop` like any work branch (its review reads the section against the range; no CI runs there). Go on with section 3 once it is merged.

## 3. The release pull request

`develop` now holds everything of the release. Other work goes on: more branches may be merged into `develop` while the release pull request is reviewed and tested, because the release pull request is a snapshot, not `develop` itself. Write the description into `novira-data/work/scratch/pr/release-v<version>-body.md`, then `node scripts/tools/pr.mjs open --release --title "chore: v<version> をリリースする" --body-file <that file>` (it pushes GitHub's `develop` as it is now to the branch `release/v<version>` and opens that into `main` as a draft, whatever the checkout holds; run it again, with no title, to bring the snapshot up to `develop` after a fix, a fast-forward that takes in what was merged since). Review it like any pull request (`/ship` section 3, a fresh agent), then `node scripts/tools/pr.mjs merge <n> --wait`: it makes the draft ready, which starts CI and CodeQL, and squash-merges when every check and CodeQL analysis passed and no code scanning alert is open (a failure sends it back to a draft: fix on `develop` through a work branch, `/ship` section 4). Its description follows `.github/pull_request_template.md` like any other (`pr.mjs` refuses anything else): **背景** why a release is due now (section 1), **変更内容** the version and the version's section quoted as it is, **確認結果** the range (`release-range.mjs`, N commits) and what was left out by kind, **追加・変更したテスト** none, with `changelog.mjs --check` and `package-release.mjs --check-tag` passing. After its merge do not judge a release again: continue with section 4. The reviewer also checks the section against the range: a user-visible change missing, a line that is not true, a development change that slipped in, the shape of section 6.

## 4. Tag

1. After the merge: `git fetch origin`; the commit to tag is the release pull request's merge commit on `main`, `gh pr view <n> --json mergeCommit --jq .mergeCommit.oid`.
2. `git tag -a v<version> -m "novira v<version>" <that commit>`, then `git push origin v<version>`.
3. The release workflow starts on the tag push: it checks the tag against the version and `CHANGELOG.md`, builds (about 15 minutes) and makes the draft release titled `v<version>` with the section as its body (a pre-release when the tag has a hyphen). Wait for it: `gh run watch <id> --exit-status` (the id from `gh run list --workflow release --limit 1`).
4. If it fails: read the log (`gh run view <id> --log-failed`), fix on a branch through `/ship` (into `develop`), and ask the user before re-running it on the tag or moving the tag. Do not publish.

## 5. Publish

`gh release edit v<version> --draft=false` (keep the pre-release flag the workflow set); `gh release view v<version>` then shows it published with the zip attached.

Then merge `main` back into `develop`: `node scripts/tools/pr.mjs sync` opens the pull request (a squash release leaves `main`'s history out of `develop`'s, so the next release would show the old changes again), and `node scripts/tools/pr.mjs merge <n>` merges it as a merge commit, with no review, once `git merge-tree` shows that `develop`'s tree stays as it is. When it refuses (a conflict, or a change only `main` has), report it: a person looks.

## 6. What goes into CHANGELOG.md, and how

`CHANGELOG.md` is the record of what changed for the user of the app, version by version, in the shape of [Keep a Changelog 1.1.0](https://keepachangelog.com/ja/1.1.0/); the release page shows the version's section as it is.

- Only this skill writes it. A feature, a fix or a removal does not add its line when it is made, and nothing waits under `[Unreleased]` between releases.
- Nothing about developing the app goes in, whatever the commit type: tests and test tools, CI and workflows, hooks, skills, rules, `scripts/`, build and cargo settings, docs and design pages, refactors. A `test:` or `chore:` commit that fixes a defect of the app does add its fix. Leave out what a user would hardly notice, and accessibility-only fixes (screen-reader names, ARIA).
- The reader is a user of the last release (the app and the browser version `server.bat` both). A feature that first appears in this version is one Added line: its fixes and reworks made before the release are not written (that user never had it). A feature of the last release that was reworked is Changed, not Added. Check each Fixed and Changed line against the last tag (`git show <last>:<path>`, `git grep <key> <last> -- frontend/src/i18n/locales/ja`): the feature it names must be there.
- Under a version, only these headings, in this order, each at most once: `### Added` (what the user can now do), `### Changed` (works differently, a rename), `### Deprecated`, `### Removed`, `### Fixed` (what went wrong no longer does), `### Security`.
- Bullets are Japanese, for users: one line each, no sub-bullets, no mechanism. Name screens and buttons with the words the app shows; merge related changes into one bullet. Added, Changed, Deprecated and Removed lines are short phrases ending in 「〜を追加。」「〜に変更。」「〜ように変更。」「〜を削除。」; Fixed lines are です/ます (「〜を直しました。」「〜ようにしました。」); a security fix is one plain line (「〜の安全性を高めました。」).
- The introduction is one line naming the format; nothing else goes above `[Unreleased]`.

`node scripts/tools/changelog.mjs --check` (pre-commit when the file is staged, the `test` workflow, `frontend/tests/changelog.test.ts`) refuses a file out of shape. It cannot tell whether a change is missing or a bullet is true; section 2 and the review do that.

## Report

- Waited: the range and why nothing in it is for users.
- Released: the version and why that number; the release link, the pull request and its merge commit, the tag, the workflow run; the version's section in a ```` ```markdown ```` block; the range (`v0.4.0..`, N commits) and what was left out, by kind with counts; the changes you could not confirm.
- A correction asked afterwards: change `CHANGELOG.md` through `/ship` (into `develop`; it reaches `main` with the next release, so correct the release page by hand too), then put the same text on the release with `gh release edit v<version> --notes-file <file>` from `node scripts/tools/changelog.mjs --notes v<version> --out novira-data/work/release-notes/v<version>.md`.

## Limits

- Never move or delete a pushed tag without the user.
- Never publish a release whose workflow run failed.
