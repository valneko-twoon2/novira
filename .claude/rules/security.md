---
description: Security checks when changing a boundary (IPC command, URL, file path, process launch, outside data, secrets, dependencies, CSP or capabilities)
paths:
  - "frontend/src/backend/**"
  - "frontend/index.html"
  - "frontend/package.json"
  - "frontend/eslint.config.js"
  - "frontend/scripts/eslint-security.mjs"
  - "backend/crates/*/src/**"
  - "backend/src-tauri/**"
  - "backend/Cargo.toml"
---

# Security checks

The source of truth is [docs/design/security.md](../../docs/design/security.md) (what is protected, the shared boundaries, where each feature's boundaries are) and the `Boundaries` and `Known limits` sections of the design page of the feature (`docs/design/README.md`). This file lists only the points to check with each change, and the range the machine protects.

## 1. When to follow this

When you add or change any of these. Not needed for mere display or internal logic changes.

- IPC commands (`commands.rs`, `command_list.rs`, `capabilities/`), Tauri settings (the CSP and windows in `tauri.conf.json`)
- Code that opens a URL, downloads, or connects to an external site
- File paths (reading, writing, deleting, moving, extracting archives)
- Launching another program (ComfyUI's Python, `claude`/`codex`, pip, 7zr, the browser)
- Use of outside data (Civitai and Hugging Face responses, model files, images, AI answers, workflow JSON)
- Handling of API keys and tokens, adding or updating dependencies

## 2. What to check per boundary

| Boundary | What to check |
|---|---|
| IPC | Add a new command to both `command_list.rs` and `capabilities/default.json`. Validate arguments **at the command's entry point** (do not trust the calling UI). Do not add the fs, shell, http or opener plugins |
| WebView | Do not loosen the CSP (`'unsafe-eval'`, external `script-src`, `*`, external hosts in `connect-src`). Render data with React; never put HTML strings into the DOM. A separate window is opened only through `openInNewWindow` in `src/backend` |
| File paths | Names use only allowed characters (the style of `images::is_valid_name` and `safe_file_name`). Reject `..`, absolute paths, drive names, UNC and reserved names, and never leave `novira-data/`. For archives, check that each entry's destination is inside the target folder (zip-slip) |
| Process launch | Launch the program directly and pass arguments one by one. Do not use `cmd /C`, `powershell -Command` or `sh -c`. Pass user strings via stdin or a file, not as arguments. `.cmd`/`.bat` go through cmd.exe internally, so give them fixed arguments only |
| Download / URL | `https` only, with an exact host match (`host_is`). Never open a partial match or an arbitrary user-entered URL (SSRF, open redirect). Write to a temporary name and move it on completion. Have a size limit and cancellation. External service addresses are held only in `endpoints.rs`; in debug builds only, `NOVIRA_TEST_<SERVICE>_BASE` can replace them with `http://127.0.0.1:<port>` / `http://localhost:<port>` (for tests; disabled in release). Do not widen this exception |
| Debug-only test seams | `NOVIRA_TEST_*` variables are read only under `cfg(debug_assertions)`, so release builds ignore them. A seam carries only a length of time or a count (`NOVIRA_TEST_<WHAT>_MS`, a whole number of milliseconds), read where its feature reads it (`src/test_timing.rs`, or next to the voice module). Never add one that takes a path, a URL (other than the loopback rule above), a program name, a secret, or anything that decides what is read, written, run or sent. A new seam gets a unit test of its parser and a test that the real value is used when the variable is absent. Tests that set a variable run in a test file of their own, because the variable is process-wide |
| Outside data | Limit lengths, counts and numeric ranges (do not crash on huge images, JSON or responses). For images, check the size from the header before decoding (`images::check_limits`). Validate the shape and values of AI answers before use |
| Model files | Prefer `.safetensors`. `.ckpt`/`.pt` are pickle and can contain code, so do not add paths that load them automatically |
| Secrets | Send keys in headers; never put them in URLs, logs, error messages, return values to the frontend, or notifications. Store only in the Windows Credential Manager (the site keys) or with DPAPI (`novira-data/secrets/`). Never put them in the repository |
| Database | SQL is a fixed string with bound parameters (`?1`). The only thing allowed into the string is `Table::name()` |
| File races | So the file cannot be swapped between checking and using it, check and use through the same handle, or rename from a temporary name (TOCTOU) |

When unsure, add a test that receives malicious input (`../`, `%2e%2e`, `\\?\`, `https://civitai.com.evil.example`, huge values, empty, control characters).

## 3. What the machine protects

| Check | What it protects | Limit |
|---|---|---|
| ESLint `novira-security/*` and `no-eval` family (`frontend/scripts/eslint-security.mjs`) | `dangerouslySetInnerHTML`, assignment to `innerHTML`/`outerHTML`/`srcdoc`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, string `setTimeout`, `javascript:`, `window.open` outside `src/backend` | Syntax only. Does not follow aliases, computed property names or data flow |
| `config` in `cargo test -p novira --test security` | The key points of the CSP (`script-src 'self'`, no `unsafe-eval`, `object-src`/`frame-src`/`base-uri`/`form-action` are `'none'`, no `*`, `connect-src` only inside the app), `devCsp`, the asset protocol, Tauri plugin dependencies, exactly one capability file | Reads the configuration only; does not see runtime behavior |
| `the_capability_allows_exactly_the_registered_commands` in `cargo test -p novira` | The permissions match the registered commands, no plugin permissions, the `main` window only | — |
| `source_scan` in `security` | Shell launches in the Rust under `backend/` (`Command::new("cmd")` etc. with `/C` or `-Command`), SQL with values inserted by `format!`, `rusqlite` outside `db.rs` | A string scan. Does not see a program name put in a variable, or SQL built with `+` or `push_str`. The only allowance is `build.rs` |
| `secrets` in `security` | In files that can enter git (tracked, and untracked and not ignored): `hf_`, `sk-ant-`, `sk-`, GitHub and AWS tokens, private keys, a 32-digit hex near a key name, files such as `.env` and `.pem` | Known shapes only. Does not look at history, binaries, or files over 5 MB |
| Unit tests of `images` / `install` / `image_scheme` | Name validation, path escapes, URL parsing, image size limits | Only the range of the individual functions |

When you add a check, deliberately introduce a violation and confirm it fails before reverting. When you add to an allowlist for a false positive, write the reason in that list's comment.

## 4. What to run

- After changing a boundary: `cargo test -p novira` (including `--test security`), the relevant `novira-core` unit tests, and `npm run lint`.
- After adding or updating a dependency: `cargo audit` (needs cargo-audit; if missing, `cargo install cargo-audit`) and, in `frontend/`, `npm run audit` (`npm audit --omit=dev`, only the dependencies that ship in the app). Report findings that concern only development tools, and do not force-update on your own.

## 5. Reporting

- Write the security-related change (which boundary, what), the checks you ran and their results. If something was not run, write why.
- If there is a new known limit or an accepted risk, update "Known limits" of the design page of that feature (`docs/design/README.md`; in [docs/design/security.md](../../docs/design/security.md) only when it belongs to no feature) in the same work (in English). If you added a boundary or protection, update the "Boundaries" table of that page too.
- Report vulnerabilities you find, whether or not you fixed them. Do not push ahead with a large fix on your own; ask first.
