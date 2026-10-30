# Setting up a development environment

How to get the source running on a Windows PC, which launcher to use for what, and where to go next. How the parts fit is in [architecture/README.md](architecture/README.md); how to check a change is in [verification.md](verification.md); the rules for working in the repository are in [../AGENTS.md](../AGENTS.md).

## What you need

| Tool | Why |
|---|---|
| Windows 11 | The launchers are `.bat` files and the app is built for Windows |
| Git | The repository, and the hooks it installs |
| Node.js 22 or later | The frontend and the Node tools (`engines` in `frontend/package.json`) |
| Rust (stable, through rustup) | `backend/rust-toolchain.toml` picks the stable channel with `rustfmt` and `clippy` |
| Microsoft C++ Build Tools | The linker Rust needs on Windows (the "Desktop development with C++" workload) |
| WebView2 runtime | The window shows the UI through it; Windows 11 already has it |
| A GPU (to generate) | ComfyUI draws on it. The app installs the NVIDIA build by default; the AMD one can be chosen in Settings, Engine. Screen work on the mock needs none |

`cargo` must be on the `PATH`; the launchers add `%USERPROFILE%\.cargo\bin` themselves. `scripts\dev.bat` installs `tauri-cli` (version 2) on its first run, which takes a few minutes.

## First setup

```bat
git clone https://github.com/valneko-twoon2/novira.git
cd novira\frontend
npm ci
```

`npm ci` also points Git at the hooks in `.githooks/` (the `prepare` script). The hooks check line ends, the layout of the screens, the documentation and the commit message before a commit is accepted (see [architecture/tooling.md](architecture/tooling.md)).

Then run `scripts\start.bat` from the repository root. The first build compiles every Rust dependency and takes several minutes; later builds only redo what changed. On its first start the app installs its own ComfyUI into `novira-data\`; the first picture also needs a model (see the first chapter of the manual, [manual/en/01-start.md](manual/en/01-start.md)).

## Ways to run it

| Launcher | What it runs | Use it when |
|---|---|---|
| `cd frontend && npm run dev` | The UI alone in a browser (http://localhost:5173/) on an in-memory mock backend | You work on screens and do not need the engine. Nothing is generated; the mock answers the same way every time |
| `scripts\dev.bat` | The desktop app on the Vite dev server (`cargo tauri dev`), with the real backend | You edit the frontend often: a saved edit shows at once, only Rust edits recompile |
| `scripts\start.bat` | The desktop app, built once (`start.bat fast` opens it without building) | You want the app as a user sees it |
| `scripts\server.bat` | The backend alone as a local web server, opened in your browser (`server.bat fast` skips the build; a phone on the home Wi-Fi is let in from the QR item of the page) | You work on the browser version, or want the real backend without a window |
| `scripts\rebuild.bat` | A clean rebuild of the frontend and the app, then opens it (`rebuild.bat full` also rebuilds every dependency) | The app looks broken although the sources are fine, for example unstyled HTML |

Windows locks a running `novira.exe`, so close the app before you start, rebuild or check with a launcher. All of them keep the data in `novira-data\` in the repository root; set `NOVIRA_DATA_DIR` to use another folder. Only one process can use a data folder at a time, so the app and the browser server cannot run together on the same one.

## Checking your work

| Command | What it does |
|---|---|
| `node tools\affected.mjs` | Runs only the checks the changed files need. Start here |
| `scripts\version.bat` | Sets the app's version (asks for it, or `version.bat 0.2.0`) in `Cargo.toml`, `package.json` and the lock files | You prepare a release |
| `node toolselease-smoke.mjs` | Starts what `release.bat` put in `artifacts\`: the server on an empty data folder and on each old-data fixture, and the app with no engine, each until its main screen or its data answers. Nothing uses the GPU; its folders are deleted after | You publish a release, before `package.bat` |
| `scripts\package.bat` | Packs what `release.bat` built into the zip for a release page, with its SHA-256 (the programs and licence texts only); write the release notes from [release-notes-template.md](release-notes-template.md) | You publish a release |
| `scripts\check.bat` | Every fast check: typecheck, lint, unit tests and line ends on the frontend, `cargo fmt`, clippy and `cargo test` on the backend (`frontend` or `backend` for one side) |
| `cd frontend && npm run check` | The frontend part alone |
| `cd frontend && npx vitest run <path>` | One frontend test file |
| `cd backend && cargo test -p novira-core --lib` | The backend's unit tests |
| `cd frontend && npm run e2e` | The screen flows in a browser (Playwright, on the mock). Run `npx playwright install chromium` once first |

Which checks fit which change is in [../.claude/rules/regression-tests.md](../.claude/rules/regression-tests.md). Running the real app, the engine or the model sweep is in [verification.md](verification.md).

## Good to know

- **Where things are.** `frontend/` is the UI, `backend/` the Rust workspace (`crates/novira-core` is the backend as a library, `src-tauri` the thin desktop shell, `crates/novira-server` the browser server), `contract/` the sample JSON both sides check, `scripts/` the launchers, `tools/` the checks and helpers. [architecture/README.md](architecture/README.md) says where to start for each kind of change.
- **Screen text** goes only in the catalogs under `frontend/src/i18n/locales/`, Japanese and English together. See [../.claude/rules/i18n.md](../.claude/rules/i18n.md).
- **Generated files** (verification data, reports, builds, scratch) go under `novira-data\work\`, which is not committed and is cleaned when stale.
- **Commit messages** are in Japanese and start with a Conventional Commits type (`feat:`, `fix:`, `docs:`, `chore:` ...): a first line of at most 72 characters, then up to eight short bullets ([../.claude/rules/commit-messages.md](../.claude/rules/commit-messages.md)). The commit hook refuses a message that does not follow it.
- **Ports.** The dev server uses 5173; the launchers stop a leftover Vite on that port before they start.
