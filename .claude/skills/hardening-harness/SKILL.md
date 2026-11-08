---
name: hardening-harness
description: "Keeps the agent harness (hooks, Git hooks, checks, rules, skills, AGENTS.md) strong and small: turns a repeated mistake of an agent or of the user's workflow into a machine check that stops it (a Claude Code hook, a Git hook, a test or lint rule, and only last a rule's text), with its own test; writes or revises a skill by Anthropic's skill authoring practices with evaluations; and reviews the whole harness to merge, cut or refresh rules, skills and hooks. Use when the user says to enforce something or stop a mistake from happening again (ハーネス整備, 強制化, こういうミスが起きないように, 毎回言ってる), asks to make, write, improve or review a skill (スキルを作って), or asks to review the rules, skills and hooks."
argument-hint: "The mistake to stop (with an example), the skill to write, or \"review\""
user-invocable: true
disable-model-invocation: false
---

Three jobs: a guard for a repeated mistake (sections 1 to 6), a skill ([reference/skills.md](reference/skills.md)), a review of the whole harness (last section). AGENTS.md prefers a machine check over a rule written in prose. The list of what guards what today is `docs/architecture/04-guards.md`; read it first, since the guard may exist and only miss this case.

```
Harness progress:
- [ ] 1. Mistake reproduced, the moment it can be caught named
- [ ] 2. Guard chosen (table below)
- [ ] 3. Guard written, its test fails without it and passes with it
- [ ] 4. Registered (settings.json or Git hook, guards.md row)
- [ ] 5. Same loophole searched elsewhere
- [ ] 6. Checks run, committed, reported
```

## 1. Name the moment

Write the mistake as "who did what, when, with what result" from the evidence: the diff, the file left behind, or the session transcripts (`~/.claude/projects/<project folder>/*.jsonl`, one JSON object per line; search them with `grep` for the path or command, never read one whole). First check whether a guard should already have stopped it; if it did not fire, the fix is in that guard (its matcher, a subagent, a worktree path), not a new one. Then name the earliest moment it can be seen: before a tool call, after a tool call, at the end of a turn, at commit, in a test run, at app start-up. A guard that waits until the commit cannot stop a file written into the user's data.

## 2. Choose the guard

Take the first row that can see the mistake:

| Moment | Guard | Where |
|---|---|---|
| Before a write or a command | `PreToolUse` hook that refuses (exit 2, reason on stderr) | `.claude/hooks/`, e.g. `data-guard.mjs pre` |
| Right after a write or a command | `PostToolUse` hook that fixes (`eol.mjs`) or reports to the agent with exit 2 (`data-guard.mjs post`); it cannot undo what a script wrote | `.claude/hooks/` |
| End of a turn | `Stop` hook that sends the agent back once (it checks `stop_hook_active` so it never loops) | `.claude/hooks/commit-before-stop.mjs`, `worktrees.mjs` |
| A subagent starting | `SubagentStart` hook that adds context | `.claude/hooks/architecture-map.mjs` |
| A commit | `.githooks/pre-commit.mjs` or `commit-msg.mjs` | also stops a human or another tool |
| What the code is | A test (`frontend/tests/structure.test.ts`, `test-hygiene.test.ts`, `cargo test -p novira --test security`) or an ESLint rule (`frontend/scripts/eslint-*.mjs`) | runs in `npm run check` and CI |
| A harness script doing harm (leaving an exe, a lock, a folder) | The script cleans up in every case and refuses unsafe input | `scripts/tools/`, e.g. `verify-real-app.mjs`, `prune-stale.mjs` |

A rule's text (`.claude/rules/`, `AGENTS.md`) only when no row can see it; say in the report why.

A guard must not stop correct work: name the cases it lets through. Block when the decision is exact (a path inside a folder, a fixed pattern); remind once when it guesses (a word that may be innocent, a command it cannot fully parse).

## 3. Write it

1. Follow the hook next to it: a pure exported function holds the decision (`isProtected`, `pending`, `badEol`), and a thin `run` reads the hook input. Hooks are Node `.mjs`, LF, comments in English.
2. Messages say what was stopped and what to do instead, in English, one or two lines.
3. Test the decision function in `frontend/tests/claude-hooks.test.ts` (Git hooks: `commit-msg.test.ts`; tools: the tool's own test). One case the guard stops, one it lets through, and the boundary between them. Make the decision function allow everything once, run the test, see it fail, and restore it.

## 4. Register it

- A Claude Code hook: add it to `.claude/settings.json` under its event, with a `matcher`, a `timeout` and a `statusMessage`, in the style of the entries there.
- A Git hook: extend `.githooks/pre-commit.mjs` or `commit-msg.mjs` (the `sh` wrappers are already wired by `npm install`); a new hook file needs a wrapper like theirs.
- A row in `docs/architecture/04-guards.md` (extend the existing row of that guard when there is one).
- If a rule or skill said the same in prose, shorten it to a pointer to the guard.

## 5. Same loophole elsewhere

Look for the other ways to the same harm: the other tool (Bash and PowerShell, Write and Edit), worktrees (`worktrees.mjs` lists them), subagents, scripts that do the same by another path. Cover them in the same change or list them in the report.

## 6. Check and report

Run `npx vitest run tests/claude-hooks.test.ts` (or the guard's own test) and `npm run check:eol` in `frontend/`, and `node scripts/tools/docs-check.mjs`. Trigger the guard once for real when it is safe to and show its message: for a `PreToolUse` refusal, try the forbidden write with the Write tool on a new file name (refused, so nothing is written); for a Git hook, `git commit` a staged scratch change with the bad message and unstage it afterwards. Never trigger it on the user's real data. Report the mistake, the guard and its moment, what it lets through, the loopholes found and covered, and the commit.

## Reviewing the whole harness

1. **Use.** Count how often each skill and rule was used in the session transcripts (`~/.claude/projects/<project folder>/*.jsonl`): `"name":"Skill","input":{"skill":"<name>"` for skills, `<command-name>/<name>` for slash commands, the path `.claude/rules/<name>.md` for rules. A skill used about once in many sessions is a candidate to fold into a related one as a reference file.
2. **Overlap.** Rules with the same `paths` load together every time: merge them when they are about one subject. A rule only one skill needs goes into that skill. Two hooks for one concern with one shared helper become one file with a mode argument (`data-guard.mjs pre|post`). Rows repeated inside a page are cut.
3. **Prose without a guard.** For each sentence that demands or forbids something (in `AGENTS.md`, Japanese: 必ず, しない, 禁止, だけ, 〜こと; in `.claude/rules/`: always, never, must, only, do not), find its guard in `docs/architecture/04-guards.md`. List the ones with none, with a proposed guard from the table above, and ask the user which to build. A sentence a guard already enforces shrinks to a pointer.
4. **Stale.** Dates of measurements that no longer steer a decision, names of removed files (`docs-check` finds those in backticks), procedures that changed (read the scripts they name), and false alarms of the hooks that agents reported.
5. Fold, rename and delete in one change with every reference (`git grep` the old names across `.claude/`, `docs/`, `scripts/`, `frontend/`, `AGENTS.md`), then `node scripts/tools/docs-check.mjs`, the hooks' tests and `check-skill.mjs` on every skill.

Request: $ARGUMENTS
