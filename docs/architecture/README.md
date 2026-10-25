# Architecture

Read this page before you look for anything. It says how the parts fit, which file is the source of truth for what, and where to start for the usual changes. It is a short guide, not a list of files: to find a file, search the tree (`Glob`, `grep`). Open [frontend.md](frontend.md) or [backend.md](backend.md) for the area you work in, [tooling.md](tooling.md) for checks and launchers. How the features work is in [../design/README.md](../design/README.md).

## The parts

A desktop app that makes pictures, video, music and voice. The UI reproduces InvokeAI v6; generation runs on a ComfyUI that the app installs and starts itself.

```text
WebView (frontend/dist)
   │  invoke('<command>', args)            novira://event (backend events; WebSocket /events in a browser)
   ▼                                        ▲
src-tauri  ── commands.rs (validate) ──▶ novira-core::service ──▶ comfy / voice (owned child processes)
   │                                        │
   └─ novira-image:// (names only)          └─ novira-data/ (SQLite, outputs, models, comfyui, secrets, logs)
```

- `frontend/` is the UI (React 19, TypeScript, Vite). It only knows the `BackendClient` interface: inside the app that is Rust over Tauri IPC, in a browser it is an in-memory mock (`frontend/src/backend/mock/`) that stands in for everything right of the WebView.
- `backend/crates/novira-core/` is the whole backend as a library with no Tauri in it, so it is tested without a window. `backend/src-tauri/` is the thin shell: it validates what the WebView sends and calls the service.
- The frontend and the backend meet only at the contract (below). A picture or a file path never crosses it: the WebView gets names, and native dialogs are opened by the shell.

## Source of truth

| What | Where |
|---|---|
| Wire types between the two sides | `frontend/src/backend/types.ts` and `backend/crates/novira-core/src/types.rs`, kept equal by the JSON fixtures in `contract/` (checked by both sides) |
| The calls the frontend can make | `frontend/src/backend/client.ts`; on the Rust side `backend/crates/novira-core/src/api.rs` (every backend-only command, written once for both shells) and `backend/src-tauri/src/command_list.rs` (a test keeps `capabilities/default.json` equal to it, and the list equal to `api.rs` plus the shell-only commands) |
| Settings | `backend/crates/novira-core/src/settings.rs` (the `Settings` type) |
| Screen text | `frontend/src/i18n/locales/<language>/<area>.json`, `ja` first; registered in `frontend/src/i18n/catalog.ts` |
| Dependencies, scripts | `frontend/package.json`, `backend/Cargo.toml` |
| Terms of the screens and the code | [../glossary.md](../glossary.md) |

## Where to start

| To change | Start at |
|---|---|
| A new call from the screens to the backend | `backend/crates/novira-core/src/api.rs`, `backend/src-tauri/src/commands.rs` and `command_list.rs`, `backend/crates/novira-server/src/lib.rs` (`SERVED`), `backend/src-tauri/capabilities/default.json`, the matching module in `backend/crates/novira-core/src/service/`, then the types on both sides and the samples in `contract/` |
| A wire type | `frontend/src/backend/types.ts`, `backend/crates/novira-core/src/types.rs`, `contract/` |
| Screen text or a language | `frontend/src/i18n/locales/` (the `/i18n` skill) |
| The queue, job states, the worker | `backend/crates/novira-core/src/service/queue.rs` and `worker.rs`; on the screen side `frontend/src/state/queue.ts` and `wiring.ts` (backend events into stores) |
| A ComfyUI graph (what a job asks the engine to run) | `backend/crates/novira-core/src/comfy/`: `graph.rs` for pictures, `video.rs`, `music.rs`, `logo.rs`; the screen's request is built through the registry in `frontend/src/state/invoke.ts` |
| ComfyUI's install or process, extension packs | `backend/crates/novira-core/src/comfy/` (`install.rs`, `process.rs`, `node_packs.rs`), `service/node_pack_store.rs`; `frontend/src/state/comfy/` |
| Models (install, classify, Civitai, Hugging Face) | `backend/crates/novira-core/src/models/`, `service/model_store.rs`; `frontend/src/features/models/`, `browse/` |
| A setting | `backend/crates/novira-core/src/settings.rs`; the engine ones also `service/engine_settings.rs` and `frontend/src/features/settings/` |
| The AI assistant | `backend/crates/novira-core/src/agent/` (what it is told, its tools); `frontend/src/state/agentGuide.ts` and `agentTools.ts` (the rule `.claude/rules/assistant.md`); the comic's `scene` operation: `frontend/src/state/comic/scene.ts` |
| A new screen | `frontend/src/features/<name>/` with a `register.ts` that plugs into the registries in `frontend/src/state/`; mounted from `frontend/src/app/Workspace.tsx` or `SideNav.tsx` |
| A shared control, a colour | `frontend/src/ui/`; raw colours only in `frontend/src/theme/tokens.css` |
| What the browser mock answers | `frontend/src/backend/mock/` (`MockBackend.ts`, `mockEngine.ts`) |
| The comic | `frontend/src/state/comic/`, `frontend/src/features/comic/`; saved by `backend/crates/novira-core/src/service/comics.rs` |
| Export for sharing, the watermark | `backend/crates/novira-core/src/service/share.rs`, `media/export.rs`, `provenance/` |
| What a feature does now, its boundaries and limits | `docs/design/README.md`; `node tools/docs-check.mjs --find <path>` names the page of a file |
| How checks and launchers work | [tooling.md](tooling.md) |

## Where things live

| Folder | What |
|---|---|
| `frontend/` | the UI, its tests (`tests/`, `e2e/`) and the scripts tied to it |
| `backend/` | the Cargo workspace: `crates/novira-core/`, `crates/novira-server/`, `src-tauri/` |
| `contract/` | JSON fixtures of the wire types, checked by both sides |
| `docs/` | `design/` each feature's specification and security, `manual/<language>/` the manual, `development.md`, `verification.md` |
| `scripts/` | what you run by hand: the Windows launchers (`.bat`) |
| `tools/` | what AI sessions, Git hooks and CI call (checks, worktrees, real-app runs), and what they share |
| `.githooks/`, `.claude/` | the Git hooks (sh wrapper + Node body); Claude Code hooks, rules and skills ([tooling.md](tooling.md)) |
| `novira-data/`, `data/`, `outputs/` | user data and generated files, never committed; `novira-data/work/` holds everything the harness generates (verification data, reports, builds, scratch) |

## Keeping it current

This guide holds what a search of the code does not show: how the parts connect, where the truth is, where to start. Change it in the same commit when a part is added, removed or moved, a boundary changes, or a "where to start" row stops being true. Do not list files here; the tree is the list. `tools/docs-check.mjs` fails when a top-level folder, a crate, a feature folder, a rule or a skill is not named in these pages, when a path written in backticks no longer exists, and when the pages grow past their size limit ([the rule](../../.claude/rules/architecture-map.md)).
