---
description: What the architecture map (docs/architecture/) holds and what it leaves to a search of the code; how big it may get (enforced by tools/docs-check.mjs)
paths:
  - "docs/architecture/**"
  - "tools/docs-check.mjs"
---

# Keeping the architecture map short and true

The map is read at the start of a task, so it holds only what a search of the code does not show, and it stays small enough to be read whole. Four pages: `README.md` (the entry: how the parts fit, the source of truth, where to start), `frontend.md`, `backend.md`, `tooling.md`.

Why it is this small (measured on 2026-10-11 over the last 40 sessions and their subagents): the earlier map had 28 pages, about 100 KB, one line per file. Of the sessions that touched source, the main session opened it before the source in 8 of 34, subagents in 1 of 177; it was mostly opened to be updated because the pre-commit check forced it. Files are found faster with a search, and a file list is a second copy that goes stale. What a search does not show was the part nobody read: how the parts connect, the source of truth, where to start. The entry page is put in front of the main session and of every subagent by the hooks `SessionStart` and `SubagentStart` (`.claude/hooks/architecture-map.mjs`), because the built-in Explore and Plan subagents do not read `AGENTS.md`.

## What goes in

| In | Out |
|---|---|
| How the parts connect and in which direction (layers, the contract, the flow of a job) | A list of the files of a folder: `Glob` and `grep` give it, and it goes stale |
| Where the truth is for a value, a type, a setting | A value, a contract or a setting copied from its source |
| Where to start for the usual changes (the "where to start" table in `README.md`) | What a file does when its name says it |
| A name that does not say what the folder is (`derive`, `finish`, `segment`) | A "Last updated" line: the date and the change are in git |
| The reason a boundary is where it is, in a line | A change inside a file |

A path is written in backticks from the repository root (`frontend/src/state/queue.ts`) so the machine can check it exists; a folder that has many alike files is named once with its role.

## Which page

| Changed | Page |
|---|---|
| A top-level folder, the flow between the parts, the source of truth for a value, a "where to start" row | `README.md` (read at the start of every task; under 7000 bytes) |
| `frontend/src/` layers, a new `frontend/src/` or `features/` folder, state registries, the mock | `frontend.md` |
| A crate, a `novira-core/src/` folder or shared file, the shell, data on disk, how a job runs, the kinds of backend tests | `backend.md` |
| A launcher or script, a guard, a hook, a rule, a skill | `tooling.md` (a rule or skill must also be in `AGENTS.md`) |

## When to change it

In the same commit as one of these: a part is added, removed or moved (a top-level folder, a crate, a layer, a feature folder, a `novira-core` module folder, a rule, a skill, a launcher); a boundary or the direction of a dependency changes; a "where to start" row stops being true. A new file in an existing folder, or a change inside a file, is not written down.

## Limits and what the machine checks

`tools/docs-check.mjs` fails when:

- a top-level folder, a crate, a `frontend/src/` folder, a feature folder, a `novira-core/src/` folder, a launcher, a rule or a skill is not named in its page (the entry page for the top-level folders, `frontend.md`, `backend.md`, `tooling.md`, and `AGENTS.md` for rules and skills);
- a path written in backticks, or a link, in a map page points at something that does not exist (fix the page; do not remove the check);
- `README.md` is over 7000 bytes, or another page over 14000. When a page is over, cut what a search shows; do not split the page into a tree of pages.

If a page grows past its limit, cut what a search of the code shows (file lists, a row per file); do not add pages. A new area that fits no page needs the user to decide: ask before adding a page.

Steps: `git diff --stat` to list what was added, moved or removed, and keep only what changes the map; edit the page in its style (English, paths in backticks from the repository root); remove mentions of what no longer exists; run `node tools/docs-check.mjs` and `npm run check:eol` in `frontend/`. The pre-commit hook runs `docs-check.mjs --git`, which also fails a change to a security boundary (IPC commands, capabilities, `tauri.conf.json`) committed without a design page (`docs-check.mjs --find <path>` names it).

It cannot tell whether a page says the right thing. When you change a page, read the paragraph around your change again and fix what is no longer true.
