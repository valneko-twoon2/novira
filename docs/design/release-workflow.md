---
covers:
  - .github/workflows/release.yml
  - scripts/release/package.bat
  - scripts/tools/package-release.mjs
---
# Release workflow

GitHub builds the Windows release when a version tag is pushed, and leaves a draft release for a person to read and publish. The same build runs by hand from `scripts\release\package.bat`; the workflow is that script on a clean machine.

## Behaviour

- **Trigger.** A tag `v*` pushed to GitHub, or "Run workflow" by hand. A manual run is a rehearsal: it builds and smoke-tests, keeps the zip as a build artifact for 14 days, and makes no release.
- **Build job** (`windows-latest`, at most 90 minutes), in this order:
  1. For a tag, `package-release.mjs --check-tag <tag>` stops the run unless the tag is `v` plus exactly the `[workspace.package]` version of `backend/Cargo.toml` (`v0.4.0` for `0.4.0`). Set the version with `scripts\release\set-version.bat` and commit it before tagging.
  2. `npm ci` and Playwright's Chromium (the smoke test drives them), with the npm cache and a cache of cargo's registry and `backend/target` keyed on `Cargo.lock` and the toolchain file.
  3. `scripts\release\package.bat build`: the frontend and the app and server in release mode into `artifacts\`.
  4. `scripts/tools/release-smoke.mjs` on what was built: the server on an empty folder and on each old-data fixture, and `novira.exe` with no engine ([development.md](../development.md)). Nothing uses the GPU. On the runner only, `novira.exe` is started by `scripts/tools/start-medium.ps1` with a normal user's token (the administrators' group deny-only, Medium integrity) from a `.cmd` the script writes into its work folder, which sets the variables and records the token's groups; on a desktop it is started directly.
  5. `package-release.mjs`: `novira-<version>-windows-x64.zip` and its `.sha256`, uploaded as the build artifact.
- **Draft job** (`ubuntu-latest`, tags only): `gh release create <tag> --draft --verify-tag` with the zip and the checksum, as a pre-release when the tag has a hyphen (`v0.5.0-beta.1`). The body only says it is a draft; the notes are written from [release-notes-template.md](../release-notes-template.md) and the release is published by a person. A rerun on a tag whose release exists only replaces the files (`--clobber`) and never changes its state.
- `package.bat` does not wait for a key when `CI` is set (the runner has nobody to press one).

## Boundaries

| Boundary | Guard |
|---|---|
| The tag name (outside input) | It reaches scripts only through the environment (`TAG`), never pasted into script text, and the build stops unless it equals `v` plus the version in `Cargo.toml` |
| The token | The workflow has `contents: read`; only the draft job has `contents: write`, and it runs no repository code, only `gh` on the downloaded artifact. No other secret is used |
| Actions | Only GitHub's own (`actions/*`), named by major version; no third-party action runs in the build |
| What is published | A draft: nothing is public until a person publishes it |

## Known limits

- On the runner the job is elevated, and WebView2 gave the elevated app no `--remote-debugging-port`, neither from `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` nor from its policy key (`WEBVIEW2_USER_DATA_FOLDER` was taken), so the smoke test could not reach the window. Nor did it with the administrators' group deny-only at High integrity (`runas /trustlevel:0x20000`). Elevation is the only difference found from a desktop, where the same build takes the port; no Microsoft page says so. Whether a Medium-integrity start opens the port there is to be seen in the next run.
- Actions are pinned by major version, not by commit, so a moved tag of an `actions/*` action is trusted.
- The build is not code-signed. The zip's SHA-256 is the only integrity mark.

## Not implemented

- Tests do not run in GitHub (there is no CI for checks): `scripts\check.bat` and `scripts\checks\full-check.bat` stay by hand, and so do the live tests, the mutation run and the real app.
