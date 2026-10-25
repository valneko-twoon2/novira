---
name: testing
description: "Chooses test cases for a change in novira: equivalence partitions, boundary values, branch and condition coverage, error guessing and property tests; state transition tests for the generation queue, model installs and packs; decision tables and pairwise combinations for rules that read several options. Use when a function, limit, validation, parser, status or transition is added or changed, a rule or form depends on two or more inputs, or the user asks which tests to write (テストケース, 境界値, どんなテスト)."
argument-hint: "What changed (a function, limit, status, rule or form) and where it lives"
user-invocable: true
disable-model-invocation: false
---

What must hold (which tests to change, which to run, which hostile inputs to try) is in `.claude/rules/test-maintenance.md`, `.claude/rules/regression-tests.md` and `.claude/rules/security.md`; read them first. This skill is only how to choose the cases. To check that Rust tests notice real changes, use `/test-mutation`.

## 1. Read what exists

1. Open the tests next to the code (`*.test.ts(x)`, `*.property.test.ts`, `#[cfg(test)]` in the `.rs`) and the Rust integration tests of the same area (`backend/crates/novira-core/tests/`). Files named `*_edge_cases.rs`, `*_failures.rs` and `mutation_*.rs` show where earlier gaps were found.
2. List what the change touches: every input, limit, `if` or `match`, combined condition, status and rule. One line each, in the scratchpad or the report.

## 2. Pick the technique for each item

| Item | Technique | Cases to write |
|---|---|---|
| An input with classes (kind, mode, name form, empty or not) | Equivalence partitioning | One representative of each valid and each invalid class. Assert the outcome of the class |
| A number, size, length, count or time window with a limit | Boundary values | The minimum, one below it, the maximum, one above it, and zero or empty. For dates, the instant of local midnight (`src/state/dateFilter.test.ts`) |
| An `if` or `match` | Branch coverage | Both outcomes |
| A condition with `&&` or `\|\|` | Condition coverage | Each part true and false at least once. For a check that guards data or security (a path, a URL, a size), also a pair of cases that differ only in that part, where the outcome must change |
| Text or data from outside (paths, URLs, huge or empty values, control characters) | Error guessing, then property-based | Put the hostile values from `security.md` into the cases. Random input with fast-check (`*.property.test.ts`, shared setup in `src/propertyTest.testkit.ts`) or proptest (`tests/prop_*.rs`) |
| Stages, statuses, a lifecycle | State transition table | [reference/state-machines.md](reference/state-machines.md) (the queue, model installs, packs) |
| Two or more inputs decide together | Decision table, pairwise, enumeration | [reference/rules-over-options.md](reference/rules-over-options.md) (guidance checks, graph checks, classification) |

Read a reference file when the change adds or changes a status, an event on a status, or a check that reads two or more inputs; when unsure, read it (each is short). A new status or event also updates the table and the rules in `reference/state-machines.md` in the same change.

## 3. Write the cases

1. Name each test after the behaviour, in English, in the style of its file. For limits, use the form that exists: "a picture exactly at the size limits is accepted and one more is refused" (`backend/crates/novira-core/tests/mutation_media.rs`).
2. Assert the outcome (a value, an error kind, a state, an event), not a log line or an internal call.
3. Check that a case would fail for the reason its name gives. For a limit, it must fail if the operator is changed (`/test-mutation` does this on Rust).
4. A known bug stays as an `it.fails` test with a `known bug:` comment (`docs/architecture/tooling.md`). Run count and seed are fixed for the suite; for a deeper one-off run set `NOVIRA_PBT_RUNS` and `NOVIRA_PBT_SEED` (frontend) or `PROPTEST_CASES` (Rust) on the command line, and do not change the committed defaults.

## 4. Check what the cases reach

Measured: frontend statements, branches, functions and lines (floors in `frontend/vitest.config.ts`); Rust lines, functions and regions (floor in `scripts\coverage.bat`, CI uses the same). Not measured: condition coverage, MC/DC, Rust branches, equivalence classes, boundary values. For those, the case table in your report is the evidence.

1. Frontend, one file: `npx vitest run <test file> --coverage.enabled --coverage.include=<source file>` in `frontend/`, then read the Branches column. A threshold message at the end is expected for one file. Do not run the whole suite for this.
2. Backend: `scripts\coverage.bat backend` gives lines. For whether cases catch real changes, use `/test-mutation`.
3. `npm run coverage` (the whole-suite floors) is a CI step, not part of `npm run check`; run it only when the change is broad enough to affect the floors.

## 5. Report

- For each item: the technique and the test names; the transition table with changed cells marked; the decision or pair table with a test per row.
- Items or cells with no case, and why (for example, condition coverage is not measured and was checked by hand only for the security check).
- The commands run and their results, and what was not run.

Request: $ARGUMENTS
