---
covers:
  - backend/src-tauri/capabilities/**
  - backend/src-tauri/tauri.conf.json
  - backend/src-tauri/src/command_list.rs
  - backend/src-tauri/src/commands.rs
  - backend/src-tauri/tests/security/**
  - frontend/scripts/eslint-security.mjs
  - .claude/rules/security.md
---
# Security design

What the desktop app protects, how, and what it knowingly leaves open. This page holds what is common to every feature: what is at stake, who is considered an attacker, the two boundaries every call crosses (IPC and the WebView's content), where the boundaries of each feature are written, the limits that belong to no single feature, and how to re-check after a change. The boundaries and known limits of a feature are on its own page, next to its behaviour.

## What is at stake

- Secrets: the Civitai API key, the Hugging Face token, the API key of an OpenAI-compatible server the assistant is connected to, and the private key that signs content credentials on exports.
- The user's files: the app reads model files the user points at, writes into its own `novira-data/` folder, and must not be talked into reading or writing anywhere else.
- The user's PC: the app starts other programs (ComfyUI's Python, `claude` / `codex`, the browser) and downloads multi-gigabyte files.

Attackers considered: a malicious or compromised web page or model listing (data from Civitai / Hugging Face), a malicious model file or image, a script that ends up running in the WebView, and other local programs. A person who already controls the user's account is out of scope.

## The boundaries every call crosses

| Boundary | Guard |
|---|---|
| WebView to Rust (IPC) | Only novira's own commands are allowed (`backend/src-tauri/capabilities/default.json`; a test keeps it equal to the registered list in `backend/src-tauri/src/command_list.rs`). No fs, shell, http or opener plugin. The `main` window only; remote pages get no capability. |
| WebView content | CSP in `backend/src-tauri/tauri.conf.json`: own origin for scripts and connections; pictures only from the image scheme and the model sites, media (a video cover in Browse) only from the image scheme and `https://*.civitai.com`; `object-src`, `frame-src`, `form-action` and `base-uri` closed. The UI renders data through React (no `innerHTML`); descriptions from Civitai are turned into plain text in the backend. |

A command validates what it receives at the boundary, not in the caller; the WebView never sends or receives a file path (the shell opens native dialogs itself) and gets pictures by generated name only.

## Where the boundaries of a feature are

| Page | Boundaries it holds |
|---|---|
| [runtime.md](runtime.md) | the database (fixed SQL, bound parameters) |
| [browser-server.md](browser-server.md) | the browser server: loopback (the home network, opened on demand), the per-start token, the `Host` and `Origin` checks, the served commands, the event socket, uploads, picture names, files of the frontend folder |
| [browser-server-pairing.md](browser-server-pairing.md) | pairing a device: the code in the fragment, the public pairing routes, this computer's approval, sessions bound to an address, the rate limit |
| [browser-server-lan.md](browser-server-lan.md) | the home network, opened on demand: the TLS-only listener, the local CA and its name constraints, which connections are answered (the subnet check), the `Host` and `Origin` of the home address |
| [generation.md](generation.md) | pictures a job uses, the local engine |
| [models.md](models.md) | model downloads, the local files a folder scan lists, secrets in transit and at rest |
| [browse.md](browse.md) | opening pages of Civitai and Hugging Face |
| [extensions.md](extensions.md) | custom node packs and their versions, switching the ComfyUI version |
| [assistant.md](assistant.md) | the assistant (CLI and OpenAI-compatible server), its tool server, its reads of pictures and prompts |
| [assistant-web-lookup.md](assistant-web-lookup.md) | the assistant's fact look-up (`lookup_reference`): the only request made from words the model wrote, to `ja.wikipedia.org` / `en.wikipedia.org` only, after the user allows it |
| [gallery-share.md](gallery-share.md) | the image scheme, uploaded pictures, the export watermark files, checking a picture, the signing key of content credentials |
| [comic-canvas.md](comic-canvas.md) | the canvas document, comic projects, installed font names |
| [settings-engine.md](settings-engine.md) | engine settings, unfinished downloads, files the user chooses, restoring a backup zip |
| [ui-state-sync.md](ui-state-sync.md) | the shared screen state: its size and shape checks, the page id and event a save sends, what a page takes from another page |

A new command, URL, path, process or place where data from outside is used goes into the table of the feature it belongs to, in the same commit.

## Known limits that belong to no single feature

- `c2pa` turns on serde_json's `preserve_order`, so JSON objects keep the order their keys were added in throughout the backend; nothing in novira compares JSON text, and the graph snapshots sort keys before comparing.
- Dependency findings: `cargo audit` (2026-10-24) reports RUSTSEC-2023-0071 (Marvin timing attack) in `rsa`, which `c2pa` uses only to verify RSA-signed manifests from outside; the attack recovers a private key from timing of private-key operations, and novira holds no RSA key (it signs with ES256). `zip` 8.6.0 has three advisories (RUSTSEC-2026-0367/0368/0369) about symlink and SUID handling when a whole archive is extracted to disk; novira never does that (it reads entries one by one for backups, exports and content credentials), so they do not reach its own use, and the fix (`zip` 9) is a major bump that waits on `c2pa`: an open decision, not taken alone. rustls is compiled only into `novira-server` (its home-network listener), at 0.23.46 with rustls-webpki 0.103.16, the releases that fix RUSTSEC-2026-0346 through -0349 and -0382; the app itself has none (`reqwest` uses native TLS). RUSTSEC-2026-0383 (`webpki-root-certs`) is in the lock file but in no compiled tree. RUSTSEC-2026-0387 (timing in `crypto-bigint` 0.5) reaches `c2pa`'s ES256 signing on export through `elliptic-curve`; the fix (0.7) waits on `c2pa`, an open decision like `zip`. Unmaintained or unsound warnings remain in build-time macros (`paste`, proc-macro-error), in `glib` (Linux GTK), and in `tokio` (RUSTSEC-2026-0386). `npm audit --omit=dev` reports 0 vulnerabilities in the shipped frontend dependencies.
- The addresses of outside services live in `endpoints.rs`; only debug builds (`debug_assertions`) let a test point them at a loopback server, so a release build cannot be redirected this way.
- Secrets are encrypted with the user's Windows account, not against another program of the same user; this and the other limits of a feature are on its page.
- The browser server (`novira-server`) is a second front for the same commands. A page there has no IPC capability list; its stand-ins are the per-start token, the `Host` and `Origin` checks (also on the event socket and the upload) and the list `SERVED`. A command is served only when the backend's own checks already make it safe for the app's window: keys are write-only (stored with DPAPI, never returned), a local model file path is refused (the app takes one only from its own folder scan), nothing that opens a dialog or restores a backup is served. A page outside the app (Civitai, Hugging Face, a model's source page) comes back as the address the backend built and checked, and the page opens it in a new tab, so the browser opens no site the app would not. On this computer (a loopback peer) whoever holds the token can do what the window can, so the token is never logged, and another local program that reads the console or the process list is the same limit as above. So is one that serves another port of the same host: a browser sends a host's cookies to every port (the cookie's name carries the port only so two servers keep their own tokens). A device on the home network (opened on demand) reaches only a TLS listener whose certificate a CA made on this computer signs, gets in only with a session this computer approved (the start token is no credential there), and gets only a safe subset: `LOOPBACK_ONLY` (installs and pack/engine version changes, engine and model-folder settings, the keys, the assistant's setup) is refused there even with the token, and the listener opens only on a network this computer's owner trusted (by its gateway) and closes after 30 minutes unused. A phone is let in only after the person at this computer compares the number both screens show and allows it, and should trust the CA only after comparing its fingerprint with the one this computer shows (the gaps: a photographed QR code within its two minutes, and approving without looking). So a stolen session drives generation, the gallery and a chat with the assistant (which acts only through the app's tools), not an install, a settings change, a key or a new assistant server. Reasons per group: [browser-server.md](browser-server.md); the home network: [browser-server-lan.md](browser-server-lan.md).

## Re-checking

After a change that adds a command, a URL, a path, a process or a place where data from outside is used: update the capability list, validate at the boundary (not in the caller), add a test with a hostile input, and run `cargo audit` and `npm run audit` (in `frontend/`, `npm audit --omit=dev`). The per-change checklist for agents is `.claude/rules/security.md`.

Mechanical checks (each states its limits next to its code):

| Check | Guards |
|---|---|
| ESLint `novira-security/*` with `no-eval`, `no-implied-eval`, `no-new-func`, `no-script-url` (`frontend/scripts/eslint-security.mjs`) | No HTML strings into the DOM (`dangerouslySetInnerHTML`, `innerHTML` / `outerHTML` / `srcdoc` assignment, `insertAdjacentHTML`, `document.write`), no dynamic code, and other windows only through `openInNewWindow` in `src/backend`. Syntactic only. |
| `cargo test -p novira --test security` (`backend/src-tauri/tests/security/`) | `config`: the CSP's critical directives, `devCsp`, the asset protocol, no Tauri plugin dependency, a single capability file. `source_scan`: no command interpreter started from Rust (`build.rs` allowed), SQL text takes only `Table::name()`, `rusqlite` only in the database module. `secrets`: credential shapes and key files in everything git would commit. Text scans; aliases, assembled strings, history and unknown key formats are not seen. |
| `cargo test -p novira` (`the_capability_allows_exactly_the_registered_commands`) | The capability equals the registered commands, has no plugin permission and applies to the `main` window only. |
| Unit tests next to the guards (`images`, `models::install`, `image_serve`, `service::guidance`, `backup`; zip-slip and foreign backups in `tests/backend_service/backup.rs`) | Name validation, traversal, URL parsing, size limits and guidance limits with hostile inputs. |
