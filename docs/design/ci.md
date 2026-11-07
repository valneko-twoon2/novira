---
covers:
  - .github/workflows/test.yml
  - .github/workflows/audit.yml
  - backend/.cargo/audit.toml
  - .github/workflows/supply-chain.yml
  - backend/deny.toml
  - .gitleaks.toml
  - scripts/tools/diff-backends.mjs
  - scripts/tools/ci-summary.mjs
---
# CI: checks on every push

GitHub runs the repository's checks on every push to a branch, so a change is checked off the developer's machine. It starts with the checks that are sure to pass on a clean runner and grows one check at a time.

## Behaviour

- **Trigger.** A push to any branch. A tag push runs the release instead ([release-workflow.md](release-workflow.md)). A newer push to the same branch cancels the running check of the older one.
- **`static` job** (`ubuntu-24.04`, at most 20 minutes): `npm ci` in `frontend/`, then `npm run typecheck`, `npm run lint`, `scripts/tools/check-eol.mjs`, `scripts/tools/check-name.mjs`, `scripts/tools/docs-check.mjs`, `scripts/tools/ui-refs.mjs`, `frontend/scripts/check-glossary.mjs` and `scripts/tools/changelog.mjs --check`. Each runs even when an earlier one failed, so one run shows every failure.
- **`rust-format` job** (`ubuntu-24.04`): `cargo fmt --all -- --check` in `backend/`, with the toolchain of `backend/rust-toolchain.toml`.
- **`vitest` job** (`windows-latest`, Node 22, at most 30 minutes): `npm ci`, then `npx vitest run --maxWorkers=4 --testTimeout=30000` in `frontend/` (every unit and component test, not the Playwright specs). The runner has 4 cores, where the config's ten workers starved each other and four tests passed 5 s; the flags apply to the runner only, a test that sets its own limit keeps it.
- **`clippy` job** (`windows-latest`, at most 60 minutes): `cargo clippy -p novira-core -p novira-server -p novira --tests -- -D warnings` in `backend/`, with cargo's registry and `backend/target` cached on `Cargo.lock` and the toolchain file. The app crate's build script builds the frontend, so Node and `npm ci` come first.
- **`cargo-test` job** (`windows-latest`, at most 90 minutes): `cargo test --no-fail-fast` for `novira-core`, `novira-server` and `novira` (the Tauri shell, which also checks the command list against the capability), each step even when an earlier one failed, with the frontend installed first (the app crate builds it) and cargo cached like `clippy` under its own key.
- **`e2e-chromium` job** (`windows-latest`, at most 60 minutes): `npx playwright test --project=chromium` in `frontend/`, the screen flows (including the a11y check) on the mock backend in Chromium, two workers (half the cores, `playwright.config.ts`) and one retry (`CI` is set). A failed run keeps `logs/playwright-report/` and `logs/e2e/` as an artifact for 7 days.
- **`e2e-phone` job** (`windows-latest`, at most 60 minutes): `npx playwright test --project=phone --project=webkit`, the phone layout (`phone*.spec.ts`) in Chromium as a Pixel 7 and in WebKit as an iPhone 14; the same report artifact on failure.
- **`diff-backends` job** (`windows-latest`, at most 60 minutes): `node scripts/tools/diff-backends.mjs`. It builds `novira-server` (no engine) into `novira-data/work/server-target` and the frontend's harness build, starts the server on an empty data folder, and runs `frontend/difftest/` against it and the browser mock. The cargo build is cached under its own key and always runs: the cache only spares the dependencies, so the server compared is the one of this commit.
- **The count of tests.** The `vitest` and `diff-backends` jobs write the JSON report of vitest (`--reporter=default --reporter=json`; `diff-backends.mjs` takes the file from `NOVIRA_VITEST_JSON`) and run `ci-summary.mjs vitest`, which writes the counts per folder and per test file; giving the reporters also stops vitest's own differently shaped summary. The `cargo-test` job keeps the output of each crate in a log (`tee`) and its last step runs `scripts/tools/ci-summary.mjs cargo`, which writes the passed, failed and ignored tests of every test binary to the job summary, a total per crate with the binaries in a fold. The two Playwright jobs add the JSON reporter (`--reporter=list,html,json`) and run `ci-summary.mjs playwright`, which writes the counts per project and per spec file. The summary steps run even when a test step failed, and a missing log or report gives a line saying so, never a failed step. Tests marked `#[ignore]` (the `*_live.rs` ones) count as ignored.
- The `static` and `rust-format` jobs read the sources only: no build, no browser, no GPU.

## Audit

`.github/workflows/audit.yml` is a workflow of its own, so a new advisory does not fail every push. It runs every Monday (03:17 UTC) and on a branch push that changes `backend/Cargo.lock`, `frontend/package-lock.json`, `backend/.cargo/audit.toml` or the workflow, on `ubuntu-24.04`:

- `cargo audit` (cargo-audit 0.22.2, installed with `--locked` and cached) over `backend/Cargo.lock`. The advisories already judged are in `backend/.cargo/audit.toml`, each with its reason ([security.md](security.md), dependency findings); a new vulnerability fails the run. Unmaintained or unsound warnings do not.
- `npm run audit` (`npm audit --omit=dev`) in `frontend/`, the dependencies that ship in the app.

## Supply chain

`.github/workflows/supply-chain.yml` is a third workflow. It is **not** run on a push yet: it starts by hand (workflow_dispatch) and every Monday (03:43 UTC), so a new check is seen to pass on the runner before it joins the push checks. Both jobs run on `ubuntu-24.04` with the version-pinned release binary of the tool, downloaded from GitHub's releases and checked against a sha256 written in the workflow before it runs (no third-party action, no `cargo install`):

- `cargo-deny` (0.20.2, at most 20 minutes): `cargo-deny --locked check bans licenses sources` in `backend/` with `backend/deny.toml`. The graph is the Windows one (the app ships on Windows only). Licences are an allow-list of what the graph carries; any other licence fails. A wildcard version, an unknown registry and any git source fail; two versions of one crate only warn. The workspace crates are `publish = false`, which lets cargo-deny take their path dependencies as local. Advisories are not checked here: they stay with `cargo audit` and `backend/.cargo/audit.toml`.
- `gitleaks` (8.30.1, at most 10 minutes): `gitleaks detect --source . --redact` over the whole history (`fetch-depth: 0`) and the tree, with `.gitleaks.toml`: the default rules plus four allowlist entries, each tied to one file and one value and giving its reason (test fixtures and catalogue ids, looked at one by one), and the untracked `novira-data/` folder. `--redact` keeps a found value out of the run log. The own scan of committed secrets (`cargo test -p novira --test security`, `secrets`) stays; this adds the history and the many key formats of the default rules.

By hand: `cargo deny --manifest-path backend/Cargo.toml check bans licenses sources` and `gitleaks detect --source . --no-banner` (also `--no-git` for the working tree).

## Boundaries

| Boundary | Guard |
|---|---|
| The token | `contents: read` only; no secret is used (all three workflows) |
| Downloaded tools | The supply-chain tools are pinned releases with a sha256 checked in the workflow; a bump means a new hash taken from the release |
| Actions | Only GitHub's own (`actions/*`), named by major version, at the releases that run on Node 24 (the older ones print a deprecation warning). `release.yml` is still on the older majors: it only runs on a tag, so a bump waits for a run that can check it |

## Known limits

- A failing check does not block a merge or a push: there is no branch protection yet.
- The `vitest` job runs on Windows because the harness tests (`data-guard`, the harness paths, the models sweep, the prune policy) assume Windows paths; on Ubuntu 4 of their files failed. 

## Not implemented

- Next in line, each added once it is seen to pass on the runner: the layout scan and the visual regression (whose baselines are Windows images). Until then they stay in `scripts\check.bat` and `scripts\checks\full-check.bat`.
- No notice goes out when the weekly audit or supply-chain run fails: it shows in the Actions tab.
- The supply-chain workflow does not run on a push. It passed once on the runner (both jobs, on a trial branch made from `main`); it joins the push checks when the user decides, and until a manual run from the default branch is possible it needs the file on `main`.
- CodeQL and semgrep are not used: CodeQL needs `github/codeql-action`, which would widen the actions rule above.
