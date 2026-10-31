---
covers:
  - backend/crates/novira-server/**
  - backend/crates/novira-core/src/api.rs
  - backend/crates/novira-core/src/startup.rs
  - backend/crates/novira-core/src/image_serve.rs
  - frontend/src/backend/http/**
  - frontend/src/backend/calls.testkit.ts
---
# Browser server

The real backend behind a plain web browser: novira without its window, and checks that drive `novira-core` from Chromium (Playwright). `backend/crates/novira-server/` is an HTTP server on this computer (or the home network: [browser-server-lan.md](browser-server-lan.md)); the frontend reaches it through a third `BackendClient`, `frontend/src/backend/http/HttpBackend.ts`, beside the Tauri client and the mock.
## Behaviour

### One command layer for both shells

`backend/crates/novira-core/src/api.rs` holds every command that needs only the backend. Each is written once in its `commands!` list (name, parameters, body); the macro makes the typed function (`api::call::<name>`), which the `#[tauri::command]` functions in `backend/src-tauri/src/commands.rs` call, and the entry of `api::dispatch(backend, name, json)`, which the server calls. So each argument check, the way an argument is read, and the panic guard exist once. `dispatch` takes named arguments in camelCase (the spelling Tauri uses), refuses a missing, mistyped or extra argument, runs a synchronous command on the blocking pool inside `guard`, and answers `CallError::{UnknownCommand, BadArguments, Failed}`.

The layer lives in `novira-core`, which stays free of Tauri and of any HTTP stack. `backend/src-tauri/src/command_list.rs` stays the list of Tauri commands (and the capability file stays equal to it); a test in `commands.rs` checks that it equals `api::NAMES` plus `api::SHELL_ONLY` and that each delegated Tauri command takes the layer's parameter names.

`api::SHELL_ONLY` lists the commands only the desktop shell implements: folder, open and save dialogs, the raw upload body, the zoom, opening the system browser (served in another form, below), the model files a scan listed (`install_model`; served without local paths), the last export folder, the restart after a restore, `prepare_watermark`. Both shells also share, in `novira-core`: opening the data folder under its lock (`startup.rs`: `open_backend`, one process per folder) and what a picture path serves (`image_serve.rs`, the decision behind `novira-image://` and `/novira-image/`).

### The server

`novira-server --data <folder> --dist <folder> [--port N] [--engine] [--open]`. `--data` falls back to `NOVIRA_DATA_DIR`; with neither it stops (exit 2), so an installed app's data is never opened by accident. A data folder another process holds is refused with exit 3. `--dist` is a built `frontend/dist` (else it stops). `--port` defaults to the last start's port (`server-port` in the data folder: a page's saved state is per address), else a free one. `--engine` also starts the worker, the engine and the watermark preparation, as the app does. When ready it prints `novira-server: http://127.0.0.1:<port>/?token=<token>`; `--open` also hands the address to the default browser (`api::browser_command`, no shell). Ctrl-C stops it. `scripts/server.bat` builds the frontend and the server (`fast` skips that) and starts it on the repository's `novira-data` with `--engine --open`; `scripts/release.bat` puts `novira-server.exe`, `dist/` and `server.bat` (written by it, data folder next to the exe) into `artifacts/`.

Routes (`backend/crates/novira-server/src/lib.rs`):

| Route | What |
|---|---|
| `GET /`, `/index.html` | `index.html` of `--dist` with `<script src="/novira-server.js">` added after `<head>`; the script sets `window.__NOVIRA_SERVER__`, by which the frontend picks `HttpBackend` |
| `POST /api/<command>` | a command of `api::SERVED`: JSON object in (an empty body is no arguments), JSON out; errors are `{"error", "code"}` with 400 `bad_arguments`, 404 `unknown_command`, 422 `failed` (the message the window shows), 501 `not_available_in_browser` |
| `POST /upload/image` | a picture as the body (`application/octet-stream`, else 415), its options as JSON in `x-novira-options` (bad JSON is 400); the answer is the stored picture. The backend decodes and re-encodes it with its own limits |
| `POST /export/images` | the `names` and `options` of `export_images` as JSON (else 415, bad JSON 400); the answer is the download, its `ExportResult` in `x-novira-export` (`gallery-share.md`) |
| `GET /events` | a WebSocket upgrade; each backend event (what the desktop sends on `novira://event`) is one JSON text message. The server only sends; what the page sends is ignored |
| `GET /novira-image/<full\|thumb>/<name>` | a picture by name, through `image_serve::serve` (the same name checks and Range answers as the desktop scheme); picture URLs the backend hands out are relative to the page (`/novira-image/...`) |
| any other `GET` | a file of `--dist` of a known type (script, style, picture, font, ...) |

Commands answered now (`SERVED`, in groups):

| Group | Commands | Why it is safe here |
|---|---|---|
| Reads | `bootstrap`, `queue_snapshot`, the lists and statuses of models, packs, fonts, comics, downloads and the watermark, `engine_settings`, `has_*` for the keys, `agent_status`, `hardware_info`, `load_canvas`, `node_defs`, `take_restored_ui_state` | no change, no secret |
| The user's own data | `create_board`, `update_board`, `delete_board`, `update_images`, `delete_images`, `save_comic`, `delete_comic`, `save_canvas`, `adopt_ui_state`, `save_ui_state`, `save_workflow`, `delete_workflow` | names and JSON inside the data folder, checked by the backend |
| Queue | `enqueue`, `cancel_queue_item`, `cancel_batch`, `clear_queue`, `prune_queue`, `pause_processor`, `resume_processor`, `retry_queue_item` | a request names pictures only by the gallery's names; the backend refuses anything else |
| Installs, models, packs | `install_model`, `cancel_install`, `update_model`, `delete_model`, `install_pack`, `cancel_pack`, `install_node_pack`, `cancel_node_pack`, `remove_node_pack`, `switch_comfy_version`, `delete_unfinished_downloads`, `prepare_watermark` (started; the page polls its status) | the app's checks: https only, exact hosts, fixed folders, only listed partial files can be deleted. `install_model` runs through `api::install_model_remote`, which refuses a local file path (the app takes one only from its own folder scan, absent in a browser). All are `LOOPBACK_ONLY` |
| Model sites, registry | `list_hugging_face_files`, `search_civitai`, `comfy_versions`, `node_pack_versions`, `registry_nodes`, `node_pack_info`, `face_rig_preview` | the addresses are fixed in the backend, the names are validated there |
| Engine settings | `restart_engine`, `set_low_memory_mode`, `set_engine_settings`, `remove_model_root` | each value is checked before it is written (the package is `nvidia` or `amd`, the timeout is in range); no path can be added (`add_model_root` needs the dialog) |
| Keys | `set_hf_token`, `set_civitai_key` | write-only: stored in the Windows Credential Manager, never returned (`has_*` only says one is set) |
| Pages outside the app | `open_civitai_page`, `open_huggingface_page`, `open_source_page` | `api::page_url` answers the address, built and checked as for the desktop shell (one allow-list); the page opens it in a new tab |
| The assistant | `agent_login`, `agent_endpoint_save`, `agent_endpoint_models`, `agent_endpoint_test`, `agent_chat`, `agent_tool_result`, `agent_cancel`, `lookup_reference` | the backend checks the address, the model and the key (stored with DPAPI, never returned); tool calls reach the page as events and come back as `agent_tool_result` |

Every other command answers 501 "not available in the browser yet: <command>" (`HttpBackend` throws it). They open a native dialog or act on a place the page picks, and no generation needs them: `scan_folder`, `add_model_root` (a folder is picked in a dialog), `export_images` and `reveal_export_folder` (the export is a download from `/export/images`), `create_backup`, `open_backup`, `confirm_restore` and `discard_restore` (a restore replaces the data folder), `check_watermark_file` (a file dialog), `set_ui_zoom` (the browser zooms), `upload_image` (its body goes to `/upload/image`). The backend's events reach the page over `/events`, so the queue and the progress it shows update live.

### The client

`HttpBackend` posts `{...}` to `/api/<command>` with the argument names the Tauri client uses, posts pictures to `/upload/image` (a picture of the page is stored first, as the Tauri client does), hands an export's answer to the browser's download and opens `/events` before its first read. It keeps the Tauri client's queue mirror; a dropped socket opens again after a second and the missed queue is read. A contract test (`frontend/src/backend/http/commands.contract.test.ts`, with the call table shared with the Tauri test in `frontend/src/backend/calls.testkit.ts`) reads `api.rs` and `commands.rs` and checks that every command name and argument name `HttpBackend` sends exists there.

## Boundaries

| Boundary | Guard |
|---|---|
| Who can connect | The listener binds `127.0.0.1` (plain HTTP); the home network opens on demand (browser-server-lan.md). A page on another site, or a DNS name that points at 127.0.0.1, is refused by the `Host` check: on loopback only `127.0.0.1:<port>` and `localhost:<port>` pass. |
| Which page may call | One `Host`, at most one `Origin` and one `Sec-Fetch-Site` (else 400). An `Origin` must be `http://<the request's own Host>` (`https://` on TLS); `Sec-Fetch-Site` must be `same-origin` or `none`. |
| Token | A random 64-hex-digit token per start (two UUID v4) is required on every request: header `x-novira-token`, or the cookie `token_cookie` names per port (`HttpOnly`, `SameSite=Strict`, `Secure` on TLS only) set by the first page load. `?token=` counts only on `GET /`, which sets the cookie; the page then drops it from the address bar. A device on the home network uses a session instead (browser-server-pairing.md). Compared in constant time. The token is printed once to the starter's console and never logged. |
| Events, uploads, exports | `/events`, `/upload/image` and `/export/images` pass the same checks as every route; the `Origin` check applies to the upgrade, so a page of another site cannot open the socket, post a picture or ask for an export. The upload takes `application/octet-stream` only and the export `application/json` only, which a cross-site form or `fetch` cannot send without a preflight. `connect-src` names `ws://<the request's checked Host>` beside `'self'`. |
| Commands | Only `SERVED` names run; the arguments pass the shared layer's checks (shape, no extra, the backend's own validation). An unknown name is 404, a known but unserved one is 501 and does nothing. `LOOPBACK_ONLY` runs for a loopback peer only (browser-server-lan.md). A body is at most 32 MiB; connections are capped (`MAX_CONNECTIONS`) and a slow request head is dropped (`HEADER_READ_TIMEOUT`), so no flood exhausts the computer. |
| Pictures | By name only, through the desktop scheme's decision; no path, `..`, separator or non-picture name reaches a file. Read-only (`GET`). |
| Files | Only files of a known type inside `--dist`; every segment is percent-decoded and refused when empty, `.`, `..`, containing a separator, a drive colon or a control character, ending in a dot or space, or a Windows device name; the resolved path must stay inside `--dist`. No listing, no fallback. |
| Page content | Every answer carries a `Content-Security-Policy` like the desktop app's (own origin, the model sites for pictures, `connect-src 'self'`, no `unsafe-eval`, no `*`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, `Cross-Origin-Resource-Policy: same-origin`. The marker script is an external file, so `script-src` needs no inline exception. |
| Data folder | One process per folder: the same lock file as the app (`novira_core::startup`). |

Tests: `backend/crates/novira-server/tests/` (`auth.rs`, `commands.rs`, `served.rs` with a test per group above, `events.rs`, `upload.rs`, `export.rs`, `files.rs`, `lifecycle.rs`, with the shared client in `common/`) run the server in process on a free port with a raw HTTP client and cover each guard of the table above, the events, stopping with a page connected, and the lock. Real-engine runs through the page: `docs/verification.md`, "Through the browser server". The shared layer: `backend/crates/novira-core/tests/backend_service/api.rs`.

## Known limits

- The token is in the address the program prints; anyone who can read that console output can use the server for as long as it runs. Every start makes a new one.
- Plain HTTP on loopback: another program of the same user on this computer can connect, and with the token, drive the backend. The token and the `Host`/`Origin` checks defend against web pages, not against local programs.
- `SERVED` includes writes without a dialog: the user's own data, installs, downloads, engine settings, keys and the assistant. On this computer the token does what the window can; the destructive ones (`delete_board`, `delete_images`, `delete_comic`, `delete_model`) are as unguarded as in the app. A home-network device gets only a safe subset: browser-server-lan.md.
- `--open` puts the address, token included, on the command line of `rundll32.exe` for a moment; another program of the same user could read it from the process list.
- Pictures are relative URLs; a page not served by this server gets none.
- No dialogs in the browser: backup and restore, folder scan, adding a model folder and checking a file are not served; their controls say so (`hasNativeDialogs`).
- A page outside the app opens after the server's answer; a browser may block the tab if it takes seconds.
- Events are not kept: a page that was away reads the queue again on reconnect, but progress and log lines in between are lost.
