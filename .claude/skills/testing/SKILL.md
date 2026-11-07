---
name: testing
description: "Chooses, writes and checks tests in novira for every kind the project uses or still lacks: example cases (partitions, boundaries, branch and condition pairs, decision tables, state transitions of the queue, installs and packs); property, model-based, fuzz, differential, monkey and metamorphic tests; integration, contract, snapshot, E2E, visual, accessibility, crash-time, old-data, smoke, performance and audit tests; kinds not yet in the repository (race exploration, fault injection, soak, static analysis, pseudo-locale, flaky handling); coverage and cargo-mutants. Use when logic, a limit, validation, a parser, a status or a transition changes, a rule reads two or more inputs, tests seem weak, a test kind is missing, or the user asks which tests to write (テストケース, 境界値, 足りないテスト, カバレッジ, ミューテーション, テストが弱い)."
argument-hint: "What changed (a function, limit, status, rule or form) or which kind of test to add, and where it lives"
user-invocable: true
disable-model-invocation: false
---

What must hold (which tests to change, which to run, which hostile inputs to try) is in `.claude/rules/tests.md` and `.claude/rules/security.md`; read them first. This skill is how to choose the kind of test and the cases, write them, and check what they reach. `docs/tests/README.md` lists what the repository already has, by layer.

## 1. Read what exists

1. Open the tests next to the code (`*.test.ts(x)`, `*.property.test.ts`, `#[cfg(test)]` in the `.rs`) and the Rust integration tests of the same area (`backend/crates/novira-core/tests/`). Files named `*_edge_cases.rs`, `*_failures.rs` and `mutation_*.rs` show where earlier gaps were found.
2. List what the change touches: every input, limit, `if` or `match`, combined condition, status and rule. One line each, in the scratchpad or the report.

## 2. Pick the kind of test

Each row is a kind of test, what it finds, when the project needs it, and where the how-to is. "Status" is the state in the repository: yes (examples exist; copy their shape), partly (read the how-to for what is missing), no (the how-to is a recipe; adding it needs the user's confirmation, see section 6).

| Kind | Finds | Needed when the change | Status | How-to |
|---|---|---|---|---|
| Example unit | a wrong rule in one function | has logic | yes | [case-design.md](reference/case-design.md) |
| State transition | a move that should be refused is allowed, or the reverse | adds or changes a status or event | yes | [state-machines.md](reference/state-machines.md) |
| Decision table, pairwise | a fault that needs two inputs together | makes a rule read two or more inputs | yes | [rules-over-options.md](reference/rules-over-options.md) |
| Property | a failure on an input nobody wrote | parses, encodes, sorts, splits, validates | yes | [randomized.md](reference/randomized.md) |
| Model-based | a wrong state after a sequence of calls | changes a store, queue, cache or session | yes (queue and store, worker not running) | [randomized.md](reference/randomized.md) |
| Fuzz: bytes, commands, requests | a crash or hang after bad input passed the first check | reads a file, a command argument or an HTTP request | yes (command fuzz partly) | [randomized.md](reference/randomized.md) |
| Differential | the mock and the real backend disagree | changes `MockBackend` or a backend command | yes | [randomized.md](reference/randomized.md) |
| Metamorphic | a wrong result where no right answer is known | changes image processing, export, watermark or graph building | no | [randomized.md](reference/randomized.md) |
| Monkey | a crash after an operation order nobody tried | adds a screen | yes (mock only) | [randomized.md](reference/randomized.md) |
| Integration, contract, snapshot | wrong wiring, a drifted interface, an unintended change of a large output | touches storage, the engine, the wire types or a graph | yes | [systems.md](reference/systems.md) |
| E2E, cross-browser, visual, accessibility | a broken flow, an engine-specific bug, a changed look, a screen that cannot be used | adds or changes a screen | yes (visual and layout scan not in CI) | [systems.md](reference/systems.md) |
| Crash-time, old data, release smoke | half-written state, a new version that breaks old data, a broken build | writes in several steps, changes stored data, changes the build | partly (step-k tests for restore and data move only) | [systems.md](reference/systems.md) |
| Performance, audit | slowdown, a vulnerable dependency or leaked key | speeds up or adds a dependency | partly | [systems.md](reference/systems.md) |
| Mutation, coverage, hollow and flaky tests | tests that pass whatever the code does | wrote or changed tests | partly | [quality.md](reference/quality.md), [mutation.md](reference/mutation.md) |
| Race exploration, fault injection, soak, load | a failure that depends on timing, on a failing disk or network, or on time | changes the worker, the queue, a lock, an install or a listener | no | [gaps.md](reference/gaps.md) |
| Static analysis, supply chain, pseudo-locale, a11y beyond axe, flaky handling, Miri, installer, output regression | what the kinds above cannot see | the user asks, or a survey names it | no | [gaps.md](reference/gaps.md) |

A change usually needs several rows: a new limit is a boundary case and, if it reads outside data, a property and a hostile input. A change to the worker, to cancelling a running job, or to a pack or model install is not verified by these tests: confirm it on the real engine (`/verify-real-app`).

## 3. Pick the technique for each item

| Item | Technique | Cases to write |
|---|---|---|
| An input with classes (kind, mode, name form, empty or not) | Equivalence partitioning | One representative of each valid and each invalid class. Assert the outcome of the class |
| A number, size, length, count or time window with a limit | Boundary values | The minimum, one below it, the maximum, one above it, and zero or empty. For dates, the instant of local midnight (`src/state/dateFilter.test.ts`) |
| An `if` or `match` | Branch coverage | Both outcomes |
| A condition with `&&` or `\|\|` | Condition coverage | Each part true and false at least once. For a check that guards data or security (a path, a URL, a size), also a pair of cases that differ only in that part, where the outcome must change |
| Text or data from outside (paths, URLs, huge or empty values, control characters) | Error guessing, then property-based | Put the hostile values from `security.md` and [case-design.md](reference/case-design.md) into the cases. Random input with fast-check (`*.property.test.ts`, shared setup in `src/propertyTest.testkit.ts`) or proptest (`tests/prop_*.rs`) |
| Stages, statuses, a lifecycle | State transition table | [reference/state-machines.md](reference/state-machines.md) (the queue, model installs, packs) |
| Two or more inputs decide together | Decision table, pairwise, enumeration | [reference/rules-over-options.md](reference/rules-over-options.md) (guidance checks, graph checks, classification) |

Read a reference file when the change adds or changes a status, an event on a status, or a check that reads two or more inputs; when unsure, read it. A new status or event also updates the table and the rules in `reference/state-machines.md` in the same change.

## 4. Write the cases

1. Name each test after the behaviour, in English, in the style of its file. For limits, use the form that exists: "a picture exactly at the size limits is accepted and one more is refused" (`backend/crates/novira-core/tests/mutation_media.rs`).
2. Assert the outcome (a value, an error kind, a state, an event, a file), not a log line or an internal call. After a refusal also assert that nothing else changed.
3. Expected values come from the spec or a hand calculation, never from the code's current output.
4. One behaviour per test. Fakes only at the edges (clock, network, the engine, a temporary folder, a seeded random source); never fake the thing under test.
5. Deterministic and isolated: fixed seeds, no sleeps (wait for the event or the status, with a deadline), a bound on every loop, a temporary folder removed even on failure, no shared state between tests, and nothing that touches the user's data, accounts, keys or running `novira.exe`.
6. **See every new test fail once.** Break the line it guards (or apply the mutant it should kill), check it fails for the reason its name gives, and restore the line. Commit first so the break cannot lose work. For a limit it must fail if the operator is changed (Rust: mutation testing, section 5). A test that cannot fail is fixed or deleted.
7. Never weaken, skip or delete a failing test, lower a floor, or exclude a file to get a pass.
8. Run count and seed are fixed for the suite; for a deeper one-off run set `NOVIRA_PBT_RUNS` and `NOVIRA_PBT_SEED` (frontend) or `PROPTEST_CASES` (Rust) on the command line, and do not change the committed defaults.

### When a test finds a bug

1. Decide from the spec whether the test or the code is wrong; when the spec is unclear, ask.
2. Keep the failing test as the regression test. Fix the code if the task includes it and show the test passing; otherwise keep the test as `it.fails` with a `known bug:` comment (`docs/architecture/guards.md`) and say why in the report. Marking a property hides every other failure of it: pin the failing case as an example and mark that, and keep the property running on the inputs not involved.
3. Look for the same bug elsewhere: the same operator or pattern, sibling functions, the same rule's other limits, the other screens, models and locales. Report what you searched, how many you found and how many you fixed (`AGENTS.md` section 4).
4. Never change an expected value to match the code's output.

## 5. Check what the cases reach

Measured: frontend statements, branches, functions and lines (floors in `frontend/vitest.config.ts`); Rust lines, functions and regions (floor in `scripts/checks/coverage.bat`, CI uses the same). Not measured: condition coverage, MC/DC, Rust branches, equivalence classes, boundary values. For those, the case table in your report is the evidence.

1. Frontend, one file: `npx vitest run <test file> --coverage.enabled --coverage.include=<source file>` in `frontend/`, then read the Branches column. A threshold message at the end is expected for one file. Do not run the whole suite for this.
2. The whole picture: `scripts\checks\coverage.bat` (`frontend`, `backend` or `e2e` for one part) measures, then builds one graphical report of every part measured so far with ReportGenerator (`scripts/tools/coverage-report.mjs`, the tool pinned in `.config/dotnet-tools.json`; needs `dotnet`) and opens it: `logs/coverage/report/index.html`, grouped by folder, with uncovered lines marked in the source and a history of earlier runs. `scripts\checks\coverage.bat report` only rebuilds it. A run of the whole suite is a CI step, not part of `npm run check`; run it when the change is broad enough to move the floors, or when the user asks.
3. Whether the Rust cases catch real changes: mutation testing of one file after its tests were written or changed, [reference/mutation.md](reference/mutation.md) (slow: tell the user the file and a time estimate first). For the frontend, test harnesses mutation cannot reach, hollow tests and flaky tests: [reference/quality.md](reference/quality.md).

## 6. Adding a kind the project lacks

A kind marked "no" in section 2 is added only from its recipe in [gaps.md](reference/gaps.md) (or the "no" part of [randomized.md](reference/randomized.md) and [systems.md](reference/systems.md)), and only after the user agrees to what the recipe marks as needing confirmation: a new dependency or tool, a CI change, or a change to the code to give the test a seam (a stage hook, a switchable lock). Tell the user the kind, the files and the workflow it touches, and the effort, then proceed on a yes. Add one kind at a time, with its own test of the test (it fails when the fault is injected), its row in the layer page under `docs/tests/`, and its place in `affected.mjs` or CI as the recipe says. CI grows one check at a time, each after it is seen to pass on the runner (`docs/design/ci.md`). Formal methods (model checking, Kani, proofs) are on hold at the user's request; do not start them unasked.

## 7. Report

- For each item: the technique and the test names; the transition table with changed cells marked; the decision or pair table with a test per row.
- Items or cells with no case, and why (for example, condition coverage is not measured and was checked by hand only for the security check).
- The commands run and their results, and what was not run. Success, failure and not run stay apart.

Request: $ARGUMENTS
