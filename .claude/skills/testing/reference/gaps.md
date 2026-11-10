# Test kinds novira does not have yet

One recipe per missing kind, so an agent can add it without asking what exists. Each section: why it fits, status, prerequisites, whether the user must say yes first, steps, the oracle, how to prove it can fail, and its place in `scripts/tools/affected.mjs`, CI and pre-commit. Paths were opened on 2026-11-07; "unconfirmed" marks what was not.

Rules for all of them (`.claude/rules/tests.md`, `security.md`, `AGENTS.md`):

- A new dependency, a new tool, a CI change, or rewriting production code to add a seam always needs the user's yes first. Ask with the name, the version, what it costs (build time, size, licence) and what it replaces. Tests only, in a new test file, need no yes.
- Work in a worktree (`node scripts/tools/worktree.mjs add <name>`). Scratch output goes to `novira-data/work/`, reports to `logs/`. Never touch the user's running `novira.exe` or the GPU (take `NOVIRA_GPU_LOCK` for any real-engine run).
- Prove every new check can fail: break the code on purpose, see it fail, revert. Write that in the report.
- A new check enters CI only after it has passed on the runner (`docs/design/01-app/04-release/02-ci.md`, "add one at a time"). Change `docs/design/01-app/04-release/02-ci.md` (its `covers` list too) in the same commit as a workflow.

| Technique | Priority | Effort | Needs user OK | Section |
|---|---|---|---|---|
| Race exploration, repeat runs | 1 | low | the script exists (`scripts/tools/repeat-test.mjs`); a nightly CI run needs a yes | 1a |
| Race exploration, shuttle/loom | 1 | high | yes (dependency, code seam) | 1b |
| Fault injection (files, disk, network) | 2 | medium | yes for failpoints/seams, no for new tests on existing seams | 2 |
| Crash-point exhaustive test for installs (restore and data move have it) | 2 | medium | yes (a step limit or count seam) | 2 |
| CodeQL / semgrep (cargo-deny and gitleaks exist: `supply-chain.yml`, manual and weekly) | 3 | low to medium | yes (tool, CI) | 3 |
| Flaky-test handling | 4 | low | yes (CI) | 4 |
| Pseudo-localisation, long-text stress | 5 | medium | yes (build config) | 5 |
| Existing manual checks into CI | 6 | low each | yes (CI) | 6 |
| Accessibility beyond axe (keyboard, motion, zoom, contrast exist: `e2e/a11y*.spec.ts`) | 7 | done | - | 7 |
| Soak and leak with the fake engine | 8 | medium | script: ask | 8 |
| Miri, sanitizers | 10 | low value | yes | 9 |
| Installer, in-place update | 11 | low value | no for tests | 10 |
| Load of `novira-server` | 12 | low to medium | no | 11 |
| Real-engine output regression, GPU matrix | 13 | medium | no (manual, GPU lock) | 12 |
| Doc tests, secret-leak check, budgets, canary | 14 | low each | canary: yes (CI) | 13 |
| Formal methods (TLA+ for the queue is in; Kani and the pairing spec are left) | 9 | medium | Kani: yes (WSL, tools) | 14 |

## 1a. Race exploration, cheap version: repeat runs

Why: the queue, worker, cancel and install code run on threads and tokio tasks, and `prop_queue.rs` keeps the worker paused, so start/finish/fail/cancel-running orders are never explored (`reference/state-machines.md`, rule 7).

Status: absent. Race-prone files: `backend/crates/novira-core/tests/model_install_locked.rs` (a held file, threads), `rename_retry_exhausted.rs` (its header records a timeout on a busy machine), `gpu_lock_owner_states.rs`, `download_resume.rs`, the `tests/backend_service/queue.rs` and `worker` tests. Code under test: `src/service/queue.rs`, `worker.rs`, `model_store.rs`, `node_pack_store.rs`, `pack_store.rs` (32 `Mutex`/atomic/`Notify` uses in `service/mod.rs`), `src/gpu_lock.rs`.

Prerequisites: none. cargo-nextest would give `--retries` and per-test timing, but it is a new tool: do not use it unless the user agrees.

Steps:
1. Build once: `cargo test -p novira-core --test backend_service --no-run` (from `backend/`).
2. Run a bounded loop in PowerShell, one thread setting per pass, stopping at the first failure and keeping the output:
   `1..40 | % { cargo test -p novira-core --test backend_service queue -- --test-threads=$t 2>&1 | Out-File -Append logs/races/queue-$t.log; if ($LASTEXITCODE) { break } }` for `$t` in 1, 4, 16. Cargo does nothing when current, so a pass costs the test time only.
3. Add load: start `node -e "for(;;);"` x (cores/2) in the background (and kill them in `finally`), then repeat step 2. A race that needs a slow thread shows only here.
4. For a `#[tokio::test]` also vary the runtime: `#[tokio::test(flavor = "multi_thread", worker_threads = 1)]` against `= 8` in a temporary copy, not in the committed test.
5. If it fails once in N, that is the finding: copy the log line and the pass number into the report, then write a deterministic test of the order you suspect (a pause through `NOVIRA_TEST_*_MS` of `src/test_timing.rs` is allowed; see `security.md`).

Oracle: zero failures in 40 passes at every setting. Record N and settings in the report (a pass in 40 is not a proof).

Prove it can fail: in a scratch worktree remove the lock in the code under test (or add `std::thread::sleep(1ms)` between check and use in `cancel_queue_item`) and see the loop catch it within N; if not, N or the load is too low.

Place: manual, not `affected.mjs`. A weekly CI run belongs to the nightly workflow of section 4. A wrapper `scripts/tools/repeat-test.mjs` (command, N, thread list, stop at first failure) is a new script: ask.

## 1b. Race exploration with shuttle or loom

Why: they try thread orders on purpose and replay a failing one from a seed.

Is it feasible? Honest answer: not as the code is. `backend/crates/novira-core/src/sync.rs` is only two extension traits (`lock_safe`, `read_safe`, `write_safe`) on `std::sync::Mutex` and `RwLock`; it is not a facade that could be switched to shuttle's types. The service layer uses `tokio::sync` (`Notify`, `Semaphore`, `broadcast`, `watch`), atomics and `tokio::spawn` (`service/mod.rs`, `worker.rs`), and neither shuttle nor loom can drive tokio tasks or `tokio::sync`. The SQLite connection is in a mutex too. So the real worker cannot run under them.

What can work: a small pure core. Steps (all need the user's yes: dev-dependency `shuttle` or `loom`, a `cfg`, and moving logic):
1. Ask: "May I add shuttle 0.8 (MIT) as a dev-dependency of novira-core and extract the queue's choose-next/cancel/finish decisions into a struct QueueCore guarded by one mutex, so the order of start, finish, fail and cancel can be explored?" Check the current shuttle version on crates.io; pin it with `=`.
2. In `src/lib.rs` add a module sync_facade (name unconfirmed): `#[cfg(not(shuttle))] pub use std::sync::{Arc, Mutex, atomic}; #[cfg(shuttle)] pub use shuttle::sync::{Arc, Mutex, atomic};` and use it in QueueCore only. Add `[lints.rust] unexpected_cfgs = { level = "warn", check-cfg = ['cfg(shuttle)'] }` to the crate's `Cargo.toml`.
3. Test file `tests/shuttle_queue.rs` with `#![cfg(shuttle)]`: `shuttle::check_random(|| { ... }, 5000)` with 3 threads: enqueue, worker step, cancel. Run with `$env:RUSTFLAGS='--cfg shuttle'; cargo test -p novira-core --test shuttle_queue --target-dir ../novira-data/work/shuttle-target` (a separate target dir, or the cfg rebuilds everything).
4. Oracle (from `reference/state-machines.md`): at most one item in progress; cancelled never becomes failed; a terminal state never moves; no pending item lost.
5. Prove it fails: let cancel read the status outside the lock; shuttle should print a schedule. `shuttle::replay` with that schedule makes a regression test.

Recommend: do 1a first. Do 1b only if 1a finds a race, or if the user wants the queue's decisions isolated anyway. loom is slower (exhaustive) and fits `gpu_lock.rs` less than shuttle; the GPU lock uses files and the Windows API, which neither models.

Place: a separate CI step with `RUSTFLAGS`; not in `affected.mjs` (it does not know the cfg).

## 2. Fault injection at file, disk and network layers

Why: backups, restore, model installs and downloads write in several steps (`tests/restore_stage_failures.rs`, `rename_retry_*.rs`, `download_resume.rs`); only some stages are failed on purpose.

Status: engine and site faults exist (fake ComfyUI in `tests/comfy_fake_server/`, `tests/fake_site/`, `comfy_client_failures.rs`, `comfy_client_hung.rs`, `*_download_errors.rs`). File-level faults are made with a real held file: `model_install_locked.rs` opens a file with `OpenOptionsExt::share_mode` to force a sharing violation, which is a hand-made Windows seam that needs no production change. No disk-full, short write, partial read or network cut mid-stream.

Seams in the repo today (`security.md`, "Debug-only test seams"): `NOVIRA_TEST_<WHAT>_MS` (time) and `NOVIRA_TEST_<SERVICE>_BASE` (loopback URL), read under `cfg(debug_assertions)` in `src/test_timing.rs` and `src/endpoints.rs`. They carry a time or a loopback address only.

Recipes, cheapest first:
1. New tests on existing seams, no yes needed. Network: the fake site closes the socket after k bytes, sends a wrong `Content-Length`, stalls after the headers, answers 200 to a `Range` request (add the behaviour to `tests/fake_site/`); assert the install ends as `error`, the part file is kept or removed as `download_resume.rs` says, and the target is untouched. Files: hold the target or its folder open with `share_mode(0)`; make the target a directory; use a read-only attribute; use a path just over 260 characters.
2. Disk full without admin rights: not possible portably. A VHD via `diskpart` needs admin; do not. Use a size-limited writer instead (3).
3. Hand-made seam (needs a yes): in the function that writes, take `impl Write` (or a small trait `Sink`) and test with a writer that fails on the k-th call with `ErrorKind::StorageFull`. Ask: "May I change `<function>` to take its writer as a parameter so a full disk can be tested?" Pure refactor; run the file's mutation test afterwards.
4. Failpoints (the `fail` crate, `fail_point!("name")` behind a `failpoints` feature): needs a yes for the dependency and because `security.md` allows a debug-only seam to carry only a time or a count. A named failpoint decides behaviour, so the user must widen that rule first. Prefer the count seam below. Do not add `FAILPOINTS`-style environment variables to release builds.

Crash-point exhaustive test ("stop after step k, restart, check"). Two exist already, in process, with the step boundary in the production code: the backup restore (`Applying::step()` in `backend/crates/novira-core/src/backup/restore.rs`, looped over k by `backup/restore/crash_tests.rs`) and the data-folder move (`move_entries(..., limit)` in `data_location.rs`, looped by `data_location/crash_tests.rs`). Copy their shape first; the gap is the multi-step writes without a step boundary: the ComfyUI install and version switch (`comfy/install.rs`: `install_version`, `recover_switch`; async, no hook) and model and pack installs (`.part` and `.resume`, `service/model_store.rs`).
1. Preferred (needs a yes, it changes production code): give the operation a step limit like `move_entries`, a plain argument, then write `<module>/crash_tests.rs` that loops k = 0..MAX_STEPS, drops all in-memory state, runs the recovery that start-up runs, and checks: the data is one whole version (old or new, by the rule), nothing is lost, no leftover, the result is reported, and a second run finishes.
2. If a limit argument does not fit (async, several modules): `NOVIRA_TEST_CRASH_AT_STEP=<k>` (a count, so it fits `security.md`), read under `cfg(debug_assertions)` next to `test_timing.rs`, with a one-line crash_point() between the steps; it calls `std::process::abort()` when its counter equals k. The test binary re-runs itself as a child for k = 1..K (K printed by a first run), waits for the abort, then opens the same data folder with `Backend::open` and checks as in 1. Test file of its own (the variable is process-wide), slow, run by hand on changes to those modules.
3. Prove it fails: move one stop point after a rename that has no rollback; the test must name the step k.

Place: new tests join `affected.mjs` by module name (`restore`, `download`); the child-process test is slow, so mark it by its file name and run it on `backups.rs`, `model_store.rs` changes by hand.

## 3. External static analysis and supply chain

Why: ESLint security rules and `source_scan` are string scans (limits listed in `security.md`, section 3); a data-flow scanner and a licence/source gate add what they cannot see. `audit.yml` already covers advisories.

Status: cargo-deny and gitleaks exist (`.github/workflows/supply-chain.yml`, `backend/deny.toml`, `.gitleaks.toml`; manual and weekly, not on push until seen to pass on the runner). Absent: CodeQL, semgrep. Own scans: `backend/src-tauri/tests/security/secrets.rs` (known shapes, no history).

Choice and conditions (put these to the user):
- CodeQL: supports JavaScript/TypeScript and, newer, Rust (check the current support and whether the repository's plan allows it: unconfirmed whether the repository is public). It needs `github/codeql-action`, which is not `actions/*`; `docs/design/01-app/04-release/02-ci.md` (Boundaries) allows only `actions/*`, so this widens that rule: ask. Results show in the Security tab and a push is not blocked.
- semgrep: `pip install semgrep==<pinned>` in the workflow, rules in a committed `.semgrep/` folder (no registry download, no account). Strong on TypeScript, weak on Rust. No third-party action.
- gitleaks: download the pinned release binary and check its SHA-256 in the script (no third-party action); `gitleaks git` needs `fetch-depth: 0`.
- cargo-deny: same install pattern as `audit.yml` (`cargo install cargo-deny --version <pinned> --locked`, cached).

Steps for cargo-deny (the one with most value):
1. Local first: `cargo deny --manifest-path backend/Cargo.toml list` prints the licences of the whole lockfile. The linked Windows crates carry (from `frontend/src/features/settings/ossLicenses.json`, `backend` key, 531 entries): MIT, Apache-2.0, Unicode-3.0, BSD-3-Clause, BSD-2-Clause, ISC, Zlib, MPL-2.0 (5), Unlicense, CC0-1.0, 0BSD, BSL-1.0, MIT-0. `cargo deny` reads the whole `Cargo.lock` for the target set, so extra licences may appear; judge each one.
2. Create `backend/deny.toml` (sketch; check the schema of the pinned version):
   ```toml
   [graph]
   targets = [{ triple = "x86_64-pc-windows-msvc" }]
   [licenses]
   allow = ["MIT", "Apache-2.0", "Unicode-3.0", "BSD-3-Clause", "BSD-2-Clause", "ISC", "Zlib", "MPL-2.0", "Unlicense", "CC0-1.0", "0BSD", "BSL-1.0", "MIT-0"]
   [bans]
   multiple-versions = "warn"
   wildcards = "deny"
   [sources]
   unknown-registry = "deny"
   unknown-git = "deny"
   allow-registry = ["https://github.com/rust-lang/crates.io-index"]
   ```
   Run only `cargo deny check bans licenses sources`: advisories stay with `cargo audit` and `backend/.cargo/audit.toml`, so the judged list has one home. A licence outside the list is a decision for the user (GPL and the like are not allowed in the app); write each exception with its reason in the file.
3. Workflow: a new `.github/workflows/supply-chain.yml` beside `audit.yml`, same header, `permissions: contents: read`, triggers `schedule` (Monday, another minute than audit) and `push` with `paths: backend/Cargo.lock, backend/Cargo.toml, backend/**/Cargo.toml, backend/deny.toml, .github/workflows/supply-chain.yml`. A normal push does not run it, so it cannot fail every push. Run it green locally and on one branch push before telling the user it is done.
4. gitleaks the same way, with a baseline: `gitleaks git --report-path logs/gitleaks.json` locally, judge each finding, then commit `.gitleaksbaseline` (or an allowlist with reasons) so only new leaks fail.

Oracle: a licence outside the list, a git dependency, a wildcard version, a planted `sk-ant-...` string fail the run. Prove it: add a throwaway dependency with a GPL licence, or a fake token in a scratch commit on a scratch branch.

Place: not `affected.mjs` (a dependency change already runs the whole side). Pre-commit: no (slow, network). Update `docs/design/01-app/04-release/02-ci.md` (Audit section and `covers`) and `docs/architecture/03-tooling.md` if a script is added.

## 4. Flaky-test handling

Why: Playwright has `retries: 1` in CI (`frontend/playwright.config.ts`), which hides flakiness; `scripts/tools/ci-summary.mjs` already counts a `flaky` status per project and spec but nothing acts on it.

Status: partial (counting only). Rust has no repeat at all.

Steps:
1. Read the number first: the job summaries of recent `test` runs show `flaky` columns. If all are 0, the nightly run below is the only new work.
2. A nightly workflow `.github/workflows/nightly.yml` (ask; `schedule`, workflow_dispatch, Windows runner like `e2e-chromium`): `npx playwright test --project=chromium --repeat-each=5 --retries=0 --reporter=list,json` in `frontend/`, then `node scripts/tools/ci-summary.mjs playwright`. A test that fails some of the 5 is flaky; one that fails all 5 is broken. Upload the report as an artifact for 7 days. Cheap vitest version: `npx vitest run --sequence.shuffle --sequence.seed=<n>` finds order dependence (run locally, three seeds).
3. Rust: the loop of 1a on the integration tests, weekly, Windows runner, at most 20 passes.
4. Quarantine with a reason, never silently: `test.fixme(true, 'flaky: <cause>, found <date>, owner <who>')` in Playwright (visible as skipped in the summary), `#[ignore = "flaky: <cause>, found <date>"]` is not allowed by `frontend/tests/test-hygiene.test.ts` outside `*_live.rs`, so for Rust fix the test instead or ask the user to extend the hygiene rule. Add a hygiene case that every `test.fixme` text starts with `flaky:` and holds a date, and fails when the date is older than 30 days: the quarantine is a loan.
5. Fix the cause (a wait for an event, not a sleep: `reference/state-machines.md`, rule 7). A raised timeout is not a fix.

Oracle: the nightly list is empty. Prove it: add `if (Math.random() < 0.5) throw new Error('x')` to one scratch spec and see the nightly run name it.

Place: CI only. `affected.mjs` unchanged.

## 5. Pseudo-localisation and long-text stress

Why: text that does not fit is the most common layout fault, and a hard-coded string that skipped `t()` is invisible in ja/en.

Status: absent. Already there: `layout-scan.mjs --locales all` scans the real languages (German, Russian and Portuguese are 30 to 50 percent longer than English) and the glossary and key checks (`.claude/rules/i18n.md`). Try that first on a change: `node scripts/tools/layout-scan.mjs --locales all` (only when asked, or after translating).

Can a pseudo locale be added without the user-facing language list? Not as a `Locale`. `LOCALES` in `frontend/src/i18n/catalog.ts` is the language list and the type; the settings pane (`features/settings/settingsPanes.tsx`), `Record<Locale, ...>` types, `tests/i18n.test.ts` (key sets per folder) and `tests/manual.test.ts` (a manual folder per language) all follow it. A folder `locales/qps/` would fail them. So pseudo text must be made outside the language list:

Recipe (needs a yes: build configuration of the harness build):
1. `frontend/e2e/pseudo.ts`: `pseudo(text)`: keep `{name}` placeholders and `{{` `}}` untouched (`src/i18n/render.ts` defines them), map letters to accented ones, pad by about 40 percent with `~`, wrap in `[` `]`. A property test (fast-check) checks placeholders survive and length grows.
2. App side: in `frontend/scripts/e2e-server.mjs` (the harness build; `frontend/playwright.config.ts` `serverMode()`), when `LAYOUT_PSEUDO=1`, add a Vite plugin whose `transform` hook runs `pseudo` over `src/i18n/locales/en/*.json`. The production build and the dev server stay as they are. Which hook fits the build there is unconfirmed: open the file first.
3. Spec side: `msg()` in `frontend/e2e/fixtures.ts` reads the catalogs from disk and `layout.spec.ts` finds controls by `msg(key)`. Apply the same `pseudo` in `loadCatalog` when `LAYOUT_PSEUDO=1`, or every click by name fails.
4. Run: `$env:LAYOUT_PSEUDO='1'; $env:LAYOUT_LOCALES='en'; node scripts/tools/layout-scan.mjs` (check that `layout-scan.mjs` passes env through: unconfirmed). It must not record a pass in `novira-data/work/layout-scan/passes.json`, because that pass would stand for the real text: make the record skip when LAYOUT_PSEUDO is set.
5. Oracle: two kinds of finding. (a) The scan's own faults (`overflow`, `clipped`, `truncated`, `touching`): at 40 percent they are expected in places designed to shorten (`data-truncate-ok`); judge each; fix real ones. (b) A visible string with no `[` `]` is hard-coded: collect `innerText` lines of each step and list the ones outside brackets (ignore model names and numbers).
6. Prove it: put a literal English word in a `tsx` button in a scratch worktree; (b) must list it.

Place: manual, like `--locales all`. Not in pre-commit. Later a CI step after section 6 puts the layout scan there.

## 6. Existing manual checks into CI, one at a time

Why: `docs/design/01-app/04-release/02-ci.md` says what is "next in line" and why each waits. Each step below is one commit: first run it on the runner by workflow_dispatch or a branch push, read it, only then make it a standing job.

Order and precondition:
1. Layout scan (ja, en). Precondition: no baselines, so it only needs the browser and the harness build. Command: `node scripts/tools/layout-scan.mjs` on `windows-latest` under the e2e lock; two minutes with 6 workers, the runner has 4 cores, so cap workers (`--workers 2`; the config caps at 6). It records passes in `novira-data/work/`, which does not matter on CI. Unconfirmed: whether the script runs without the local build cache; try it.
2. Visual regression (`npm run e2e:visual`). Precondition: committed baselines are `-win32` images from the developer's machine (`frontend/e2e/__screenshots__`); the runner's fonts and anti-aliasing may differ (`maxDiffPixels: 20` in `playwright.config.ts`). First run: see how many screens differ. If many, do not loosen the tolerance: either keep the check local, or create baselines from the runner in a separate artifact and ask the user which side owns them.
3. Frontend coverage floors: `npx vitest run --coverage` (floors in `frontend/vitest.config.ts`); adds minutes to the `vitest` job, so add it as its own job. Precondition: it passes locally. Rust coverage (`scripts/checks/coverage.bat`): unconfirmed what tool it uses; read it before planning a CI job.
4. Scheduled mutation: weekly, never on push. `cargo mutants` supports `--shard k/n`; a matrix of 8 shards, each under the 6-hour job limit, report as artifact (`mutants.out/missed.txt`). Pin the version used in `reference/mutation.md` (27.1.0). Start with `--in-diff` on a pull request branch against `main` for changed files only. Precondition: one full run by hand to know the time (about 40 seconds per mutant, `reference/mutation.md`); tell the user the estimate. Do not make it block anything.

Oracle: the job is green on the runner twice in a row. Prove it: break a rule on a scratch branch and see the job go red.

Place: `.github/workflows/test.yml` for 1 to 3 (update the header comment and `docs/design/01-app/04-release/02-ci.md`, "Not implemented"); a workflow of its own for 4.

## 7. Accessibility beyond axe

Why: `e2e/a11y.spec.ts` runs axe 4.14.0 (WCAG A/AA) with `color-contrast` excluded and a ratchet in `e2e/a11yKnown.ts` (lower an entry, never raise it). axe cannot judge keyboard order, motion or zoom.

Status: contrast, traversal, reduced motion, zoom absent. No new dependency for any of them.

Recipes (new specs in `frontend/e2e/`, chromium project, mock backend; use the fixtures and `page.getByTestId` as the neighbouring specs do):
1. Contrast: in `a11y.spec.ts` run axe with only `color-contrast` for each surface, in dark and light (`colorScheme` emulation; the app switches with `data-theme`). Put the counts per surface in a second map next to `KNOWN` (same ratchet). Expect many at first: the palette is in `frontend/src/theme/tokens.css`, the only place to fix colour. Oracle: counts do not rise. Prove: set a token to a low-contrast colour.
2. Keyboard traversal and focus order: per screen press `Tab` up to 200 times, record `{role, name, rect}` of `document.activeElement` each time. Oracle: (a) it returns to the start (no trap, except an open dialog, which must hold focus inside and return it to the opener on `Escape`); (b) every visible, enabled control that axe or `querySelectorAll` finds is visited, minus a documented list; (c) the focused element has a visible indicator (outline or box-shadow differs from unfocused); (d) the order follows the visual order within a row (left to right, top to bottom, tolerance). `frontend/src/ui/` shared controls are the likely culprits. Prove: add `tabIndex={-1}` to one button.
3. Reduced motion: `page.emulateMedia({ reducedMotion: 'reduce' })`, open each screen, wait, then `page.evaluate(() => document.getAnimations().filter(a => a.effect?.getTiming().iterations === Infinity).length)`; allow a named list (progress spinner). Also assert no `transition-duration` above 0.01s on listed elements when the CSS uses `@media (prefers-reduced-motion)`. Prove: add an infinite animation in a scratch CSS.
4. Zoom: `uiZoom` (0.5 to 2, `frontend/src/state/settings.ts`) is applied only by the desktop shell (`backend.setUiZoom`, `app/UiZoom.tsx` does nothing in a browser), so a browser run cannot set it. Emulate it by the viewport: zoom z shows `1600/z` by `960/z` CSS pixels. Run the layout scan or a smaller screen set at 800x480 (z=2) and 3200x1920 (z=0.5), and at the smallest window (`minWidth 720`, `minHeight 600` in `backend/src-tauri/tauri.conf.json`). Oracle: the scan's faults; no horizontal page scroll; the main controls reachable. The scan viewport is fixed in the `layout` project (1600x900); a variant project or an env var is a config change: ask.

Place: `affected.mjs --e2e` picks specs by feature name; add the new specs to the "new screen" list in `tests.md` row 31 when stable. CI: `e2e-chromium` runs them without a change.

## 8. Soak and leak with the fake engine

Why: ComfyUI and Python are child processes (`child_job.rs`, `comfy/process.rs`), and the app runs for days; a leak of handles, memory or children shows only over many cycles.

Status: absent. `perf.mjs` measures once. Fake engine: `tests/comfy_fake_server/` (HTTP fake of ComfyUI) and the `Engine` trait fakes in tests (see `NoEngine` in `tests/model_install_locked.rs`).

Recipe, no GPU, bounded (needs a yes only if a script file is added):
1. Start `novira-server` without `--engine` on a data folder inside `novira-data/work/soak-data` (pattern: `scripts/tools/server-run.mjs`; build target `novira-data/work/server-target`). Never the user's data folder or process.
2. A Node script `scripts/tools/soak.mjs` (new script: ask) loops at most N cycles or M minutes: enqueue and cancel, create and delete a board, upload and delete a picture, open and close the `/events` WebSocket, through `POST /api/<command>`.
3. Every 20 cycles read the server's numbers on Windows: `Get-Process -Id <pid> | Select Handles, WorkingSet64, Threads` (PowerShell), child processes `Get-CimInstance Win32_Process -Filter "ParentProcessId=<pid>"`. Only the server's own pid and its children; no `Stop-Process` on anything else.
4. Engine child cycle (needs the isolated `comfy-copy` setup and the GPU lock, so use `/verify-real-app` rules): start and stop the engine 20 times and count `python` processes whose command line contains `comfy-copy` (the harness already matches them that way); expect 0 after each stop.
5. Oracle: after a warm-up of 10 percent of the cycles, handles and threads are flat (last quarter equals the second quarter within 5 percent); working set grows less than 10 percent; child count 0 at the end; the script exits non-zero otherwise.
6. Prove it: in a scratch worktree leak a `File::open` result with `std::mem::forget` in a hot command; handles must climb.

Place: manual, or the nightly workflow when stable (windows runner, 10 minutes). Not `affected.mjs`.

## 9. Miri and sanitizers

Status and verdict: not worth running now.
- Files with `unsafe` (`grep unsafe backend --include=*.rs`): `novira-core/src/child_job.rs` (job objects), `fonts.rs` (registry), `gpu_lock.rs` and `tests/gpu_lock_owner_states.rs` (`GetProcessTimes`), `secret.rs` (Credential Manager, DPAPI; 13 uses), `provenance/watermark.rs` (`libloading::Library::new`), `novira-server/src/home_network.rs` (IP helper tables, 9 uses). `agent/mod.rs`, `tests/agent_fake_tool.rs`, `tests/auth.rs`, `server/src/lib.rs` only contain the word "unsafe" in text.
- Miri cannot run any of them: every one calls the Windows API or loads a DLL, and Miri has no emulation for these (and it isolates the clock and file system). Miri could run only unsafe-free pure logic, which finds nothing.
- Sanitizers (ASAN) need nightly and are Linux-only in practice for Rust; the unsafe code is Windows-only. Skip.
Cheaper guard that does help (needs a yes, a small code change): `#![deny(unsafe_code)]` in `novira-core/src/lib.rs` and `novira-server/src/lib.rs`, with `#[allow(unsafe_code)]` and a reason on the six modules above. Then a new `unsafe` anywhere else fails the build, which is the control Miri would not give. Prove: add `unsafe {}` to `settings.rs`.

## 10. Installer and in-place update

What is really shipped: `backend/src-tauri/tauri.conf.json` has `"bundle": { "active": false }`, so there is no installer (no MSI, NSIS, updater). `scripts/tools/package-release.mjs` (`ENTRIES`) zips `novira.exe`, `novira-server.exe`, `dist\`, `server.bat`, `LICENSE`, `THIRD_PARTY_NOTICES.txt` as `novira-<version>-windows-x64.zip` plus a `.sha256`; `artifacts\novira-data\` is never in it. `release.yml` builds, runs `scripts/tools/release-smoke.mjs` (both exes, old data fixture `tests/fixtures/data-v0.3.0/`), packs, makes a draft release. "Update" is unzipping a new version over the old folder; "uninstall" is deleting the folder.

So installer tests do not apply. What is testable without new tools:
1. Unzip-over test: unzip version A, start `novira-server.exe` on a data folder, stop; unzip version B over the same folder; start again; the data opens. A leftover file of A that B no longer ships (a changed `dist\` hash name) must not break B: compare the file list of `dist\`. Needs two zips; the older from `gh release download` (network) or a local build: add as a case of `release-smoke.mjs` only when a second version exists (unconfirmed which tags have assets).
2. Package content test: `package-release.mjs` exports `ENTRIES`, `missingEntries`, `tagNamesVersion`; unit-test that the zip lists exactly `ENTRIES` and holds no `novira-data` (a vitest file next to a test of this script; check whether one exists).
3. Uninstall residue: secrets are in the Credential Manager (`secret.rs`) and the WebView2 profile is outside the folder; deleting the folder leaves them. Whether that is intended is a question for the user, not a test.
Effort and value are low; do 2 if the package contents change.

## 11. Load and stress of `novira-server`

Why realistic: a LAN or remote listener for a few phones and one owner, not a public service. Limits in `backend/crates/novira-server/src/lib.rs`: `MAX_CONNECTIONS = 512` (a `Semaphore`), `HEADER_READ_TIMEOUT` 15 s. `tests/http_fuzz.rs` sends malformed requests one by one; nothing sends many at once.

Recipe (tests or a Node script on loopback; node built-ins only, no tool):
1. Tests in `backend/crates/novira-server/tests/` in a new file `load.rs` (shape of `tests/common/`): start the server in process on loopback.
2. Cases: (a) 600 idle connections: the first 512 hold, the rest wait or are refused, and a request after closing 10 is served; (b) 50 slow clients that send one header byte per second (slowloris): each is closed at the header timeout (set a short one through a time seam if the code has one: unconfirmed; otherwise use the real 15 s and one case), and meanwhile a normal request answers under 1 s; (c) 100 parallel `Range` picture requests: all complete, memory flat; (d) 30 `/events` sockets and a burst of 1000 events: none blocks the sender, a slow reader is dropped, not buffered without limit; (e) 20 parallel uploads at the size limit: the limit holds; (f) the same under TLS (`lan_tls.rs` helpers).
3. Oracle: a normal request is answered within 1 s during every attack; the process memory (see section 8) stays under a budget; no 5xx; the server stays up.
4. Prove: lower `MAX_CONNECTIONS` check or remove the header timeout in a scratch worktree; (a) and (b) must fail.
Place: `cargo test -p novira-server` (affected.mjs already runs it for `novira-server`); keep the run under a minute or mark the slow case with a name filter and run it by hand.

## 12. Real-engine output regression and GPU/driver matrix

Why: nothing checks that the same job still makes the same picture after a ComfyUI, driver or graph change. `models-sweep.mjs` checks lists, covers and that a picture is not blank, not quality.

Status: absent; manual, on the user's PC, GPU lock required (`docs/verification.md`, "Real engine, no window"). CI has no GPU; `hardware_detect.rs` and `prop_machine.rs` only parse text.

Recipe (needs no yes if it stays in an `#[ignore]` live test and `novira-data/work/`):
1. Check the GPU is free (`scripts/tools/gpu-check.mjs`), take `NOVIRA_GPU_LOCK`.
2. Reference pictures are not committed (binary, tied to one GPU): `node scripts/tools/models-live.mjs <model> --out novira-data/work/reference/<model>` with a fixed seed, size and steps (`NOVIRA_LIVE_STEPS`, `_SIZE`, and a seed variable if `models_live.rs` has one: unconfirmed), plus a sidecar JSON: GPU name, driver, ComfyUI version, torch version, model file hash, graph JSON.
3. Compare in a second run of the same command with `NOVIRA_LIVE_REFERENCE=<folder>` (an addition to `tests/models_live.rs`): decode both with the `image` crate novira-core already has, scale both to 64x64, compute the root mean square difference per channel and the share of pixels differing over 16/255.
4. Tolerance: on the same machine, GPU, driver and ComfyUI the output is usually identical or near; across a driver or torch change small diffs are normal. Calibrate: run the same job 3 times (threshold must be above their difference) and one run with the seed changed by 1 (must exceed it). Keep thresholds in the sidecar, not in code. Compare only when the sidecar's GPU and torch match; otherwise report "not comparable".
5. Matrix: a second GPU or driver means a second reference folder per GPU name. Record, do not gate.
Oracle: RMS below the calibrated threshold. Prove: change the seed, then change one LoRA strength by 0.1.
Place: manual after a change to `comfy/graph.rs`, `video.rs`, `music.rs` or a ComfyUI update, together with the model sweep (`.claude/rules/models.md`). Not `affected.mjs`, not CI.

## 13. Smaller kinds

Each is one test file or one script; none needs a CI change unless noted.

- Doc tests. No Rust doc has a code block today. Add a runnable example only to a pure public function whose use is not obvious (for example the name validators `images::is_valid_name`); `cargo test -p novira-core --doc` runs them. Low value; skip unless a function's contract is easier to show than to describe. Markdown in `docs/` is already checked by `docs-check.mjs`, `ui-refs.mjs`, `manual.test.ts`.
- Secret-leak check across logs. `security.md` forbids keys in logs, errors, return values and notifications; `src-tauri/tests/security/secrets.rs` scans source, `tests/key_cleanup/` checks cleanup. Missing: a run-time check. New file `tests/key_canary.rs`: set a unique key (`NOVIRA-CANARY-<uuid>`) for a site key through the service (`service/keys.rs`), run the fake-site flows (`tests/fake_site/`: lookup, download with auth, a failing request), collect (a) every event from `set_event_sink`, (b) every JSON returned by the commands, (c) every file under the data folder except the secret store, (d) the dev log, and assert the canary appears nowhere in plain text. Prove: add the key to one `format!` error. Also grep the Playwright traces of a failed e2e run: unconfirmed that the mock holds real keys, skip.
- Memory and power budget. `perf.mjs` only reports. Add a budget file (`scripts/tools/perf-budget.json`, new) and a `--budget` option failing when idle working set of `novira-server` after start, or CPU time over a 60 s idle window (`Get-Process | Select CPU`, delta), exceeds a limit set at 1.5 times the first measured value. Idle CPU is the power proxy on a laptop (wake-ups); `powercfg /energy` needs admin: do not. Same machine only (`docs/verification.md`, "Measuring speed"). Ask before adding the option.
- External-service canary. `*_live.rs` (`civitai_live.rs`, `huggingface_live.rs`, `node_packs_live.rs`, `media_live.rs`, `watermark_live.rs`, `agent_live.rs`, `agent_endpoint_live.rs`; `models_live.rs` needs a GPU, `home_network_live.rs` a network) are `#[ignore]`. Safe candidates for a schedule: `civitai_live`, `huggingface_live` (public endpoints, no key; never pass a key into CI). A weekly workflow `canary.yml` (ask) on `ubuntu-24.04` or Windows: `cargo test -p novira-core --test civitai_live --test huggingface_live -- --ignored`. A failure means the service changed its shape or is down; the notice is only the Actions tab (like `audit.yml`), unless the user allows an issue (needs `issues: write`, a widened permission: ask). Allow one retry before red.

## 14. Formal methods: the queue spec is in, the rest is open

The user lifted the hold on 2026-11-08 and asked for it to be learned as well as used. What exists and the reasoning (when to prefer it to proptest) is `docs/tests/11-formal.md`; read it first.

Done: `backend/crates/novira-core/formal/Queue.tla` (+ `Queue.cfg`) models the queue and the worker; `node scripts/tools/checks.mjs tla` runs TLC (it fetches a portable JDK 17 and `tla2tools.jar` into `novira-data/work/tools` once). Proved to fail: three deliberate breaks of the spec each produced a violation (no pending check at start, overwriting an ended item, the id counter reset by a clear). When `queue.rs` or `worker.rs` changes how an item moves, change the spec in the same commit.

Left:
- Kani on `backend/crates/novira-server/src/pair.rs`: Kani does not run on native Windows; use the WSL Ubuntu, which has no Rust and no `cc` and needs `sudo apt install build-essential` (the user's password). `pair.rs` depends on `ring`, whose C build Kani must compile; if that fails, extract the pure decisions (`alive`, `allow`, `clean_label`, the single-use rule) into a function without `ring` and prove those. Ask before installing anything.
- A TLA+ spec of the pairing machine (code, request, approval, session, revoke, expiry).
- Quint and Verus are not planned: Quint only restates TLA+, and Verus costs more than this size of project repays.
