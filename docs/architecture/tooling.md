# Tooling: launchers, checks and guards

How the project is started and checked, and where the rules and skills are; what each guard stops is [guards.md](guards.md). How to run the checks for a change: [../verification.md](../verification.md). Up: [README.md](README.md).

## Launchers and tools

`scripts/` holds what you run by hand: the Windows launchers (`.bat`); everyday ones at its top, long checks in `checks/`, the release in `release/`. `scripts/tools/` holds what AI sessions, the Git hooks and CI call. `.githooks/` holds the Git hooks: a thin `sh` file per hook and its body in Node. `.github/workflows/` runs the checks on a branch push ([ci.md](../design/ci.md)) and builds the release on a tag ([release-workflow.md](../design/release-workflow.md)).

| In `scripts/` | What |
|---|---|
| `start.bat` | Builds what changed, then opens `backend\target\debug\novira.exe` (`fast` skips it; `clean` cleans `frontend/dist` and the app crate first, `clean full` all of `backend/target`) |
| `dev.bat` | `cargo tauri dev`: Vite hot reload with the real backend |
| `server.bat` | Builds what changed (`ensure-frontend.mjs`), starts `novira-server` on `novira-data` with the engine and opens the browser (`fast` skips the build) |
| `check.bat` | All fast checks: `npm run check` plus `cargo fmt --check`, clippy with `-D warnings`, `cargo test` |
| `checks/full-check.bat` | All tests by hand: `check.bat`, `novira-server`, the mock against it (`diff-backends.mjs`), Playwright, layout scan (`full-check.mjs`) |
| `checks/coverage.bat`, `checks/mutation.bat` | Coverage, mutation testing |
| `checks/manual.bat` | The manual: mock-app screenshots, then `novira-data/work/manual/<language>/` |
| `release/package.bat` | Release build into `artifacts/`, then zip and `.sha256` (`package-release.mjs`); `build` skips the zip, for `release-smoke.mjs`; the release workflow runs the same steps |
| `release/set-version.bat` | Sets the one version in `Cargo.toml`, `package.json` and the lock files (`set-version.mjs`) |

| In `scripts/tools/` (and one spec) | What |
|---|---|
| `affected.mjs` | Only the checks the changed files need |
| `coverage-report.mjs` | One graphical coverage report of every part measured (ReportGenerator, pinned in `.config/dotnet-tools.json`) |
| `typecheck.mjs`, `commit-gates.mjs`, `docs-check.mjs`, `ui-refs.mjs`, `visual-baselines.mjs`, `check-eol.mjs`, `fix-eol.mjs`, `eol.mjs`, `check-name.mjs`, `changelog.mjs`, `ci-summary.mjs` | Whole-repository checks: types, the CI jobs a commit must pass (format, clippy, lint, backends, phone), the map, stale doc names, stale test ids and text keys, stale baselines, line ends, name spelling, the changelog, CI test counts |
| `layout-scan.mjs`, `e2e-lock.mjs` | The layout scan (with text fit) and its pass record; the lock for one heavy Playwright run at a time |
| `e2e/a11y.spec.ts` (`e2e/a11yKnown.ts`) | axe-core (WCAG A/AA, no contrast) on each main tab: fails beyond the known list, which only shrinks |
| `worktree.mjs` | Makes and removes a subagent worktree |
| `repeat-test.mjs` | Runs one command N times (default 20, `--parallel` for load) to catch a flaky or racy test; the first failure's output is kept in `logs/repeat-test/` |
| `prune-stale.mjs` | Deletes stale entries of `novira-data/work/` and `logs/` (below) |
| `prune-target.mjs` | Daily, before the Rust checks: `cargo clean --profile dev` past 50 GB, unless a program runs from it |
| `verify-real-app.mjs`, `models-live.mjs`, `gpu-check.mjs`, `harness-paths.mjs`, `harness-process.mjs`, `server-run.mjs` | The real app (or browser server), or one engine job, isolated (`docs/verification.md`); a worktree uses the main checkout's `novira-data/` and `logs/`; they stop when the GPU is busy. Shared: paths, the harness build (every screen in), processes, cargo |
| `models-sweep.mjs`, `models-sweep-app.mjs`, `models-sweep-lib.mjs` | Every installed model checked in the isolated app or (`--via server`) Chromium (`.claude/rules/models.md`) |
| `perf.mjs` (runs `perf-startup.mjs`, `backend/crates/novira-core/examples/backend_timing.rs`) | Speed of the backend, the frontend start and the real app's IPC, against a saved baseline |
| `fetch-trustmark.mjs`, `comfy-node-defs.mjs` | The watermark's pinned files, hash-checked; the saved node definitions of ComfyUI |
| `.githooks/` | `pre-commit` and `commit-msg` (sh wrappers, turned on by `npm install`) running `pre-commit.mjs` / `commit-msg.mjs` |
| `frontend/scripts/` | The scripts tied to the frontend: the local lint rules (`eslint-*.mjs`), text and manual checks, `shot.mjs`, `e2e-server.mjs` (the layout scan's cached build, `novira-data/work/e2e-build/`) |
| `.claude/hooks/`, `.claude/settings.json` | Claude Code hooks (below) |

### Stale output

What the harness makes lives directly inside `logs/` (the results a person reads) or `novira-data/work/` (everything else) of the main checkout ([../verification.md](../verification.md)). Stale means deleted: `prune-stale.mjs` removes an entry unused longer than its limit, counted from the `.last-used` marker the harness writes into it; in `logs/` it touches only the entries it knows; `--dry-run` only lists. Test: `tests/prune-stale.test.ts`.

## Rules and skills

Rules (`.claude/rules/`) say what must hold; Claude Code loads one when a file under its `paths` is touched. Skills (`.claude/skills/<name>/`) say how to do it and point back to their rule. `AGENTS.md` lists both for agents that do not load them on their own.

| Rule | About |
|---|---|
| `docs.md` | What the map and a design page hold, when to update them |
| `frontend.md`, `i18n.md`, `manual.md`, `assistant.md`, `comfyui.md`, `security.md` | The frontend's layers and look; screen text in every language; the manual; the AI assistant kept in step with features; pack settings; what to check at each boundary |
| `models.md`, `tests.md`, `commit-messages.md` | Model changes swept in the real app; tests change with behaviour and only affected ones run; a commit message |

| Skill | For |
|---|---|
| `i18n/`, `manual/` | Screen text, the manual (also catching up the other languages) |
| `gatekeeper/`, `verify-real-app/` | Taking a subagent's branch into main; running the real app in isolation |
| `testing/`, `hardening-harness/`, `release-notes/` | Test cases, coverage and mutants; a guard, a skill or a review of the harness; a release and its changelog |

## What guards what

The table of every guard and what it stops is its own page: [guards.md](guards.md).
