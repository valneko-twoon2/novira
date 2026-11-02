---
name: release-notes
description: "Releases a novira version when the user runs /release-notes: fills docs/release-notes-template.md from the git history since the previous tag into novira-data/work/release-notes/ (never committed), tags the latest commit of main, pushes the tag and makes the draft release with those notes; the release workflow then attaches the zip. Use when the user runs /release-notes, and only then (リリースノート, リリースして); it pushes a tag, so never on its own initiative."
argument-hint: "The tag to release, for example v0.4.0 (default: v plus the version in backend/Cargo.toml)"
user-invocable: true
disable-model-invocation: true
---

# Release notes, tag and draft release

Running `/release-notes` is the user's word to release: write the notes, tag the latest commit of `main`, push the tag and make the draft. Do not stop to ask between the steps; stop only on a failed check below, and say why.

The notes file is **never committed**: it lives in `novira-data/work/release-notes/`, which git ignores and the pre-commit hook refuses. Never write it under `docs/` or anywhere else git tracks, and never `git add` it. Fill the template from the commits; do not invent changes.

```
Release progress:
- [ ] 1. Ready: tag checked, main pushed, tag not taken
- [ ] 2. Commits sorted and checked
- [ ] 3. Notes written to novira-data/work/release-notes/<tag>.md
- [ ] 4. Tag pushed, draft made with the notes
- [ ] 5. Reported
```

`gh` may not be on PATH: `C:\Program Files\GitHub CLI\gh.exe`.

## 1. Ready

Stop at the first failure, before writing anything:

- The tag: the argument, else `v` plus the `[workspace.package]` version of `backend/Cargo.toml`. `node scripts/tools/package-release.mjs --check-tag <tag>` must pass; if not, the version is not set (`scripts\release\set-version.bat`, then a commit).
- The latest commit: on `main`, `git fetch origin`, and `git rev-parse HEAD` equals `git rev-parse origin/main` (nothing unpushed, nothing newer on GitHub). Uncommitted changes do not go into a tag; ignore them.
- Not taken: `git ls-remote --tags origin <tag>` prints nothing, and `gh release view <tag>` fails.
- The range: previous tag `git describe --tags --abbrev=0`; `git log --no-merges --format="%h %s" <previous>..HEAD`.

## 2. Sort and check

1. Read `docs/release-notes-template.md` in full, including its top comment: it holds the writing rules (Japanese, screen words from the ja catalog, one-line bullets, section layout).
2. Sort by what the user of the app sees, not by the prefix alone:
   - 新機能: something the user can now do. 修正: something that works better or no longer goes wrong (a change to an existing choice, such as how a model is picked, is 修正). 既知の制限: known gaps.
   - Leave out everything about developing the app, whatever its prefix (`feat:`, `fix:`, `chore:`, `test:`, `docs:`): tests and test tools, CI and the release workflow, the smoke test, hooks, skills, rules, `scripts/`, build and cargo settings, docs and the design pages, refactors.
   - A `test:` or `chore:` subject that says a defect of the app was fixed (直す, 不具合) can hold a product fix: read it and keep the fix.
   - Keep it simple (the user's choice): one short line per bullet, what changed for the user and no mechanism; merge related commits; leave out small fixes a user would hardly notice and accessibility-only fixes (screen-reader names, ARIA). A security fix is one plain line (「〜の安全性を高めました。」).
3. When a subject does not say what the user can now do, read the commit (`git show --stat <id>`, then the relevant part). Quote button and screen names from `frontend/src/i18n/locales/ja/`. Take numbers from the code.
4. A change you could not confirm is written cautiously or left out, and listed as a question in the report.

## 3. Write

Write only the part of the template below its comment, filled in, to `novira-data/work/release-notes/<tag>.md` (LF, UTF-8; make the folder if it is missing). Drop empty sections. Keep the translation line of 既知の制限 while `frontend/src/i18n/locales/` has languages other than `ja` and `en`.

## 4. Tag, push, draft

Run in order; do not change the commands. The tag push is the one push outside `main` this skill makes.

1. `git tag -a <tag> -m "novira <tag>"`, then `git push origin <tag>`. The release workflow starts on the push.
2. Right away (the workflow's build takes about 20 minutes, so the draft is there before its draft job, which then only attaches the zip and `.sha256` and keeps the body):

   ```bash
   gh release create <tag> --draft --verify-tag --title "novira <tag>" --notes-file novira-data/work/release-notes/<tag>.md
   ```

   Add `--prerelease` when the tag has a hyphen (`v0.5.0-beta.1`).

If a step fails after the tag was pushed, do not delete or move the tag; report what failed and ask.

## 5. Report

- The draft's URL and the workflow run (`gh run list --workflow release --limit 1`); the zip is attached when the run ends. Publishing the draft is the user's step on GitHub.
- The notes in a ```` ```markdown ```` block and the path of the file.
- The range (`v0.3.0..HEAD`, N commits) and what was left out, summarised by kind with counts.
- The open questions. A change the user asks for afterwards: edit the file, then `gh release edit <tag> --notes-file <file>`.

## Limits

- Never commit, stage or copy the notes into tracked files; never publish the release (`--draft=false`); never move or delete a pushed tag without the user.
- If the workflow fails, the draft stays without the zip: read the run's log, fix on `main`, and ask the user before re-running it on the tag (`gh run rerun <id>`) or moving the tag.
