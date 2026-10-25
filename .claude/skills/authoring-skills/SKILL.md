---
name: authoring-skills
description: "Create or revise a Claude Code skill (a SKILL.md under .claude/skills) following Anthropic's skill authoring best practices: a third-person description that says what and when, a concise body under 500 lines, the right degree of freedom, references one level deep, workflows with checklists and feedback loops, and evaluations run before and after. Use when the user asks to make, write, add, improve or review a skill, or to turn a repeated procedure into one."
argument-hint: "What the skill should do and when it should be used"
user-invocable: true
disable-model-invocation: false
---

Source: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices. This page keeps only what to do; read the source when a case is not covered here.

Copy this checklist and tick it as you go:

```
Skill progress:
- [ ] 1. Gap found and three evaluations written
- [ ] 2. Name and description
- [ ] 3. Body drafted (concise, right freedom, one-level references)
- [ ] 4. check-skill.mjs passes
- [ ] 5. Evaluations run in a fresh agent, skill revised
- [ ] 6. Registered in AGENTS.md and docs/architecture/tooling.md, docs-check passes
```

## 1. Find the gap first

Write the evaluations before the body, so the skill fixes real failures rather than imagined ones.

1. Look for what Claude gets wrong or has to be told again without the skill: past corrections in memory, rules in `.claude/rules/`, repeated steps in the conversation. If an existing skill or rule already covers it, change that one instead of adding a skill.
2. Write three scenarios in the scratchpad, each a request plus the behaviour expected:

```json
{
  "skills": ["<name>"],
  "query": "<a realistic user request>",
  "expected_behavior": ["<observable outcome 1>", "<observable outcome 2>"]
}
```

3. Note what a fresh agent does today without the skill (the baseline).

## 2. Name and description

`name`: at most 64 characters, lowercase letters, digits and hyphens, equal to the folder name, without `anthropic` or `claude`. Prefer the gerund form (`processing-pdfs`); avoid vague names (`helper`, `utils`, `data`).

`description`: at most 1024 characters, no XML tags, **third person** ("Checks…", not "I can…" or "You can…"). It is the only part loaded before the skill is chosen, so it says both what the skill does and when to use it, with the words the user would actually type (file types, commands, Japanese phrasings if the user writes Japanese).

Keep the frontmatter fields the other skills here use: `argument-hint`, `user-invocable`, `disable-model-invocation`. Skill files are written in English (AGENTS.md section 0).

## 3. The body

- **Concise.** Claude already knows general programming; write only what it would not know (this repository's paths, commands, traps, decisions). For each paragraph ask whether it earns its tokens.
- **Degree of freedom by fragility.** Many valid ways: give direction and heuristics. A preferred pattern: give a template or pseudocode. Fragile or ordered operations: give the exact command and say not to change it.
- **One default, not a menu.** Name one tool or way and an escape hatch for the exception.
- **Progressive disclosure.** Keep `SKILL.md` under 500 lines. Move detail into files next to it, named for their content (`reference/queue.md`, not `doc2.md`), each linked directly from `SKILL.md`; never a reference that links to another reference. Give a reference over 100 lines a table of contents at the top.
- **Workflows.** Number the steps of a multi-step task; for a long one, give a checklist to copy, as this page does.
- **Feedback loops.** Where quality matters, make a check step: run the validator, fix, run again, go on only when it passes. A deterministic check belongs in a script, not in prose.
- **Scripts.** Say whether to run a script or read it. Scripts handle their errors themselves and print messages that say how to fix the input; every constant has a reason in a comment. Do not assume a package is installed; say what is needed.
- **Examples** are concrete input/output pairs, not descriptions of style.
- **Terms**: one word for one thing throughout (match `docs/glossary.md`).
- **No dates that will go stale** ("before August use…"). Put superseded ways in an "Old patterns" section if they must stay.
- **Paths** with forward slashes. MCP tools by their full name (`server:tool`).
- Rules that must always hold go in `.claude/rules/` or a check; a skill holds the procedure and points at the rules instead of copying them.

## 4. Check the file

Run, and fix until it prints OK:

```bash
node .claude/skills/authoring-skills/scripts/check-skill.mjs .claude/skills/<name>
```

It checks the name, the description, the length, backslash paths, missing links and references more than one level deep. It cannot judge whether the text is right; step 5 does.

## 5. Evaluate and revise

1. For each scenario, give the query to a fresh subagent that has not seen this conversation and tell it to use the skill. Compare what it does with `expected_behavior` and with the baseline.
2. Watch how it uses the skill: files it never opens (cut them or link them better), files it reads every time (move the content into `SKILL.md`), rules it skips (make them more prominent).
3. Revise and run again until the three scenarios pass. If the skill will be used on Haiku, run at least one scenario on it: what is clear for Opus may be too thin there.
4. Report which scenarios passed, failed or were not run.

## 6. Register it

- Add the skill to the skill list in `AGENTS.md` (section 2) and to the skill table in `docs/architecture/tooling.md`.
- Run `node tools/docs-check.mjs` and, in `frontend/`, `npm run check:eol`.
- Commit the skill folder with the registrations.
