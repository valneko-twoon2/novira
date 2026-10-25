---
covers:
  - backend/crates/novira-core/src/settings.rs
  - backend/crates/novira-core/src/service/engine_settings.rs
  - backend/crates/novira-core/src/service/memory.rs
  - backend/crates/novira-core/src/comfy/process.rs
  - backend/crates/novira-core/src/unfinished.rs
  - backend/crates/novira-core/src/backup/**
  - backend/crates/novira-core/src/service/backups.rs
  - backend/crates/novira-core/src/types.rs
  - backend/src-tauri/src/command_list.rs
  - backend/src-tauri/src/dialogs.rs
  - frontend/src/features/settings/**
  - frontend/src/state/settings.ts
  - frontend/src/state/uiState.ts
  - frontend/src/state/lowMemory.ts
---
# Settings and engine settings

Settings are the choices that outlive one session: the backend's `settings.json` (which ComfyUI runs, extra model folders, low-memory mode, the Civitai lookup), the Settings screen's tabs that change them, the list of unfinished downloads, the reset of the page's saved state, and backup and restore of the user's data. It also covers the native file dialogs.

## Behaviour

**The file.** `settings.json` sits in the data folder (see runtime.md). `Settings` in `backend/crates/novira-core/src/settings.rs` reads it: a missing key takes its default, unknown keys are ignored, and a broken file stops start-up with the reason (`backend/src-tauri/src/lib.rs`). `Settings::save_key` replaces one key, keeps all others, and writes through `settings.json.tmp`. Keys and defaults:

- `comfyuiUrl` (unset) connects to a running ComfyUI; `comfyuiDir` (unset) uses an existing local ComfyUI folder. The URL decides the address and so the mode shown; with both set, the folder's ComfyUI is started at that address when nothing answers, and the address must be on this PC (see generation.md). With neither, the app runs its own copy.
- `comfyuiPackage`: `nvidia` or `amd`. `comfyuiPython` (unset) and `comfyuiArgs` (`[]`) are passed to the ComfyUI process novira starts.
- `modelRoots` (`[]`): extra model folders, at most 16; model packs kept in them are read too (model-packs.md).
- `gpuLock`: `auto` (the `NOVIRA_GPU_LOCK` variable; no lock when unset), a folder path, or `""` (off).
- `comfyuiStartTimeoutSecs`: 180, allowed 30 to 1800.
- `civitaiLookup`: `false`. `lowMemoryMode`: `false`. `civitaiApiKey` is a plain fallback; the key saved in the Accounts tab is encrypted (see models.md).

**Other tabs.** General, Generation (including the Drafts screen's starting count and position, `draftCount` and `draftPosition`), Gallery, Editing, Comic and text, and Developer change the page's own preferences, stored under `novira.settings` (`frontend/src/state/settings.ts`); their items are in `frontend/src/features/settings/settingsPanes.tsx`.

**Settings: Engine** (`frontend/src/features/settings/EnginePane.tsx`). Shows the data folder and the ComfyUI mode (the URL or folder when set), read-only; `comfyuiPython`, `comfyuiArgs` and `gpuLock` are not shown. Four things change, each checked by the backend first:

- the ComfyUI package; when an install exists and the package differs, the screen asks first;
- the start timeout (a slider, 30 to 1800 s in steps of 10, saved 500 ms after it stops moving);
- the Civitai lookup switch;
- the extra model folders (added through a folder dialog, removed by row).

A change that differs from what the app started with sets `restartNeeded`, and the screen says it applies at the next start. Model folders are read only at start.

**Engine commands.** `engine_settings` returns `EngineSettings` (`backend/crates/novira-core/src/types.rs`). `set_engine_settings` takes an `EngineSettingsPatch` and checks every value before anything is written (`backend/crates/novira-core/src/service/engine_settings.rs`). `add_model_root` takes a folder from the shell's dialog and returns `null` when cancelled; `remove_model_root` takes an index. On the browser server (no dialog) the "add a folder" button and the backup buttons are replaced by a note that they need the desktop app (`hasNativeDialogs`); removing a folder still works.

**Package change.** At the next start after `comfyuiPackage` changes, an install made from another package is replaced by the same ComfyUI version from the saved package, with the extension packs installed again; if the new package does not start, the old one returns (`backend/crates/novira-core/src/comfy/client.rs`). The download is described in extensions.md.

**Low-memory mode** (`backend/crates/novira-core/src/service/memory.rs`, `backend/crates/novira-core/src/comfy/process.rs`). The switch is in Settings: Generation (`low_memory_mode`, `set_low_memory_mode`). Changing it saves `lowMemoryMode`. If novira's ComfyUI is running and no job is in progress, it restarts with `--novram`, which replaces the VRAM flags in `comfyuiArgs` (not used with `--cpu`). Otherwise it applies at the next start. When novira starts no ComfyUI (only `comfyuiUrl` is set), the setting is saved with no effect, and the screen says so. After an out-of-memory failure the toast offers the switch (`frontend/src/state/outOfMemory.ts`).

**Unfinished downloads** (`backend/crates/novira-core/src/unfinished.rs`, Settings: Data). The list shows each partial file (`<name>.part`) with the bytes kept. It looks in `comfyui/.downloads`, `comfyui/.tools`, `models/trustmark` and each `.downloads` folder at most four levels under `models/`. A `.resume` record is listed only when its partial file is gone. A row's delete is immediate; "delete all" asks first. A running download keeps its part (`unfinished::hold`).

**The screen state** (what the pages keep under `novira.*`) is also kept in the database and followed live by the other open pages; see [ui-state-sync.md](ui-state-sync.md).

**Reset of the saved page state** (`frontend/src/state/uiState.ts`, Settings: Data). After a confirmation, one part of browser storage is cleared: `settings` (`novira.settings`, reset in memory at once), `generation` (`novira.params`), `gallery` (`novira.gallery`), `assistant` (`novira.agent`), or `all` (every `novira.` key). Other scopes need a reload, which the screen offers.

**Backup and restore** (`backend/crates/novira-core/src/backup/`, `backend/crates/novira-core/src/service/backups.rs`, `frontend/src/features/settings/BackupSection.tsx`).

- Create (`create_backup`): the page's `novira.` keys go in as `ui-state.json`; the shell asks where to save (default `novira-backup-YYYYMMDD-HHMM.zip`). The zip holds `manifest.json` (format `novira-backup`, version 1, app version, time, counts), `novira.sqlite` (a `VACUUM INTO` copy), `outputs/<name>` for each image in that copy (stored uncompressed) and `thumbnails/<stem>.thumb`. It is written as `.zip.partial` and renamed when complete. Models, ComfyUI, caches, logs, `settings.json`, `agent.json` and `secrets/` are left out.
- Restore (`open_backup`): the zip is checked and unpacked into the `restore-staging` folder of the data folder (see Boundaries). The page shows the date and counts and asks to confirm. Confirming (`confirm_restore`) writes a `READY` marker and restarts; cancelling (`discard_restore`) removes the staged copy.
- Next start, before the database is opened (`restore::apply_pending`, from `backend/crates/novira-core/src/service/mod.rs`): the current database, its WAL and SHM files, `outputs/` and `thumbnails/` move into `backup-before-restore-<date>`, the staged ones move in, and the new database's tables are read. Any failure moves the old data back and reports why; on success the old folder is deleted. The page gets its saved state once (`take_restored_ui_state`) and reloads.

**About dialog** (`frontend/src/features/settings/AboutModal.tsx`). One height on both tabs. The license tab shows the full text of `LICENSE`. The open-source tab lists `ossLicenses.json` and the installed extensions by name and version, narrowed by part or by a name search; each row shows its license text in place, read out of `THIRD_PARTY_NOTICES.txt` by `ossTexts.ts` (software the app downloads later and extensions have none: the row points to the homepage), and opens its homepage through `open_source_page` (see browse.md for the sites it accepts).

**Files the user chooses.** Commands that need a file or folder open the native dialog inside the shell (`backend/src-tauri/src/dialogs.rs`, rfd). The WebView never sends or receives a path, only names, options and a cancelled or done result. This covers the extra model folder, the backup and restore zips, and the export and watermark check (see gallery-share.md).

## Boundaries

| Boundary | Guard |
|---|---|
| Engine settings (`engine_settings`, `set_engine_settings`, `add_model_root`, `remove_model_root`) | Only the ComfyUI package, the start timeout, the Civitai lookup switch and the extra model folders can be changed. `comfyuiUrl` and `comfyuiDir` are shown read-only; the Python, the arguments and the GPU lock are not shown at all. The patch refuses unknown fields; the package must be `nvidia` or `amd` and the timeout a whole number of 30 to 1800 seconds, checked in the backend before anything is written (`settings::check_package`, `check_start_timeout`). A model folder comes only from the folder dialog the shell opens inside `add_model_root` (the page sends no path) and is checked again (`settings::check_new_model_root`): absolute, no `..`, no control characters or device path, an existing folder, not listed yet (compared resolved, and without case on Windows), not the data folder or inside it, at most 16. `remove_model_root` takes only an index into the saved list. Every change is written with `Settings::save_key` (other keys kept, written through a temporary file) and applies at the next start. A changed package reinstalls ComfyUI from the same official addresses as the first install, at the next start, after the user confirms in Settings. |
| Unfinished downloads (`list_unfinished_downloads`, `delete_unfinished_downloads`, `unfinished.rs`) | Only the partial files (`<name>.part` and their `.resume` records) in novira's download folders are listed: `comfyui/.downloads`, `comfyui/.tools`, `models/trustmark`, and every `.downloads` folder at most four levels under `models/`. A delete names entries by the relative path the listing returned; a path the listing does not hold is ignored and is never joined to the data folder, so nothing outside those folders can be deleted. A part a download is writing now is held (`unfinished::hold`, taken by `download_with_stall` and the watermark fetch) and kept. At most 1000 paths, each at most 512 characters with no control characters (`check_picked`). Links are not followed while looking for folders. |
| Files the user chooses (export for sharing, backup, restore) | The shell opens the native dialog itself inside the command (rfd, no dialog plugin); the WebView never sends or receives a path, only names, options and a cancelled / done result. "Open the folder" opens only the folder the shell remembered from its own last export. |
| Restoring a backup zip | Every entry name must be one of the exact names a backup is made of (`manifest.json`, `novira.sqlite`, `ui-state.json`, `outputs/<valid name>`, `thumbnails/<valid stem>.thumb`); absolute paths, `..`, drive letters, backslashes, symlinks and duplicates refuse the whole zip before anything is written. Entries are unpacked with size limits into `restore-staging/` only; the manifest version and the database are checked; the data is replaced at the next start with a roll-back. Backups never contain `secrets/` or `settings.json`. |

## Known limits

- A backup zip holds the user's pictures, prompts and screen state unencrypted; whoever gets the file can read them. The API keys are never in it.
- Unfinished downloads stay on disk until the user deletes them, because a stopped download keeps its part so it can resume. A part another program has open may not be removable; the delete then leaves it and the list shows it again.
- The Civitai lookup of local models (`civitaiLookup`, off by default) sends the SHA-256 of each model file to Civitai, and the Civitai API key with it when one is saved. Turning it on is the user's consent; the setting applies at the next start.

## Not implemented

- Installing or reinstalling ComfyUI from the Settings screen. The app installs its own copy when it is missing (see Behaviour).
- Editing `comfyuiUrl`, `comfyuiDir`, `comfyuiPython`, `comfyuiArgs` and `gpuLock` from the screen: they are changed only in `settings.json`.
