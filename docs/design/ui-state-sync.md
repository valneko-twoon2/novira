---
covers:
  - backend/crates/novira-core/src/service/ui_state.rs
  - frontend/src/state/uiStateSync.ts
  - frontend/src/state/uiStateStorage.ts
  - frontend/src/state/uiStateMerge.ts
  - frontend/src/state/rehydrate.ts
  - frontend/src/state/liveStores.ts
---
# The screen state, shared and live

What the pages keep under `novira.*` in the browser's storage (the Generate form, drafts, presets, the prompt book, the preferences) is kept in the backend too, and the pages that are open at the same time follow each other. The reset of the saved state and backup and restore are in [settings-engine.md](settings-engine.md).

## Behaviour

**The screen state is shared by the desktop app and the browser server.** What the pages keep under `novira.*` in the browser's storage (settings, history, drafts, presets, the prompt book) is also kept in the database, as one JSON object in the `meta` table (`ui_state`, `backend/crates/novira-core/src/service/ui_state.rs`), because each shell's storage is its own and both open the same data folder. At start-up, before the stores exist, `adoptBackendUiState` (`frontend/src/state/uiStateSync.ts`, called from `frontend/src/main.tsx`) calls `adopt_ui_state`: the backend's state wins and goes into the storage. A page never synced before sends its own state: it becomes the backend's when the backend has none, else it is kept once in `ui_state_replaced` (the latest only) and replaced. Later changes to a `novira.*` key go out with `save_ui_state` after 0.8 s and when the page is hidden. A backend that cannot be read leaves the page as it is and receives nothing that session. A restore saves its state the same way before the reload. The browser mock keeps it in memory only.

**Live sync between pages** (`frontend/src/state/uiStateSync.ts`, `uiStateMerge.ts`, `rehydrate.ts`, `liveStores.ts`). Pages that are open at the same time on one data folder (the desktop app, the PC's browser page, phones through the home network) follow each other's saved state while they run.

- *Notice.* `save_ui_state` takes the saving page's own random id (`origin`, 1 to 64 letters, digits, `-`, `_`; anything else is dropped to empty) and, once the state is stored, emits `ui_state_changed { origin, revision }` (`BackendEvent::UiStateChanged`, over the Tauri event channel and `/events`). `revision` only grows (milliseconds, raised by one on a tie). The event holds no state; a home-network device receives it like every other event.
- *Read.* A page whose `origin` is not its own reads the state with `adopt_ui_state(null)` (no new command) 150 ms later (bursts are read once). It also reads when it comes back to the screen (a sleeping phone misses events) and when the event socket reopens (`queue_cleared`). The text is checked like the backend does: an object of `novira.*` keys (at most 200 characters) with text values, at most 32 Mi characters; anything else is ignored. The event's two fields are checked too, and an event whose revision is not newer than one already seen is dropped.
- *Merge, per key, last writer wins.* The page remembers, for each key, the backend's text and its own storage text as of the last read or write. A key follows the backend when the backend's text changed since and the page's did not. A key the page changed itself keeps the page's text and is sent next, so the later writer wins; the choice is per key, not per field, because the stores save a whole key (the Generate form is one key). A key the page wrote in the last 2 s is held back and looked at again after 1 s, so the text being typed is not replaced under the cursor. A key the backend dropped is removed from the storage.
- *Apply.* The changed keys are written into the storage, then the stores behind them read it again (`persist.rehydrate()`, through `rehydrate.ts`; the stores are listed once in `liveStores.ts`). Writes made while applying are not changes of the page, and the record of what is in step is taken afterwards, so the page does not send what it just received and two pages do not pass the same change back and forth. A page's own saves come back as events with its own `origin` and are not read.
- *Before sending.* A page reads the backend's state and merges it first, so a save does not put an old copy of a key another page changed a moment ago over the new one. A failed send is tried again with the next change.
- *Per page, not live.* These keys still travel with the saved state (the next start takes the backend's), but a running page does not change them from outside: `novira.settings` (language, theme, zoom and the rest of the preferences), `novira.gallery` (thumbnail size and view choices), `novira.agent` (assistant chats and their window), `novira.canvas`, `novira.workflows` and `novira.text` (documents under edit), `novira.extensions.railWidth`. A key no store has registered is never applied. All other `novira.*` keys follow: the Generate form (prompts, model, LoRAs, reference images, size, seed and the rest, `novira.params`), drafts, the image, logo, music, video, voice, text-style and character presets, the prompt book, wildcard lists and the video, music, voice, logo and manga-finish forms. A test lists the keys the sources write and fails when one is in neither group.

## Boundaries

| Boundary | Guard |
|---|---|
| Screen state (`adopt_ui_state`, `save_ui_state`) | One JSON object of `novira.*` keys (at most 200 characters each) with text values, at most 32 MiB, checked before it is stored in the `meta` table through a bound parameter; the backend does not read the texts. The `origin` a save carries is kept only when it is 1 to 64 letters, digits, `-` or `_`, so the event never carries other text. A page treats the event and the state it fetches as untrusted: it checks both again and applies only keys a registered store reads (`rehydrate.ts`). |

## Known limits

- A state replaced at the first sync (`ui_state_replaced`) can only be read from the database. Settings that suit one shell (the zoom, panel widths) are shared at start-up too, but not live.
- Live sync is per key, last writer wins: if two pages change the same key (for example the prompt) within about a second, the later save is kept and the other change is lost. A save also puts the saving page's per-page keys (the settings) into the shared state, so the next start of a page takes the latest saver's. A page that stays hidden or offline catches up when it is shown again. It was checked with the mock and fake backends and the real stores; not with a real phone.
