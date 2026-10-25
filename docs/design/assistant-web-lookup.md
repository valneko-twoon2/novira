---
covers:
  - backend/crates/novira-core/src/agent/reference.rs
  - backend/crates/novira-core/tests/reference_fake.rs
---
# Assistant fact look-up (Wikipedia)

The assistant can look a fact up on Wikipedia while it helps with a story (a period, clothing, a place, a trade, a term). It is the one place where words the model wrote go to a website, so the request is made by the Rust backend only, to two fixed hosts, after the user allows it. The rest of the assistant is in [assistant.md](assistant.md).

## Behaviour

- Tool `lookup_reference` (`backend/crates/novira-core/src/agent/reference.rs`): `query` (1 to 100 characters) and `language` (`ja` or `en`, default `ja`). The Rust backend reads the MediaWiki action API of `ja.wikipedia.org` or `en.wikipedia.org` (search with the start of each article as plain text) and returns up to 3 `{title, extract, url}` entries, each extract cut to 1500 characters with control characters removed. The window calls the command `lookup_reference`; the tool's description tells the model that the text is data, is CC BY-SA 4.0 and must be credited by title and url, and that the query must be short and generic. It is read-gated (the query leaves the PC) with its own setting `assistantWebAccess`, and the permission question shows the words that would be sent.
- Frontend: the handler in `frontend/src/state/agentTools.ts` calls `BackendClient.lookupReference`; the browser mock answers one canned article per query. The permission question (`frontend/src/features/agent/AgentWindow.tsx`) has its own title and shows the words and the site; the user's setting is `assistantWebAccess` in Settings > Generation > AI assistant.

## Boundaries

| Boundary | Guard |
|---|---|
| Assistant fact look-up on Wikipedia | The one place where words the model wrote go to a website. The command `lookup_reference` (`backend/src-tauri/src/commands.rs`, in `command_list.rs` and the capability) takes `language` and `query` and checks both again in the backend: the language must be exactly `ja` or `en` (`Lang::parse`) and the host is chosen from that enum (`ja.wikipedia.org` or `en.wikipedia.org`, `endpoints::Service`), never from input. The request is an HTTPS GET of `/w/api.php` with fixed parameters and the cleaned words (control characters become spaces, 1 to 100 characters) as one encoded parameter (`gsrsearch`), built with `Url::query_pairs_mut`, so `&`, `#` and line breaks cannot add a parameter, a fragment or a header. The address is checked again before sending and on the final address after redirects (HTTPS, exact host, no port or credentials). A redirect is followed only inside the same origin, at most 3 times. No cookie store, connect timeout 10 s and total 20 s, a descriptive `User-Agent`, answer at most 1 MiB (also while streaming), at most 3 entries of 1500 characters back, and an answer of another shape is an error. The window never connects out: `connect-src` stays closed. The tool is read-gated by the backend (`is_read_gated`) and the window (`isReadGated`) and uses its own setting `assistantWebAccess` (`always`, `ask` by default, `never`), apart from `assistantReadAccess`: allowing pictures never allows the web, and "always allow" on the web question changes only the web setting. A decline, a stop or "never" answers the model with an error that says not to ask again in that request. Debug builds only: `NOVIRA_TEST_WIKIPEDIA_JA_BASE` and `NOVIRA_TEST_WIKIPEDIA_EN_BASE` may point to a loopback fake. |

## Known limits

- A look-up sends the model's query to Wikipedia in the clear over HTTPS, and Wikipedia can see the PC's address and the words. The query is shown to the user before it is sent, but a model can still put private words in it despite the tool's instructions; the user can decline, and a user who allows always accepts that. The result is Wikipedia's text written by anyone: it is data for the model, never instructions, and can be wrong or mislead.
