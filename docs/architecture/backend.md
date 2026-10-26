# backend/

How the Rust side is built: the three crates, what each module of `novira-core` is for, how a job runs, where data lives and how it is tested. Up: [README.md](README.md). How it works in depth: [../design/README.md](../design/README.md); what is protected and how: [../design/security.md](../design/security.md); the rule for changing boundaries: `.claude/rules/security.md`.

The Cargo workspace root is `backend/` (`Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`, `rustfmt.toml`, build output in `target/`). The Rust backend replaces the mock in `frontend/src/backend/mock/` when the app runs inside Tauri, stores everything under `novira-data/` next to the app, and drives a ComfyUI that it installs and starts itself.

## The crates

| Crate | Path | What |
|---|---|---|
| `novira-core` | `backend/crates/novira-core/` | The whole backend as a plain library. No Tauri, so it is tested without a window |
| `novira-server` | `backend/crates/novira-server/` | The real backend over HTTP on this computer, for a plain web browser (tests and checks drive it with Playwright), and, opened on demand from the page, over a TLS-only listener for the home network (a local CA signs its certificate; it opens on demand and only on a network the owner trusted, and a phone pairs and this computer approves it): serves `frontend/dist`, `POST /api/<command>` through `novira_core::api`, picture uploads and pictures by name, and the backend events over a WebSocket (`/events`). A token per start, `Host`/`Origin` checks; its `build.rs` gives the Windows exe the app's product name, version and icon. [../design/browser-server.md](../design/browser-server.md) |
| `novira` | `backend/src-tauri/` | The thin Tauri 2 shell: window config, IPC commands, capabilities, the `novira-image://` URL scheme. It validates what the WebView sends and calls the service |

The shell (`backend/src-tauri/src/`): `commands.rs` holds the IPC commands (thin: they call `novira_core::api::call`, the shared layer; synchronous ones run through `commands::guard` so a panic does not kill the main thread; dialogs and window commands are written here), `command_list.rs` the registered names, `dialogs.rs` the native folder, save and open dialogs (opened by the shell itself, so the WebView never sends or receives a path), `events.rs` the bridge from backend events to the `novira://event` channel, `image_scheme.rs` the image URL scheme (names only, never paths; the decision is `novira_core::image_serve`), `startup.rs` the dialog shown when the start fails (the lock in the data folder that refuses a second copy is `novira_core::startup`).

## novira-core

`backend/crates/novira-core/src/`. The top-level files are shared by every part:

| File | What |
|---|---|
| `api.rs` | The one command layer both shells call: every command written once (name, named JSON arguments, checks), as a typed function for Tauri and as `dispatch` for the browser server |
| `startup.rs`, `image_serve.rs` | Opening the data folder under its lock (one process per folder); what a picture URL path serves (`/<full|thumb>/<name>`) |
| `types.rs` (and `types/`) | The wire types, mirrored by `frontend/src/backend/types.ts`; unit tests in `types/tests.rs` |
| `engine.rs` | The `Engine` trait, jobs, outputs, status |
| `db.rs` | SQLite, one JSON document per row; the only file that uses `rusqlite` |
| `settings.rs` | `settings.json`; the `Settings` type is the source of truth for every setting |
| `endpoints.rs` | The addresses of outside services (Civitai, Hugging Face, GitHub, 7-Zip, TrustMark); a debug build can point them at a loopback test server |
| `secret.rs` | The Civitai key and Hugging Face token in the Windows Credential Manager; the other saved keys and the content-credential signing key encrypted with Windows DPAPI |
| `sync.rs` | Lock helpers that survive a panic (`lock_safe`, `read_safe`, `write_safe`); no `unwrap` on a lock |
| `child_job.rs` | A Windows job object: ComfyUI and the voice worker die with the app, even when it is killed |
| `gpu_lock.rs`, `hardware.rs`, `fonts.rs` | The GPU lock directory and its owner record; the card and its memory; the installed font families |
| `applog.rs`, `unfinished.rs`, `packs.rs`, `test_timing.rs` | The log (stderr, `logs/novira.log`, developer log events); partial files of interrupted downloads; model packs of ComfyUI files (video, music, LaMa, Z-Image-Turbo); debug-only shortened waits for tests |

| Folder | What |
|---|---|
| `service/` | What the frontend's `BackendClient` calls: one module per area on one shared state (`mod.rs`). `queue.rs`, `worker.rs` and `guidance.rs` are the job path; `model_store.rs`, `pack_store.rs`, `node_pack_store.rs` the installs; `engine_settings.rs`, `memory.rs`, `keys.rs`, `backups.rs`, `share.rs`, `assistant.rs`, `canvas.rs`, `comics.rs`, `workflows.rs`, `boards.rs`, `gallery.rs`, `browse.rs` the rest |
| `comfy/` | ComfyUI as the engine: installed, started and owned by the app (`install.rs`, `process.rs`: loopback only), the HTTP and WebSocket client (`client.rs`), and the prompt builders (`graph.rs` for pictures, `video.rs`, `music.rs`, `logo.rs`, `user_graph.rs` for the workflow editor). `node_packs.rs` and `registry.rs` are extension packs and the ComfyUI Registry. Snapshot tests of built prompts are in `comfy/__snapshots__/graph/` |
| `models/` | Model folders under `novira-data/models`, safetensors header → kind, the installed list, install from a source, Civitai and Hugging Face search, the adult-content filter |
| `agent/` | The AI assistant through the `claude` / `codex` CLI or an OpenAI-compatible server. It acts through the app's tools: `tools.rs` (names, schemas, checks), `mcp.rs` (the loopback tool server, `dispatch` is the one path every tool call takes), `relay.rs` (calls to the window and its answers), `prompt.rs` (what it is told) |
| `voice/` | The voice engine: Qwen3-TTS in a worker process, its installer |
| `media/` | Gallery files (PNG / MP4, thumbnails, embedded metadata, upload limits, name checks), clean copies for sharing, audio |
| `provenance/` | The "made with AI" marks on exported copies (TrustMark watermark, XMP, C2PA manifests) and the check that reads them |
| `backup/` | The backup zip and the restore into `restore-staging/`, applied at the next start with roll-back |
| `data_location/` | Where the data folder is (a pointer file in the user's config folder), and the move of the data into a new folder at the next start |
| `first_run/` | The first start: when it is one, and writing the folders it asked for (data folder pointer, ComfyUI folder setting); the shell's `first_run.rs` holds its IPC commands |

## How a job runs

The screen asks `queue` to enqueue a request; `guidance.rs` checks the mask, control layers and reference images and resolves models and pictures. The worker (`worker.rs`) takes pending jobs, builds a prompt with `comfy/graph.rs` (or `video`, `music`, `logo`, `user_graph`), sends it through `comfy/client.rs`, follows progress, stores the results (pictures, files, text) and emits events. The shell forwards the events to the window, and `frontend/src/state/wiring.ts` puts them into the stores. A queue item moves through pending, in progress, then completed, failed or canceled; pause, cancel, retry and restart are in `queue.rs` (the `/testing` skill has the transition tables).

## Data on disk

`novira-data/` (the repository root in debug builds; the user folder in release builds, or beside the executable where one already exists; `NOVIRA_DATA_DIR` changes it):

```text
novira-data/
├─ novira.sqlite              # one JSON document per row (db.rs)
├─ outputs/  thumbnails/      # gallery files
├─ trash/                     # deleted pictures that can still be taken back (14 days, 500 at most)
├─ models/                    # model folders (models/layout.rs)
├─ comfyui/                   # the installed ComfyUI and its Python (unless settings point at another one)
├─ secrets/                   # DPAPI-encrypted keys, and the id of this folder's Credential Manager entries (secret.rs)
├─ cache/  logs/              # ComfyUI caches; novira.log (rotated)
├─ settings.json  agent.json
└─ restore-staging/  backup-before-restore-<date>/   # while a restore is pending; during one at start-up
```

## Tests

Unit tests sit in each `.rs` file (`mod tests`), or in `<name>/tests.rs` next to a long one. `backend/crates/novira-core/tests/` holds:

| Kind | What |
|---|---|
| `backend_service/` | The service with a fake engine, one module per area |
| `comfy_fake_server/`, `fake_site/` | The client against a fake ComfyUI; a loopback server standing in for Civitai, Hugging Face and GitHub, used by the `*_download_fake` tests |
| `contract/` | The fixtures of the repo-root `contract/` against the wire types |
| `prop_*.rs` | Property tests (proptest, in process): hostile names, paths, URLs, JSON and bytes into pure functions and parsers |
| other `*.rs` | Failure and waiting paths made real (a damaged database, a held file, a retry that runs out), the assistant with fake CLIs, export with the watermark |
| `*_live.rs` | `#[ignore]`d: network, CLIs or a running ComfyUI; run by name when the change is about them |

The shell has `backend/src-tauri/tests/` (`security/`, `window_config.rs`, `robustness.rs`). Which tests to run for a change: `.claude/rules/regression-tests.md`.
