---
covers:
  - .github/workflows/release.yml
  - scripts/release/package.bat
  - scripts/tools/package-release.mjs
  - scripts/tools/changelog.mjs
---
# Release workflow

GitHub builds the Windows release when a version tag is pushed, and leaves a draft release, titled with the tag and with the tag's section of `CHANGELOG.md` as its notes, for a person to read and publish. The same build runs by hand from `scripts\release\package.bat`; the workflow is that script on a clean machine.

## Behaviour

- **Trigger.** A tag `v*` pushed to GitHub, and nothing else (no manual run, no branch push).
- **Build job** (`windows-latest`, at most 90 minutes), in this order:
  1. `package-release.mjs --check-tag <tag>` stops the run unless the tag is `v` plus exactly the `[workspace.package]` version of `backend/Cargo.toml` (`v0.4.0` for `0.4.0`). Set the version with `scripts\release\set-version.bat` and commit it before tagging. Then `changelog.mjs --notes <tag>` stops it unless `CHANGELOG.md` has a non-empty section for the version (`/release-notes` writes it before tagging); the section is uploaded as the build artifact `release-notes`.
  2. `npm ci` and Playwright's Chromium (the smoke test drives them), with the npm cache and a cache of cargo's registry and `backend/target` keyed on `Cargo.lock` and the toolchain file.
  3. `scripts\release\package.bat build`: the frontend and the app and server in release mode into `artifacts\`.
  4. `scripts/tools/release-smoke.mjs` on what was built: the server on an empty folder and on each old-data fixture, and `novira.exe` with no engine ([development.md](../development.md)). Nothing uses the GPU. On the runner only, `novira.exe` is started by `scripts/tools/start-medium.ps1` with a normal user's token (the administrators' group deny-only, Medium integrity) from a `.cmd` the script writes into its work folder, which sets the variables and records the token's groups; on a desktop it is started directly.
  5. `package-release.mjs`: `novira-<version>-windows-x64.zip` and its `.sha256`, uploaded as the build artifact of the same name (`novira-<version>-windows-x64`), which the draft job downloads.
- **Draft job** (`ubuntu-latest`): `gh release create <tag> --draft --verify-tag --title <tag>` with the zip and the checksum, and the downloaded `release-notes` as the body, as a pre-release when the tag has a hyphen (`v0.5.0-beta.1`). The release is published by a person. A rerun on a tag whose release exists only replaces the files (`--clobber`) and never changes its title, body or state.
- `package.bat` does not wait for a key when `CI` is set (the runner has nobody to press one).

## Boundaries

| Boundary | Guard |
|---|---|
| The tag name (outside input) | It reaches scripts only through the environment (`TAG`), never pasted into script text, and the build stops unless it equals `v` plus the version in `Cargo.toml` |
| The token | The workflow has `contents: read`; only the draft job has `contents: write`, and it runs no repository code, only `gh` on the downloaded artifacts (the zip, its checksum and the notes file). No other secret is used |
| Actions | Only GitHub's own (`actions/*`), named by major version; no third-party action runs in the build |
| What is published | A draft: nothing is public until a person publishes it |

## Known limits

- On the runner the job is elevated, and WebView2 gave the elevated app no `--remote-debugging-port`, neither from `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` nor from its policy key (`WEBVIEW2_USER_DATA_FOLDER` was taken), so the smoke test could not reach the window. Nor did it with the administrators' group deny-only at High integrity (`runas /trustlevel:0x20000`). A start at Medium integrity opens it (run 41378550015). Why WebView2 ignores the flag at High integrity is not documented by Microsoft.
- Actions are pinned by major version, not by commit, so a moved tag of an `actions/*` action is trusted.
- The build is not code-signed. The zip's SHA-256 is the only integrity mark.

## Not implemented

- The release does not wait for the `test` workflow: the tag is pushed from a `main` whose checks ran on its own push. The tests the `test` workflow does not run yet stay by hand (`scripts\check.bat`, `scripts\checks\full-check.bat`), and so do the live tests, the mutation run and the real app.
