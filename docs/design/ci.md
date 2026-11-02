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
- **`vitest` job** (`windows-latest`, Node 22, at most 30 minutes): `npm ci`, then `npx vitest run --maxWorkers=4 --testTimeout=30000` in `frontend/` (every unit and component test, not the Playwright specs). The runner has 4 cores, where the config's ten workers starved each other and four tests passed 5 s; the flags apply to the runner only, a test that sets its own limit keeps it.
- **`clippy` job** (`windows-latest`, at most 60 minutes): `cargo clippy -p novira-core -p novira-server -p novira --tests -- -D warnings` in `backend/`, with cargo's registry and `backend/target` cached on `Cargo.lock` and the toolchain file. The app crate's build script builds the frontend, so Node and `npm ci` come first.
- **`cargo-test` job** (`windows-latest`, at most 90 minutes): `cargo test --no-fail-fast` for `novira-core`, `novira-server` and `novira` (the Tauri shell, which also checks the command list against the capability), each step even when an earlier one failed, with the frontend installed first (the app crate builds it) and cargo cached like `clippy` under its own key.
- **`e2e-chromium` job** (`windows-latest`, at most 60 minutes): `npx playwright test --project=chromium` in `frontend/`, the screen flows (including the a11y check) on the mock backend in Chromium, two workers (half the cores, `playwright.config.ts`) and one retry (`CI` is set). A failed run keeps `playwright-report/` and `test-results/` as an artifact for 7 days.
- **`e2e-phone` job** (`windows-latest`, at most 60 minutes): `npx playwright test --project=phone --project=webkit`, the phone layout (`phone*.spec.ts`) in Chromium as a Pixel 7 and in WebKit as an iPhone 14; the same report artifact on failure.
- The `static` and `rust-format` jobs read the sources only: no build, no browser, no GPU.

## Boundaries

| Boundary | Guard |
|---|---|
| The token | `contents: read` only; no secret is used |
| Actions | Only GitHub's own (`actions/*`), named by major version |

## Known limits

- A failing check does not block a merge or a push: there is no branch protection yet.
- The `vitest` job runs on Windows because the harness tests (`data-guard`, the harness paths, the models sweep, the prune policy) assume Windows paths; on Ubuntu 4 of their files failed. 

## Not implemented

- Next in line, each added once it is seen to pass on the runner: the layout scan and the visual regression (whose baselines are Windows images), and `scripts/tools/diff-backends.mjs`. Until then they stay in `scripts\check.bat` and `scripts\checks\full-check.bat`.
- No dependency audit runs (`npm audit`, `cargo audit`).
