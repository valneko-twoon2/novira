# Tooling: launchers, checks and guards

How the project is started, checked and guarded, and which file guards what. How to run the checks for a change: [../verification.md](../verification.md). Up: [README.md](README.md).

## Launchers and tools

`scripts/` holds what you run by hand: the Windows launchers (`.bat`). `tools/` holds what AI sessions, the Git hooks and CI call, and the parts they share. `.githooks/` holds the Git hooks: a thin `sh` file per hook and its body in Node.

| In `scripts/` | What |
|---|---|
| `start.bat` | Builds what changed, then opens `backend\target\debug\novira.exe` (`fast` skips it) |
| `rebuild.bat` | Clean rebuild: fresh `frontend/dist`, `cargo clean -p novira` (drops Tauri's cached screens), build, open (`full` cleans all of `backend/target`) |
| `dev.bat` | `cargo tauri dev`: Vite hot reload with the real backend |
| `server.bat` | Builds, starts `novira-server` on `novira-data` with the engine and opens the browser (`fast` skips the build) |
| `release.bat` | A release build into `artifacts/`: the app, `novira-server.exe`, `dist/` and a `server.bat` it writes |
| `check.bat` | All fast checks: `npm run check` plus `cargo fmt --check`, clippy with `-D warnings`, `cargo test` |
| `coverage.bat`, `mutation.bat` | Coverage and mutation testing; reports in `novira-data/work/`, no source changes |
| `version.bat` | Sets the one version in `Cargo.toml`, `package.json` and the lock files (`tools/set-version.mjs`) |
| `manual.bat` | The user manual: screenshots of every language from the mock app, then `novira-data/work/manual/<language>/` |

| Elsewhere | What |
|---|---|
| `tools/affected.mjs` | Only the checks the changed files need, run |
| `tools/typecheck.mjs`, `tools/docs-check.mjs`, `tools/ui-refs.mjs`, `tools/visual-baselines.mjs`, `tools/check-eol.mjs`, `tools/fix-eol.mjs`, `tools/eol.mjs`, `tools/check-name.mjs` | Whole-repository checks: types, the map, stale doc code names, stale test ids and text keys, stale baselines, line ends, name spelling |
| `tools/layout-scan.mjs`, `tools/e2e-lock.mjs` | The layout scan (with text fit) and its pass record; the lock for one heavy Playwright run at a time |
| `tools/worktree.mjs` | Makes and removes a subagent worktree |
| `tools/prune-stale.mjs` | Deletes stale `novira-data/work/` entries (below) |
| `tools/verify-real-app.mjs`, `tools/models-live.mjs`, `tools/gpu-check.mjs`, `tools/harness-paths.mjs`, `tools/harness-process.mjs`, `tools/server-run.mjs` | The real app (or browser server), or one engine job, isolated (`docs/verification.md`); a worktree uses the main checkout's `novira-data/`; they stop when the GPU is busy. Shared: paths, the harness build (`HARNESS_MODE`: every screen in), processes, cargo |
| `tools/models-sweep.mjs`, `models-sweep-app.mjs`, `models-sweep-lib.mjs` | Every installed model checked in the isolated app or (`--via server`) Chromium (`.claude/rules/models.md`) |
| `tools/perf.mjs` (runs `tools/perf-startup.mjs`, `backend/crates/novira-core/examples/backend_timing.rs`) | Speed of the backend, the frontend start and the real app's IPC, against a saved baseline |
| `tools/fetch-trustmark.mjs`, `tools/comfy-node-defs.mjs` | The watermark's pinned files, hash-checked; the saved node definitions of ComfyUI |
| `.githooks/` | `pre-commit` and `commit-msg` (sh wrappers, turned on by `npm install`) running `pre-commit.mjs` / `commit-msg.mjs` |
| `frontend/scripts/` | The scripts tied to the frontend: the local lint rules (`eslint-*.mjs`), `check-i18n-sync.mjs`, `check-manual-sync.mjs`, `check-glossary.mjs`, `i18n-add.mjs`, `i18n-todo.mjs`, `manual.mjs`, `shot.mjs`, `e2e-server.mjs` (the cached build the layout scan opens, in `novira-data/work/e2e-build/`) |
| `.claude/hooks/`, `.claude/settings.json` | Claude Code hooks (below) |

### Stale output

Everything the harness makes lives directly inside `novira-data/work/` ([../verification.md](../verification.md)). Stale means deleted: `tools/prune-stale.mjs` removes an entry unused longer than its limit, counted from the `.last-used` marker the harness writes into it; `--dry-run` only lists. Test: `tests/prune-stale.test.ts`.

## Rules and skills

Rules (`.claude/rules/`) say what must hold; Claude Code loads one when a file under its `paths` is touched. Skills (`.claude/skills/<name>/`) say how to do it and point back to their rule. `AGENTS.md` lists both for agents that do not load them on their own.

| Rule | About |
|---|---|
| `architecture-map.md`, `design-docs.md` | What the map holds and how big it may get; what a design page (the current specification of a feature) holds and when to update it |
| `frontend.md`, `i18n.md`, `manual.md`, `assistant.md`, `comfyui.md`, `security.md` | The frontend's layers and look; screen text in every language; the manual; the AI assistant kept in step with features; pack settings; what to check at each boundary |
| `models.md` | Model changes swept in the real app |
| `regression-tests.md`, `test-maintenance.md`, `commit-messages.md` | Which tests to run; tests change with behaviour; the shape of a commit message |

| Skill | For |
|---|---|
| `i18n/`, `manual/` | Screen text, the manual |
| `gatekeeper/`, `verify-real-app/` | Taking a subagent's branch into main; running the real app in isolation |
| `testing/`, `test-mutation/`, `authoring-skills/`, `hardening-harness/` | Test cases; mutants; a skill; a guard |
## What guards what

| Guard | Stops |
|---|---|
| `tools/typecheck.mjs` (`tsc`, incremental; pre-commit) | type errors in src, tests, e2e, configs; text keys ja lacks |
| `frontend/tests/i18n.test.ts` | a key ja has and en lacks, a key or area another language has and ja does not, different placeholders, Japanese written straight into ts / tsx |
| `frontend/scripts/check-glossary.mjs` (`src/i18n/glossary.json`, its test, pre-commit) | a word the term list forbids, in the ja/en catalogs and manual |
| `frontend/tests/manual.test.ts` | a manual folder missing for an app language, chapters whose files or structure (headings, tables, lists, pictures) differ from `ja`, `{{ui:key}}` / links / picture ids that do not exist, scenes and pictures out of step |
| `frontend/scripts/check-i18n-sync.mjs` (pre-commit) | a commit that changes a message in ja or en without the other, or leaves another language a text for a message that ja or en changed |
| `frontend/scripts/check-manual-sync.mjs` (pre-commit) | a manual chapter changed in ja or en without the other, or neither translated nor listed in `docs/manual/pending.json` for another language |
| ESLint | network access outside `src/backend/`, non-LF line ends, react-hooks rules; a union `switch` leaving a member to `default`; a model list filtered to type main |
| ESLint `frontend/scripts/eslint-layers.mjs` | imports against the layer direction, one feature importing another (except `features/media` and `features/invoke`); listed exceptions may only shrink |
| ESLint `frontend/scripts/eslint-test-hygiene.mjs` | committed `.only` tests |
| `frontend/tests/structure.test.ts` | `utils/`, `misc/`, `helpers/` folders; layer exceptions that are no longer needed |
| `frontend/tests/test-hygiene.test.ts` | `#[ignore]` outside `tests/*_live.rs`; prompt snapshots no test writes (frontend and `comfy/__snapshots__/graph/`) |
| `comfy::node_defs_check` (in `cargo test -p novira-core --lib`) | a built graph a real ComfyUI would refuse (unknown node or input, missing input, wrong link, a choice or number it does not take; against `node-defs.json` from `tools/comfy-node-defs.mjs`). Not missing files or run-time failures |
| ESLint `frontend/scripts/eslint-security.mjs`, `cargo test -p novira --test security` | HTML put straight into the DOM, `eval`, `window.open`, a looser CSP or capability, launches through a shell, SQL with values formatted in, committed secrets (details and limits in `.claude/rules/security.md`) |
| stylelint | outside `tokens.css`: hex, `rgb()`, `hsl()` colours; a radius not `--radius-*`; a z-index over 9 not `--z-*` |
| `npm run check:eol` | a text file with the wrong line ends, tracked or untracked (not ignored): LF expected, CRLF for `.bat` and `.cmd` |
| `tools/docs-check.mjs` (`tests/docs-check.test.ts` in `npm run check` and CI; `--git` in pre-commit) | a folder, crate, launcher, tool, hook body, rule or skill no map page or AGENTS.md names; a backticked path or link of a map or design page that does not exist; a code name in backticks (camelCase, snake_case, UPPER_SNAKE) in `docs/` (not the manual), `.claude/` or AGENTS.md that no code has; a page over its limit (README 7000 bytes, others 14000); a design page without a matching `covers` list or missing from its index; a security boundary change (`command_list.rs`, capabilities, `tauri.conf.json`) without a design page in the commit; a **warning** when a commit changes code a design page covers and not the page |
| `tools/ui-refs.mjs` (pre-commit; `tests/ui-refs.test.ts`; `verify-real-app.mjs` runs it on its test script before the build) | a test id or text key (forms in the tool's header) named by the e2e specs, `frontend/scripts/`, `tools/`, the docs or `.claude/` that no source of `frontend/src` or the ja catalog has. Not an id hidden in one build or held in a variable |
| `.githooks/commit-msg.mjs` (`.githooks/commit-msg`; `tests/commit-msg.test.ts`) | a message breaking `.claude/rules/commit-messages.md`: a summary over 72 characters or ending in a full stop, a body over 8 one-line `- ` bullets of at most 100 characters, a named work branch (merge, revert, fixup and squash commits excepted). |
| `.githooks/pre-commit` | staged line ends, type errors, languages out of step, forbidden terms, stale docs and UI references, layout source without a layout-scan pass, staged `novira-data/` (so also `novira-data/work/`), `out/`, `data/`, `outputs/`, `config.json`, `.env*` |
| `frontend/scripts/oss-licenses.mjs` (pre-commit, when a lockfile, `package*.json`, an `oss-*` input, the generator or a download manifest is staged: it regenerates and stages `THIRD_PARTY_NOTICES.txt` and `ossLicenses.json`) | a dependency or download added without a license text (a package with none is named) or a downloaded file in no entry of `oss-downloads.json` (the watermark files are read); the About list and the notices stay in step with the lockfiles |
| `tools/visual-baselines.mjs` (`affected.mjs` uses its trigger rule; `tests/visual-baselines.test.ts`) | which changed files can alter a main screen; run `npm run e2e:visual` by hand (too heavy for pre-commit). Only the screens in `visual.spec.ts` |
| `tools/layout-scan.mjs` (`e2e/layout.spec.ts`, rules `e2e/layoutRules.ts`, `e2e/textFit.ts`; run by `affected.mjs`) | on every screen of the mock, ja and en, dark and light: a control out of its box or the window, text cut off or shortened to "…", visible controls or cards closer than 1px or overlapping; a label that sticks out or wraps, a tooltip or menu out of the window. Pre-commit refuses layout source without a recorded pass on exactly what is staged ([../verification.md](../verification.md)). Only the surfaces in the spec |
| Claude Code hooks (`.claude/hooks/`) | the map's entry page missing from a session or a subagent (`architecture-map.mjs`, at `SessionStart` and `SubagentStart`: Explore and Plan do not read `AGENTS.md`); wrong line ends after an edit (LF for text, CRLF for `.bat`/`.cmd`; `eol.mjs` converts) or after a shell rewrite such as `sed`; uncommitted work at the end of a turn (`commit-before-stop.mjs` reminds once), and model code committed with no sweep record for HEAD; a write into `novira-data/` outside `work/` (`data-guard.mjs`: refused before, reported after a script). The Stop hook asks for the removal (`tools/worktree.mjs remove`) of every finished worktree. Line-end and uncommitted-work hooks see every worktree (`worktrees.mjs`). |
| `cargo test -p novira --test robustness` | `unwrap` / `expect` on locks (use `novira_core::sync`), synchronous commands that do not run through `commands::guard` (a panic on the main thread kills the app) |
| `cargo test -p novira --test window_config` | `dragDropEnabled` turned on (on Windows no HTML5 drag and drop reaches the page) |
| `npm run coverage` (`coverage.bat`) | frontend coverage falling below the floors in `frontend/vitest.config.ts`. Run by hand, not in `npm run check`. Rust: `coverage.bat backend` fails below its line floor (`--fail-under-lines`). `npm run coverage:e2e` (`coverage.bat e2e`) adds the browser coverage of the Playwright run (`frontend/scripts/coverage-report.mjs`) |
| `mutation.bat rust` (`cargo mutants`, config `backend/.cargo/mutants.toml`) | a test that does not notice a real change of the code (a surviving mutant). Not in `check.bat` or CI (a day for the crate; one file with `-- -f <path>`); equivalent mutants are excluded in the config with a reason | frontend (see its own part of `mutation.bat`), code the tests never run (that is `coverage.bat`) |
| `npx vitest run <file>.property.test.ts` (part of `npm run check`; fast-check, shared setup in `frontend/src/propertyTest.testkit.ts`) | hostile or random input reaching pure frontend logic and stores. In process only (`fetch` throws), fixed run count and seed (`NOVIRA_PBT_RUNS`, `NOVIRA_PBT_SEED`); a known bug is an `it.fails` test with a `known bug:` comment |
| `cargo test -p novira-core --test prop_paths` (and `prop_graph`, `prop_parsers`, `prop_roundtrip`, `prop_loopback`; part of `cargo test -p novira-core`) | hostile or random input reaching a pure function or parser: a path that escapes its folder or names a device or another host; a prompt with a dangling link, a cycle or a null input; a parser that panics or overflows; a contract type that changes in a round trip. Fixed seed, `PROPTEST_CASES` for the count | only what the generators reach: no real engine, network or GPU, and a bug outside the generated shapes |
| `backend/rustfmt.toml` (`newline_style = "Unix"`) | Rust line ends |
