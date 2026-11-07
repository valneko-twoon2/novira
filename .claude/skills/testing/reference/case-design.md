# Choosing the cases (example-based unit tests)

Write the case table before the tests. The table is the plan and the evidence: no coverage tool measures equivalence classes, boundary values or condition pairs. Expected values come from the spec, a worked example or a hand calculation, never from running the code and copying its output (today's bug would become the expectation). If the spec says nothing about a case, leave it out of the tests and put it in the report as a question.

| Item | Technique | Cases (input -> expected, from the spec) | Test name |
|---|---|---|---|
| Upload limit "at most 10 MiB" | Boundary | 10 485 760 bytes -> stored; 10 485 761 -> refused "too large"; 0 -> refused "empty" | `accepts a file of exactly the limit and refuses one byte more` |

## 1. Equivalence classes and boundaries

- One representative of every valid class and every invalid class. A date field: a full date, a date with time, a leap day; empty, 31 April, letters, a two-digit year, an inner space.
- Every limit: the limit itself, one unit inside, one unit outside, and zero or empty. The unit is what the rule counts: one cent, one item, one byte, one millisecond.
- Check the unit. "512 bytes" is not 512 characters (171 of `あ` are 513 bytes in UTF-8). "10 items" counts items, not lines. A limit worded `at least`, `at most` or `up to` that the code writes with `>` or `<` is the bug these cases find most often.
- Time: local midnight, the clock change in and out of summer time, 29 February, month end, zones east and west of UTC, a clock that goes backwards. The frontend example is `frontend/src/state/dateFilter.test.ts`.
- Size and count: 0, 1, 2, the maximum, maximum + 1; a list of one; the same item twice.
- Pictures: the smallest and the largest accepted size and one beyond each (the example is `backend/crates/novira-core/tests/mutation_media.rs`).

## 2. Branches and conditions

- Every `if`, `match`, `?:` and early return, both ways. Every `catch` or `Err` arm, with a failure that can really happen.
- `a && b`, `a || b`: each part true and false at least once. For a check that guards data or security (a path, a URL, a size, a permission) add a pair of cases that differ only in that one part and must give different outcomes: that pair is what catches `&&` written as `||`.
- A refusal changes nothing. After a refused call, assert the whole object or store, not just the field that was refused (a setter that ran before the check is the usual bug).

## 3. Rules over several inputs, and states

- Two or more inputs decide together: [rules-over-options.md](rules-over-options.md) (decision table, pairwise, enumeration).
- A status or lifecycle: [state-machines.md](state-machines.md) (a table of statuses by events; one test for every cell a user can reach).
- Output that depends on many options (a graph, a prompt): representative cases plus a snapshot ([systems.md](systems.md), snapshots).

## 4. Hostile input

For every input that comes from outside (a person, a file, the network, another program, a downloaded model, the engine's reply) add these to the classes. The security meaning of each is in `.claude/rules/security.md`; the values are:

| Input | Values |
|---|---|
| Text | `""`, `" "`, tab, 100 000 characters, NUL, newline, right-to-left override `\u202e`, combining marks, emoji, a lone surrogate, mixed scripts |
| Paths and names | `..`, `../x`, `..\x`, `%2e%2e/x`, `C:\x`, `\\server\share`, `\\?\C:\x`, `CON`, `nul.txt`, trailing dot or space, `file.txt:stream`, 255 and 256 characters, names that differ only in case |
| Numbers | 0, -0, -1, 1, the type's maximum and minimum, maximum + 1, `NaN`, `Infinity`, `1e309`, `0.1 + 0.2`, a digit string longer than any integer |
| JSON | wrong type per field, a missing field, an unknown field, `null`, a duplicate key, 100 levels of nesting, 10 000 elements, a huge string |
| URL | `http://` where `https://` is required, `https://good.example.evil.example`, `https://good.example@evil.example`, an IP literal, `localhost`, `file:`, `javascript:` |
| Files | empty, cut short, a length field larger than the file, a good header followed by rubbish, a good file with extra bytes at the end, a huge declared size |
| Environment | disk full, permission denied, a file locked or deleted while in use, the network dropping half-way, two calls at once, a cancel half-way |

Aim paths such as `..` and `C:\x` only inside the test's own temporary folder, never at real data (`.claude/rules/security.md`).

## 5. Properties

Where the function has one of these shapes, a property (random inputs) says more than a few examples. How to write and run one is [randomized.md](randomized.md).

| Shape | Property |
|---|---|
| Encoder and decoder | a round trip is equal for every valid value; the decoder refuses every damaged value without crashing |
| Split, share out, round | the parts add up to the whole; each part is in its rounding range; ties follow the stated order |
| Sort, filter, search | the output is a permutation or subset of the input; it is ordered; applying it twice changes nothing; no matching item is lost |
| Two implementations | equal on every input (one is the oracle) |
| Validation | everything built from the valid grammar is accepted; changing one place of it is refused |
| Normalise, migrate | applying it twice equals applying it once; unknown fields survive |

A case a property found becomes an ordinary named test next to it.
