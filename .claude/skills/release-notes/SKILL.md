---
name: release-notes
description: "Releases a novira version when the user runs /release-notes: writes [Unreleased] of CHANGELOG.md from the commits since the previous tag, turns it into the version's section, commits and pushes main, then tags that commit and pushes the tag; the release workflow builds the zip and makes the draft release titled with the tag, with the version's section as its body. Use when the user runs /release-notes, and only then (リリースノート, リリースして); it pushes a tag, so never on its own initiative."
argument-hint: "The tag to release, for example v0.5.0 (default: v plus the version in backend/Cargo.toml)"
user-invocable: true
disable-model-invocation: true
---

# Release: changelog, tag and draft release

Running `/release-notes` is the user's word to release: finish the changelog, commit and push it, tag that commit and push the tag. Do not stop to ask between the steps; stop only on a failed check below, and say why.

The notes are the version's section of `CHANGELOG.md`, written as section 6 below says. The release workflow reads them from the tagged commit, titles the draft with the tag and attaches the zip ([release-workflow.md](../../../docs/design/01-app/04-release/01-release-workflow.md)). Do not make the release with `gh` yourself.

```
Release progress:
- [ ] 1. Ready: tag checked, main pushed, tag not taken
- [ ] 2. [Unreleased] written from the commits
- [ ] 3. Version section cut, committed, main pushed
- [ ] 4. Tag pushed, workflow running
- [ ] 5. Reported
```

`gh` may not be on PATH: `C:\Program Files\GitHub CLI\gh.exe`.

## 1. Ready

Stop at the first failure, before changing anything:

- The tag: the argument, else `v` plus the `[workspace.package]` version of `backend/Cargo.toml`. `node scripts/tools/package-release.mjs --check-tag <tag>` must pass; if not, the version is not set (`scripts\release\set-version.bat`, then a commit).
- The latest commit: on `main`, `git fetch origin`, and `git rev-parse HEAD` equals `git rev-parse origin/main` (nothing unpushed, nothing newer on GitHub). Uncommitted changes of others stay out: stage only `CHANGELOG.md` below.
- Not taken: `git ls-remote --tags origin <tag>` prints nothing, `gh release view <tag>` fails, and `CHANGELOG.md` has no section for the version.
- `node scripts/tools/changelog.mjs --check` passes.
- The range: previous tag `git describe --tags --abbrev=0`; `git log --no-merges --format="%h %s" <previous>..HEAD`.

## 2. Write [Unreleased] from the commits

`[Unreleased]` is empty between releases: nothing else writes `CHANGELOG.md`. Write every line now, from the commits of the range:

1. Sort the commits by what the user of the app sees, not by the prefix alone; leave out everything about developing the app (section 6). A `test:` or `chore:` subject that says a defect of the app was fixed (直す, 不具合) can hold a product fix: read it.
2. For each user-visible change, write one line under `[Unreleased]`, as section 6 says. When a subject does not say what the user can now do, read the commit (`git show --stat <id>`, then the relevant part); quote screen words from `frontend/src/i18n/locales/ja/`, numbers from the code.
3. Skip changes that were reverted, merge lines about the same thing, and keep it short: leave out small fixes a user would hardly notice.
4. A change you could not confirm is written cautiously or left out, and listed as a question in the report.

## 3. Cut the version and push main

1. `node scripts/tools/changelog.mjs --release <version>` (the tag without `v`): `[Unreleased]` becomes `## [<version>] - <today>` and the links are rewritten. It refuses an empty `[Unreleased]`.
2. `git add CHANGELOG.md`, commit `docs: CHANGELOG に <tag> の変更を書く`, `git push origin main`.

## 4. Tag and push

Run in order; do not change the commands. The tag push is the one push outside `main` this skill makes.

1. `git tag -a <tag> -m "novira <tag>"` on the commit of step 3, then `git push origin <tag>`.
2. The release workflow starts on the push: it stops early if the tag does not match the version or `CHANGELOG.md` has no section for it, then builds (about 15 minutes) and makes the draft release titled `<tag>` with the section as its body, as a pre-release when the tag has a hyphen.

If a step fails after the tag was pushed, do not delete or move the tag; report what failed and ask.

## 5. Report

- The workflow run (`gh run list --workflow release --limit 1`); the draft appears on the releases page when the run ends. Publishing the draft is the user's step on GitHub.
- The version's section in a ```` ```markdown ```` block and the commit ID.
- The range (`v0.4.0..HEAD`, N commits) and what was left out, summarised by kind with counts.
- The open questions. A change the user asks for afterwards: edit `CHANGELOG.md` on `main` (commit and push), then put the same text on the release with `gh release edit <tag> --notes-file <file>` from `node scripts/tools/changelog.mjs --notes <tag> --out novira-data/work/release-notes/<tag>.md`.

## 6. What goes into CHANGELOG.md, and how

`CHANGELOG.md` is the record of what changed for the user of the app, version by version, in the shape of [Keep a Changelog 1.1.0](https://keepachangelog.com/ja/1.1.0/); the release page shows the version's section as it is.

- Only this skill writes it. A feature, a fix or a removal does not add its line when it is made, and nothing waits under `[Unreleased]` between releases.
- Nothing about developing the app goes in, whatever the commit type: tests and test tools, CI and workflows, hooks, skills, rules, `scripts/`, build and cargo settings, docs and design pages, refactors. A `test:` or `chore:` commit that fixes a defect of the app does add its fix. Leave out what a user would hardly notice, and accessibility-only fixes (screen-reader names, ARIA).
- Under a version, only these headings, in this order, each at most once: `### Added` (what the user can now do), `### Changed` (works differently, a rename), `### Deprecated`, `### Removed`, `### Fixed` (what went wrong no longer does), `### Security`.
- Bullets are Japanese, for users: one line each, no sub-bullets, no mechanism. Name screens and buttons with the words the app shows; merge related changes into one bullet. Added, Changed, Deprecated and Removed lines are short phrases ending in 「〜を追加。」「〜に変更。」「〜ように変更。」「〜を削除。」; Fixed lines are です/ます (「〜を直しました。」「〜ようにしました。」); a security fix is one plain line (「〜の安全性を高めました。」).
- The introduction is one line naming the format; nothing else goes above `[Unreleased]`.

`node scripts/tools/changelog.mjs --check` (pre-commit when the file is staged, the `test` workflow, `frontend/tests/changelog.test.ts`) refuses a file out of shape: the title, `[Unreleased]` first, versions newest first with real dates, only the headings above in order, one-line bullets, the compare links at the end. It cannot tell whether a change is missing or a bullet is true; step 2 does that.

## Limits

- Never publish the release (`--draft=false`); never move or delete a pushed tag without the user.
- If the workflow fails, there is no draft: read the run's log, fix on `main`, and ask the user before re-running it on the tag (`gh run rerun <id>`) or moving the tag.
