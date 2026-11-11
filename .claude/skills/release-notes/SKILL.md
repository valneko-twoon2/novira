---
name: release-notes
description: "Releases novira from main the GitHub Flow way: judges whether the changes since the last tag call for a release and which version, writes the version's CHANGELOG section from the commits, ships it as a release pull request (/ship: agent review, CI, merge), tags the merge commit, waits for the release workflow and publishes the release. Use after a merge into main (/ship section 5 asks for it), or when the user asks for a release (リリースして, 版を出して, リリースノート)."
argument-hint: "Optional: the version to release (default: judged from the commits)"
user-invocable: true
disable-model-invocation: false
---

# Release: from main to a published release

The whole release is the agent's: deciding that one is due, the changelog, the pull request, the tag and the publication (the user's standing word, 2026-11-12). Do not stop to ask between the steps; stop only on a failed check below, and say why. `CHANGELOG.md` is written only here (section 6).

```
Release progress:
- [ ] 1. Judged: release due, version chosen (or: waits, and why)
- [ ] 2. Release branch: version set, [Unreleased] written and cut
- [ ] 3. Shipped: release pull request reviewed and merged
- [ ] 4. Tag pushed, release workflow passed
- [ ] 5. Release published
- [ ] 6. Reported
```

`gh` may not be on PATH: `C:\Program Files\GitHub CLI\gh.exe`.

## 1. Judge

1. `git fetch origin --tags`. The last release: `git describe --tags --abbrev=0 origin/main`. The range: `git log --no-merges --format="%h %s" <last>..origin/main`.
2. Sort the range as section 6 says (what a user of the app sees). The release is due when the range holds a security fix (release now) or a user-visible fix or feature (a line section 6 would write). Only development changes (tests, CI, hooks, skills, docs, refactors, dependency updates nobody notices): **wait**, say so in the report, and do nothing else.
3. The version, from the last tag `X.Y.Z`: a feature or a changed behaviour raises the minor (`X.Y+1.0`), fixes only raise the patch (`X.Y.Z+1`); before 1.0 a breaking change raises the minor too. A version named in the argument wins. When `backend/Cargo.toml` already declares a version above the last tag that no tag has, release that one.
4. Not taken: `git ls-remote --tags origin v<version>` prints nothing and `gh release view v<version>` fails. If the tag exists with no published release (a failed run), stop and report: a pushed tag is not moved without the user.

## 2. Release branch

1. `node scripts/tools/worktree.mjs add release-v<version>` and work there.
2. `node scripts/tools/set-version.mjs <version>` unless the version is already set; `node scripts/tools/package-release.mjs --check-tag v<version>` must pass.
3. Write `[Unreleased]` from the range, as section 6 says:
   1. Sort the commits by what the user of the app sees, not by the prefix alone; a `test:` or `chore:` subject that says a defect of the app was fixed (直す, 不具合) can hold a product fix: read it.
   2. For each user-visible change, one line under `[Unreleased]`. When a subject does not say what the user can now do, read the commit (`git show --stat <id>`, then the relevant part); quote screen words from `frontend/src/i18n/locales/ja/`, numbers from the code.
   3. Skip changes that were reverted, merge lines about the same thing, and keep it short.
   4. A change you could not confirm is written cautiously or left out, and named in the report.
4. `node scripts/tools/changelog.mjs --release <version>` (`[Unreleased]` becomes `## [<version>] - <today>`, the links are rewritten), then `node scripts/tools/changelog.mjs --check`.
5. Commit: `chore: v<version> のリリースを用意する` (the version files and `CHANGELOG.md`).

## 3. Ship the release pull request

`/ship` the branch with the title `chore: v<version> をリリースする` and the version's section as the body. The reviewer also checks the section against the range: a user-visible change missing, a line that is not true, a development change that slipped in, the shape of section 6.

## 4. Tag

1. After the merge: `git fetch origin`; the merge commit is `origin/main` (check that its subject is the release pull request's).
2. `git tag -a v<version> -m "novira v<version>" origin/main`, then `git push origin v<version>`.
3. The release workflow starts on the tag push: it checks the tag against the version and `CHANGELOG.md`, builds (about 15 minutes) and makes the draft release titled `v<version>` with the section as its body (a pre-release when the tag has a hyphen). Wait for it: `gh run watch <id> --exit-status` (the id from `gh run list --workflow release --limit 1`).
4. If it fails: read the log (`gh run view <id> --log-failed`), fix on a branch through `/ship`, and ask the user before re-running it on the tag or moving the tag. Do not publish.

## 5. Publish

`gh release edit v<version> --draft=false` (keep the pre-release flag the workflow set); `gh release view v<version>` then shows it published with the zip attached.

## 6. What goes into CHANGELOG.md, and how

`CHANGELOG.md` is the record of what changed for the user of the app, version by version, in the shape of [Keep a Changelog 1.1.0](https://keepachangelog.com/ja/1.1.0/); the release page shows the version's section as it is.

- Only this skill writes it. A feature, a fix or a removal does not add its line when it is made, and nothing waits under `[Unreleased]` between releases.
- Nothing about developing the app goes in, whatever the commit type: tests and test tools, CI and workflows, hooks, skills, rules, `scripts/`, build and cargo settings, docs and design pages, refactors. A `test:` or `chore:` commit that fixes a defect of the app does add its fix. Leave out what a user would hardly notice, and accessibility-only fixes (screen-reader names, ARIA).
- Under a version, only these headings, in this order, each at most once: `### Added` (what the user can now do), `### Changed` (works differently, a rename), `### Deprecated`, `### Removed`, `### Fixed` (what went wrong no longer does), `### Security`.
- Bullets are Japanese, for users: one line each, no sub-bullets, no mechanism. Name screens and buttons with the words the app shows; merge related changes into one bullet. Added, Changed, Deprecated and Removed lines are short phrases ending in 「〜を追加。」「〜に変更。」「〜ように変更。」「〜を削除。」; Fixed lines are です/ます (「〜を直しました。」「〜ようにしました。」); a security fix is one plain line (「〜の安全性を高めました。」).
- The introduction is one line naming the format; nothing else goes above `[Unreleased]`.

`node scripts/tools/changelog.mjs --check` (pre-commit when the file is staged, the `test` workflow, `frontend/tests/changelog.test.ts`) refuses a file out of shape. It cannot tell whether a change is missing or a bullet is true; section 2 and the review do that.

## Report

- Waited: the range and why nothing in it is for users.
- Released: the version and why that number; the release link, the pull request and its merge commit, the tag, the workflow run; the version's section in a ```` ```markdown ```` block; the range (`v0.4.0..`, N commits) and what was left out, by kind with counts; the changes you could not confirm.
- A correction asked afterwards: change `CHANGELOG.md` through `/ship`, then put the same text on the release with `gh release edit v<version> --notes-file <file>` from `node scripts/tools/changelog.mjs --notes v<version> --out novira-data/work/release-notes/v<version>.md`.

## Limits

- Never move or delete a pushed tag without the user.
- Never publish a release whose workflow run failed.
