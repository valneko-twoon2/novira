---
covers:
  - backend/crates/novira-server/src/embedded.rs
  - backend/crates/novira-server/src/embedded/**
  - backend/src-tauri/src/home_network.rs
  - frontend/src/backend/tauri/lan.ts
---
# Phones and the desktop app

The desktop app lets a phone on the home network use it as `novira-server` does ([browser-server-lan.md](browser-server-lan.md), [browser-server-pairing.md](browser-server-pairing.md)): the side bar's QR item opens the home network, the phone scans the code, the app allows it. The server of `novira-server` runs inside the app for this, with its home-network listener only.

## Behaviour

- At the start, once the backend is open, the shell makes the server with `novira_server::embed` over the app's own backend, with no listener on this computer (the window keeps IPC), and enables the home network with the same `Control` on the app's data folder (so the CA, the trusted networks and the listener's port are the ones `novira-server` uses on that folder). The window's QR item drives it through the commands `lan_state`, `lan_open`, `lan_close`, `lan_trust`, `lan_untrust`, `lan_pair_code`, `lan_approve`, `lan_deny` and `lan_revoke` (`frontend/src/backend/tauri/lan.ts`); each runs one fixed route through `Embedded::manage`, which sends the request through the server's own router in process, as this computer with the start token, and answers `{status, body}` as the route did (any path that is not a management route is 404 there). A paired phone gets the frontend built into the app (the asset resolver; only a file the build has, never the resolver's fallback to `index.html`). The app's backend hands out picture URLs of its own scheme (`http://novira-image.localhost/...`): the server writes every string that starts with that base as `/novira-image/...` in command answers, uploads and events, and back in the arguments of commands (`embedded.rs`). The backend's events go to the window and to the phones' `/events` (one sink that calls both). Closing the app closes the listener.
- The commands are listed in `api::SHELL_ONLY` (the browser server answers them as not available; its page has the routes). A test keeps the frontend's command names and arguments equal to the Rust ones (`frontend/src/backend/tauri/lan.test.ts`).

## Boundaries

| Boundary | Guard |
|---|---|
| The window | Its server has no listener on this computer: the window reaches the home network only through the nine `lan_*` commands, which the main window's capability lists, each a fixed management route with its arguments' length capped at the entry and their shape checked by the route. A device gets exactly what it gets from `novira-server`. |
| Picture URLs | Only strings that start with the app's base (out) or `/novira-image/` (in) are written; the backend still checks every name it is given. |

Tests: `backend/crates/novira-server/src/embedded/tests.rs` (the management calls and what is refused, a phone paired through them getting the built-in page and files, its commands and upload with this server's picture base, closing from the window, the URL rewriting), `backend/crates/novira-server/src/embedded/fuzz.rs` (damaged management calls, generated JSON for the URL rewriting, damaged file paths of a paired phone; 300 cases each, more with `NOVIRA_FUZZ_ITERATIONS` and `NOVIRA_FUZZ_SEED`) and `backend/src-tauri/src/home_network.rs` (the argument cap, both event sinks).

## Known limits

- A string a phone sends in a command's arguments that starts with `/novira-image/` is read as a picture URL and written with the app's scheme, even inside free text (a prompt that starts so); one that only contains it is left as it is.
- Windows asks once whether `novira.exe` may accept connections, the first time the listener opens.
