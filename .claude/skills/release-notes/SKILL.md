---
name: release-notes
description: "Drafts the GitHub release notes of a novira version by filling docs/release-notes-template.md from the git history since the previous tag, writes them to novira-data/work/release-notes/ (never committed), and, when the user says to release, pushes the tag and makes the draft release with that body. Use when the user asks for release notes, a release body or to release a version (リリースノート, Releases の文章, 更新内容を書いて, リリース文, タグを打って, リリースして)."
argument-hint: "The tag to release, for example v0.4.0 (default: v plus the version in backend/Cargo.toml)"
user-invocable: true
disable-model-invocation: false
---

# Release notes and the draft release

Fill the project's template from the commits; do not invent changes. The notes file is **never committed**: it lives in `novira-data/work/release-notes/`, which git ignores and the pre-commit hook refuses. Never write it under `docs/` or anywhere else git tracks, and never `git add` it.

```
Release progress:
- [ ] 1. Tag and range found
- [ ] 2. Commits sorted and checked
- [ ] 3. Notes written to novira-data/work/release-notes/<tag>.md and shown
- [ ] 4. (on the user's word) tag pushed, draft made with the notes
```

## 1. Tag and range

- The tag: the argument, else `v` plus the `[workspace.package]` version of `backend/Cargo.toml`. Check it with `node scripts/tools/package-release.mjs --check-tag <tag>`; if it fails, the version is not set yet (`scripts\release\set-version.bat`, then a commit): tell the user and stop.
- The previous tag: `git describe --tags --abbrev=0` (if `<tag>` already exists locally, `git describe --tags --abbrev=0 <tag>^`). The range: `git log --no-merges --format="%h %s" <previous>..HEAD`.

## 2. Sort and check

1. Read `docs/release-notes-template.md` in full, including its top comment: it holds the writing rules (Japanese, screen words from the ja catalog, one-line bullets, section layout).
2. Sort by what the user sees, not by the prefix alone:
   - 新機能: something the user can now do (a `fix:` that adds a choice or a screen goes here too). 修正: something that works better or no longer goes wrong. 既知の制限: known gaps.
   - Leave out what a user cannot see: `docs:`, tests, the harness, refactors, and every `feat:`/`fix:`/`chore:` on CI, the smoke test, the release workflow, hooks, skills or `scripts/tools/`.
   - A `test:` or `chore:` subject that says a defect was fixed (直す, 不具合) can hold a product fix: read it and keep the fix.
   - Keep it simple (the user's choice): one short line per bullet, what changed for the user and no mechanism; merge related commits; leave out small fixes a user would hardly notice and accessibility-only fixes (screen-reader names, ARIA). A security fix is one plain line (「〜の安全性を高めました。」).
3. When a subject does not say what the user can now do, read the commit (`git show --stat <id>`, then the relevant part). Quote button and screen names from `frontend/src/i18n/locales/ja/`. Take numbers (days, counts, defaults) from the code.
4. A change you could not confirm goes into a question for the user, not into the notes as fact.

## 3. Write and show

Write only the part of the template below its comment, filled in, to `novira-data/work/release-notes/<tag>.md` (LF, UTF-8; make the folder if it is missing). Drop empty sections. Keep the translation line of 既知の制限 while `frontend/src/i18n/locales/` has languages other than `ja` and `en` (their text is caught up later). Then show the user:

- the notes in a ```` ```markdown ```` block, and the path of the file;
- the range used (`v0.3.0..HEAD`, N commits) and the commits left out, summarised by kind with counts (list ids only for a left-out `feat:` or `fix:`);
- the open questions.

Revise the file when the user asks for changes. Stop here unless the user says to release.

## 4. Release (only when the user says so)

The tag push is the one push outside `main` this skill makes, and only on the user's word for this tag. Run these in order and stop at the first failure (`gh` may not be on PATH: `C:\Program Files\GitHub CLI\gh.exe`):

1. Ready: `git status --short` shows nothing of yours; `git fetch origin` and `git rev-parse HEAD` equals `git rev-parse origin/main`; `git ls-remote --tags origin <tag>` prints nothing; the notes file exists; `--check-tag` passes.
2. Tag and push: `git tag -a <tag> -m "novira <tag>"`, then `git push origin <tag>`. The release workflow starts on the push.
3. Draft with the notes, right away (the workflow's build takes about 20 minutes, so the draft is there before it; when the workflow reaches its draft job it only attaches the zip and `.sha256` to the existing release and keeps the body):

   ```bash
   gh release create <tag> --draft --verify-tag --title "novira <tag>" --notes-file novira-data/work/release-notes/<tag>.md
   ```

   Add `--prerelease` when the tag has a hyphen (`v0.5.0-beta.1`). If a release of that tag already exists, use `gh release edit <tag> --notes-file <file>` instead.
4. Report the draft's URL and the run (`gh run list --workflow release --limit 1`). Publishing the draft is the user's step on GitHub; never pass `--draft=false`.

## Limits

- Never commit, stage or copy the notes into tracked files; never publish the release; never move or delete a tag that was pushed (ask the user).
- If the workflow fails after the tag is pushed, the draft stays without the zip: read the run's log, fix on `main`, and ask the user before re-running the workflow on the tag (`gh run rerun <id>`) or moving the tag.
