---
description: Keep tests in step with every feature addition, fix or removal in the frontend or backend
paths:
  - "frontend/src/**"
  - "frontend/tests/**"
  - "frontend/e2e/**"
  - "contract/**"
  - "backend/**"
---

# Test maintenance (with every feature addition, fix or removal)

When work changes behavior in `frontend/` or `backend/`, change the tests in the same work (the same commit). How to run tests is in [regression-tests.md](regression-tests.md). How to choose the cases is in the `/testing` skill (partitions, boundaries, branch and condition coverage, property tests, state transitions, decision and pairwise tables).

## 1. What to do for each kind of change

| Change | What to do with tests |
|---|---|
| Adding a feature | Add tests that protect the new behavior. Besides the normal case, at least one failure, empty or boundary case |
| Fixing a bug | Add a test that fails before the fix and passes after (to prevent recurrence) |
| Changing a spec | Rewrite tests that assume the old behavior to the new spec. Do not just mechanically adjust expected values to match the implementation |
| Removing a feature or code | Delete tests that checked only that feature, and fixtures, mocks and helpers that are no longer used |
| Renaming or moving | Move the test files, names and `describe` blocks too (tests sit next to the code) |

## 2. Where tests go and what kinds there are

| Kind | Location | Suited to |
|---|---|---|
| Frontend unit / component | `*.test.ts(x)` next to the target (vitest) | Pure functions, stores (`state/`), component operations, the mock |
| Frontend whole-source checks | `frontend/tests/` | Rules that span the whole source, such as i18n |
| Frontend E2E | `frontend/e2e/*.spec.ts` (Playwright, mock backend) | User operation flows across screens |
| Visual regression | `frontend/e2e/visual.spec.ts` and `e2e/__screenshots__/` | The look of the main screens (dark and light) |
| Graph snapshots | Frontend: `*.snapshot.test.ts` and `__snapshots__/`; backend: `src/comfy/graph_snapshots.rs` and `graph_snapshots_families.rs` (every backend snapshot is also checked against `__snapshots__/node-defs.json` by `node_defs_check`) | The whole prompt JSON sent to ComfyUI |
| Contract | `contract/*.json`, `frontend/src/backend/contract/samples/`, `backend/crates/novira-core/tests/contract/` | Types sent over IPC, and command names and arguments |
| Backend unit | `#[cfg(test)] mod tests` in each `.rs`; in a long file, `mod tests;` with the module in `<name>/tests.rs` beside it (so the file the reader opens first is the code) | Logic, the JSON shape of types |
| Backend integration | `backend/crates/novira-core/tests/` | The whole service, communication with a fake ComfyUI |
| Touching external services or the real engine | `tests/*_live.rs` (`#[ignore]`; `models_live.rs` runs one model without a window) | Run only when asked, or to verify an engine change |

Keep test files to one responsibility each too. If adding tests would mix different areas in one file, or push it well past 500 lines, split it by area (Rust integration tests can become `tests/<name>/main.rs` with submodules, keeping a single binary).

When you add a new screen flow (tab, dialog, generation steps), add one E2E test or extend an existing one. A screen once opened stays mounted, hidden, while another shows (`frontend/src/app/App.tsx`), so the same element can be on the page twice: `page.getByTestId` in `e2e/fixtures.ts` keeps only the visible one, a CSS locator needs `:visible`, and a component test finds the open screen's copy outside `display: none`. When you change the contract (`types.ts`, `types.rs`), align the `contract/samples/` samples and the Rust-side checks, and regenerate the fixtures with `CONTRACT_UPDATE=1` (procedure in [docs/verification.md](../../docs/verification.md)). When you add graph-building code, add a snapshot; when you add a screen, add one shot to `visual.spec.ts`.

## 3. Do not leave tests that have lost their meaning

- Before and after a change, read the tests in the area you touched, and delete or fix any of these you find.
  - Tests that check a feature, branch or option that no longer exists
  - Tests that check nothing (no assertions, or always pass)
  - Duplicates that check the same thing as another test
  - Tests left as `skip`, `only` or `#[ignore]` (except `*_live.rs`) without a reason
  - Snapshots, fixtures and baseline images for removed screens, graphs or types (when you delete the test, delete the matching files too)
- When you delete a test, write in the report what you deleted and why. Do not delete or weaken a test merely because it fails.

## 4. Reporting

Include in the report the tests you added, changed or deleted, and why. If you did not change tests, write the reason (for example: documents only; look only, checked with `shot.mjs`).
