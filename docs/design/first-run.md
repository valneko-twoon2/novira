---
covers:
  - backend/crates/novira-core/src/first_run.rs
  - backend/crates/novira-core/src/first_run/tests.rs
  - backend/src-tauri/src/first_run.rs
  - frontend/src/features/splash/FirstRun.tsx
  - frontend/src/backend/tauri/firstRun.ts
---
# The first start

The very first start of the desktop app asks where the data folder and novira's own ComfyUI go, before anything is opened. Nothing is written to a default place first.

## Behaviour

**When it shows.** `first_run_needed` in `backend/src-tauri/src/lib.rs` is true when no `NOVIRA_DATA_DIR` is set, the pointer file (see settings-engine.md) does not exist, and neither `novira-data/` beside the app nor `novira-data/` in the user's folder (where earlier versions kept data) exists. Anyone who already uses the app is therefore never asked, and a debug build, whose `novira-data/` sits in the repository, is not either. The check is made from what is on disk, so it stays true until the choice is saved.

**What happens.** The shell does not open a backend: it manages no `Backend`, starts no worker and no engine, and the image scheme answers 404. The page (`frontend/src/main.tsx`) asks `first_run_info` through `firstStart()` before it calls anything else and renders `FirstRun.tsx` alone: the logo and a card with two rows, the data folder and the ComfyUI install folder, each showing its path (the default one at first), a button that opens the shell's folder dialog, and a button back to the default once another folder is chosen. "Start with these folders" calls `first_run_finish`, which writes the choice and restarts the app; the next start is a normal start with the pointer and, when a ComfyUI folder was chosen, the `comfyuiInstallDir` setting in place. The same screen shell shows "moving your data" (`moving` in `first_run_info`) while a data folder change from Settings is carried out at start-up; the app restarts by itself when it is done.

**What is written.** `novira_core::first_run::apply` checks the choice (the same checks as the Settings screen: a full plain path, not a drive root, a new or empty folder or one that already holds data for the data folder; `check_install_dir` for ComfyUI), creates the data folder, saves `comfyuiInstallDir` in its `settings.json`, and writes the pointer last, so a failure leaves the next start a first start again. The default data folder is `default_data_dir` (the user's folder in a release build); the default ComfyUI folder is `comfyui` inside the data folder, which writes no setting.

**The page profile.** The WebView profile normally sits in the data folder. At the first start it goes to `setup-webview` next to the pointer file, so the default data folder is not created before the user chooses.

## Boundaries

| Boundary | Guard |
|---|---|
| `first_run_info`, `first_run_choose`, `first_run_reset`, `first_run_finish` (IPC, `backend/src-tauri/src/first_run.rs`) | They take no path: a folder comes only from the shell's own dialog and waits in the shell's state until `first_run_finish`. `kind` is `data` or `comfyui`, anything else is refused. Every command refuses once `first_run_needed` is false, so the page cannot move the data folder through them later. A chosen folder is checked at once and again by `apply`. |
| The browser server | The commands are shell-only (`SHELL_ONLY` in `api.rs`): the server answers "not available in the browser yet". |

## Known limits

- Only the data folder and the ComfyUI folder are asked; the model folders and the rest are set in the Settings screen afterwards.
- The screen has no test in the browser mock (the mock has no first start); `FirstRun.test.tsx` mocks the IPC.
- The restart after "Start" uses the app's own restart; a `tauri dev` session ends with it (a debug build is not asked at the first start in the repository, so this only matters for a debug build run from a folder with no `novira-data/`).

## Not implemented

- Choosing the language on this screen: it follows the language the page already has.
