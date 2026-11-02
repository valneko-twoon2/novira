---
covers:
  - .github/workflows/test.yml
---
# CI: checks on every push

GitHub runs the repository's checks on every push to a branch, so a change is checked off the developer's machine. It starts with the checks that are sure to pass on a clean runner and grows one check at a time.

## Behaviour

- **Trigger.** A push to any branch. A tag push runs the release instead ([release-workflow.md](release-workflow.md)). A newer push to the same branch cancels the running check of the older one.
- **`static` job** (`ubuntu-latest`, at most 20 minutes): `npm ci` in `frontend/`, then `npm run typecheck`, `npm run lint`, `scripts/tools/check-eol.mjs`, `scripts/tools/check-name.mjs`, `scripts/tools/docs-check.mjs`, `scripts/tools/ui-refs.mjs`, `frontend/scripts/check-glossary.mjs` and `scripts/tools/changelog.mjs --check`. Each runs even when an earlier one failed, so one run shows every failure.
- **`rust-format` job** (`ubuntu-latest`): `cargo fmt --all -- --check` in `backend/`, with the toolchain of `backend/rust-toolchain.toml`.
- These checks read the sources only: no build, no browser, no GPU, no Windows.

## Boundaries

| Boundary | Guard |
|---|---|
| The token | `contents: read` only; no secret is used |
| Actions | Only GitHub's own (`actions/*`), named by major version |

## Known limits

- A failing check does not block a merge or a push: there is no branch protection yet.
- The runner is Linux; the app is built and smoke-tested on Windows only by the release.

## Not implemented

- Next in line, each added once it is seen to pass on the runner: vitest (`npx vitest run`), then `cargo clippy` and `cargo test -p novira-core` on a Windows runner, then Playwright (`chromium`, then the visual regression, whose baselines are Windows images). Until then they stay in `scripts\check.bat` and `scripts\checks\full-check.bat`.
- No dependency audit runs (`npm audit`, `cargo audit`).
