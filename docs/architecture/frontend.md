# frontend/

How the UI is built: the layers and their direction, how screens plug into each other, what each feature folder is for, how the browser mock works. Up: [README.md](README.md). The rules agents follow when changing it: `.claude/rules/frontend.md`.

React 19 + TypeScript + Vite. It reproduces the InvokeAI v6 screens and interactions; inside the desktop app it talks to the Rust backend over Tauri IPC, in a browser it runs on an in-memory mock. Visual direction: flat surfaces with a single blue accent (pure-black dark theme by default), no gradients or glows.

## Layers

From the bottom: `backend/` → `state/` → `ui/` → `features/<name>/` → `app/`, all under `frontend/src/`.

| Layer | What it is |
|---|---|
| `frontend/src/backend/` | The only layer that talks to the outside: `types.ts` (wire types), `client.ts` (the `BackendClient` interface), `tauri/TauriBackend.ts` (IPC, backend events, queue mirror), `http/HttpBackend.ts` (the same Rust backend over HTTP and a WebSocket for events, on a page `novira-server` served), `mock/`, `perf.ts` (start-up marks and the time of every call, for `tools/perf.mjs`; no screen shows them). `index.ts` picks the Tauri client in the app, the HTTP client on a page the server marked (`window.__NOVIRA_SERVER__`), the mock otherwise (`?scenario=empty`, `?engine=install`); the mock is a chunk of its own, and `frontend/src/main.tsx` loads the app (`App.tsx`, a chunk too) once `backendReady` has settled, so the desktop app never loads the mock. Everything above uses the interface and does not know which one answers |
| `frontend/src/state/` | zustand stores, the wiring of backend events into them (`wiring.ts`), and the registries that let features plug into each other |
| `frontend/src/ui/` | shared controls, re-exported by `index.ts`; `canvasDraw/` is the Canvas layer drawing code (render, composite, bounds) that both the Canvas and the comic use |
| `frontend/src/features/<name>/` | one folder per screen or dialog |
| `frontend/src/app/` | the composition root: providers, start-up, layout (`Workspace.tsx`), side navigation, hotkeys; also where the comic and the Canvas parts meet (`ComicWorkspace`, `ComicSide`, `PageInpaintBar`), since features never import each other; `frontend/src/app/phone/` is the phone layout, the same features composed for a narrow screen (`frontend/src/state/layout.ts` says when it shows) |
| `frontend/src/assets/` | files built into the app and imported by the code (the sound-effect pictures of the comic, the page icons); `public/` holds only the browser mock's pictures, which the desktop build leaves out |
| `frontend/src/i18n/`, `frontend/src/theme/` | outside the layers and import none of them: `t()` and the catalogs (`ja` is the source), design tokens (`tokens.css` is the only place for raw colours) |

A layer imports only the layers below it. A feature never imports another feature (except the shared `features/media` and `features/invoke`): features meet in `state/` through registries, for example `registerInvokeBuilder` (a screen says how to build its request) and `registerAgentEditor` (a screen lets the assistant edit it). Network access is allowed only inside `src/backend/`. ESLint (`frontend/scripts/eslint-layers.mjs`) checks the direction; existing exceptions are listed one by one there and may only shrink.

## Conventions

- `frontend/src/app/App.tsx` keeps every screen it has opened mounted, hidden by `<Activity>` while another is shown: a switch shows the screen again instead of building it (its effects stop while hidden, its state stays). The shell itself is built the same way, hidden under the start-up screen once the start-up data is in, so opening the app only shows it. Controls a screen holds by the hundred stay light: a tooltip (`frontend/src/ui/Tooltip.tsx`, not Radix's) is only handlers until it opens, a select builds its list only while open.
- A feature folder holds its own CSS and registers itself from `register.ts` where it plugs into the registries, called from `frontend/src/app/registerFeatures.ts` (its test says which screens must end up with an Invoke builder or an assistant editor); dialog features export their entry point from `index.ts`, which the shell mounts. Which picture or clip a dialog is open on lives in `frontend/src/state/dialogs/`.
- User-visible text lives in `src/i18n/locales/<lang>/<area>.json`; the ja and en area files and the language list (`LOCALES`) are registered in `i18n/catalog.ts`; ja and en are built in, each other language is a chunk (`i18n/bundles/<lang>.ts`) loaded when chosen, before the first render at start-up.
- Tests sit next to the code (`*.test.ts[x]`; snapshots as `*.snapshot.test.ts` with JSON in `__snapshots__/<builder>/`). `frontend/tests/` holds only checks that span the whole source, `frontend/e2e/` the Playwright tests against the mock. Property tests are `*.property.test.ts[x]` (fast-check, fixed run count and seed from `src/propertyTest.testkit.ts`, `fetch` stubbed to throw); a bug one found stays as an `it.fails` test with a `known bug:` comment until fixed.
- The mock is deterministic: the same inputs give the same pictures, `[fail]` in a prompt fails the job. Its pictures come from `public/mock-images/`, which the build leaves out (the dev server serves them); a missing cover gets one only in the mock (`standInCover`), so the desktop app shows an empty cover. Do not add colour fields or synthesized pictures for them.
- Pure helpers a feature shares with another go to `state/` (or `ui/` when they draw), not into the other feature.

## State: what is where

Beyond the plain stores (`ui`, `settings`, `params`, `gallery`, `queue`, `models`, `canvas`, `toasts`, `engine`), these are not obvious from the names:

| Folder or file | What |
|---|---|
| `invoke.ts` | The registry "build a request for this screen" |
| `generationParts.ts` | The txt2img request parts shared by the Generate tab and the comic |
| `agent*.ts` | The assistant: requests and permission question, its chat sessions, its tools as the window runs them (`agentTools.ts`, `agentRegistry.ts`), what it is told about each screen (`agentGuide.ts`) |
| `comfy/` | ComfyUI seen from the frontend: node definitions, pack installs and suggestions, the Registry list, and `graphJob.ts` / `runGraph.ts` to queue an app-written prompt and wait for its result |
| `comic/` | Comic projects: document, store, layout, balloons, requests, persistence; a page's layers are Canvas layers in `page.canvas`, edited through one Canvas store per page (`pageCanvas.ts`, `paintMode.ts`) |
| `pose/`, `poseSkeleton.ts` | The OpenPose skeleton math and presets, shared by the canvas and the comic |
| `prompts/`, `presets/` | The prompt book, tags, wildcards, dynamic prompts; the presets of every generator screen. Starting data is JSON in `seed/` |
| `uiState.ts` | Every `novira.*` storage key, for a backup, after a restore and for a scoped reset |
| `canvas.ts`, `canvasStoreContext.ts` | `canvas.ts` makes Canvas stores (`createCanvasStore`: the Image tab's global one, one per comic page); the context tells the canvas components which store they act on |
| `canvasDocument.ts`, `canvasPersistence.ts` | The saved shape of Canvas layers (shared by the canvas and the comic pages); saving the canvas to the backend a second after a change |

## Features

`frontend/src/features/` has one folder per screen. Most names say what they are; these need a word:

| Folders | What |
|---|---|
| `params/`, `invoke/`, `launchpad/`, `drafts/` | The Generate and Upscaling left panels, the Invoke bar, the start pages per tab, drafts (a batch of half-drawn seeds) |
| `media/`, `video/`, `music/`, `voice/`, `logo/` | The video, music, voice and logo screens; `media/` is what they share (preset card, seed row, model choice, model fit mark) |
| `canvas/`, `text/`, `comic/`, `workflows/` | The Canvas tab, the Text tab, the Comic tab, the node editor and Extensions tab |
| `gallery/`, `viewer/`, `queue/`, `share/` | Gallery, image viewer (its manga finish dialog is `viewer/manga/`), Queue tab, export for sharing (watermark switch, "check a picture") |
| `models/`, `browse/` | The model manager, the Browse tab (Civitai, Hugging Face) |
| `derive/`, `caption/`, `facefix/`, `pose/`, `xyplot/`, `batch/`, `finish/`, `segment/` | Dialogs over a picture, several pictures, a clip or a selection. `derive` redoes a picture with its stored settings, `caption` describes it as a prompt, `finish` smooths or enlarges a clip, `segment` makes a mask for cut-out, erase and inpaint. Most queue a graph through `state/comfy/graphJob.ts` |
| `agent/`, `engine/`, `devlog/`, `splash/`, `settings/`, `downloads/` | What sits around every screen: the assistant, the engine banner, the developer log, the start-up screen and its gate, settings, the download dock |

## The browser mock

`frontend/src/backend/mock/` is the stand-in the browser and the tests use. `MockBackend.ts` is the client; `mockEngine.ts` is the pretend engine (extension packs, ComfyUI version, low-memory mode, engine settings); `imageSynth.ts`, `videoSynth.ts` and `audioSynth.ts` make deterministic results; `agent*.ts` are the assistant's rules as scripted tool calls that run through the window's dispatcher; `guidance.ts` repeats the backend's guidance checks. When a backend behaviour changes, change the mock with it, or the browser tests stop describing the app.

## Outside `src/`

`frontend/scripts/` holds the local lint rules and the scripts tied to the frontend (line ends, i18n and manual sync, `shot.mjs` for screenshots); `frontend/tests/` the whole-source tests; `frontend/e2e/` the Playwright flows, `visual.spec.ts` (baselines in `__screenshots__/`) and the layout scan with the text fit `layout.spec.ts` (rules in `layoutRules.ts`, `textFit.ts`). What each guard stops: [tooling.md](tooling.md).
