---
covers:
  - backend/crates/novira-core/src/db.rs
  - backend/crates/novira-core/src/child_job.rs
  - backend/crates/novira-core/src/applog.rs
  - backend/crates/novira-core/src/settings.rs
  - backend/crates/novira-core/src/service/mod.rs
  - backend/crates/novira-core/src/service/worker.rs
  - backend/crates/novira-core/src/media/images.rs
  - backend/crates/novira-core/src/comfy/process.rs
  - backend/crates/novira-core/src/voice/mod.rs
  - backend/src-tauri/src/lib.rs
  - backend/src-tauri/src/startup.rs
  - backend/crates/novira-core/src/startup.rs
  - backend/src-tauri/src/image_scheme.rs
  - backend/src-tauri/build.rs
  - backend/src-tauri/Cargo.toml
---
# Runtime

How the desktop app is put together while it runs: the layers between the WebView and the Rust backend, start-up and shutdown, the data folder and the lock that keeps a second copy out, where data is stored, how a failure is kept from ending the app, how ComfyUI and the voice worker are kept from outliving it, and how the build makes the app self-contained. Features built on top of this have their own pages (for example generation.md for the queue and the ComfyUI graphs).

## Behaviour

### Layers

```text
React (frontend/)            TauriBackend (frontend/src/backend/tauri/): one invoke() per BackendClient method; listens on "novira://event"
  │  Tauri IPC, events, novira-image URL scheme
backend/src-tauri            thin shell: commands.rs (calls novira_core::api, the command layer shared with the browser server), events.rs, image_scheme.rs, capabilities/default.json
  │
backend/crates/novira-core   the backend service: SQLite, image files, queue, models, workflows. No Tauri dependency
  │  Engine trait (engine.rs)                 VoiceEngine trait (voice/mod.rs)
ComfyEngine (comfy/client.rs)               voice worker (Python process)
  │  HTTP /prompt /history /view /upload/image /models/<folder> /object_info, / and /assets (locale files); WebSocket /ws
ComfyUI (Python process)
```

`novira-core` is a library with no Tauri in it, so it is tested without a window (`cargo test -p novira-core`). The shell forwards calls and events, serves images, and does the window-side start-up (`backend/src-tauri/src/startup.rs`; the data folder lock and the opening of the backend are `backend/crates/novira-core/src/startup.rs`, shared with the browser server, [browser-server.md](browser-server.md)).

Which ComfyUI is used depends on `comfyuiUrl` and `comfyuiDir` in `settings.json` (fields documented on `Settings` in `backend/crates/novira-core/src/settings.rs`):

- Neither set: novira runs its own ComfyUI from `<data>/comfyui/` on a free port on 127.0.0.1, installing it when it is missing (Windows only).
- `comfyuiDir` set: novira starts the ComfyUI in that folder and stops it on exit, at the address of `comfyuiUrl` when that is also set (its host must be on this PC, or the start is refused), else on a free loopback port.
- Only `comfyuiUrl` set: novira uses the server already running there and never starts or stops it. If it does not answer, the engine reports "not reachable".

The owned process runs `main.py --listen <host> --port <port> --disable-auto-launch --preview-method auto --extra-model-paths-config <data>/extra_model_paths.yaml`, followed by `comfyuiArgs`, with no console window. Its output goes to `logs/comfyui.log`, and its caches (`HF_HOME`, `TORCH_HOME`, `TEMP` and similar) go to `<data>/cache/`. Its Python is `comfyuiPython` when set, else a venv or the portable package's `python_embeded` in the ComfyUI folder (`backend/crates/novira-core/src/comfy/process.rs`), else `python` from PATH.

### Start-up

In the order of `backend/src-tauri/src/lib.rs` and `Backend::open`:

1. Before the window, a panic hook logs panics (see Failures and logs). Unless `WEBVIEW2_USER_DATA_FOLDER` is already set, it is set to `<data>/webview`.
2. The data folder is resolved and created (see Data folder).
3. `novira.lock` is claimed. If another copy holds it, a dialog names the reason and the folder, and the process exits with code 1 before the database or ComfyUI is touched. Other start-up errors show in the same dialog.
4. The log file is set and `settings.json` is read. A broken file stops start-up with the reason; a missing one gives the defaults.
5. `Backend::open`: novira's own ComfyUI is put back to its old version when a version switch was cut off, the work folders of cut-off pack installs are cleared (extensions.md), and a restore the user confirmed earlier is applied. The model category folders and `extra_model_paths.yaml` are written. The database is opened and loaded into memory. ComfyUI and the voice engine are configured but not started. The time of each step goes to `novira.log` in one line (`opened in … ms (…)`, `backend/crates/novira-core/src/service/open_timing.rs`); `backend/crates/novira-core/examples/backend_timing.rs` times them on a copy of a data folder.
6. Window setup: `tauri.conf.json` creates the window hidden; `show_window` gives its frame and background the theme the screens were left in (`saved_theme_is_light`, from the saved screen state; dark when there is none, at the first start and during a move) and then shows it, so the frame never follows Windows first. Before the first paint, `frontend/public/theme-boot.js` (a plain script in `<head>`, written into the build by `themeBoot` in `frontend/vite.config.ts`) puts the theme saved in the page's storage on the page; `frontend/src/state/savedTheme.ts` applies it again once the backend's state is in. The backend gets the event sink, the queue worker starts, and in the background ComfyUI is prepared (installed when missing, started, and reported ready once it answers). A `comfyuiPackage` that differs from the installed one is installed in its place at this start. The export watermark files are prepared. On Windows the window's small icon is replaced by the app icon's frame for the screen scale (16 px at 100 %, 20 at 125 %, picked again when the window moves to a display of another scale; `fit_window_icon`), because Tauri hands the window the 32 px frame, which Windows then shrinks, so the window's row in the Task Manager looked heavier than the program's row. `icon.ico` therefore holds 16, 20, 24, 32, 40, 48, 64, 128 and 256 px frames. With `civitaiLookup` on, covers and licences of local models are looked up.

Launchers: `scripts\start.bat` builds what changed and opens `backend\target\debug\novira.exe` (`fast` skips the build). `scripts\dev.bat` runs the app against the Vite dev server, so frontend edits show on save. `cargo run -p novira` in `backend/` builds and opens the same app. `npm run dev` in `frontend/` serves only the browser mock.

### Data folder

The folder is `NOVIRA_DATA_DIR` when set and not empty; else `novira-data/` in the repository root in a debug build. A release build uses `novira-data/` in the user folder (`USERPROFILE`, else `HOME`), unless one already sits beside the executable, which it keeps using so an update does not leave data behind (`default_data_dir` in `backend/src-tauri/src/lib.rs`). The browser server has no default. A folder chosen in Settings is read from a pointer file (`data_location.rs`, see settings-engine.md) after the variable and before this default (a debug build has its own pointer); with nothing at all, the first start asks (first-run.md); a move it asks for is done before the lock is taken, in a thread started from window setup behind the "moving" screen, and the app restarts after it.

- `novira.sqlite` and its WAL file: the database (see Storage).
- `outputs/`, `thumbnails/`: the gallery files.
- `models/<category>/`: model folders, created at start.
- `comfyui/`: novira's own ComfyUI.
- `cache/`: caches and temporary files of ComfyUI and the voice worker.
- `voice/site/`: the voice worker's Python libraries.
- `secrets/`: keys encrypted with Windows DPAPI, and `store-id`, the id of this folder's Credential Manager entries for the Civitai key and the Hugging Face token (`backend/crates/novira-core/src/secret.rs`).
- `extra_model_paths.yaml`: rewritten at every start; tells ComfyUI which folders hold models.
- `logs/`: `comfyui.log` and `novira.log`.
- `webview/`: the WebView2 profile, so the page's own storage (for example presets) is kept per data folder.
- `novira.lock`: the lock. It is opened and locked exclusively at start and held until the process ends; the OS releases it even after a crash, so a crashed copy never blocks the next start. Nothing is written to it.
- `settings.json`: optional. Missing keys take the defaults in `Settings`.

### Failures and logs

- A synchronous IPC command runs inside `commands::guard`: a panic becomes an error for that call. Such commands run on the window's main thread, where an unwinding panic would end the app.
- The queue worker catches a panic inside a job and marks only that job failed; the worker goes on.
- Locks are taken through `LockExt` and `RwLockExt` (`backend/crates/novira-core/src/sync.rs`), which take the guard back after a panic, so one panic does not poison later callers.
- `backend/src-tauri/tests/robustness.rs` checks that every synchronous command is guarded and that no lock is unwrapped.
- `applog` writes each line and each panic to stderr, to `logs/novira.log`, and once the window is set up, to the frontend's developer log as `log` events. `novira.log` is renamed to `novira.log.1` before a line is appended when it is over 2,000,000 bytes. Messages are cut at 4,000 characters.
- A database row that no longer parses is skipped and logged; the rest of its table loads.

### Storage

- SQLite is bundled (`rusqlite` with `bundled`). The database runs in WAL mode with `synchronous` NORMAL (`backend/crates/novira-core/src/db.rs`).
- Tables: `boards`, `images`, `workflows`, `models`, `queue`, `comics`, `watermarks`. Each row is one JSON document in a `data` column, ordered by a `sort` column. A `meta` table holds key/value entries, such as the hidden-models list and the canvas document.
- The in-memory state is the working copy. Changes are written through to the database as they happen (`Db::put`, `put_many`, `delete`).
- Originals are `outputs/<uuid>.png`; videos are `outputs/<uuid>.mp4` and audio `outputs/<uuid>.<ext>`. The thumbnail is `thumbnails/<uuid>.thumb`: PNG when the picture has alpha, else JPEG at quality 85. Files are written under a `.tmp` name and renamed into place. Names are generated by novira; `images::is_valid_name` refuses anything else before a path is built.
- The `novira-image` scheme serves them: `http://novira-image.localhost/<full|thumb>/<name>` on Windows. A URL carries only the name. Unknown or invalid names get 404. Audio and video answer byte ranges (206, 416) so they can seek.
- Generation settings are stored inside the PNG as an uncompressed UTF-8 `iTXt` chunk, `novira_metadata`, and `novira_workflow` when a workflow was used (`backend/crates/novira-core/src/media/images.rs`). The pixel data is not touched. A PNG uploaded again gets its settings back. A PNG is stored byte for byte; other formats are decoded and written as PNG.
- Built-in workflows stay in the frontend (`frontend/src/backend/defaultWorkflows.ts`); the backend stores only the user's workflows.
- Backups copy the database with `VACUUM INTO` (`Db::backup_to`).

### Shutdown and process lifetime

- On Windows, the ComfyUI process novira starts (`backend/crates/novira-core/src/comfy/process.rs`) and the voice worker (`backend/crates/novira-core/src/voice/mod.rs`) are added to one job object (`backend/crates/novira-core/src/child_job.rs`) created with kill-on-close. The job handle is never closed while the app runs, so when the app's process ends for any reason, including a crash or a kill, Windows closes the job and ends its members. So the engines do not outlive the app. Binding is best effort: if it fails, the process runs as usual and the normal exit path still stops it. Elsewhere `bind` does nothing.
- Normal exit: `RunEvent::Exit` calls `Backend::shutdown` (`backend/crates/novira-core/src/service/worker.rs`). It cancels the worker and running installs, kills ComfyUI and waits for it, and stops the voice worker with `start_kill`, which is skipped while a voice request holds the worker (the job object then covers it). Then `gpu_lock::release_all()` frees a GPU lock this process holds.
- An external ComfyUI (`comfyuiUrl` without `comfyuiDir`) is never stopped by novira.

### Build

- `backend/` is the Cargo workspace. The app is the package `novira` in `backend/src-tauri`.
- `tauri` is built with the `custom-protocol` feature, so every build, including `cargo run`, serves the bundled frontend and not a dev server.
- `backend/src-tauri/build.rs` runs `vite build` in `frontend/` when `frontend/dist/index.html` is missing or older than `frontend/src`, `frontend/index.html`, `frontend/package.json` or `frontend/vite.config.ts`. It fails the build when `frontend/node_modules` is missing. `NOVIRA_SKIP_FRONTEND_BUILD=1` skips the step (CI without Node).
- So `cargo run -p novira` and the built `novira.exe` show the real app without a dev server.

## Boundaries

| Boundary | Guard |
|---|---|
| Database | Fixed SQL with bound parameters; table names come from an enum. |
