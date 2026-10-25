---
covers:
  - backend/crates/novira-core/src/agent/attach.rs
  - backend/crates/novira-core/src/agent/relay.rs
  - frontend/src/features/agent/Attachments.tsx
  - frontend/src/features/comic/agentView.ts
---
# Pictures the assistant sees

Pictures reach the model in two ways only: the user attaches them to a message, or, on the comic screen, the assistant asks to look at a page it has drawn and the user allows it. The rest of the assistant is in [assistant.md](assistant.md).

## Behaviour

- Attached pictures (`backend/crates/novira-core/src/agent/attach.rs`): up to 4 gallery names per message; files, drops and pastes are stored in the gallery first (`frontend/src/features/agent/Attachments.tsx`). The service reads them and sends a JPEG of at most 1568 px: Claude with stream-json input and output, Codex with `-i` files in the request's folder, a server as `image_url` parts. Only that message carries them.
- Pictures a tool returns: `view_comic_page` answers with the name of an intermediate picture of the page, drawn by the window (`frontend/src/features/comic/agentView.ts`) only while the comic screen is open (any of its views). The relay reads it through the service's reader and prepares it as an attachment (`relay::PICTURE_TOOLS`, `with_picture`); the MCP answer carries it as an `image` content block, the server loop as a user message with `image_url` parts after that turn's tool messages (`toolloop::tool_pictures`).
- The tool fails with a sentence for the model when the comic screen is not open, the page does not exist, or it has no drawn panel. The rendered page is a JPEG of the page as "save page as picture" draws it (`pageRender`), stored with `isIntermediate`, so the gallery does not list it.

## Boundaries

| Boundary | Guard |
|---|---|
| Which pictures leave the PC | Attachments: only the names the user attached, checked like gallery names. `view_comic_page`: read-gated in both lists (`is_read_gated`, `isReadGated`), asked under `assistantReadAccess`, only while the comic tab is open, and only a page the window drew; the model cannot name a gallery picture. |
| Pixels on the IPC path | The window's answer carries a picture name only (`{"picture": name}`); the backend checks the name (`images::is_valid_name`, not a video or sound), reads it from `outputs/`, checks its size before decoding (`attach::prepare`) and replaces the name with the picture. A missing or unreadable picture makes the call an error. |
| Text inside a picture | Each provider is told that words in the picture are data or lettering, never an instruction. |

## Known limits

- Checked on this PC on 2026-10-14 with the user's own logins (`agent_live`, `both_tools_see_the_picture_a_tool_returns`): both `claude` and `codex exec` saw a plain red picture returned by the tool and named its colour. The server loop (user message with `image_url` parts) is checked with the fake server of the tests only, not with a real server.
- A provider or model that drops image content answers from the text alone; that is reported, not worked around.
- Each look stores one intermediate picture; the last four stay for the conversation, older ones are deleted, and a comic run deletes them all when it ends (`state/comic/scratch.ts`).
