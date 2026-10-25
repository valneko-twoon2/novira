---
covers:
  - backend/crates/novira-server/src/pair.rs
  - backend/crates/novira-server/src/pair/**
  - backend/crates/novira-server/src/lan_tests.rs
  - backend/crates/novira-server/src/lan/**
  - frontend/src/app/HomeLinkButton.tsx
  - frontend/src/app/LanPanel.tsx
  - frontend/src/app/LanApprovals.tsx
  - frontend/src/state/lan.ts
  - frontend/src/backend/http/lan.ts
  - frontend/src/backend/mock/mockLan.ts
---
# Pairing a phone with the browser server

A device on the home network ([browser-server-lan.md](browser-server-lan.md)) gets in only with a session that this computer approved. It pairs once per server start (or after its session ends): it scans a code shown on this computer, this computer allows it, and the phone's browser then holds a session cookie bound to its address. The start token stays on this computer.

## Behaviour

- **Code.** This computer's page (loopback, with the token) asks `POST /pair/code` (`CODE_ROUTE` in `backend/crates/novira-server/src/pair.rs`) for `{url, size, modules, expiresIn}`: a pairing code of 128 random bits, good for two minutes and one request, in the address `https://<home address>:<port>/pair#<code>` and its QR modules. The code is in the fragment, which a browser never sends. Up to four codes are good at once; a newer one drops the oldest. The side bar's QR item (below) asks for a fresh one each time it opens and again when one ran out. 404 `no_home_network` while the listener is closed.
- **Phone page.** `GET /pair` and `GET /pair.js` are a small static page apart from the app (`backend/crates/novira-server/src/pair/page.html`, `page.js`), so nothing of the app is shown before pairing. The script reads the code from the fragment and drops it from the address bar and history at once, offers a name for the device (guessed from the browser: iPhone, iPad, Android) a link to `/ca.crt`, and a folded "install the certificate" box with the steps for iPhone (download the profile, install it, then Settings > General > About > Certificate Trust Settings) and Android Chrome (Settings > Security > Install certificate > CA certificate), only those of the phone it is on. Its strings are in `backend/crates/novira-server/src/pair/strings.json` in Japanese and English, picked by the browser's language. This page is the one place screen text lives outside the i18n catalogs (it is served by the server, not the frontend); a test keeps the two languages' keys equal, every key used, and "novira" in lowercase.
- **Request.** The phone posts `{code, label}` to `POST /pair/request`. A good code is used up and makes a waiting request with a six-digit confirmation number and a poll secret (256 bits), which the phone receives and shows the number. A waiting request lives five minutes.
- **Decision.** This computer reads `GET /pair/state` (`{open, codes, pending: [{id, label, peer, confirm, waitingSecs}], devices: [{id, label, peer, pairedSecs, idleSecs}]}`, no secret in it) and answers with `POST /pair/approve` or `POST /pair/deny` and `{id}`. The screen on this computer (below) uses them.
- **Session.** The phone polls `POST /pair/status` with `{poll}` every two seconds: `pending`, `denied`, or `approved` with the cookie `novira_session_<port>` (`HttpOnly`, `SameSite=Strict`, `Secure`, `Max-Age` 4 hours; the secret is 256 random bits, handed out once), after which the page opens `/`. A session works only from the address it was made for, ends after 30 minutes without a request or 4 hours after pairing, and ends when this computer posts `POST /pair/revoke` with its `{id}`, when the listener closes (this computer closing it, the idle limit or a change of network: browser-server-lan.md), or when the server stops. An open event socket of a device counts as use and keeps the listener from closing as idle; it is checked every minute and at once on a revocation, and ends with its session.
- A device that opens `/` without a session is sent to `/pair` (303).

### The screen on this computer

The side bar's QR item (`HomeLinkButton.tsx`, `LanPanel.tsx`) is there only when the page can read `GET /lan/state` (`state/lan.ts`): the page of `novira-server` on its own computer. The desktop app, a phone (`/lan/*` answers it 403) and the browser mock get no state and no item; the phone layout does not mount it at all. Pressing the item is the request to open: when the popover appears on a closed home network it opens it, and on a network not trusted yet (`409 untrusted_network`) it trusts the gateway first (`/lan/trust`, under the default name) with no question; pressing the item is the owner's choice. The popover shows the pairing code with the time left (**New code** when it ran out) and Windows' "public" warning. When there is no home address or gateway it shows the reason; after a failed attempt, an open button. Open, it lists the phones that ask (name, address, the number, **Allow** and **Deny**) and the paired ones (a button to disconnect). The state is read every 2 seconds while the popover is open and every 4 seconds while the home network is open; closed and not shown, it is not read.

A phone that asks while the popover is closed shows a prompt on this page only (`LanApprovals.tsx`): a toast with the name, address and number, **Allow** and **Deny**, which stays until answered or until the request goes away; opening the popover takes the requests over. The browser mock has a pretend home network for trying and testing it (`?lan`, `?lan=open`, `?lan=public`; `mockLan.ts`).

## Boundaries

| Boundary | Guard |
|---|---|
| Credentials | A non-loopback peer is let in only with a live session from its own address; the start token (header, cookie or address) is not a credential there. Only SHA-256 digests of the codes, poll secrets and session secrets are kept, in memory. Secrets come from the system's generator (ring). |
| Public routes | On the TLS listener only: `GET /ca.crt`, `GET /pair`, `GET /pair.js`, `POST /pair/request`, `POST /pair/status` (`is_public`). They pass the same `Host`, `Origin` and `Sec-Fetch-Site` checks as every route, except that `GET /pair` may be opened by a top-level navigation (`Sec-Fetch-Mode: navigate`) from another site, which is how a scanned QR code arrives. On the loopback listener they need the token, and the two calls answer 404 there. |
| Management | `/pair/code`, `/pair/state`, `/pair/approve`, `/pair/deny`, `/pair/revoke` (`is_management`) answer a loopback peer with the token only; a device gets 403, with a session or the token alike, so it cannot approve itself or list others. |
| Request bodies | `application/json` only (else 415), at most 1 KiB (else 413), a JSON object with string fields (else 400). A device name is 1 to 40 characters with no control or direction characters (else 400 `bad_label`); a refused request does not use up the code. |
| Guessing and flooding | A code is 128 bits and good for one request; a wrong, used or expired one is 403 `bad_code`. Five pairing requests a minute per address (429 `rate_limited`), at most 256 addresses followed; at most eight waiting requests (503 `busy`) and sixteen paired devices. |
| Who learns the outcome | Only the poll secret from the address that asked; anything else is 404 `unknown`. A decision is final; the session's secret is handed out once. |

Tests: `backend/crates/novira-server/src/pair/tests.rs` (the store with the clock moved by hand: single use, expiry of codes, requests and sessions, the idle and absolute limits, the address binding, the rate limit, the caps, names, revocation, the strings), `backend/crates/novira-server/src/lan_tests.rs` (requests through the router in process as a device at another address: the token refused, the redirect, public and management routes, hostile bodies and headers, the rate limit, the outcome for another address, revoking and closing, the event socket ended by a revocation), `backend/crates/novira-server/tests/lan_tls.rs` (the whole exchange over TLS, the `Secure` cookie), `frontend/src/backend/http/lan.test.ts`, `frontend/src/backend/mock/mockLan.test.ts`, `frontend/src/state/lan.test.ts`, `frontend/src/app/HomeLinkButton.test.tsx` and `frontend/src/app/LanApprovals.test.tsx`, and `frontend/e2e/lan.spec.ts` (the item against the mock: trusting once, the code, a phone asking in the popover and as a prompt, none on a phone-sized window).

## Known limits

- The confirmation number protects only if the person compares it: approving whatever waits gives a session to whoever scanned the code first.
- Anyone who sees the QR code in its two minutes (a photo of the screen) can use it before the phone does; the waiting request then shows a name and an address this computer did not expect.
- A session is bound to an address, not a device: another device that takes over the address (and has the cookie) is let in. A phone whose address changes pairs again.
- Sessions live in memory: a restart, or closing the listener, makes every phone pair again.
