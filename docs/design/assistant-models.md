---
covers:
  - backend/crates/novira-core/src/agent/models.rs
  - frontend/src/features/agent/AgentModelPicker.tsx
---
# Assistant models

The model and thinking effort a command-line tool (`claude`, `codex`) runs a request on, chosen with the button beside the chat's title. A server's model is part of its saved settings. The rest of the assistant is in [assistant.md](assistant.md).

## Behaviour

- Claude: a fixed list of full names (`CLAUDE_MODELS` in `backend/crates/novira-core/src/agent/models.rs`), shown with their version ("Opus 5.5") and passed as `--model <full name>`, never an alias such as `sonnet`, so the name shown is the version that answers. Efforts are low to max, starting at high.
- Codex: the models its `models_cache.json` lists for the account (in its home folder; hidden models left out), in its order of priority, each with the efforts it lists.
- Default: `AgentStatus.defaultModel` is the model a request runs on until the user picks one: `claude-sonnet-5-5` for Claude (the one the CLI takes when given none), Codex's first listed model. The picker has no "default" and no typed name: it always names and presses the model that answers (`effectiveModel` in `frontend/src/state/agent.ts`). Only Codex without its list runs its own default, shown as the default.
- A request carries the model (`agentModel`). The backend takes it only when the tool lists it, otherwise the default (`cli_model` in `backend/crates/novira-core/src/agent/mod.rs`). A choice saved under an old alias (`opus`) is read as the listed model of that name.
- An effort the model does not take is dropped, and the picker falls back to the model's own starting effort. The choice per tool is kept in the window (`novira.agent`) and goes with every message from the next one on.

## Boundaries

| Boundary | Guard |
|---|---|
| The model argument | The one argument of a CLI run that is not a fixed word. Only a model the tool lists whose name is letters, digits and `.-_` (at most 64, not starting with `-`) is passed; any other name runs the default model. Nothing about the model goes in the environment. |

## Known limits

- Claude's list is fixed in the app: a newer Claude model is offered only after an update of `CLAUDE_MODELS`, and the default is not read from the CLI.
