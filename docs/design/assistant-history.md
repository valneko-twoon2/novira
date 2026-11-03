---
covers:
  - frontend/src/state/agentHistory.ts
  - frontend/src/state/agentSessions.ts
---
# Assistant conversation history

What the assistant is told about the earlier part of a chat, so that a correction ("that was fine as it was") can be taken back to how things were instead of being patched on top of the last answer. The rest of the assistant is in [assistant.md](assistant.md).

## Behaviour

- Sessions (`frontend/src/state/agentSessions.ts`): each chat is a session of messages. The text, the chips of what each answer did (`AgentToolLog`) and whether it was undone are saved between runs (at most 100 sessions, `PERSISTED_SESSIONS_MAX`); the undo snapshots stay in memory only.
- A request carries the earlier turns of its own session, failed replies left out, as many of the newest as fit `CONTEXT_TOKENS` (30000 estimated tokens, about one per three characters; `fitHistory` in `frontend/src/state/agentHistory.ts`), the newest turn always; the older ones are not sent whole. While the token limit is on (the switch of the meter; `tokenLimit` in the agent store, saved, on at first) a chat that does not fit has its older turns shortened to a line each (the first `DIGEST_LINE_CHARS` 140 characters of the text, no model call) in one turn at the start, within `DIGEST_TOKENS` (2500) beside the newest turns kept whole; older lines beyond that room are left out and the turn says how many (`compressHistory`). A chat that fits is sent whole. With the limit off the whole chat is sent, however long (the model may then refuse it). The same switch keeps the prompts the assistant writes short: while it is on, `set_generation_settings` refuses a prompt box over `CLIP_TOKEN_LIMIT` (77, counted by `estimateTokens` as the box's counter does) and changes nothing, and `get_generation_settings` returns that limit as `promptTokenLimit` (`ToolRun.promptTokenLimit` in `frontend/src/state/agentTools.ts`). Other prompts (the comic, the media forms) are not limited. `HISTORY_TURNS` (400) in `backend/crates/novira-core/src/agent/prompt.rs` only stops an absurd request. The chat shows the estimate above the message box (`ContextMeter`: the conversation that goes with the next message against the budget, how many older messages are sent shortened, and the limit switch); it does not count the rules, the tools or the tool answers of the current request. A new chat starts with nothing. An answer whose tool calls did something ends with a note in brackets of what they did, in order (the model, a LoRA and its weight, the prompt boxes, the parameters, an editor, queued jobs, suggested extensions), and a second note when the user undid it (`historyTurn` in `frontend/src/state/agentHistory.ts`).
- Pictures of earlier turns: the pictures themselves are not sent again. A turn that carried pictures (the user's attachments, the trial pictures an answer showed) ends with a note naming them, and the rules tell the model to look at one again with `view_picture` and its name when the request is about it, so an attached original is not forgotten after the first turn. The look is asked for under the read permission like any other.
- Earlier settings: for each earlier answer of the session that changed the Generate tab, the settings as they were before it (its undo snapshot: model, LoRAs, prompts, steps, CFG, size, scheduler, seed), with the user's request that led to it (cut to 300 characters) and whether it was undone, oldest first and at most 8 (`earlierSettings`). An answer that failed or was stopped after a change counts too.
- `get_generation_settings` returns them as `earlier` only with `includePrompts`, so they are read under the same question as the prompts; without it they are not sent.
- The rules (`INSTRUCTIONS`, and in short `COMIC_INSTRUCTIONS`) say how to take a correction: restore from `earlier` word for word when the user says something was fine before; change only the person or thing the request is about; keep a person's words apart from the shared ones and check what a negative word takes from the others; replace contradicting, repeated or ineffective words instead of piling them up, and say how the prompt's length changed (`set_generation_settings` returns `tokens`: the estimate of `estimateTokens` before the request and now); after a missed correction rebuild from the user's requests instead of patching; and never claim a fault is fixed, since the assistant does not see the pictures the engine makes unless the user attaches one.

## Boundaries

| Boundary | Guard |
|---|---|
| Earlier prompts reaching the model | Only through `get_generation_settings` with `includePrompts`, which is read-gated (`is_read_gated`, `isReadGated`): the user is asked as for the current prompts |
| What is kept | The earlier settings come from the undo snapshots, which are never saved to disk |

## Known limits

- After the app restarts, the earlier settings of an old chat are gone (the snapshots were in memory); the notes of what each answer did remain.
- The earlier settings cover the Generate tab only. For the editors (comic, text, workflow, the media forms) the model has the notes and reads the editor as it is now.
- The notes say what kind of change an answer made, not its words; the words are in `earlier`.
- Whether the model follows the rules is not tested: the tests check that the rules and the data are there.
