---
description: The two kinds of repository documents - the architecture map (docs/architecture/, short, read at the start) and the design pages (docs/design/, one current specification per feature) - what each holds, when to update it, and what scripts/tools/docs-check.mjs enforces
paths:
  - "docs/architecture/**"
  - "docs/design/**"
  - "scripts/tools/docs-check.mjs"
---

# The map and the design pages

Both say what is true now, in Japanese, with paths in backticks from the repository root so the machine can check they exist. Neither copies a value, a contract or a setting (name where it lives), keeps a "Last updated" line or tells history: git has that.

## 1. The map (`docs/architecture/`)

Five pages, read at the start of a task (the hooks `SessionStart` and `SubagentStart` put `README.md` in front of every session and subagent, `.claude/hooks/architecture-map.mjs`): `README.md` (how the parts fit, the source of truth, where to start; under 4500 characters), `01-frontend.md`, `02-backend.md`, `03-tooling.md`, `04-guards.md` (each under 9000 characters). The README comes last in a file list because the pages are numbered (the manual does the same). It holds only what a search of the code does not show; a list of files is what made the earlier, larger map go unread.

| In | Out |
|---|---|
| How the parts connect and in which direction | A list of a folder's files (`Glob` gives it) |
| Where the truth is for a value, a type, a setting | The value itself |
| Where to start for the usual changes | What a file does when its name says it |
| A folder whose name does not say what it is | A change inside a file |

| Changed | Page |
|---|---|
| A top-level folder, the flow between the parts, a source of truth, a "where to start" row | `README.md` |
| `frontend/src/` layers, a new `src/` or `features/` folder, registries, the mock | `01-frontend.md` |
| A crate, a `novira-core/src/` folder, the shell, data on disk, how a job runs | `02-backend.md` |
| A launcher, a script, a hook, a rule, a skill | `03-tooling.md` (a rule or skill also in `AGENTS.md`) |
| A guard and what it stops | `04-guards.md` |

Change it in the same commit as: a part added, removed or moved; a boundary or dependency direction changed; a "where to start" row no longer true. A page over its limit is cut first (file lists, a row per file); splitting it into a new page, or a new area that fits no page, is the user's decision (the guards table left `03-tooling.md` that way).

## 2. Design pages (`docs/design/`)

One page per feature: how it behaves, how it is built, its security boundaries, its known limits. Read the pages of the code you will change first: `node scripts/tools/docs-check.mjs --find <path>...` (none named: nothing to read). The pages sit in two folder levels, area then topic (`docs/design/<NN-area>/<NN-topic>/<NN-page>.md`); the numbers give the order, so a folder's `README.md` comes last. Every folder, `docs/design/` itself included, has a `README.md` that names everything directly in it (the page's one line, the folder's scope). `01-app/01-core/03-security.md` holds what every feature shares. A new page takes the next free number of its topic folder (never renumber the others); a new topic or area gets a folder, a README and a line in its parent's README.

```text
---
covers:
  - backend/crates/novira-core/src/service/queue.rs
  - backend/crates/novira-core/src/comfy/**
---
# Title
one paragraph: what the feature is for
## Behaviour          current spec, present tense, facts checked against the code
## Boundaries         a table: Boundary | Guard
## Known limits
## Not implemented    only what is really missing
```

`covers` is how a changed file finds its page (`dir/**` crosses folders, `*` does not); each entry must match a tracked file. A page over 9000 characters is split by feature, keeping a feature's frontend and backend together. A new feature gets a page and a line in its topic folder's README. Update the page in the same commit as a change that makes it untrue; a boundary change (IPC commands, capabilities, CSP, window config) needs its page in the commit.

## 3. What the machine checks

`scripts/tools/docs-check.mjs` (`tests/docs-check.test.ts`; `--git` in pre-commit) fails when a top-level folder, crate, `frontend/src/` or feature folder, `novira-core/src/` folder, launcher, rule or skill is named by no page (`AGENTS.md` for rules and skills); a backticked path or link points nowhere; a code name in backticks is in no code; a page is over its limit; a design page has no `covers` that matches; a design folder has no `README.md` or its README does not name something in the folder; a security boundary file is committed without a design page. It **warns** when a commit changes code a page covers without the page: re-read it and fix it if it no longer holds. It cannot tell whether a page says the right thing; read the paragraph around your change again.
