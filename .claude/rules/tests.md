---
description: Tests change with every feature addition, fix or removal, and only the tests a change affects are run (frontend, backend, contract)
paths:
  - "frontend/src/**"
  - "frontend/tests/**"
  - "frontend/e2e/**"
  - "contract/**"
  - "backend/**"
---

# Tests: what to change and what to run

Follow this when changing `frontend/` or `backend/`. How to choose the cases (partitions, boundaries, state transitions, decision tables, mutation testing) is the `/testing` skill; procedures are in [docs/verification.md](../../docs/verification.md).

## 1. Change the tests with the code (same commit)

| Change | Tests |
|---|---|
| A feature added | Tests of the new behaviour: the normal case and at least one failure, empty or boundary case. A new screen flow (tab, dialog, generation steps) gets a Playwright spec that is run; a new screen also one shot in `e2e/visual.spec.ts` |
| A bug fixed | A test that fails before the fix and passes after |
| A spec changed | Rewrite the tests to the new spec; do not just copy the new output into the expected values |
| A feature or code removed | Delete the tests that checked only it, and their fixtures, mocks, helpers, snapshots and baseline images |
| A rename or move | Move the tests, their names and `describe` blocks too (tests sit next to the code) |
| The contract (`types.ts`, `types.rs`) | Align `contract/samples/` and the Rust checks; regenerate the fixtures with `CONTRACT_UPDATE=1` |
| Graph-building code | A snapshot (`*.snapshot.test.ts`; Rust `graph_snapshots*.rs`, also checked against `node-defs.json`) |
| Code that parses, validates or reads outside data (a file, a model header, a command argument, a request, the engine's reply) | Hostile-input cases (`security.md`) and a property test (proptest `tests/prop_*.rs`, fast-check `*.property.test.ts`); a new file format or reader also gets a case in `tests/fuzz_inputs.rs`, a new command one in `tests/backend_service/api_fuzz.rs`, a new HTTP route one in `backend/crates/novira-server/tests/http_fuzz.rs` |
| A store, queue, session or other state with a lifecycle | A transition table with a test per reachable cell (`/testing`, `state-machines.md`); the queue and stores also the model-based test (`tests/prop_queue.rs`, `prop_db.rs`) |
| A call added or changed in `MockBackend` or the backend | The difference test (`frontend/difftest/`, `node scripts/tools/diff-backends.mjs`) agrees, or the call is left out with the reason |
| A write in several steps (restore, install, move, migrate) | A test that fails one step and checks the data is whole and no leftover remains (`tests/restore_stage_failures.rs` is the shape) |
| A change to what is stored on disk | A copy of the old data folder still opens (`tests/backend_service/old_data.rs`); a new fixture at the release that changes the stored form |
| An action that fires often (per pointer move, key or input event) or a screen switch | A time budget in `e2e/perf-budget.spec.ts` (`/testing`, `systems.md` section 11); a colour picker is `ColorInput` from `@/ui` |
| A new screen or dialog | Add it to the lists of the monkey run (`RUNS` in `e2e/monkey.spec.ts`), the axe check (`TABS` or `SURFACES` in `e2e/a11y.spec.ts`), the keyboard check (`LAYERS` and `TABS` in `e2e/a11yKeyboard.spec.ts`) and the layout scan (`e2e/layout.spec.ts`) |

Where tests go: `*.test.ts(x)` next to the code (vitest); whole-source rules in `frontend/tests/`; flows in `frontend/e2e/*.spec.ts` (Playwright on the mock); `#[cfg(test)]` in each `.rs` (a long file: `mod tests;` with `<name>/tests.rs` beside it); Rust integration in `backend/crates/novira-core/tests/`; `tests/*_live.rs` (`#[ignore]`) touches external services or the real engine and runs only when asked. One responsibility per test file; split a file that would mix areas or pass about 500 lines.

A screen once opened stays mounted, hidden, while another shows (`frontend/src/app/App.tsx`): `page.getByTestId` in `e2e/fixtures.ts` keeps only the visible copy, a CSS locator needs `:visible`, and a component test finds the open screen's copy outside `display: none`.

Delete what lost its meaning: tests of a removed feature or option, tests with no assertion, duplicates, `skip` / `only` / `#[ignore]` without a reason (`*_live.rs` excepted), orphaned snapshots and baselines. Never delete or weaken a test because it fails.

## 2. Run only what the change affects

**Start with `node scripts/tools/affected.mjs`** (repository root): it reads the changed files (`--base main` adds a branch's commits, or give paths), picks the checks and runs them all even when one fails. `--list` only prints the choice; Playwright is only named unless `--e2e`; the ja/en text and manual tests need `--text`. It cannot see an integration test that reaches the module through another module, or a flow that names none of the changed folder's test ids: add those yourself and say so in the report.

Do not widen to every test "just in case". Run everything only for a change with wide effect (shared parts, the contract, build settings, dependencies), after resolving merge conflicts, or when the user asks, and give the reason. Before changing, read the existing tests of the behaviour; for a change made for speed (start-up, a frequent command, IPC), measure before and after with `node scripts/tools/perf.mjs`.

What `affected.mjs` does not decide for you:

| Changed | Also run |
|---|---|
| Any ts / tsx (tests too) | `npx eslint <changed files>` and `npm run typecheck`: CI runs the whole lint and vitest, so passing the related tests is not passing CI (a test helper named `open` trips `novira-security/no-window-open`) |
| The contract (`types.ts`, `client.ts`, `types.rs`) | `npx vitest run src/backend/contract.test.ts src/backend/tauri` and `cargo test -p novira-core --test contract`: both sides, the mock, the Tauri implementation and the callers move together |
| A new `persist` store (a new `novira.*` key) | Name the key in `src/state/liveStores.ts` (`LIVE_STORES`, or `LOCAL_ONLY_KEYS`) and run `src/state/liveStores.test.ts` |
| A graph snapshot that changed on purpose | `npx vitest run -u <file>` (Rust: `UPDATE_SNAPSHOTS=1`) and read the JSON diff |
| A screen flow | The specs of the area (`npx playwright test e2e/<spec> --project=chromium`); a worktree sets its own `E2E_PORT`; a whole project runs under `node scripts/tools/e2e-lock.mjs -- ...`; cases that time out together are rerun with `--workers=2` before they count as failures |
| Look (css, layout, shared components) | `node scripts/tools/layout-scan.mjs` (pre-commit refuses layout source without a pass on exactly what is staged; `--locales all` when the user asks or after translating); `npm run e2e:visual` by hand, and commit updated baselines with the change after looking at them; check by eye with `node scripts/shot.mjs` |
| A Rust file with logic | `cargo fmt --all`, `cargo clippy -p novira-core --tests`; then mutation testing of that file (`/testing`) |
| `api.rs`, `novira-server`, `frontend/src/backend/http/` | `cargo test -p novira-server`, `cargo test -p novira-core --test backend_service api::`, `npx vitest run src/backend/http` |
| `src-tauri` (commands, capability) | `cargo test -p novira` and `npx vitest run src/backend/tauri` |

Finish with `npm run lint` (eslint and stylelint) in `frontend/`. `cargo` missing from PATH: add `%USERPROFILE%\.cargo\bin` (`affected.mjs` and `check.bat` do). While the user's `novira.exe` is open, Rust builds go to `novira-data/work/check-target`.

A change that touches the engine, the queue worker, the GPU, model files or packs is not verified by unit tests: run it on the real engine (`/verify-real-app`; the model sweep for a model change, [models.md](models.md)).

## 3. Report

The tests added, changed or deleted and why (or why none: documents only, look only checked with `shot.mjs`); the commands run and their results; what was not run and why; dark and light looked at for a look change. Keep success, failure and not run apart, and never extend a pass to what you did not run. A failure you call unrelated needs evidence (it fails on a clean `main` too).
