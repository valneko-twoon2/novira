---
covers:
  - frontend/src/state/agentHistory.ts
  - frontend/src/state/agentSessions.ts
---
# Assistant conversation history

What the assistant is told about the earlier part of a chat, so that a correction ("that was fine as it was") can be taken back to how things were instead of being patched on top of the last answer. The rest of the assistant is in [assistant.md](assistant.md).

## Behaviour

- Sessions (`frontend/src/state/agentSessions.ts`): each chat is a session of messages. The text, the chips of what each answer did (`AgentToolLog`) and whether it was undone are saved between runs (at most 100 sessions, `PERSISTED_SESSIONS_MAX`); the undo snapshots stay in memory only.
- A request carries the last 10 turns of its own session (`HISTORY_TURNS` in `backend/crates/novira-core/src/agent/prompt.rs`), failed replies left out. An answer whose tool calls did something ends with a note in brackets of what they did, in order (the model, a LoRA and its weight, the prompt boxes, the parameters, an editor, queued jobs, suggested extensions), and a second note when the user undid it (`historyTurn` in `frontend/src/state/agentHistory.ts`).
- Earlier settings: for each earlier answer of the session that changed the Generate tab, the settings as they were before it (its undo snapshot: model, LoRAs, prompts, steps, CFG, size, scheduler, seed), with the user's request that led to it (cut to 300 characters) and whether it was undone, oldest first and at most 8 (`earlierSettings`). An answer that failed or was stopped after a change counts too.
- `get_generation_settings` returns them as `earlier` only with `includePrompts`, so they are read under the same question as the prompts; without it they are not sent.
- The rules (`INSTRUCTIONS`, and in short `COMIC_INSTRUCTIONS`) say how to take a correction: restore from `earlier` word for word when the user says something was fine before; change only the person or thing the request is about; keep a person's words apart from the shared ones and check what a negative word takes from the others; after a missed correction rebuild from the user's requests instead of patching; and never claim a fault is fixed, since the assistant does not see the pictures the engine makes unless the user attaches one.

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
