---
name: gatekeeper
description: "Checks and merges a subagent's branch or worktree into main: reads its report against the diff, checks the AGENTS.md rules on the diff, merges, re-runs the checks on the merged result, pushes main and removes the worktree safely; also how to brief the subagent and make its worktree. Use before every merge of a subagent's work, before handing work to a subagent in a worktree, or when the user says to take a branch in (取り込んで, マージして, main に入れて)."
argument-hint: "The branch or worktree to take in"
user-invocable: true
disable-model-invocation: false
---

A subagent's report says what it believes it did. This skill is the gate between that report and `main`: nothing is merged on the report alone. The rules it checks are in `AGENTS.md` and `.claude/rules/`; this page only orders the steps. Push only `main`, after the merge (section 4).

For a merge, copy this and tick it as you go:

```
Merge progress:
- [ ] 1. Main tree clean; each report claim found in the diff
- [ ] 1. Rule table passed on the branch
- [ ] 2. Merged with --no-ff, conflicts resolved, LF kept
- [ ] 3. Checks re-run on the merged result
- [ ] 4. Subagent's processes stopped, worktree removed by the script, node_modules intact, main pushed
- [ ] 5. Report written
```

## 0. Briefing a subagent (before it starts)

- Give it the absolute path of the novira repository (or of its worktree); never run it in another folder such as ComfyUI.
- Put in the brief: the facts you already checked, the rules it must keep (comments and test names in English, line ends as `npm run check:eol` requires, commit only its own files, no push), and the first pages to read: `docs/architecture/README.md` plus `frontend.md` or `backend.md` for its area.
- Use the model and effort the user named for subagents, if they named one.
- Say "write the report in Japanese"; pass on to the user only the part that matters, rewritten in Japanese, never an English report as it came.

## 0.5 Making a worktree (for a subagent, or for yourself while the user's dev server watches the main tree)

1. The Agent tool's `isolation: "worktree"` can refuse with a path-case error on this machine (`e:` against `E:`). Make the worktree with `node tools/worktree.mjs add <name>` (a sibling folder `../novira-wt-<name>` on a new dated branch, `frontend/node_modules` linked) and give the subagent its absolute path. The hooks (`.claude/hooks/worktrees.mjs`) watch every worktree of the repository for line ends and uncommitted work.
2. The linked `node_modules` is the junction section 4 warns about: `git worktree remove` follows it and empties the main tree's `node_modules` (it happened once; `npm ci` in `frontend/` restores it). **Remove a worktree only with `node tools/worktree.mjs remove <path>`**: it unlinks first, removes the worktree, and deletes the branch when it is merged. The Stop hook asks for it for every finished worktree.
3. Playwright in a worktree needs its own port, or it reuses the main tree's server and tests the wrong code: `E2E_PORT=51xx npx playwright test ...`. Run a whole project under the e2e lock (`node tools/e2e-lock.mjs -- ...`); if many cases still time out together, rerun the failures with `--workers=2` before calling them failures.
4. `npx tsc -b` leaves `frontend/tsconfig.tsbuildinfo`; delete it before committing.

## 1. Before the merge (in the subagent's branch, read only)

1. `git status` in the main tree: own changes must be committed first, so the merge starts clean. `git log main..<branch> --oneline` and `git diff --stat main...<branch>`.
2. **Report against the diff.** For each claim of the report (a feature, a test, a doc, a file added) find it in the diff. A claim with nothing behind it, or a change the report does not mention, is sent back to the subagent (SendMessage) or fixed by you, and the report to the user says so.
3. **Rules on the diff**, by the table below. Anything that fails goes back; do not weaken a check to pass it.

| Check | How |
|---|---|
| Line ends | `npm run check:eol` (in the branch), `git diff --stat` shows no file changed on every line |
| Commit messages | Japanese, line 1 `<type>: ...` (feat, fix, docs, chore ...) at most 72 characters, no branch or tag names (`commit-messages.md`; the hook refuses the rest); only the subagent's own files |
| Comments and test names | English (AGENTS.md section 0) |
| Tests | Added or changed with the feature (`test-maintenance.md`); no `skip`, `only` or `#[ignore]` without a reason; no test file mixed over 500 lines |
| Texts | ja and en in the same change; a new area registered in `catalog.ts` (ja and en); `tests/i18n.test.ts` passes |
| Manual | A user-visible change has ja and en chapter text; `manual-pending.mjs add` was run; no shots were retaken |
| Map | A new top-level, crate, feature or module folder, rule or skill is named in the map (`docs-check`); a changed IPC or boundary has the design page of its feature (`docs-check --find`); a change to behaviour has its page updated (`docs/design/`) |
| Assistant | A feature the assistant should know: tool, description, handler (`assistant.md`); a tool that reads pictures or prompts is read-gated on both sides |
| Same kind elsewhere | A fix says where it looked for the same kind of fault (other screens, model categories, the ja and en texts) and how many it found and fixed; a fix without that goes back |
| Secrets and data | No `novira-data/`, `out/`, `data/`, `outputs/`, `config.json`, keys in the diff |

## 2. Merge

1. `git merge --no-ff <branch> -m "<type>: <何を取り込むか>"`, for example `feat: 画面状態のライブ同期を取り込む` (Japanese, the type of what came in; it names what came in, not the branch).
2. Conflicts: keep both sides unless one is clearly replaced. Typical ones and what to do:
   - i18n catalogs (`agent.json` and others): both sides append keys at the end; keep both and add the comma to the older last line; `JSON.parse` the file after.
   - Map pages and the manual: keep both sides' rows; recheck `docs-check`.
3. Write edit scripts so that they keep LF (or use the Edit tool); check `git diff --stat` for files changed on every line.

## 3. After the merge (the merged result, not the branch)

1. Run what the merged files affect (`regression-tests.md`); after conflicts, the full set of the areas both sides touched (the reason goes in the report). Typecheck and lint always.
2. A failure that is also on a clean `main` is reported as existing, with the evidence (run it on `main`); any other failure is fixed before the report.
3. A change that touches the engine, the queue, the GPU, models or packs is not verified until `/verify-real-app` ran, or the report says it was not.

## 4. Clean up

1. Stop what the subagent left running (its dev servers, polling shells, a stray `ollama` it started). Never the user's `novira.exe` or ComfyUI.
2. **A worktree holds junctions** (`node_modules`) that point into the main tree, and `git worktree remove` can follow them and delete the main tree's contents. Remove it only with `node tools/worktree.mjs remove <path>` (it unlinks first and deletes the branch when merged; an unmerged branch is never deleted with `-D`: ask). After this, `ls frontend/node_modules` in the main tree must still list packages.
3. If the folder is still held by a process, find it (`Get-CimInstance Win32_Process` by command line), stop only the subagent's own, then remove.
4. Push `main` (`git push origin main`): the user allows a push of `main` after each merge into it (AGENTS.md section 3). Never `--force`, never another branch.

## 5. Report

The branch, the merge commit and whether it was pushed; claims of the subagent that the diff did not support; what was sent back; the commands run on the merged result and their results; existing failures with their evidence; what was not verified (and why); what was cleaned up.

Request: $ARGUMENTS
