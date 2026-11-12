---
name: gatekeeper
description: "Checks a subagent's branch or worktree before it goes to develop: reads its report against the diff and checks the AGENTS.md rules on the diff, then hands the branch to /ship (pull request, agent review, CI, squash merge) and removes the worktree safely; also how to brief the subagent and make its worktree. Use before taking in a subagent's work, before handing work to a subagent in a worktree, or when the user says to take a subagent's branch in (取り込んで, マージして, main に入れて)."
argument-hint: "The branch or worktree to take in"
user-invocable: true
disable-model-invocation: false
---

A subagent's report says what it believes it did. This skill is the gate between that report and the pull request: nothing goes to `main` on the report alone. The rules it checks are in `AGENTS.md` and `.claude/rules/`; this page only orders the steps. The way into `main` is `/ship` (a pull request merged by `scripts/tools/pr.mjs`); a direct push of `main` is refused by branch protection.

For a merge, copy this and tick it as you go:

```
Merge progress:
- [ ] 1. Main tree clean; each report claim found in the diff
- [ ] 1. Rule table passed on the branch
- [ ] 2. Branch up to date with origin/develop, conflicts resolved, LF kept
- [ ] 3. Shipped (/ship): pull request reviewed, checks green, merged
- [ ] 4. Subagent's processes stopped, worktree removed by the script, node_modules intact
- [ ] 5. Report written
```

## 0. Briefing a subagent (before it starts)

- Give it the absolute path of the novira repository (or of its worktree); never run it in another folder such as ComfyUI.
- Put in the brief: the facts you already checked, the rules it must keep (comments and test names in English, line ends as `npm run check:eol` requires, commit only its own files, no push: the branch is pushed by /ship), and the first pages to read: `docs/architecture/README.md` plus `frontend.md` or `backend.md` for its area.
- Use the model and effort the user named for subagents, if they named one.
- Say "write the report in Japanese"; pass on to the user only the part that matters, rewritten in Japanese, never an English report as it came.

## 0.5 Making a worktree (for a subagent, or for yourself while the user's dev server watches the main tree)

1. The Agent tool's `isolation: "worktree"` can refuse with a path-case error on this machine (`e:` against `E:`). Make the worktree with `node scripts/tools/worktree.mjs add <name>` (a sibling folder `../novira-wt-<name>` on a new dated branch, `frontend/node_modules` linked) and give the subagent its absolute path. The hooks (`.claude/hooks/worktrees.mjs`) watch every worktree of the repository for line ends and uncommitted work.
2. The linked `node_modules` is the junction section 4 warns about: `git worktree remove` follows it and empties the main tree's `node_modules` (it happened once; `npm ci` in `frontend/` restores it). **Remove a worktree only with `node scripts/tools/worktree.mjs remove <path>`**: it unlinks first, removes the worktree, and deletes the branch when it is merged. The Stop hook asks for it for every finished worktree.
3. Playwright in a worktree needs its own port, or it reuses the main tree's server and tests the wrong code: `E2E_PORT=51xx npx playwright test ...`. Run a whole project under the e2e lock (`node scripts/tools/e2e-lock.mjs -- ...`); if many cases still time out together, rerun the failures with `--workers=2` before calling them failures.
4. `npx tsc -b` leaves `frontend/tsconfig.tsbuildinfo`; delete it before committing.

## 1. Before the merge (in the subagent's branch, read only)

1. `git status` in the main tree: own changes must be committed first, so the merge starts clean. `git log origin/develop..<branch> --oneline` and `git diff --stat origin/develop...<branch>`.
2. **Report against the diff.** For each claim of the report (a feature, a test, a doc, a file added) find it in the diff. A claim with nothing behind it, or a change the report does not mention, is sent back to the subagent (SendMessage) or fixed by you, and the report to the user says so.
3. **Rules on the diff**, by the table below. Anything that fails goes back; do not weaken a check to pass it.

| Check | How |
|---|---|
| Line ends | `npm run check:eol` (in the branch), `git diff --stat` shows no file changed on every line |
| Commit messages | Japanese, line 1 `<type>: ...` (feat, fix, docs, chore ...) at most 72 characters, no branch or tag names (`commit-messages.md`; the hook refuses the rest); only the subagent's own files |
| Comments and test names | English (AGENTS.md section 0) |
| Tests | Added or changed with the feature (`tests.md`); no `skip`, `only` or `#[ignore]` without a reason; no test file mixed over 500 lines |
| Texts | ja and en in the same change; a new area registered in `catalog.ts` (ja and en); `tests/i18n.test.ts` passes |
| Manual | A user-visible change has ja and en chapter text; `manual-pending.mjs add` was run; no shots were retaken |
| Map | A new top-level, crate, feature or module folder, rule or skill is named in the map (`docs-check`); a changed IPC or boundary has the design page of its feature (`docs-check --find`); a change to behaviour has its page updated (`docs/design/`) |
| Assistant | A feature the assistant should know: tool, description, handler (`assistant.md`); a tool that reads pictures or prompts is read-gated on both sides |
| Same kind elsewhere | A fix says where it looked for the same kind of fault (other screens, model categories, the ja and en texts) and how many it found and fixed; a fix without that goes back |
| Secrets and data | No `novira-data/`, `out/`, `data/`, `outputs/`, `config.json`, keys in the diff |

## 2. Bring the branch up to date

1. `git fetch origin`; when `develop` moved and the branch touches the same files, bring it up to date: `git rebase origin/develop` only before the branch's first push, `git merge origin/develop` once it is pushed (a rebase of a pushed branch needs `--force`, which is not allowed; the squash merge keeps `develop`'s history clean anyway). Conflicts: keep both sides unless one is clearly replaced. Typical ones and what to do:
   - i18n catalogs (`agent.json` and others): both sides append keys at the end; keep both and add the comma to the older last line; `JSON.parse` the file after.
   - Map pages and the manual: keep both sides' rows; recheck `docs-check`.
2. Write edit scripts so that they keep LF (or use the Edit tool); check `git diff --stat` for files changed on every line.
3. After conflicts, run what both sides touched locally (`tests.md`), typecheck and lint; CI runs the rest on the pull request.

## 3. Ship

Run `/ship` for the branch: it opens the pull request, has a fresh agent review it on GitHub, waits for CI and merges. A failure that is also on a clean `main` is reported as existing, with the evidence; any other failure is fixed on the branch first. A change that touches the engine, the queue, the GPU, models or packs is not verified until `/verify-real-app` ran, or the report says it was not.

## 4. Clean up

1. Stop what the subagent left running (its dev servers, polling shells, a stray `ollama` it started). Never the user's `novira.exe` or ComfyUI.
2. **A worktree holds junctions** (`node_modules`) that point into the main tree, and `git worktree remove` can follow them and delete the main tree's contents. Remove it only with `node scripts/tools/worktree.mjs remove <path>` (it unlinks first and deletes the branch when merged into main or by its pull request; an unmerged branch is never deleted with `-D`: ask). After this, `ls frontend/node_modules` in the main tree must still list packages.
3. If the folder is still held by a process, find it (`Get-CimInstance Win32_Process` by command line), stop only the subagent's own, then remove.

## 5. Report

The branch, its pull request and merge commit; claims of the subagent that the diff did not support; what was sent back; the checks run (local and CI) and their results; existing failures with their evidence; what was not verified (and why); what was cleaned up.

Request: $ARGUMENTS
