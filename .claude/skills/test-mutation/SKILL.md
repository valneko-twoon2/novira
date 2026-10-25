---
name: test-mutation
description: "Checks that the Rust backend's tests notice real changes, using cargo-mutants through scripts/mutation.bat, one file at a time, and turns each missed mutant into a test or an exclusion with a reason. Use after writing or changing the tests of a novira-core module, when a module's tests seem weak, or the user asks for mutation testing (ミューテーション, テストが弱い)."
argument-hint: "The Rust file to check, for example crates/novira-core/src/settings.rs (relative to backend/)"
user-invocable: true
disable-model-invocation: false
---

What must hold is in `.claude/rules/regression-tests.md` (what to run) and `.claude/rules/test-maintenance.md` (never weaken a test to make it pass). The script is `scripts/mutation.bat`, its settings are `backend/.cargo/mutants.toml`, and the tooling page describes both (`docs/architecture/tooling.md`). These are the steps.

## 1. What it does and what it costs

- Mutation testing changes one thing at a time in a temporary copy of the code (an operator flipped, a function body replaced by a default), runs the novira-core tests, and records whether a test failed. A missed mutant is a change the tests did not notice.
- It is slow. The whole suite takes about 40 seconds and runs once per mutant, so one file takes minutes to hours and the whole crate about a day. It is not part of `check.bat` or CI, and it does not touch `novira.exe` or the GPU.
- Only the Rust side has it. `scripts\mutation.bat` takes `rust` only.

Run it when a module's tests were written or changed in a way that could leave a gap. Do not run it as a routine check for every change. Before starting, tell the user the file and a time estimate (mutants listed by `cargo mutants --list -f <file>` times about 40 seconds), so a long run is not a surprise.

## 2. Run one file

1. Pick one file under `backend/crates/novira-core/src/`. Start with the file you changed. Look at the `tests/mutation_*.rs` files for the area first; they show what was already found.
2. From the repository root run `scripts\mutation.bat rust -- -f crates\novira-core\src\<path>.rs`. It takes long, so start it in the background and read the result when it finishes.
3. Read the results in `novira-data\work\mutation\rust\mutants.out\`: `missed.txt`, `caught.txt`, `timeout.txt`, `unviable.txt`.

## 3. Handle each missed mutant

| Verdict | Action |
|---|---|
| A real behaviour is untested (a limit, a branch, an error path) | Add a test that fails under this mutant and passes on the real code. Name it after the rule, as the existing `mutation_*.rs` files do |
| The mutant changes no behaviour (it is equivalent to the code) | Leave it, and name it in the report with the reason |
| It needs a real process, the network, the GPU or a real engine | Exclude it in `backend/.cargo/mutants.toml`, with the reason in that file. Only after a run has shown it to be noise |
| A timeout | Look at it first. A loop that never ends is a real finding, in the code or in a test. Fix the cause, or exclude it with a reason |

Rules: never weaken or delete an existing test to make a mutant disappear. Each exclusion gets a reason in the TOML file.

## 4. Confirm

1. Run the same file again. The missed list should now be empty, or hold only the equivalent mutants you named.
2. Report per file: the counts of caught, missed, timeout and unviable mutants, the tests added, and the exclusions added with their reasons. Do not call a crate covered on the strength of one file.
