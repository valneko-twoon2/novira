---
description: Regression checks and test runs after reading or changing the backend or frontend source
paths:
  - "frontend/src/**"
  - "frontend/tests/**"
  - "frontend/e2e/**"
  - "contract/**"
  - "backend/**"
---

# Regression checks and running tests

Follow this when reading or changing the source of `frontend/` or `backend/`. For detailed procedures see [docs/verification.md](../../docs/verification.md); for the completion checklist see section 4 of [AGENTS.md](../../AGENTS.md).

## 1. Before changing

- Look for existing tests of the behavior you will change (`*.test.ts(x)` and `__snapshots__/` in the same folder, `frontend/e2e/`, `contract/`, `backend/crates/novira-core/tests/`, `#[cfg(test)]` inside each `.rs`). If there are any, read them first and understand what they protect.
- For a change made for speed, or one that may cost it (start-up, a command the screens call often, IPC), measure before and after with `node tools/perf.mjs` ([docs/verification.md](../../docs/verification.md), "Measuring speed").

## 2. After changing, run only the affected tests (do not widen to everything)

**Start with the tool:** `node tools/affected.mjs` (repository root) reads the changed files (working tree against HEAD; `--base main` adds a branch's commits; or give paths), chooses the checks by the tables below and runs them, each even when an earlier one failed. Frontend tests come from the import graph (`vitest related`), so a test that imports a changed file is never left out; files tests read at run time (catalogs, the manual, contract fixtures, records, the map) are mapped by path. Rust: the library tests and the integration tests that name the changed module. `--list` prints the choice without running it; Playwright is only named unless `--e2e` is given. Playwright specs are named for a feature folder by their file name and by the test ids of the folder they use. What it cannot see (an integration test that reaches the module through another module, a screen flow that names none of the changed folder's test ids) is still yours to add from the tables; write in the report what you added and why.

**[Mandatory]** Choose from the changed code and its callers, dependencies and shared parts, and do not run tests unrelated to what you changed. Do not widen to every test, every E2E test or the visual regression "just in case". Run everything only for a change with wide effect (shared parts, the contract, build settings, dependencies), when the user asks, or as the final check right after resolving merge conflicts, and write the reason in the report.

### Frontend (run in `frontend/`)

| What changed | What to run |
|---|---|
| ts / tsx in general, tests included | `npm run typecheck` (`tools/typecheck.mjs`, incremental; the pre-commit hook runs it too, so run it before committing a test file, not only vitest) |
| Text, i18n, a new area | `affected.mjs` leaves out the tests of the ja/en screen text and the manual (`tests/i18n.test.ts`, `tests/i18n-glossary.test.ts`, `tests/manual.test.ts`) unless given `--text`; the pre-commit sync checks and `npm run check` still run them. Run them (`--text`) when the user asks, when a piece of work ends, or before a release |
| `src/state/` | The store's `*.test.ts` and the tests of the features that use it |
| `src/features/<feature>/` | That feature's `*.test.ts(x)` |
| `src/backend/` (boundary, mock) | `typecheck` for type changes, plus the callers' tests. For the mock, `src/backend/mock/MockBackend.test.ts` |
| The contract (`types.ts`, `client.ts`, `TauriBackend.ts`) | `npx vitest run src/backend/contract.test.ts src/backend/tauri`, and the backend's `cargo test -p novira-core --test contract` |
| Code that builds the graph sent to ComfyUI | That feature's `*.snapshot.test.ts`. If the diff is as intended, update with `npx vitest run -u <file>` and read the JSON diff |
| Screen flow (tabs, dialogs, generation steps), startup, the mock | `npx playwright test --project=chromium` (E2E). Name the specs of the area instead of running all; give a worktree its own `E2E_PORT`. Run a whole project under the e2e lock (`node tools/e2e-lock.mjs -- npx playwright test ...`, repository root) so two heavy runs never share the machine; cases that still time out together are rerun with `--workers=2` before they count as failures |
| Look (css, layout, shared components) | `npm run e2e:visual`. If the change is intended, update the baselines with `-- --update-snapshots` and **include them in the same commit** (pre-commit does not run it: it is heavy, so run it by hand when needed). Check the images |
| css | `npm run lint` (stylelint: colours, corner radii and z-index layers only from `theme/tokens.css`). Check the look by eye with `node scripts/shot.mjs` |
| Layout source: css, `src/ui/`, `src/app/`, feature tsx | `node tools/layout-scan.mjs` from the repository root (`affected.mjs` runs it; it also checks the text fit with tooltips and menus, takes the e2e lock and serves the cached harness build: minified, every screen in). The pre-commit hook refuses the commit without a recorded pass on exactly what is staged, so run it after the last edit and before staging other layout changes. Fix a fault where it comes from (tokens, `ui/`); mark a place designed to shorten with `data-truncate-ok` only with a reason. `--locales all` only when the user asks |
| Finishing | `npm run lint` |

### Backend (run in `backend/`; if `cargo` is missing, add `%USERPROFILE%\.cargo\bin` to PATH; `affected.mjs` and `check.bat` add it, and build into `novira-data/work/check-target` while the user's `novira.exe` is open)

| What changed | What to run |
|---|---|
| `novira-core` logic | `cargo test -p novira-core --lib` (to narrow, `-- <test name>`) |
| Backend integration (queue, gallery, import, etc.) | `cargo test -p novira-core --test <name>` (`backend_service`, `comfy_fake_server`, etc.) |
| `types.rs`, types sent over IPC | `cargo test -p novira-core --test contract`, and the frontend's `npx vitest run src/backend/contract.test.ts src/backend/tauri` |
| Graph building in `comfy/` | `cargo test -p novira-core --lib comfy::` (it includes `node_defs_check`, which tests every snapshot prompt against the node definitions of a real ComfyUI). If the diff is as intended, update with `UPDATE_SNAPSHOTS=1` and read the JSON diff. A graph that uses a new node: save the definitions again (`node tools/comfy-node-defs.mjs <URL>`) |
| `api.rs`, `novira-server`, `frontend/src/backend/http/` | `cargo test -p novira-server` (the server in process: token, host and origin checks, picture and file names) and `cargo test -p novira-core --test backend_service api::`; the HTTP client: `npx vitest run src/backend/http` (names and arguments match `api.rs`) |
| `src-tauri` (commands, capability) | `cargo test -p novira` (it also checks that the command list matches the capability) and `npx vitest run src/backend/tauri` (argument names match) |
| Finishing | `cargo fmt --all`, `cargo clippy -p novira-core --tests` |

After changing a Rust file with logic, run `/test-mutation` on it (one file at a time through `scripts\mutation.bat`) to see whether the tests notice a real change. For choosing the cases, see the `/testing` skill.

`*_live.rs` touches external services or the real engine, so run it only when asked.

## 3. Where to suspect a regression

- If you changed the contract (`types.ts` and `types.rs`), check that both sides, the mock, the Tauri implementation and the callers are in step. Tests on both sides check the fixtures in `contract/`.
- If you changed a shared part (`ui/`, `state/`), check that the screens of other features that use it are not broken.
- A change that touches the engine, the queue worker, the GPU, model files or extension packs is not verified even if unit tests pass. Confirm it on the real engine without a window (`models_live`, docs/verification.md). The desktop app is the user's check; run it in isolation yourself only for a change to IPC, the shell, the WebView set-up or start-up, and run the model sweep for a model change ([models.md](models.md)).

## 4. Reporting

- Write the commands run and their results, why you chose those targets, and what you did not run and why.
- A change to the look is viewed in both dark and light (`node scripts/shot.mjs` or the `npm run e2e:visual` images); say "not checked" for what you could not see.
- Distinguish success, failure and not run. Do not say "no problem" about a range you did not look at.
- Investigate and fix failing tests. Do not weaken tests to make them pass. Do not update snapshots, fixtures or baseline images without reading the diff. If you claim an existing failure is unrelated to this change, show the evidence.
