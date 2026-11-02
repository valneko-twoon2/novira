---
description: What goes into CHANGELOG.md and how it is written - Keep a Changelog 1.1.0, Japanese one-line bullets for the app's users, written in the same commit as the change
paths:
  - "CHANGELOG.md"
  - "scripts/tools/changelog.mjs"
  - ".github/workflows/**"
---

# The changelog

`CHANGELOG.md` at the repository root is the record of what changed for the user of the app, version by version, in the shape of [Keep a Changelog 1.1.0](https://keepachangelog.com/ja/1.1.0/). The release workflow takes the tag's section as the body of the release page, so what is written here is what users read.

## When

- A commit that changes what the user of the app sees adds its line under `## [Unreleased]` **in the same commit** (AGENTS.md section 4). A later commit that changes the same thing edits that line rather than adding another.
- Nothing about developing the app goes in, whatever its commit type: tests and test tools, CI and the workflows, hooks, skills, rules, `scripts/`, build and cargo settings, docs and the design pages, refactors. A `test:` or `chore:` commit that fixes a defect of the app does add its fix.
- Leave out what a user would hardly notice, and accessibility-only fixes (screen-reader names, ARIA).
- `/release-notes` turns `[Unreleased]` into the version's section; nobody else writes a version section or moves lines between versions.

## How

- Under a section, only the Keep a Changelog types, in this order and each at most once: `### Added` (something the user can now do), `### Changed` (an existing feature or choice works differently, a rename), `### Deprecated`, `### Removed`, `### Fixed` (something that went wrong no longer does), `### Security`.
- Bullets are Japanese, for users: one line each, no sub-bullets, no paragraphs, no mechanism. Name screens and buttons with the words the app shows (quote `frontend/src/i18n/locales/ja/`); take numbers from the code.
- Added, Changed, Deprecated and Removed lines are short phrases ending in 「〜を追加。」「〜に変更。」「〜ように変更。」「〜を削除。」; Fixed lines are です/ます (「〜を直しました。」「〜ようにしました。」). A security fix is one plain line (「〜の安全性を高めました。」).
- Merge related changes into one bullet.
- The introduction is one line naming the format; nothing else goes above `[Unreleased]`.

## Enforcement

`scripts/tools/changelog.mjs --check` (the pre-commit hook when the file is staged, the `test` workflow, `frontend/tests/changelog.test.ts`) refuses a file out of shape: the title, `[Unreleased]` first, versions newest first with real dates, only the types above in order, one-line bullets, and the compare links at the end. It cannot tell whether a change is missing or a bullet is true; the release (`/release-notes`) reads the commits since the last tag against `[Unreleased]` for that.
