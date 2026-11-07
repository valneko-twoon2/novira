# Proving that tests are good

A test that passes proves nothing until you know it would fail on wrong code. This page is how to find out in novira: mutation testing, fault injection for the test harnesses a mutation tool cannot reach, the signs of a hollow test, flaky tests, and how to read the coverage report. It extends `SKILL.md` section 4. What each existing technique checks is in [docs/test-techniques.md](../../../../docs/test-techniques.md).

Rules for everything below: never weaken, skip or delete a test to make a result pass, never lower a coverage floor, never exclude a file from coverage, never commit a fault you injected, and write the result per file in the report. One file's result says nothing about the others.

## 1. Mutation testing

### Rust

Use cargo-mutants through `scripts\checks\mutation.bat`. The procedure, the verdict table, the exclusion rule and the known limit of `delete field` mutants are in [mutation.md](mutation.md); do not repeat them here. Tell the user the file and a time estimate before starting. The `tests/mutation_*.rs` files in `backend/crates/novira-core/tests/` show the gaps found so far.

### Frontend: the gap

There is no mutation tool for the frontend. A frontend test that asserts little is found by reading it (section 3) and by fault injection (section 2), not by a score.

To try one, Stryker is the usual tool for TypeScript. Do this only with the user's OK, and on one file:

1. Work in a worktree made with `node scripts/tools/worktree.mjs add <name>`, so no `package.json` or lockfile change touches the user's checkout. The tool is a dev dependency and changes `frontend/package.json`; do not commit that unless the user decides to adopt it.
2. Install `@stryker-mutator/core` and the vitest runner plugin `@stryker-mutator/vitest-runner` in `frontend/`. The runner reads `frontend/vitest.config.ts`, so the alias and the icon-package optimizer settings apply.
3. Point it at one source file (`mutate`) and run only that file's tests (the runner's `related` or a `--testFiles` list). A whole-app run is far too slow.
4. Estimate the time first: mutants times the time of that file's tests. Run it in the background.
5. Handle survivors with the table in `mutation.md` section 3. An equivalent mutant is named in the report with its reason.
6. Report the counts and that the tool is not part of the repository. Remove the install in the worktree when done (`node scripts/tools/worktree.mjs remove <path>`).

The repository's no-prettier convention is irrelevant here: Stryker works on a temporary copy and never formats the source.

## 2. Fault injection

Mutation tools change operators and bodies of source files. They do not reach the test machinery itself: a fuzz loop, the monkey spec, the differential run, a crash-stage test, a lint rule, a guard script. A harness that has never failed has not been shown to be able to fail. Prove it once per new harness, and again when you change how it checks.

1. Commit or stash your own work first (the repository rules want a clean point to return to). Do the injection in a worktree (`node scripts/tools/worktree.mjs add <name>`), not in the checkout the user's dev server watches.
2. Put the fault where the harness surely passes through it:
   - fuzz and property tests: make the reader or handler panic, return the wrong value or skip a write for every input, or only for an input shape the generator makes (a length field set to its edge value, an empty list);
   - monkey: make a component throw on a click of a control that every screen has, so the error boundary shows;
   - differential: change one answer of the mock (`frontend/src/backend/mock/MockBackend.ts`) or of the service, and see the difference reported;
   - crash and rollback tests: remove the rollback step or the temp-file cleanup, and see the stage test fail;
   - a lint rule or guard script: write the forbidden code on purpose (a `.only`, an import against the layer direction) and see the run stop.
3. Make sure the fault fires. A fault on a path the run does not take proves nothing: add a log line or a counter, or run the harness with its trace option (`NOVIRA_MONKEY_TRACE=1`) and see the faulty step happen. A component that throws only when it re-renders is never reached if nothing re-renders.
4. Run the harness. It must fail, and the failure must say where: the seed and the actions before it (monkey, `NOVIRA_MONKEY_SEED`), the seed and the saved input (`NOVIRA_FUZZ_SEED`, `logs/fuzz/`), the first step that differs (`NOVIRA_DIFF_SEED`), the stage, the property and the shrunk input (proptest, fast-check with `NOVIRA_PBT_SEED`). A failure that says only "failed" is a finding too: improve the message.
5. Replay the printed seed once and see the same failure. A seed that does not reproduce is a bug in the harness.
6. Revert the fault (`git checkout -- <file>` or remove the worktree) and run the harness again; it passes. Never commit the fault, and do not leave the saved inputs of the run in the repository (`logs/` is ignored).

A new guard follows the same method: make it fail once on purpose and see the run stop. A new coverage floor is proved by running a smaller part of the suite and seeing the threshold message (expected, see `SKILL.md` section 4).

## 3. Hollow tests

These pass when the code is wrong. When you find one, fix it and put the count in the report.

| Sign | Why it is hollow | Instead |
|---|---|---|
| Only toBeDefined(), `toBeTruthy()`, `not.toBeNull()` or a loose range | Almost any wrong value passes | The exact value from the spec |
| toThrow() with no type or message; Rust `is_err()` where the error kind matters | A typo or another failure passes as the expected refusal | The error kind or a part of the message |
| The expected value computed by the code under test or copied from its output | Today's bug becomes the expectation | A hand-computed value or a spec example |
| Only toHaveBeenCalled() on a mock, no check of the result | The result may be wrong | Assert the result; mock only the edge (network, clock) |
| An `if`, a `try`/`catch` that swallows, or a loop inside a test | The assertion may never run | A straight test; assert the number of iterations |
| A loop over cases that may be empty | Zero cases means zero assertions | Assert the case count first |
| `vi.useFakeTimers` or a stub that returns what the test then asserts | The test checks the stub | Assert what the code did with it |
| A whole-output snapshot updated with `-u` without reading the diff | Records whatever the code does | A snapshot of chosen output; read every diff (`docs/verification.md`) |
| A fixed `sleep` or `waitForTimeout` | Slow, and flaky under load | Wait for the event or the state with `expect(...).toPass()`, `expect.poll` or a Playwright web-first assertion |
| A proptest or fast-check property whose generator only makes easy shapes | The property holds on a corner of the input space | Check what the generator produces; add the edge shapes by hand |
| `it.fails` without a `known bug:` comment | A skipped check with no owner | The comment names the bug; fix the app and remove the marker when it passes |
| A function body replaced by a default still passes | Nothing is asserted about its result | Mutation testing shows it (Rust); on the frontend, inject the fault by hand |

The repository already stops some of these: `frontend/scripts/eslint-test-hygiene.mjs` (committed `.only`), `frontend/tests/test-hygiene.test.ts` (`#[ignore]` outside live tests, orphan snapshots), `frontend/tests/structure.test.ts`. They do not catch an empty assertion or a hollow expected value, so read the test.

## 4. Flaky tests

A new test, or a test you changed, is run many times and once under load before it counts as stable.

| Where | Repeat |
|---|---|
| vitest | `npx vitest run <file> --repeats 10` runs every test 10 times. `--sequence.shuffle` with `--sequence.seed <n>` finds a test that depends on another one's order |
| Playwright | `npx playwright test e2e/<spec> --project=chromium --repeat-each=10`; add `--workers=<n>` to change the load, never more than 6 |
| Rust | `cargo test` has no repeat flag: loop the command in the shell, or run with `-- --test-threads=1` and with the default to see a shared-state problem |

Under load: run the repeat while another heavy job runs (a second Playwright project, `cargo test` of another crate), or lower the worker count. A test that fails only under load waits for time instead of a condition, or shares state (a port, a file, a global store). `backend/crates/novira-core/tests/rename_retry_exhausted.rs` records a timeout on a busy machine.

Before you call a test flaky, rerun on a quiet machine and do not let a heavy run overlap (the e2e lock, `node scripts/tools/e2e-lock.mjs -- <command>`). Cases that time out together are rerun with `--workers=2` first (`.claude/rules/tests.md`).

Causes to look for: real time and dates, order between tests, shared files or globals, the real network, a promise or thread not awaited, a port in use, an unseeded random, a resource not cleaned up. The tests here use a fake ComfyUI and a fake website (`backend/crates/novira-core/tests/comfy_fake_server/`, `backend/crates/novira-core/tests/fake_site/`) and fixed seeds, so a flake is almost always a wait or a shared resource, not the engine.

Retries hide flakiness. `frontend/playwright.config.ts` sets one retry on CI and none locally, and the `layout` project always one. A case that passes on its retry is a flaky case: it shows in the Playwright report and in the CI summary, so read it, and do not add retries to cover a test. Wait for events and states, not for sleeps.

## 5. Measuring coverage

The commands and what is measured are in `SKILL.md` section 4 (one file with `--coverage.include`, the whole picture with `scripts\checks\coverage.bat`); this section is how to read the result.

1. Open `logs/coverage/report/index.html` (ReportGenerator). It groups by folder and marks uncovered lines in the source. Read the table per file, not the total: a total hides a new untested file behind old tested ones.
2. Rank the gaps. Sort the files by uncovered branches or lines (the frontend writes a JSON summary per file next to the report, in `logs/coverage/frontend/`). Start with the files that hold a limit, a validation, a parser, a status or a security check; leave pure layout and glue for last.
3. For each uncovered line ask what behaviour it is. A branch for an error path is a missing failure test. A branch for a state is a missing transition case. Code no test and no flow can reach is dead code: delete it.
4. Write the test for the behaviour, not for the line. A line executed by a test with no assertion is covered and still untested (section 3).
5. Read the combined figure with care: it adds the Playwright lines to the unit lines and the two tools count lines a little differently, so it is approximate.

Not measured, so evidence for it is the case table in the report: conditions and MC/DC, Rust branches, equivalence classes, boundary values, anything a test reaches only through a real engine or the window. Coverage says what ran, not what was checked. For that use sections 1 to 3.

Never lower a floor in `frontend/vitest.config.ts` or `scripts/checks/coverage.bat`, never add a file to an exclude list to pass, and raise a floor when the numbers rise. A drop is a finding: find the change that caused it.
