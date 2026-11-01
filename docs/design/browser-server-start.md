---
covers:
  - backend/crates/novira-server/src/main.rs
  - scripts/server.bat
  - scripts/release.bat
---
# Starting the browser server

How `novira-server` ([browser-server.md](browser-server.md)) is started: its options, which data folder it opens, and the launchers that start it.

## Behaviour

`novira-server (--data <folder> | --app-data) --dist <folder> [--port N] [--engine] [--open]`. `--data` falls back to `NOVIRA_DATA_DIR`; `--app-data` takes the folder `novira.exe` beside it opens (`data_location::app_data`: the variable, the pointer, the default; exit 2 before its first start or while a move waits); with none it stops (exit 2), so an app's data is never opened by accident. A data folder another process holds is refused with exit 3. `--dist` is a built `frontend/dist` (else it stops). `--port` defaults to the last start's port (`server-port` in the data folder: a page's saved state is per address), else a free one. `--engine` also starts the worker, the engine and the watermark preparation, as the app does. When ready it prints `novira-server: http://127.0.0.1:<port>/?token=<token>`; `--open` also hands the address to the default browser (`api::browser_command`, no shell). Ctrl-C stops it. `scripts/server.bat` builds the frontend and the server (`fast` skips that) and starts it on the repository's `novira-data` with `--engine --open`; `scripts/release.bat` puts `novira-server.exe`, `dist/` and `server.bat` (written by it, with `--app-data`) into `artifacts/`.

## Boundaries

| Boundary | Guard |
|---|---|
| Whose data | No default folder: `--data`, `NOVIRA_DATA_DIR` or `--app-data` names it. `--app-data` reads the app's own choice and never makes one: before the app's first start, or while the app's move of the data waits, it stops instead of creating a folder the app would then take for its data (a folder beside `novira.exe` is the app's default). One process per folder (exit 3). |

Tests: `backend/crates/novira-server/src/main.rs` (the options, `--app-data` against `--data` and the variable, the refusals, the release launcher's command line), `backend/crates/novira-core/src/data_location/tests.rs` (`app_data`, `default_data_dir`), `backend/crates/novira-server/tests/lifecycle.rs`.

## Known limits

- `--app-data` reads the pointer of the build it is: a release server reads the release app's pointer, a debug one the debug app's.
