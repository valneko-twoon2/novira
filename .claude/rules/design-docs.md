---
description: What a design page (docs/design/, one per feature) holds, how to find the page of the code you change, and when to update it (enforced by tools/docs-check.mjs)
paths:
  - "docs/design/**"
  - "tools/docs-check.mjs"
---

# Design pages: the current specification, one per feature

`docs/design/` holds what each feature does now: how it behaves, how it is built, which security boundaries it has, what its known limits are. It is the specification to read before changing a feature and to correct after changing it. It is not read at the start of every task (that is the map, `docs/architecture/`), and it does not say why a decision was made (git history keeps that): it says what is true now.

## Read before changing

Before changing code, run `node tools/docs-check.mjs --find <path>...` for the files you will change and read the pages it names. If none covers a path, nothing needs reading. The index is `docs/design/README.md`; `security.md` holds what is common to every feature (what is at stake, the shared principles, the known limits that span features, how to re-check).

## A page

```text
---
covers:
  - backend/crates/novira-core/src/service/queue.rs
  - backend/crates/novira-core/src/comfy/**
---
# Title
one paragraph: what the feature is for
## Behaviour          current spec, present tense, facts
## Boundaries         the security boundaries of this feature (a table: Boundary | Guard)
## Known limits
## Not implemented    only what is really missing
```

- `covers` is the code the page describes: files, folders, or globs (`dir/**` crosses folders, `*` does not). It is how a changed file finds its page, so keep it exact; each entry must match a tracked file.
- English. Paths in backticks from the repository root so the machine can check they exist. No "Last updated" line: git has the history.
- Write what the code does, checked against the code; never what is planned. A value, a contract or a setting is not copied here: name where it lives.
- One feature per page. A page over 14000 bytes is split by feature, not by frontend and backend: the frontend and backend halves of a feature belong on the same page. A new feature gets a page and a line in `docs/design/README.md`.

## Update

In the same commit as a change that makes a page untrue: behaviour, a boundary, a limit, a new or removed part of the feature. A boundary change (IPC commands, capabilities, CSP, window config) needs a design page in the commit, and the security row of the feature moves with it. A change inside a function that leaves the page true needs nothing.

## What the machine checks

`tools/docs-check.mjs` fails when a page has no `covers` or one that matches no file, when a page is not in `docs/design/README.md`, when a path or link it writes does not exist, when a code name it writes in backticks (camelCase, snake_case, UPPER_SNAKE: a removed component or constant) is in no code of the repository, when a page is over its limit, and when a boundary file is committed with no design page. It **warns** (in pre-commit, without failing) when a commit changes code that a page covers and the page is not in the commit: re-read the page and fix it if it no longer holds. It cannot tell whether a page is true.
