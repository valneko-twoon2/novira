# Tests of whole systems (integration, contract, golden, E2E, visual, a11y, crash, old data, release, speed, audit)

How to add each kind, with the real files. The cases inside a test come from `SKILL.md`; the table of what each kind is and what it does not see is in `docs/verification.md` ("Kinds of tests"). Read the code and its nearest existing test first. Never weaken or delete a test that fails (`.claude/rules/tests.md`). Everything a run writes goes to `logs/` or `novira-data/work/`; no test starts the user's `novira.exe`, and none uses the GPU (GPU work is `/verify-real-app`).

| Kind | Needed when | Status | Section |
|---|---|---|---|
| Integration | a service, store, worker, download or install changes | yes | 1 |
| Contract | a wire type, command or sample changes | yes | 2 |
| Snapshot / golden | a ComfyUI graph builder changes | yes | 3 |
| E2E | a screen flow is added or changed | yes (mock in CI, real app by hand) | 4 |
| Visual regression | a screen's look changes | partly (not in CI) | 5 |
| Cross browser / device | the phone layout or shared CSS changes | yes (no Firefox) | 6 |
| Accessibility | a screen, menu or dialog is added | yes (no contrast, no keyboard order) | 7 |
| Crash-time consistency | a multi-step write on disk is added or changed | partly | 8 |
| Upgrade / old data | stored data (SQLite, settings, files) changes shape | yes (v0.3.0 only) | 9 |
| Release smoke | the build, packaging or start-up changes | yes (tag only) | 10 |
| Performance regression | a start-up, frequent or IPC path changes | partly (manual, no budget) | 11 |
| Dependency / secret audit | a dependency, a key or a licence changes | partly | 12 |

Run state of CI for every kind: `.github/workflows/test.yml` runs on each branch push the static checks, vitest, clippy, `cargo test` (novira-core, novira-server, novira), Playwright `chromium`, `phone` and `webkit`, and `diff-backends`. It does not run visual, layout scan, coverage, mutation, perf, live tests or the real app. `pre-commit` runs none of the tests; it checks line ends, types, languages, and that a layout-scan pass is recorded for what is staged. `release.yml` runs only on a `v*` tag.

## 1. Integration (real SQLite and folders, fake servers)

Needed when code crosses a module boundary: queue to worker to engine, a download to disk, a settings or backup round trip. A unit test with mocks does not count.

Existing: `backend/crates/novira-core/tests/backend_service/` (one binary, `main.rs` lists the modules; `common.rs` has `FakeEngine`, `open`, `request`, `wait_until`, `statuses`, `settings`, `write_lora_and_checkpoint`, `png`); `tests/comfy_fake_server/main.rs` (a fake ComfyUI over HTTP and WebSocket: `serve`, `serve_with`, `job`, `engine`); `tests/fake_site/mod.rs` (a loopback website: `site()`, `Site::put`, `put_json`, `requests`, `Route::bytes/json/status/announcing/with_header`, `client()`); files such as `model_store_fake.rs`, `comfy_install_fake.rs`, `download_resume.rs` (its own server, because `fake_site` does not answer `Range`); server side `backend/crates/novira-server/tests/*.rs`.

Steps to add one:
1. Pick the nearest binary. A queue, worker, gallery, settings, backup or model-store behaviour: a new module in `tests/backend_service/` plus one `mod` line in its `main.rs`. A call to a website: a new `tests/<area>_fake.rs` with `mod fake_site;` (or `#[path = "fake_site/mod.rs"] mod fake_site;` as `backend_service/main.rs` does).
2. Build the world in a `tempfile::tempdir()`: `open(...)` from `common.rs` for a `Backend` on the fake engine, `write_lora_and_checkpoint` for model files. Point a service at the fake site with the matching `NOVIRA_TEST_<SERVICE>_BASE` variable (`src/endpoints.rs`: Civitai, HuggingFace, GitHub, Codeload, GitHubApi, ComfyRegistry, SevenZip, TrustMark). Set it once per process before the first call.
3. Script the failure you care about on the fake (a status code, a cut connection, `Route::announcing(n)` with fewer bytes, a hang, a slow answer) as well as the normal run. Assert the outcome: a status, an event, the files on disk, the rows after a restart (close the `Backend`, open the same folder again).
4. Wait for events or states with `wait_until`, never a fixed sleep. A pause inside a retry is shortened with `NOVIRA_TEST_RETRY_PAUSE_MS` (debug builds only, `src/test_timing.rs`).
5. A fake that must differ from the real service for the test to pass is a finding: say so in the report, and cover the real service with a `*_live.rs` test (`#[ignore]`, run by name with `-- --ignored`).

Prove it can fail: change the production line the test is about (flip the status, skip the write), run the test, see it fail for the reason in its name, restore. For a Rust file with logic use `reference/mutation.md`.

Run: `cargo test -p novira-core --test backend_service <module>`; `cargo test -p novira-core --test <file>`; `cargo test -p novira-server`. CI: the `cargo-test` job. Not seen by these tests: the real engine, IPC, the window (use `/verify-real-app`).

## 2. Contract (frontend and backend agree on the wire)

Needed when `frontend/src/backend/types.ts`, `client.ts`, `backend/crates/novira-core/src/types.rs` or `api.rs` changes, or a command is added.

Existing: `contract/*.json` (one sample per wire type), the TS samples `frontend/src/backend/contract/samples/`, `frontend/src/backend/contract.test.ts`, `frontend/src/backend/tauri/commands.contract.test.ts`, the Rust side `backend/crates/novira-core/tests/contract/` (`both.rs` round trip, `outbound.rs` and `inbound.rs` exhaustive struct literals, `enums.rs` exhaustive `match`; its header says how each kind is checked; `every_fixture_is_checked` fails on a fixture with no check). The ComfyUI node-definition contract is the other half: `comfy::node_defs_check` against `backend/crates/novira-core/src/comfy/__snapshots__/node-defs.json`.

Steps:
1. Change the type on both sides in the same work.
2. Add or edit the sample in `frontend/src/backend/contract/samples/` (a non-integer value for every `f64`: `7.5`, not `7`).
3. Regenerate the JSON: `CONTRACT_UPDATE=1 npx vitest run src/backend/contract.test.ts` in `frontend/`. Read the `git diff contract/`.
4. Add the Rust check for a new fixture in `tests/contract/` (the right file by the kind of type; list it in the table in `main.rs`). A new enum variant fails to compile until listed.
5. Run both sides (below). For a new command also the command-list tests named in `.claude/rules/tests.md` (`cargo test -p novira`, `npx vitest run src/backend/tauri`).
6. A new ComfyUI node in a graph: start a ComfyUI (`--cpu` is enough) and run `node scripts/tools/comfy-node-defs.mjs http://127.0.0.1:<port>`, read the `node-defs.json` diff, run `cargo test -p novira-core --lib comfy::node_defs_check`. Starting ComfyUI needs the user's models folder untouched and no GPU use; ask when unsure.

Prove it can fail: rename one field in `types.rs` only; `cargo test -p novira-core --test contract` must fail (or not compile). Revert.

Run: `npx vitest run src/backend/contract.test.ts src/backend/tauri` and `cargo test -p novira-core --test contract`. CI: `vitest` and `cargo-test` jobs. Differential check of mock against the real server: `node scripts/tools/diff-backends.mjs` (CI job `diff-backends`).

## 3. Snapshot / golden files (ComfyUI graphs)

Needed when graph-building code changes: frontend `frontend/src/state/comfy/`, `frontend/src/features/*`, backend `backend/crates/novira-core/src/comfy/graph.rs`, `video.rs`, `music.rs`.

Existing: frontend `*.snapshot.test.ts` with `toMatchFileSnapshot('./__snapshots__/<builder>/<case>.json')` (example `frontend/src/features/canvas/poseFromImage.snapshot.test.ts`); backend `src/comfy/graph_snapshots.rs` and `graph_snapshots_families.rs`, files in `src/comfy/__snapshots__/graph/<case>.json` (own mechanism: `assert_snapshot`, no `insta`). Orphans: `frontend/tests/test-hygiene.test.ts` fails on a snapshot file no test case writes.

Steps:
1. Add a case that builds the graph for the new input (a literal case name, so the orphan scan can read it; a name built at run time needs its own folder check).
2. Run once without the update flag: a missing file fails. Then write it on purpose: frontend `npx vitest run -u <file>`; backend `UPDATE_SNAPSHOTS=1 cargo test -p novira-core --lib comfy::graph_snapshots` (PowerShell: `$env:UPDATE_SNAPSHOTS=1`; unset it afterwards).
3. Read the whole JSON diff. For each changed node check: a node you meant to add, input links by `[node id, output index]`, the seed and sizes. An update is a statement that the new output is intended; do not copy output you did not read. Unexpected churn (ids renumbered, a key reordered) means the builder changed more than you meant.
4. A removed case: delete its file (the orphan test names it).
5. A backend snapshot is also run against `node-defs.json` (`node_defs_check`); a graph the real ComfyUI would refuse fails there.

Prove it can fail: change a default in the builder; the snapshot test must fail and the diff must show that default. Revert.

Run: `npx vitest run <file>.snapshot.test.ts`; `cargo test -p novira-core --lib comfy::graph_snapshots comfy::node_defs_check`; `npx vitest run tests/test-hygiene.test.ts`. CI: `vitest` and `cargo-test`.

## 4. End-to-end

Needed when a screen flow is added or changed (tab, dialog, generation steps). Two levels:

Existing, mock: `frontend/e2e/*.spec.ts` on the in-memory mock (`frontend/src/backend/mock/`). `e2e/fixtures.ts` exports `test`, `expect`, `openApp(page, query)`, `showTab`, `openCanvas`, `chooseFirstModel`, `msg(key, vars, locale)` (screen text from the catalog; never write the text), and an auto `errors` fixture that fails any spec whose page logged `console.error` or `pageerror`. `page.getByTestId` keeps only the visible copy (opened screens stay mounted).
Existing, real: `scripts/tools/verify-real-app.mjs <test.mjs>` (isolated app over CDP), `models-live.mjs`, `models-sweep.mjs`, `release-smoke.mjs`; procedure in `/verify-real-app` and `docs/verification.md`.

Steps (mock):
1. New spec `frontend/e2e/<feature>.spec.ts` (one area per file). `import { expect, msg, openApp, showTab, test } from './fixtures';`. Locate by role, `getByTestId` or `msg(...)`; a test id that does not exist is caught by `node scripts/tools/ui-refs.mjs`.
2. Cover the normal flow and one failure or empty case. If the mock answers differently from the real backend for this flow, fix the mock (`diff-backends` shows it).
3. No `waitForTimeout`; wait on `expect(locator)`. Do not commit `.only`.
4. Run it: `npx playwright test e2e/<spec> --project=chromium` in `frontend/`. A worktree sets its own `E2E_PORT` (default 5180). A whole project runs under the lock: `node scripts/tools/e2e-lock.mjs -- npx playwright test --project=chromium` (`--status` says who holds it). Workers are capped at 6 by `playwright.config.ts`; never raise it. Cases that time out together: rerun with `--workers=2`.
5. A flow that depends on IPC, the shell, start-up, the engine, or the real queue worker: add a script for `verify-real-app.mjs` (it checks the script's test ids with `ui-refs.mjs` first) and run it only when the GPU is free (`NOVIRA_GPU_LOCK`, `node scripts/tools/gpu-check.mjs`). If you cannot run it, say "not run" and why; do not claim the mock run covers it.

Prove it can fail: break the behaviour in the app (hide the button, return the wrong text) and see the spec fail; Playwright keeps a trace of a failed case in `logs/e2e/`.

CI: `e2e-chromium` (one retry, `forbidOnly`). A retry that passes hides a flaky test: when a case needed its retry, fix it. Real-app runs are never in CI.

## 5. Visual regression

Needed when a main screen's look changes (css, `src/ui/`, `src/app/`, a feature's tsx). A new screen gets a spec in `frontend/e2e/visual/` (`.claude/rules/tests.md`).

Existing: `frontend/e2e/visual/<screen>.spec.ts` (project `visual`; helpers in `visual/shared.ts`: both themes, fixed clock, masks for time text; `maxDiffPixels: 20` in `playwright.config.ts`; the screens that exist only in the desktop app, such as the network item, are opened with `?lan` by `openDesktop`), baselines `frontend/e2e/__screenshots__/visual/<screen>/<dark|light>/<shot>-<platform>.png` (`-win32` from Windows, `-linux` from the cloud container). The look-scan without baselines: `node scripts/tools/layout-scan.mjs` (`e2e/layout.spec.ts`, rules in `e2e/layoutRules.ts`, `e2e/textFit.ts`).

Steps:
1. Add the screen as a spec in `frontend/e2e/visual/` the way its neighbours do (`inEachTheme`, `snap(page, <screen>, theme, <shot>, <part>)`: the whole screen and each part that carries a state of its own; screens hidden in the production build (video, music, voice, comic) are not shot; mask what varies).
2. Look at the change by eye first (`node scripts/shot.mjs` in `frontend/` (`frontend/scripts/shot.mjs`), dark and light). Then `npm run e2e:visual -- --update-snapshots=changed` in `frontend/`. Open every changed PNG. Commit only the baselines of this platform's suffix that you looked at; the other platform's set is refreshed when it runs there.
3. Run `node scripts/tools/layout-scan.mjs` from the repository root (ja and en, dark and light, about two minutes). A fault is fixed, or the place carries `data-truncate-ok`, `data-touch-ok` or `data-layout-ignore` with a reason. Pre-commit refuses layout source without a recorded pass for exactly what is staged (`layout-scan.mjs --check`).
4. A removed screen: delete its baselines.

Prove it can fail: change a colour token or a margin locally; `npm run e2e:visual` must fail and write the diff image to `logs/e2e/`. Revert.

CI: none (baselines are Windows images; `docs/design/01-app/04-release/02-ci.md` says visual and layout scan are added one at a time once they pass on the runner). Adding the visual job to `test.yml` is a CI change: needs user confirmation.

## 6. Cross browser and device

Needed when the phone layout, touch handling or shared CSS changes.

Existing: `frontend/playwright.config.ts` projects `chromium` (desktop flows), `phone` (Pixel 7) and `webkit` (iPhone 14), both on `phone*.spec.ts` (`frontend/e2e/phone.spec.ts`); CI job `e2e-phone`. No Firefox project. The real WebView2 is only the isolated app (section 4).

Steps:
1. A phone-only flow: add to a `frontend/e2e/phone*.spec.ts`. A desktop flow runs in `chromium` only.
2. Run `npx playwright install webkit` once, then `npx playwright test e2e/phone.spec.ts --project=phone --project=webkit`. WebKit is about twice as slow (its timeout is 60 s).
3. Playwright's WebKit is not iOS Safari; say so in the report. A new project (Firefox, a tablet) is a config and CI change: needs user confirmation.

Prove it can fail: force a desktop-only width in the component locally and see the phone spec fail.

## 7. Accessibility

Needed when a tab, menu, dialog or popover is added or its markup changes.

Existing: `frontend/e2e/a11y.spec.ts` (axe-core, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, colour contrast switched off), the list of known failures `frontend/e2e/a11yKnown.ts` (`KNOWN[surface][rule] = max nodes`; only lowered).

Steps:
1. Add the surface to the `SURFACES` table in `a11y.spec.ts` (an opener function that ends with an `expect` that the surface is visible), or the tab to `TABS`.
2. Run `npx playwright test e2e/a11y.spec.ts --project=chromium`. `A11Y_REPORT=1` prints each violation with its first selectors.
3. Fix the markup (name, role, label) rather than adding to `a11yKnown.ts`. Raising an entry is not allowed; a library behaviour that cannot be fixed (the Radix `aria-hidden-focus` entries) is a new entry with a comment saying why.
4. Missing (no test exists): colour contrast, keyboard order and focus traps, reduced motion, zoom. Adding one is a new spec; follow the structure above.

Prove it can fail: remove an `aria-label` from a button of the surface; the scan fails with `button-name`.

CI: runs inside `e2e-chromium`.

## 8. Crash-time consistency (stop after step k, restart, check)

Needed when code changes data on disk in several steps (rename, move, unpack, swap) and a power cut or kill between two steps must leave one whole state after the next start.

Two exhaustive tests already exist, and they define the seam:
- Backup restore: `backend/crates/novira-core/src/backup/restore.rs`. `Applying` is a state machine (`begin` writes the journal `APPLYING`, `step()` does one rename or check and returns `Next::More | Restored | Refused`); the next step is read from the folders, so a cut-off start continues. Test `src/backup/restore/crash_tests.rs`: `cut_off_after(data, k)` runs `begin` and k steps, then `apply_pending` stands for the next start; the loop `for k in 0..` ends when the restore finished, once for a good backup and once for a refused one (rollback). The assertions are `assert_restored` / `assert_kept` (one whole data folder, `leftovers()` empty, the outcome record).
- Data folder move: `src/data_location.rs`, `move_entries(from, to, progress, k)` takes the number of entries to move before stopping; `src/data_location/crash_tests.rs` loops `k` over `0..=FILES.len()`, then `apply_pending(&pointer)`.

Other failure-injection tests (a failure at a stage, not every stage): `tests/restore_rollback.rs`, `restore_stage_failures.rs`, `backup_edges.rs`, `rename_retry_*.rs` (Windows, holds a file open), `download_resume.rs` (a cut connection then Range resume), `settings_save_failures.rs`.

Steps to add one for a new multi-step operation:
1. Split the operation into steps that each do one visible change on disk and decide the next step from the folders, not from memory (as `Applying` does), with a journal written before the first change. A step that cannot be repeated safely is a bug found.
2. Expose one test seam: either a state-machine type with `step()` (preferred, no production parameter), or a `stop_after: usize` argument on the inner function that the public function passes as `usize::MAX`.
3. Write `src/<module>/crash_tests.rs` (`#[cfg(test)] mod crash_tests;`): build the world in a tempdir, loop `k` from 0 until the run finished, stop after k, call the start-up entry point, assert one whole state (old or new, never mixed), no leftover work folders, and that a second start changes nothing. Assert the loop ran more than a minimum number of steps, so a code change that drops steps is noticed.
4. Run it for the success path and for every refusal path (damaged input, rename failure).

Prove it can fail: delete the journal write or reorder two steps; some k must fail. Revert.

Not covered, and needs a seam that does not exist: the ComfyUI install and version switch (`src/comfy/install.rs`: `install_version` renames the package into place around lines 381-395, and `recover_switch`, `restore_previous`, `discard_previous` repair a cut-off switch; the steps are `async` with no stage hook), model and pack installs (`src/models/install.rs` `.part` file plus `.resume` record, `src/packs.rs`), the database file itself (SQLite's own journal). The install steps are not a state machine like `Applying`, and adding a stage hook or a stop_after argument to them changes production code: needs user confirmation first. Unconfirmed: I did not find a versioned schema migration in `src/db.rs` (grep for user_version and `migrate` found none); if one is added, its crash test follows this section.

Run: `cargo test -p novira-core --lib backup::restore::crash_tests data_location::crash_tests`. CI: `cargo-test`.

## 9. Upgrade and old data

Needed when anything stored changes shape: a table or column in `src/db.rs`, `settings.json` fields, the layout of `outputs/`, thumbnails, trash, backups, comic or workflow records.

Existing: `backend/crates/novira-core/tests/fixtures/data-v0.3.0/` (written by that release's own code: `novira.sqlite`, `outputs`, `thumbnails`, `trash`, `models`, `settings.json`), `tests/backend_service/old_data.rs` (copies a fixture to another folder, opens it with `Backend::open_with_engine`, checks every board, picture, file, setting, workflow, comic and job, and that a new job still runs), `examples/make_old_data_fixture.rs`, and `release-smoke.mjs` which opens the same fixture with the built `novira-server.exe`. Only v0.3.0 exists; the app is at 0.4.x / 0.5.0.

Steps:
1. A change of stored data: add a test in `old_data.rs` that opens each fixture and checks the new or changed field has its default or migrated value. Never edit a fixture.
2. A fixture for a release that changed stored data is due at that release: on the release's commit run `cargo run -p novira-core --example make_old_data_fixture` (it refuses a non-empty `novira-data/work/fixture-out/`; remove it first), copy the folder to `tests/fixtures/data-<version>/` without `extra_model_paths.yaml`, add one test line for the version in `old_data.rs`. `release-smoke.mjs` and `fixtureVersions()` pick up the new folder by name. Do this when asked for a release or when the change in step 1 alters stored data and no newer fixture exists; mention it in the report.
3. Also test the other direction when a file may be written by a newer version (unknown fields are kept, not crash): add a case with an extra key in `settings.json`.

Prove it can fail: rename a stored field without a fallback; `old_data` must fail on the fixture.

Run: `cargo test -p novira-core --test backend_service old_data`. CI: `cargo-test`.

## 10. Release smoke

Needed when the build, `scripts/release/package.bat`, `tauri.conf.json`, start-up, or the file set of a release changes.

Existing: `scripts/tools/release-smoke.mjs [--artifacts <folder>]` (default `artifacts\`): checks `novira.exe`, `novira-server.exe`, `dist\index.html`, `server.bat` exist; runs `novira-server.exe` on an empty data folder and on a copy of each old-data fixture and reads `bootstrap`; starts `novira.exe` with no engine (CDP port 9334) and waits for the Generate tab. It uses `novira-data/work/release-smoke/` only and stops only processes it started. It is step "Smoke test what was built" in `.github/workflows/release.yml` (tag `v*` only; the zip is made after it).

Steps:
1. A new thing a release must contain or do: add it to `missingFiles` (a file) or to the numbered checks in the file header (behaviour), with a pure helper exported and tested in `frontend/tests/` (the file already exports `parseArgs`, `missingFiles`, `fixtureVersions`, `checkFixtureBootstrap`).
2. Run locally after `scripts\release\package.bat build`: `node scripts\tools\release-smoke.mjs`. This builds a release and starts a window: ask before running it while the user works; never with the user's `novira.exe` as the target.
3. Not covered: an installer, uninstall and in-place update (the release is a zip), other Windows versions or GPUs.

Prove it can fail: delete one file from a scratch copy of `artifacts` and run with `--artifacts <copy>`.

CI: `release.yml` only. It does not run on branch pushes, so a broken packaging is found at the tag. Adding it to `test.yml` is a CI change: needs user confirmation.

## 11. Performance regression

Needed when start-up, a command the screens call at start or often, IPC, or the size of an answer changes (and for any change made for speed).

Existing: `node scripts/tools/perf.mjs <backend|startup|app|all>` (`--runs 7`, `--save <name>`, `--compare <name>`, `compare <baseline> [<result>]`, `--no-build`, `--data`), `scripts/tools/perf-startup.mjs`, `backend/crates/novira-core/examples/backend_timing.rs`; pure parts tested in `frontend/tests/perf.test.ts`. Baselines `novira-data/work/perf/baselines/<name>.json`, results `logs/perf/`. Judgement (`judge()`): moved when the new median is outside the baseline's lowest-highest and differs by at least 10 % and 2 ms (1 for counts); sizes by more than 1 %. `agent_status` is never flagged. No part starts ComfyUI or the GPU.

Steps:
1. On the code before the change: `node scripts/tools/perf.mjs all --save before` (or one part). Needs `novira-data/work/perf-data` (a copy of real data; if it does not exist, ask the user, do not use `novira-data` itself).
2. After the change: `node scripts/tools/perf.mjs all --compare before`. Read the load line first; repeat a run that flags something while the machine was busy. Compare only on the same machine.
3. Report the metrics that moved with their numbers. The recorder is `frontend/src/backend/perf.ts` (a new call is measured automatically).

Screen budgets exist for the front end (below). For the backend and IPC a failing budget does not exist. To add one: (a) keep a committed budget file (metric name to maximum, for stable metrics such as response sizes in bytes and counts, not milliseconds), (b) a `perf.mjs budget` subcommand that fails when a result exceeds it, with a test in `frontend/tests/perf.test.ts`, (c) a CI step. Time budgets on a shared runner are noisy; start with sizes and counts only. A CI step and a committed budget need user confirmation.

Prove it can fail: add a deliberate 50 ms sleep to a command and see `--compare` flag it.

Screen time budgets: `frontend/e2e/perf-budget.spec.ts` times the frequent actions of the screens on the mock (a text colour dragged fast, Image and Text switching, main screen switching, adding a layer) in the Playwright dev build at a 2x display. `frontend/e2e/perfBudget.ts` holds the helpers: costInPage runs a self-contained action in the page N times and returns, per run, the time its code ran (`blocked`) and the time until the second frame (`painted`); withinBudget fails with the action, the milliseconds and "Look at: <files>". A budget is about three times what was measured, set on the median, so a slow runner does not trip it. Add one for a new action that fires often (per pointer move, per key, per input event) or switches a screen: measure first (print `costs`), set the limit, then prove it fails by undoing the fix. When a budget fails: profile before editing (`page.context().newCDPSession(page)`, `Profiler.start` with a 200 microsecond interval, `Profiler.stop`, sum self time per function), look for work done once per event instead of once per frame, and for a screen rebuilt on a switch. The native colour picker fires an `input` event per pointer move; use `ColorInput` from `@/ui`, not a bare `<input type="color">`.

CI: `e2e-chromium` runs the budget spec with the other specs.

## 12. Dependency and secret audit

Needed when a dependency is added or updated, a key could be written, or a licence matters.

Existing: `.github/workflows/audit.yml` (Mondays 03:17 UTC and on a push changing `backend/Cargo.lock`, `frontend/package-lock.json`, `backend/.cargo/audit.toml` or the workflow): `cargo audit` (cargo-audit 0.22.2, installed with `--locked`, cached by version) and `npm run audit` (`npm audit --omit=dev`). Judged advisories are in `backend/.cargo/audit.toml`, each with a reason and what ends it. Secrets: `backend/src-tauri/tests/security/secrets.rs` (token shapes and key files in the files git would commit; `ALLOWED` stays empty), `backend/crates/novira-core/tests/key_cleanup/`, the stored keys live in `novira-data/secrets/` (DPAPI). Licences: `frontend/scripts/oss-licenses.mjs` (pre-commit).

Steps for a new finding:
1. Update or replace the dependency first. Only if none exists, add the advisory id to `audit.toml` with the reason (what is reached, what ends it) as the other entries have.
2. A new secret shape: add its regex and a positive and a negative case to `secrets.rs`; run `cargo test -p novira --test security`.

Missing, each needs user confirmation (new tool and CI change), shown here so it can be added in one step:
- cargo-deny (licences, banned crates, sources, duplicate versions): add `backend/deny.toml` (`[licenses] allow = [...]`, `[sources] unknown-registry = "deny"`, `[bans]`), then a job in `audit.yml` in the style of the `cargo-audit` job: cache `~/.cargo/bin/cargo-deny` with key `cargo-deny-<version>-${{ runner.os }}`, `cargo install cargo-deny --version <pinned> --locked` when not cached, `working-directory: backend`, `run: cargo deny check`; add `backend/deny.toml` to the workflow's `paths`. Pin an exact version at least two weeks old.
- gitleaks (secrets in the files and history): a job that downloads the pinned release binary of a given version and checksum (only actions of GitHub's own, `actions/*`, are allowed by `docs/design/01-app/04-release/02-ci.md`, so no third-party action), runs `gitleaks detect --source . --redact`, with an allowlist file `.gitleaks.toml` for fixtures. Full history needs `fetch-depth: 0` on checkout.
- Update `docs/design/01-app/04-release/02-ci.md` (its `covers` list names `audit.yml` and `audit.toml`) in the same commit.

Prove it can fail: run the tool locally against a deliberately bad input in a scratch folder under `novira-data/work/` (a licence not on the list, a fake token), not in the repository.

CI: `audit.yml` (weekly and on lock changes); not part of `test.yml`, so a new advisory does not fail every push. No notice goes out when it fails.
