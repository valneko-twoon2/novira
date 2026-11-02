---
covers:
  - frontend/src/state/agentRefine.ts
---
# AI assistant: getting closer over several pictures

When the user asks the assistant to make pictures resemble a picture or a description over several tries ("make it like this", "try a few and bring it closer"), the app, not the model, keeps the loop going: after each answer it sends the assistant back for the next picture. The rest of the assistant is in [assistant.md](assistant.md).

## Behaviour

- The assistant starts it with the `refine` tool (`action: start`, the goal in a sentence, the names of the target pictures, `maxRounds` between 2 and 30, 30 when left out) and draws the first trial picture in the same answer ([assistant-pictures.md](assistant-pictures.md)). It needs the setting `assistantTrialPictures`; without it the call fails and nothing starts.
- State is `refining` in `frontend/src/state/agent.ts` (`Refinement` in `frontend/src/state/agentRefine.ts`: goal, targets, pictures drawn, pictures at most, and the chat it runs in). After each request `afterRequest` counts one more picture, unless the assistant called `refine` with `finish` (the loop ends) or `start` (it begins again at picture 1).
- While it runs, the end of each answer makes the window send the next turn itself (`continuation`): an English message that names the picture number, the goal and the targets, and tells the assistant to look at the target and its latest picture with `view_picture`, change only what differs, draw one more trial picture, and call `finish` when it is close or the last two pictures came no closer. A message that arrives with the last picture says to finish after it. The assistant cannot end the loop by answering: only `finish`, the last picture, or the user ends it.
- The user ends it by writing a message (it goes out in place of the next picture), by the stop button, or by switching to another chat; a failed request also ends it. The picture limit is 30.
- The chat shows each automatic message as a small note in the middle ("Getting closer: picture N of M"), kept in the message as `step`; the model reads the English message. Each round's picture comes under that round's answer.
- Reading the pictures asks the user's permission like any other read; "always" lets the rounds run without a question.

## Boundaries

No boundary of its own: every call goes through `mcp::dispatch` and its schema checks, and `refine` changes only this state of the window, never a picture, a prompt or a file.

## Known limits

- Whether the model judges a picture as close is its own call; the app only guarantees that it is asked again, up to the limit.
- A long loop makes a long chat: the earlier turns that do not fit the context budget are no longer sent ([assistant-history.md](assistant-history.md)), so the goal and the target names are repeated in every automatic message.
- Not kept between runs: closing the app ends a refinement; the notes stay in the chat.
