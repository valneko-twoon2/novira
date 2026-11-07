# Randomized tests: property, model-based, fuzz, differential, monkey, metamorphic

How to add each kind of randomized test in novira, and how to prove it can fail. Transition tables and queue rules are in [state-machines.md](state-machines.md); do not repeat them here. Findings always end as an ordinary test (section 1, rule 4).

| Kind | Needed when | Status in novira | Section |
|---|---|---|---|
| Property (Rust, proptest) | A parser, validator, limit, path or URL rule, or builder takes outside data | yes (`prop_*.rs`) | 2 |
| Property (frontend, fast-check) | A store, parser or pure function in `frontend/src/` takes free input | yes | 3 |
| Model-based (stateful) | A store or queue is changed by a sequence of operations | yes: `prop_queue.rs`, `prop_db.rs` | 4 |
| Byte-mutation fuzz | A new file format or reader of outside bytes | yes (`fuzz_inputs.rs`) | 5 |
| Structure-aware command fuzz | A new command in `api.rs` | partly (local commands only) | 6 |
| Request fuzz | A new HTTP route or check in `novira-server` | yes (`http_fuzz.rs`) | 7 |
| Differential | A call added or changed in `MockBackend` or the backend | yes | 8 |
| Monkey | A new screen or dialog | yes, mock and browser only | 9 |
| Metamorphic | Output is hard to state exactly (resize, crop, export, watermark, graph builder) | yes (`meta_graph.rs`, `meta_media.rs`; watermark not testable without the model) | 10 |
| Model-based, pairing state machine | `novira-server/src/pair.rs` changes | yes (`src/pair/model_tests/`) | 11 |
| Model-based, queue with worker races | `service/queue.rs` or `worker.rs` changes | yes (`prop_queue_worker.rs`) | 12 |
| Coverage-guided fuzz (cargo-fuzz) | A reader that parses a binary format and has been fuzzed by mutation already | no | 13 |

## 1. Shared rules (as practised here)

1. Fixed default seed, small default count, environment override. Rust proptest: `tests/prop_common/mod.rs` (`DEFAULT_SEED`, `cases()` = `PROPTEST_CASES` or 256, clamped to 1..=4096; `PROPTEST_SEED`; `check`, `check_up_to(limit, ...)` for slow cases). Rust fuzz: `NOVIRA_FUZZ_SEED`, `NOVIRA_FUZZ_ITERATIONS` (a local `setting()` in each file). Frontend: `NOVIRA_PBT_RUNS` (150), `NOVIRA_PBT_SEED` (20261007) in `frontend/src/propertyTest.testkit.ts`. Differential: `NOVIRA_DIFF_SEED`, `NOVIRA_DIFF_RUNS`, `NOVIRA_DIFF_STEPS`. Monkey: `NOVIRA_MONKEY_SEED`, `NOVIRA_MONKEY_ACTIONS`, `NOVIRA_MONKEY_TRACE`. Never change a committed default; a deeper run is a command-line override.
2. Hand-written generators are `Rng` (xorshift64*) copies in `fuzz_inputs.rs`, `api_fuzz.rs` and `http_fuzz.rs`, started with `Rng(seed | 1)`. The `| 1` is applied without mixing, so seeds 2 and 3 run alike (documented in verification.md). A new hand-written generator mixes the seed first (splitmix64, then `| 1`) so every seed differs. Prefer proptest or fast-check, which take the seed directly.
3. Every loop has a constant bound (`for case in 0..cases`, `0..MAX_STEPS`); no `loop` that waits for a condition. A bounded wait is `wait_until` in `backend/crates/novira-core/tests/backend_service/common.rs` (200 tries of 20 ms, then panics).
4. On failure print the seed, the case number and the input; save a large or binary input under `logs/fuzz/` (git-ignored) as `<reader>-<seed>-<case>.bin`, `api-<seed>-<case>.json` or `http-<seed>-<case>.txt` (the existing `fuzz()` / `fail()` helpers). Pin the finding: a plain `#[test]` or `it(...)` with the input written out, named after the rule that was broken, in the file of the code (for a request, `novira-server/tests/auth.rs`). Proptest regression files are off (`failure_persistence: None`); do not rely on them. Until fixed, a known frontend bug is `it.fails` with a `known bug:` comment.
5. Each case has a time limit: `SLOWEST` = 10 s in the three fuzz files. A slower input is a finding, not a flaky test.
6. Count how far inputs got when the oracle has layers: answered, refused at the door, refused deeper. If nearly all are refused at the first check, start from valid samples and damage less. (`http_fuzz.rs` builds requests from the server's own routes with a valid credential for this reason; `api_fuzz.rs` takes samples from `contract/`.) Whether `fuzz_inputs.rs` prints such counts is unconfirmed; add them in a new fuzz file.
7. The oracle is stronger than "no panic": answer-or-refuse, accepted data is valid, nothing written outside the data folder, the system answers after every input, a valid request still works at the end, a refusal leaves no half state.
8. Prove the harness can fail (do this once per new test, then revert): put a fault on a path the test reaches (flip a comparison, remove a check, `panic!` on one input class, make a transition skip a state), run with the default seed, confirm the failure names seed, case and input and reproduces with the same seed, then `git checkout` the fault away. Say in the report which fault and which message. Rust mutation testing ([mutation.md](mutation.md)) is the systematic form.

## 2. Property test, Rust (proptest =1.11.0)

Needed when: code parses, validates or builds from outside data, or has a rule that must hold for all inputs (round trip, idempotence, well-formed output, "never panics, refuses with a reason").
Existing examples: `backend/crates/novira-core/tests/prop_paths.rs`, `prop_graph.rs` (every built ComfyUI prompt has unique ids, links to existing nodes, no cycle: `assert_well_formed`), `prop_roundtrip.rs`, `prop_parsers.rs`, `prop_classify.rs`, `prop_xmp.rs`, `prop_machine.rs`, `prop_ui_locale.rs`, `prop_gallery_files.rs`, `prop_packs.rs`, `prop_loopback.rs`. Shared strategies: `nasty_string()`, `json_value`, `json_object`, `any_text` in `tests/prop_common/mod.rs`.

1. Create `backend/crates/novira-core/tests/prop_<area>.rs` (one responsibility). Start with `mod prop_common;` and `use prop_common::{check, check_up_to, ...}; use proptest::prelude::*;`.
2. Write the property as a sentence (round trip, invariant, idempotence, oracle, relation) and name the test after it: `fn a_<thing>_<holds>_for_any_<input>()`.
3. Generate valid input from a narrow strategy and hostile input from `nasty_string()` in a separate test. Do not filter with `prop_assume!` for most cases (rejects waste the budget); build the valid shape.
4. Call `check(strategy, |input| { ...; prop_assert_eq!(...); Ok(()) })`. Use `check_up_to(64, ...)` when a case touches the file system, SQLite or the system key store.
5. A panic inside the body counts as a failure and is shrunk; the failure message holds the minimal input. Pin it as a plain test.
6. Fault check: change the code under test (for example drop one `..` check in a path rule), run the command below, confirm the minimal counterexample is printed, revert.

Run: `cargo test -p novira-core --test prop_<area>`; deeper: `PROPTEST_CASES=4096 PROPTEST_SEED=<n> cargo test -p novira-core --test prop_<area>` (4096 is the clamp; the clamp is intended, do not raise it).

## 3. Property test, frontend (fast-check 4.10.2)

Needed when: a store, parser, formatter or state function takes free input. Examples: `frontend/src/state/params.property.test.ts` (ops in any order keep a usable size), `dateFilter.property.test.ts`, `gallery.property.test.ts`, `persistence.property.test.ts`, `dnd.property.test.ts`; about 30 to 50 such files in all.

1. Create `<module>.property.test.ts` beside the code. Import `check, blockExternalNetwork` (and `junkText`, `junkJson`, `junkStored`, `memoryStorage`, `installMemoryLocalStorage` where they fit) from `@/propertyTest.testkit`; call `blockExternalNetwork()` at module top (a `fetch` then throws and is recorded in `attemptedFetches`).
2. Reset the store before each test (`beforeEach(() => useX.setState(initial, true))`, as in `params.property.test.ts`).
3. Build arbitraries with `fc.record`, `fc.oneof`, `fc.constantFrom(...)`; keep ranges honest (`fc.double({ noNaN: true })` unless NaN is the case).
4. `check(fc.property(arb, (x) => { ...expect... }))`; the third parameter of `check` scales runs for an expensive property. Never call `fc.assert` with your own seed; `pbt()` supplies `numRuns` and `seed`.
5. Failure output is fast-check's report (seed, path, shrunk counterexample). Reproduce with the same seed; pin as an ordinary `it(...)`.
6. Fault check as in section 1, rule 8, in the module under test.

Run: `npx vitest run src/<path>/<module>.property.test.ts`; deeper: `NOVIRA_PBT_RUNS=2000 NOVIRA_PBT_SEED=<n> npx vitest run <file>` (in `frontend/`). Run `npx eslint <file>` and `npm run typecheck` too (tests.md).

## 4. Model-based test (stateful)

Needed when a store or queue changes through a sequence of operations and its state is easy to state in a few lines.
Existing: `backend/crates/novira-core/tests/prop_queue.rs` (enum `Op`, strategy `op()` with weights, type `Model = Vec<(u64, String, QueueItemStatus)>`, `actual(&Backend)`, `pick(&model, i)`; worker stopped by `b.pause_processor()` so each step is deterministic) and `prop_db.rs` (`a_run_of_writes_leaves_what_a_plain_model_of_them_leaves`). Frontend: `params.property.test.ts` uses an `Op` union the same way.

1. Define `enum Op` with only operations a user or caller can reach; weight them with `prop_oneof![4 => ..., 1 => ...]`. Index-style operands are `usize` taken modulo the model length (`pick`), so they are always valid.
2. Write the model as plain data, with no clever logic. If the model needs the same branches as the code, the test proves nothing.
3. Apply each op to both; after every op compare the full state (sorted when order is not promised) and the derived numbers (`queue_snapshot().status`: total, pending, canceled, in_progress, `is_paused`). Also assert invariants that hold at every step (ids only grow, ids unique, a batch shares one id).
4. Bound the sequence (`prop::collection::vec(op(), 1..25)`) and the cases (`check_up_to(64, ...)`), and reset state at the start of each case (`b.clear_queue()`).
5. The shrunk failure is the shortest op list; write it out as an ordinary test with the ops in order.
6. Fault check: for example make `Retry` accept a pending item; the test must fail and shrink to enqueue then retry.
7. Add a new op whenever a transition is added to the table in [state-machines.md](state-machines.md); a cell that cannot be reached with the worker paused goes to section 12.

Run: `cargo test -p novira-core --test prop_queue` (or `prop_db`).

## 5. Byte-mutation fuzz

Needed when a new file format or reader of outside bytes is added (picture, credentials, model header, backup zip, a new import).
Existing: `backend/crates/novira-core/tests/fuzz_inputs.rs`: `mutate()` (one to four of: bit flip, byte to 0/0xFF/0x7F/0x80, truncate, insert, delete range, copy range, length field set to an edge, splice from a second sample), `fuzz(reader, seeds, read)`, `SLOWEST`, `picture(format, w, h)`, `safetensors(header, data)`, `backup_zip()`, `files_under()`. Tests: `damaged_pictures_of_every_format_are_read_or_refused`, `damaged_content_credentials_are_read_or_refused`, `damaged_model_headers_are_read_or_refused`, `damaged_backups_are_unpacked_into_the_staging_folder_or_refused_leaving_nothing`.

1. Build two or more valid samples with a helper (a second one supplies the splice).
2. Add a test `damaged_<thing>_is_read_or_refused` calling `fuzz("<reader>", &seeds, |bytes| { ... })`. The closure calls the reader and checks the result.
3. Oracle beyond "no panic" (the harness already adds the 10 s limit): an accepted result is valid (a kept picture decodes, a parsed header re-serializes), a refusal leaves nothing behind (`files_under(dir)` is empty or only the staging folder), nothing appears outside the temp folder.
4. Reader is async or needs a data folder: create a `tempfile::tempdir()` per case, never the real `novira-data`.
5. Fault check: make the reader `unwrap()` a length field or index with it unchecked, run, confirm "`<reader>` panicked on case N of seed S; the input is logs/fuzz/<reader>-S-N.bin".
6. Pin a finding: copy the saved bytes into a fixture or a byte literal in the reader's own test file.

Run: `cargo test -p novira-core --test fuzz_inputs`; deeper: `NOVIRA_FUZZ_ITERATIONS=20000 NOVIRA_FUZZ_SEED=<n> cargo test -p novira-core --test fuzz_inputs`.

## 6. Structure-aware command fuzz

Needed when a command is added to `api.rs` (tests.md names `api_fuzz.rs` for a new command).
Existing: `backend/crates/novira-core/tests/backend_service/api_fuzz.rs`: `commands(model)` returns `(name, valid args)` pairs, using `sample("<name>")` from `contract/<name>.json` where there is one; damage is applied to the JSON tree and the call goes through `api::dispatch`; the worker runs on `FakeEngine`.

1. Add the command to `commands()` with arguments it accepts, from `contract/` samples when the type has one (add the sample first if the command is new, tests.md contract row).
2. If the command reaches a website, starts a program or the Credential Manager, do not add it; add its name to the "left out" comment at the top of the file instead, with the reason.
3. If it takes ids, check that the id-substitution in the file reaches the new argument (strings are now and then ids from earlier calls). Reading the remaining part of the file for how ids are collected is needed: unconfirmed here.
4. Oracle already in the harness: no panic (a sync panic comes back as "Internal error"), under 10 s, `bootstrap` answers after each call, nothing written outside the data folder, and a valid job still ends at the end. Add a command-specific check only if the command has a postcondition that a damaged call could break.
5. Fault check: make the command `unwrap()` an optional field; run with the default seed, or raise `NOVIRA_FUZZ_ITERATIONS` until the damage hits that field; confirm `logs/fuzz/api-<seed>-<case>.json`.
6. Pin the finding in `tests/backend_service/` next to the command's tests.

Run: `cargo test -p novira-core --test backend_service api_fuzz`; deeper: `NOVIRA_FUZZ_ITERATIONS=5000 NOVIRA_FUZZ_SEED=<n>` in front of it.

## 7. Request fuzz (HTTP)

Needed when a route or request check is added to `novira-server`.
Existing: `backend/crates/novira-server/tests/http_fuzz.rs`. `COMMANDS` and `PATH_DAMAGE` constants, `build()` makes a request from the server's own routes, `damage()` breaks method, path, `Host`, `Origin`, `Sec-Fetch-Site`, token, cookie, `Range`, content type, body; `exchange_raw()` sends it over a socket; `passes_the_checks()` is the oracle that restates `check_request` (`src/lib.rs`): exactly one `Host` in the served set, at most one `Origin` equal to `http://<host>`, at most one `Sec-Fetch-Site` that is `same-origin` or `none`, and a token by header (`TOKEN_HEADER`), cookie, or `?token=` on `GET /`. Test: `damaged_requests_are_answered_and_none_gets_past_a_check`.

1. New command: add `("<name>", r#"<valid json>"#)` to `COMMANDS` (local commands only). New route: add it to `build()` with valid credentials.
2. A new check in `check_request`: add it to `passes_the_checks()` as one more condition, and add a damage in `damage()` that breaks only that check. The oracle must be the check, written independently of the code (both directions: a request that fails any check is refused; one that passes all is not).
3. When the oracle and the server disagree, first decide which one is wrong; do not "fix" either until then (a partial restatement of the check is the usual false alarm).
4. Keep duplicate headers in the damage set: the check reads the first value and a handler may read the last.
5. Fault check: remove the `Origin` comparison in `check_request`; the run must report a request let through, with `logs/fuzz/http-<seed>-<case>.txt`.
6. Pin the finding in `novira-server/tests/auth.rs`.

Run: `cargo test -p novira-server --test http_fuzz`; deeper: `NOVIRA_FUZZ_ITERATIONS=5000 NOVIRA_FUZZ_SEED=<n>`. Not covered by this file: home-network routes, the export, commands that reach a website.

## 8. Differential test (mock against the real backend)

Needed when a call is added or changed in `MockBackend` (`frontend/src/backend/mock/`) or the Rust backend (tests.md).
Existing: `scripts/tools/diff-backends.mjs` builds and starts `novira-server` on an empty data folder in `novira-data/work/diff-backends` (`scripts/tools/server-run.mjs`: `ensureBuilt`, `startServer({ data, engine: false })`) and runs vitest with `frontend/vitest.difftest.config.ts`. `frontend/difftest/backends.difftest.ts` (fixed cases), `sequences.difftest.ts` (seeded sequences: `SEED` 20261031, `RUNS` 3, `STEPS` 30), `harness.ts` (`useBackends()`, `same(backends, steps)`, `normalize()` numbering made-up ids as `<made N>`, `png(w, h)`), `setup.ts`.

1. Fixed case: in `backends.difftest.ts` add a test calling `same(backends, (b) => [...steps])`. Each step is a call on the `BackendClient`; read back only what the case made.
2. Random sequence: add the call to the pool in `sequence()` of `sequences.difftest.ts`; choose arguments from the seeded generator and from the count of things made so far, and add the readback of the new state.
3. Make-up values (ids, times, picture addresses) go through `normalize`. Do not compare an order that neither side promises: sort first.
4. A difference is fixed in the mock. A call the real server answers as shell-only is left out with a comment giving the reason.
5. Fault check: change the mock's answer for the new call (drop a field); the run must name the first differing step.
6. Pin a finding as a fixed case in `backends.difftest.ts`.

Run (repository root): `node scripts/tools/diff-backends.mjs`; deeper: `NOVIRA_DIFF_SEED=<n> NOVIRA_DIFF_RUNS=20 NOVIRA_DIFF_STEPS=60 node scripts/tools/diff-backends.mjs`. No GPU, no network.

## 9. Monkey test

Needed when a screen or dialog is added (tests.md).
Existing: `frontend/e2e/monkey.spec.ts` (chromium project): `TABS` (generate, comic, canvas, upscaling, workflows, models, browse, queue), `TARGETS`, `KEYS`, `TEXTS` (empty, 3000 chars, `[fail]`, `../../x`, emoji, RTL mark), `act(page, next)`, one test per tab, with the mock library and with `?scenario=empty`; `SEED` 20261031 + run index, `ACTIONS` 60. After every action: no `error-boundary` test id, `.app` present, `errors` fixture empty (console error or pageerror, from `e2e/fixtures.ts`).

1. A new tab: add it to `TABS` (and to `showTab` in `e2e/fixtures.ts` if it cannot be opened yet). A dialog: it is reached by clicking; add its opener to `TARGETS` if the generic selectors miss it.
2. Wrap the new region in an `ErrorBoundary` (frontend.md) or the oracle cannot see a render failure.
3. Add text that matters for the new inputs to `TEXTS`.
4. Oracle is fixed by the spec; add an invariant for the screen only if it has one (a count that must not go negative), in the loop after `act`.
5. A failure message starts `seed <n>, action <k>:` followed by the numbered action log; the log is also attached as `actions`. Repeat with `NOVIRA_MONKEY_SEED=<seed - run index>`.
6. Fault check: make a click handler of the screen throw, and a component throw during render after the first action; both must be reported; then revert.
7. Fixing the app is the pin; for a layout-independent regression add a normal e2e step to the area's spec.

Run (in `frontend/`): `npx playwright test e2e/monkey.spec.ts --project=chromium` (under `node scripts/tools/e2e-lock.mjs -- ...` for a longer run; at most 6 workers); deeper: `NOVIRA_MONKEY_SEED=<n> NOVIRA_MONKEY_ACTIONS=300 NOVIRA_MONKEY_TRACE=1 npx playwright test e2e/monkey.spec.ts --project=chromium`. Mock and browser only: IPC, the shell and the real engine are not covered (`/verify-real-app`).

## 10. Metamorphic test (exists: `meta_graph.rs`, `meta_media.rs`; the design below is the pattern for a new one)

Needed when the exact output is hard to state but a relation between two runs is easy: image processing, export, watermark, graph building. Status: no such test; only round trips in `prop_roundtrip.rs`. Add them as proptest files for Rust (section 2 steps) and `*.property.test.ts` for the frontend (section 3). No oracle file is needed: both runs are the code under test.

Recipe:
1. Pick a relation `f(T(x))` against `T'(f(x))`, an invariant under a change, or a monotone change. Write it first as a sentence.
2. Generate small valid inputs (pictures of 1 to 64 pixels per side via `image::RgbImage::from_fn` or the `png(w, h)` helper in `tests/backend_service/common.rs`; options within `MIN_SIDE..=MAX_SIDE` of `media/export.rs`).
3. Compare with a tolerance where lossy codecs or resampling are involved; state the tolerance in the test and keep it as tight as a passing run allows (measure, do not guess). Exact equality only for lossless paths.
4. Fault check: change one constant in the code (a rounding mode, an off-by-one in a crop), see the relation fail.

Relations to implement (the function names are from the source; open them before writing):

| Subject | Relation |
|---|---|
| `media::export::target_size(w, h, max_side)` | Never larger than the input; longest side equals `max_side` when the input was larger, else unchanged; aspect ratio kept within one pixel; applying it twice equals once (idempotent); a larger `max_side` never gives a smaller result (monotone); swapping width and height swaps the result |
| `media::export::encode(original, options)` | PNG output decodes to the pixels of the lossless resize (same pixels as encoding to the size in one step); quality 100 is at least as close to the original as quality 1 (mean absolute error); encoding a copy that already has `max_side` size keeps the size; a `max_side` at or above the input size gives the input size |
| Crop, resize in `frontend/src/features/canvas/` (`geometry.ts` and the rendering code) | Crop to the full rectangle is the identity; crop then crop equals one crop of the composed rectangle; resize by `s` then by `1/s` is within tolerance for flat colours; translation of the crop window moves the pixels by the same offset. Which function to call is unconfirmed: read `geometry.ts` first |
| `provenance::watermark::Watermarker::embed` / `read` | Embed with id A then read gives A; the image size and colour type are unchanged; mark then export at the same size still reads A. Needs the TrustMark model files and runtime: the existing tests that load it are `watermark_live.rs` (`#[ignore]`, run only on request). Write the metamorphic version in `watermark_live.rs` or against a fake marker, and say in the report that it did not run in the normal suite |
| `comfy::graph::build(&GraphInput)` | Changing only the seed changes only the seed inputs of the sampler nodes; the node ids and links are equal; adding a LoRA adds nodes and links and removes none of the earlier ones' classes; changing the prompt text changes only the text-encode nodes; every produced prompt still passes `assert_well_formed` from `prop_graph.rs` (move it to `prop_common` when a second file needs it). Compare the two `BuiltGraph` values as JSON and report the first differing node id |
| Frontend request builder (`frontend/src/state/invoke.ts` registry) | Same relations as the graph builder, on the request the screen sends; same seed and params give the same request (the mock is deterministic too, frontend.md section 4) |

Run: `cargo test -p novira-core --test prop_<area>` or `npx vitest run <file>.property.test.ts`; same override variables as in section 1.

## 11. Model-based test of the pairing state machine (exists: `backend/crates/novira-server/src/pair/model_tests/`; the design below is the pattern)

Needed when `backend/crates/novira-server/src/pair.rs` changes (codes, requests, sessions, rate limit). Status: example tests only in `src/pair/tests.rs` (clock moved by hand with `Instant`, helpers `ip()`, `paired()`, `pending_id()`); no proptest in `novira-server`.

Prerequisite (confirm with the user before doing it): proptest is not a dev-dependency of `novira-server`. The survey rule is that work beyond the request (new tools, CI changes) is confirmed first. Adding a dev-dependency to a crate is that kind of change. Once agreed: in `backend/crates/novira-server/Cargo.toml` `[dev-dependencies]` add the exact version used by novira-core, `proptest = { version = "=1.11.0", default-features = false, features = ["std", "bit-set"] }` (the workspace pins exact versions and `cargo audit` reads `Cargo.lock`), run `cargo test -p novira-server` to update the lock file, and write `docs/design` / security notes only if the dependency list there needs it (docs.md). The seed helper of `prop_common` is in novira-core's tests and cannot be imported; copy the small `check` runner (fixed `RngAlgorithm::ChaCha` seed, `failure_persistence: None`, `PROPTEST_CASES`, `PROPTEST_SEED`) into `novira-server/tests/prop_common/mod.rs`, or put the test inside `src/pair/tests.rs` (the type `Pairing`, with private fields, is reachable there).

Steps:
1. The clock is an argument, so the test owns time: keep `let t0 = Instant::now()` and a model time `at: Duration`; `now = t0 + at`. `Op::Advance(secs)` adds to it (choose from 0, 1, 59, 60, 119, 120, 121, 299, 301, 1799, 1800, 14399, 14400, 14401 s, the edges of `CODE_TTL`, `RATE_WINDOW`, `PENDING_TTL`, `SESSION_IDLE`, `SESSION_MAX`).
2. `enum Op`: NewCode, `Request { peer, code_choice, label_choice }`, `Poll { peer, which }`, `Approve(i)`, `Deny(i)`, `Session { which }`, `Touch { which }`, `Revoke(i)`, `Reset`, `Grant { peer, passkey }`, `Advance(u64)`. Operands are indices modulo the model's list, plus wrong values (a code never issued, a wrong poll secret, another peer's address, labels from `clean_label` edge cases: empty, 41 characters, control, `\u{202e}`).
3. Model: lists of codes with expiry, requests with decision, sessions with `created`/`last`/`peer`, per-peer request times. Keep it plainly written; do not call `Pairing` methods in the model. The constants (`CODE_TTL`, `MAX_CODES`, `MAX_PENDING`, `MAX_SESSIONS`, `REQUESTS_PER_WINDOW`, `RATE_WINDOW`, `SESSION_IDLE`, `SESSION_MAX`, `LABEL_MAX`) are private or `pub`; use `super::*` inside `src/pair/tests.rs`.
4. Properties (oracle): no session secret exists without an approval (or a grant); a revoked or reset session never passes `session`/`touch` again; a code is used by one request and not after `CODE_TTL`; an approved request gives one session and its secret is returned once (`Status::Approved` then `Unknown`); a poll from another address or with another secret is `Unknown`; requests per peer in one window never exceed `REQUESTS_PER_WINDOW`; waiting requests never exceed `MAX_PENDING`, sessions never `MAX_SESSIONS`, tracked peers never `MAX_TRACKED`; a session dies when idle for `SESSION_IDLE` or old for `SESSION_MAX`; `view()` lists exactly the model's pending requests and sessions.
5. Secrets are random (`random_hex`), so compare outcomes (`Some`/`None`, `Status` variants) and keep real secrets in the model as opaque strings read from the results.
6. Fault check: remove the used-code removal in `request`, or make `alive` use `<=` for `SESSION_IDLE`; the run must shrink to a short op list and print it.
7. Pin the shrunk sequence as an ordinary test in `src/pair/tests.rs` with the operations written out.

Run: `cargo test -p novira-server pair::` (inside `src`) or `--test prop_pair` (integration file); deeper: `PROPTEST_CASES=4096 PROPTEST_SEED=<n>`. Whether `lan.rs` and `remote.rs` hold a similar state machine worth the same treatment is unconfirmed.

## 12. Model-based test of the queue with worker races (exists: `backend/crates/novira-core/tests/prop_queue_worker.rs` with `Gate` in `tests/backend_service/common.rs`; the design below is the pattern)

Needed when `service/queue.rs` or `worker.rs` changes. Status: `prop_queue.rs` pauses the worker, so start, finish, fail, cancel-running and restart are not explored; `tests/backend_service/` has example tests for each, and the race tests such as `tests/model_install_locked.rs` use `thread::spawn` without exploring orders. Transition rules to check are in [state-machines.md](state-machines.md).

Extend `prop_queue.rs` (or add `prop_queue_worker.rs` next to it, reusing `#[path = "backend_service/common.rs"] mod common;` as it does) with a worker that is under the test's control:

1. Engine: `FakeEngine` (in `common.rs`) has `block` (generate waits for cancellation), `reject`, and records `jobs`. Whether it can be made to finish or fail on command, per job, is unconfirmed: if it cannot, add a small field there (a `Mutex<Vec<Outcome>>` the test fills before resuming), keeping its default behaviour; this edits a shared test helper, so run all `backend_service` tests afterwards.
2. New ops: `Resume` (let the worker take the first pending item), `Finish`, `Fail`, CancelRunning, `Restart` (drop the `Backend` and `open` the same folder again, as `queue.rs` tests do for `state_survives_a_restart_and_unfinished_jobs_are_not_resumed_silently`), keeping `Pause`.
3. After each op, wait for the quiet state with `wait_until` or an event (no sleeps), then compare to the model.
4. Properties: at most one item is in progress; the worker takes the first pending only when not paused and none runs; a job stopped by cancel is `Canceled`, never `Failed`; a terminal status (`Completed`, `Failed`, `Canceled`) never changes except by retry creating a new item; after `Restart` no item is `InProgress` and former in-progress items are `Failed`; pending items stay pending and are not run until resumed; a failing job never loses a pending item behind it; events: one `QueueItemStatusChanged` per move.
5. Use `check_up_to(32, ...)` and short sequences; each case builds a runtime (cost is higher than the paused test).
6. Order exploration with deterministic scheduling (loom or shuttle) is a separate, missing technique and a new tool: confirm with the user before adding a dependency. The cheap alternative is to repeat the race tests: `cargo test -p novira-core --test <file> -- --test-threads=1` in a loop of 20 runs (a shell `for` with a bound), which finds rare failures without a new tool.
7. Fault check: make cancel of a running job set `Failed`; the run must fail with the op list.
8. A change to the worker is also confirmed on the real engine (`/verify-real-app`).

Run: `cargo test -p novira-core --test prop_queue` (or the new file); deeper: `PROPTEST_CASES=1024 PROPTEST_SEED=<n>`.

## 13. Coverage-guided fuzzing with cargo-fuzz (missing)

Needed when a reader of binary formats (`models/classify.rs` `parse_header`, `provenance/credentials`, `provenance/xmp`, `media/images`, the backup zip reader) must be searched far beyond what a 200-case mutation loop reaches. Status: not in the repository (no `fuzz/` folder, no workflow). `fuzz_inputs.rs` is the substitute: stable Rust, no coverage guidance.

Constraints (confirmed from the repository, the rest from the tool's documentation, unconfirmed here): `backend/rust-toolchain.toml` pins `stable`; cargo-fuzz needs a nightly toolchain and libFuzzer, and its sanitizer build is reliable on Linux and macOS but not on Windows (the project is developed on Windows). Proposed scope: Linux CI or WSL only, never run on the user's PC.

Do not start this without the user's confirmation (a new tool, a new CI job, a nightly toolchain, a `fuzz/` crate outside the workspace members glob `crates/*`). Once agreed:
1. `cargo install cargo-fuzz` (Linux/WSL), then in `backend/crates/novira-core/`: `cargo fuzz init` creates `fuzz/Cargo.toml` and `fuzz/fuzz_targets/`. Keep `fuzz` out of the workspace (`[workspace]` in its own manifest).
2. One target per reader: `fuzz_target!(|data: &[u8]| { let _ = novira_core::models::classify::parse_header(data); });` Use the same entry points as `fuzz_inputs.rs`; add the oracle there too (re-encoding gives the same record, no write outside a temp folder).
3. Seed the corpus from the samples `fuzz_inputs.rs` builds (write them to `fuzz/corpus/<target>/` once), so the search starts deep.
4. Run bounded: `cargo +nightly fuzz run <target> -- -max_total_time=300 -rss_limit_mb=2048`. A crash is saved under `fuzz/artifacts/<target>/`; copy the file to `tests/fixtures/` and pin it as an ordinary test in `fuzz_inputs.rs`'s neighbours.
5. Fault check: add an out-of-range index to the reader; the fuzzer must find it within the time limit and print the artifact path.
6. CI: a separate scheduled job on `ubuntu-latest` in `.github/workflows/` with a time limit (the workflows today are `test.yml`, `audit.yml`, `release.yml`; test.yml adds checks one at a time); confirm with the user first.
Until then, deeper searches use `NOVIRA_FUZZ_ITERATIONS=20000` (section 5).
