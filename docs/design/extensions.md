---
covers:
  - backend/crates/novira-core/src/comfy/node_packs.rs
  - backend/crates/novira-core/src/comfy/node_packs/**
  - backend/crates/novira-core/src/comfy/registry.rs
  - backend/crates/novira-core/src/comfy/install.rs
  - backend/crates/novira-core/src/comfy/switch.rs
  - backend/crates/novira-core/src/comfy/client.rs
  - backend/crates/novira-core/src/service/node_pack_store.rs
  - backend/crates/novira-core/src/endpoints.rs
  - backend/src-tauri/src/command_list.rs
  - frontend/src/state/comfy/nodePacks.ts
  - frontend/src/state/comfy/registry.ts
  - frontend/src/state/comfy/packCatalog.ts
  - frontend/src/state/comfy/versions.ts
---
# ComfyUI extensions

Extensions are the custom node packs that ComfyUI loads on top of its own, and the ComfyUI release that novira installs and runs itself. This feature installs, updates, removes and restarts packs from GitHub, lists the packs of the ComfyUI Registry, and installs or switches the ComfyUI package. Model files are in models.md; the graphs that use a pack's nodes are in generation.md.

## Behaviour

### Node packs

- Packs are the folders of ComfyUI's `custom_nodes`. `node_packs::list` skips folders whose name starts with `.`, is `__pycache__`, or ends in `.disabled`. A pack novira installed has a marker file, `.novira-pack.json`, with its repository address and tag (no tag for the default branch). A pack put there by hand has neither and is listed without an address.
- Packs are managed only when novira knows the ComfyUI folder and its Python (`NodePacks.available`): its own copy, or a `comfyuiDir`. Otherwise the list is empty and install and remove are refused. The Python is `comfyuiPython` when set, else a `venv` or `.venv` in the folder, else the `python_embeded` of the portable package. Without any of them, packs are unavailable.
- Install (`install_node_pack`, with an optional `version`): the address must be `https://github.com/<owner>/<repo>` (`parse_github`; a trailing `.git` or slash is accepted). The archive is the default branch (`zip/HEAD`) or the tag (`zip/refs/tags/<tag>`), from `codeload.github.com`. The install runs in the background, one per repository (a second request for the same pack returns at once). Progress arrives as `node_pack` events; `cancel_node_pack` stops it.
- Steps, in order: download the archive into a hidden `.novira-<uuid>` folder in `custom_nodes`; unpack it with ComfyUI's Python; fetch each submodule listed in the repository's `.gitmodules` (GitHub only, pinned to the commit the repository records at that tag, else `HEAD`); write the marker; move an installed folder of the same name aside and move the new one in (up to 8 retries while Windows refuses access); install the requirements with pip under constraints that keep ComfyUI's PyTorch packages (`torch`, `torchvision`, `torchaudio`, `xformers`) at their installed versions; run `install.py` if present. If a step fails after the move, the old folder is put back.
- Pack needs (`node_packs.rs`): `extra_requirements` adds libraries a pack needs but does not list (`opencv-python-headless` for Nekodificador's NKD Basic Tools; `triton-windows` for 1038lab's ComfyUI-RMBG on Windows). `skipped_requirements` leaves out lines that would replace files the running ComfyUI holds or break a pinned library (`mediapipe` and `albumentationsx` for Fannovel16's comfyui_controlnet_aux). The pack's own `requirements.txt` is not changed.
- `node_pack_versions` gives the latest 50 tags, newest first. `node_pack_info` gives the author, the licence (SPDX id), the description and the star count.
- `remove_node_pack` deletes one plain folder name directly under `custom_nodes`.
- `restart_engine` stops and starts ComfyUI so it loads the changed packs. It is refused while a job is in progress. It works for the ComfyUI novira starts (its own copy, or `comfyuiDir`); for a server given only as `comfyuiUrl` the user restarts it. A finished install and a removal set `restartNeeded`; a restart clears it.
- ComfyUI Registry (`registry_nodes`, `comfy/registry.rs`): reads `api.comfy.org/nodes` at 100 packs a page, up to 200 pages, sixteen requests at a time (about 4 s for the 60 pages today; six at a time took about 9.5 s, measured 2026-10-13). It keeps active packs whose repository is on GitHub and sorts them by downloads. The list is kept in memory and in `cache/registry-nodes.json` of the data folder (written through a temporary name; read back with the same checks as a fresh answer, and not read past 40 MB). A list younger than an hour is returned as it is; an older one, in memory or on disk from an earlier start, is returned at once and read again in the background (one read at a time; a failed one keeps the old list). Only the first read with no copy, and `refresh`, wait for the site. Installing from it is the same call as installing from a GitHub address.
- Pack routes: `node_packs::PACK_ROUTES` lists `nkd/facerig/`, the routes the Face Rig editor calls through `pack_call`. Any other route is refused. `route_allowed` also refuses `..`, `//`, `?`, `#`, `\`, `%` and control characters.

### ComfyUI itself

- Windows only. When novira's own ComfyUI is missing, it is installed the first time ComfyUI is needed: in the background at start (`prepare_engine`), and before a job or a pack request. The package is the official portable release named by `comfyuiPackage` (`nvidia` by default, or `amd`), from `github.com/comfyanonymous/ComfyUI/releases/latest/download/`. The 7-Zip console tool `7zr.exe` is fetched once from `www.7-zip.org` into the install's `.tools` folder.
- The archive downloads under a `.part` name and is renamed when complete, then is unpacked into a `.unpacking` folder, and the `portable` folder is moved into place. A finished archive is kept when unpacking fails, except when 7-Zip reports it damaged; then it is deleted and fetched again. Each move is tried up to 60 times, one second apart, while Windows refuses access (antivirus scanners hold new files).
- Progress is reported as `engine_status`: `downloading` (with bytes), `extracting`, `starting`, `ready`, `error`.
- The package an install came from is written to `portable/novira-package.txt`. An install without that record is taken to be from the package the settings name, the first time it is needed (`adopt_package`).
- Package change: when the record names another package than the settings, the next start (the first time ComfyUI is needed) installs the same ComfyUI version from the settings' package, through the switch described below, and then starts it. If the new package does not start, the old one is put back. Settings asks for confirmation before saving the change (see settings-engine.md).
- Version switch: `comfy_versions` lists the latest 50 releases of `comfyanonymous/ComfyUI`, without drafts, pre-releases or names that are not plain tags. `switch_comfy_version` (`comfy/switch.rs`) is refused while a job is in progress or a pack install runs, and works only for an install novira made. It stops ComfyUI, installs the release package with the current `portable` folder kept as `.previous`, moves the old pack folders into the new `custom_nodes` (where both have a folder, the new package's copy stays; `__pycache__` is not moved), reinstalls every pack that has a marker at its recorded tag (packs put there by hand are moved but not reinstalled), starts ComfyUI, and deletes `.previous`. A pack that fails to reinstall is reported by folder name and does not undo the switch. If ComfyUI does not start, `.previous` is put back, the old version is started, and the error says so.
- Python steps of packs (unpacking, pip, `install.py`) run with caches under the data folder's `cache` folder (`PIP_CACHE_DIR`, `HF_HOME`, `TORCH_HOME`, `TEMP`, `TMP`) and without a console window (`confine` in `node_packs.rs`).

### Pack needs in generation

- Reference images need `ComfyUI_IPAdapter_plus` (node `IPAdapterAdvanced`). `validate` checks for the node before anything is uploaded, so a job without the pack fails at once. The reference-image notice (`frontend/src/features/params/refImages/RefImagePackNeeds.tsx`) offers the install and asks for a restart after it.
- Manga finish (the viewer's "Finish as manga page"): a step on a picture that already exists, never part of drawing. `frontend/src/features/viewer/manga/` runs a graph job through `graphRequest` and `runJob` (no IPC command of its own): `LoadImage` to one `MangaFinish` node of the ComfyUI-MangaScreen pack (screen lines, white point, black point, gradation, white lines; the node's tone and pen defaults fixed) to `SaveImage`. A try is an `intermediate` picture, so the gallery lists do not show it; saving runs the same graph with the `gallery` destination on the original's board, as a new ordinary picture that keeps the original's prompts, model and seed and the workflow name "Manga finish" (the original is never changed). The values are `useMangaFinish` (`state/mangaFinish.ts`, kept in `novira.mangaFinish`). The pack is `ComfyUI-MangaScreen` (MIT, catalog id `mangascreen`): while it is missing, or installed but not yet loaded, the dialog shows the install, then the restart, and disables Try and Save. The wire type still has `GenerationMetadata.mangaScreen` and `graph.rs` still builds `MANGA_NODE` for it, but no screen sends it any more; the form's `manga` key and a comic's saved `manga` draw setting are ignored when read.

## Boundaries

| Boundary | Guard |
|---|---|
| Custom node packs and their versions | `https://github.com/<owner>/<repo>` only, with plain owner and repository names (`node_packs::parse_github`). A version is a tag name of plain characters (letters, digits, `.`, `_`, `-`, `+`; no `..`, not starting with `-` or `.`, at most 100 characters; `node_packs::valid_tag`), checked at the command and again before the archive address `codeload.github.com/<owner>/<repo>/zip/refs/tags/<tag>` is built. The list of versions (the latest 50 tags) comes from `api.github.com/.../tags`, capped at 1 MB; names that are not plain tags are dropped. `node_pack_info` reads the repository's record from `api.github.com` for the author, licence id (at most 40 characters, `NOASSERTION` dropped), description (cut to 300 characters) and star count; the page shows them as text. `registry_nodes` reads the registry's pages (100 packs each, at most 200 pages, each capped at 5 MB) and keeps only active packs whose repository passes `parse_github`; every text field is cut to a length and stripped of control characters, a licence over 40 characters is dropped, a version must pass `valid_tag`, and an icon address is kept only when it is `https` on exactly `raw.githubusercontent.com` or `avatars.githubusercontent.com` (so the page can show it under the CSP, as an image only). The result is cached in memory and on disk (the disk copy is checked again when read). Installing from it uses the same checked path as any GitHub address. The version novira installed is written in the pack's marker file and read back as data only. |
| Switching the ComfyUI version | `switch_comfy_version` takes a release tag that passes the same plain-name check as pack versions (`valid_tag`), is refused while a job is in progress or a pack install runs, and only works on the ComfyUI novira installed itself (otherwise an error). The package comes from `github.com/comfyanonymous/ComfyUI/releases/download/<tag>/<fixed file name>` over `https` (the address service in `endpoints.rs`); the list of the latest 50 releases comes from `api.github.com/repos/comfyanonymous/ComfyUI/releases`, capped at 1 MB, with drafts, pre-releases and non-plain tags dropped. The unpacking uses the same 7-Zip tool and temporary folder (`.unpacking`) as the first install; the old package is kept in `.previous` until the new one answers and put back if it does not, and extension folders move by rename inside the install folder. |

## Known limits

- The ComfyUI package and `7zr.exe` are fetched over HTTPS from their official hosts without a separate signature or hash check.
- Reference images run nodes of a third-party custom node pack (ComfyUI_IPAdapter_plus, marked `unmaintained` in `frontend/src/state/comfy/packCatalog.ts`) inside ComfyUI's Python. It is installed only when the user asks for it, from the default branch of its GitHub repository unless the user picks a tag.
- Registry extension descriptions and the node descriptions of installed packs are written by third parties and reach the assistant's model through `search_extensions` (see assistant.md). The instructions treat them as data, but a model can still be misled by hostile text. The damage is bounded: the assistant cannot install, delete or run anything, nothing is installed until the user presses the card's install button, and every change of a request can be undone at once. A misled model could still change settings and editors, queue generation, or read prompts when the user allows it.

## Not implemented

- Version requirements of catalog packs: the check that marks a version as not recommended exists (`frontend/src/state/comfy/versions.ts`), but no entry of the pack catalog has a `requires` list yet.
