// What the assistant is told about the earlier part of a chat: the note under each answer of what it changed, and the
// settings before each earlier request.
import { describe, expect, it } from 'vitest';
import { EARLIER_MAX, earlierSettings, historyTurn, REQUEST_CHARS } from './agentHistory';
import { TOOL_LOG_KINDS, type AgentMessage } from './agentSessions';

const user = (id: number, text: string): AgentMessage => ({ id, role: 'user', text, tools: [] });
const answer = (id: number, extra: Partial<AgentMessage> = {}): AgentMessage => ({ id, role: 'assistant', text: 'done', tools: [], ...extra });

describe('historyTurn', () => {
  it('leaves the user and an answer that changed nothing as they are', () => {
    expect(historyTurn(user(1, 'hi'))).toEqual({ role: 'user', text: 'hi' });
    expect(historyTurn({ ...user(1, 'hi'), tools: [{ kind: 'prompt' }] })).toEqual({ role: 'user', text: 'hi' });
    expect(historyTurn(answer(2))).toEqual({ role: 'assistant', text: 'done' });
  });

  it('notes every call of an answer in order, with its model, weight, count or summary', () => {
    const turn = historyTurn(answer(2, { tools: [{ kind: 'model', key: 'm1' }, { kind: 'lora', key: 'l1', weight: 0.8 }, { kind: 'prompt' }, { kind: 'params', summary: '30 steps' }, { kind: 'queued', count: 2 }] }));
    expect(turn.text).toBe('done\n[This answer selected the model m1; added the LoRA l1 at 0.8; rewrote the prompt boxes of the Generate tab; set 30 steps; queued 2 job(s).]');
  });

  it('has a note for every kind of chip', () => {
    for (const kind of TOOL_LOG_KINDS) expect(historyTurn(answer(2, { tools: [{ kind }] })).text).toMatch(/^done\n\[This answer \S.+\.\]$/);
  });

  it('says when the user undid the answer', () => {
    expect(historyTurn(answer(2, { tools: [{ kind: 'prompt' }], undone: true })).text).toBe(
      'done\n[This answer rewrote the prompt boxes of the Generate tab.]\n[The user undid these changes with the undo button: they are not in the app any more.]',
    );
  });
});

describe('earlierSettings', () => {
  it('pairs the settings before each changing request with that request, oldest first', () => {
    const messages = [
      user(1, 'short hair'),
      answer(2, { snapshot: { positivePrompt: 'long hair' } }),
      user(3, 'what is a LoRA?'),
      answer(4),
      user(5, 'black hair'),
      answer(6, { snapshot: { positivePrompt: 'short hair' }, undone: true }),
      user(7, 'stopped one'),
      answer(8, { snapshot: { positivePrompt: 'short hair' }, error: true }),
    ];
    expect(earlierSettings(messages)).toEqual([
      { request: 'short hair', settings: { positivePrompt: 'long hair' } },
      { request: 'black hair', undone: true, settings: { positivePrompt: 'short hair' } },
      // A request stopped after a change still changed the settings.
      { request: 'stopped one', settings: { positivePrompt: 'short hair' } },
    ]);
    expect(earlierSettings([])).toEqual([]);
  });

  it('cuts a long request and keeps only the latest versions', () => {
    const long = 'あ'.repeat(REQUEST_CHARS + 5);
    expect(earlierSettings([user(1, long), answer(2, { snapshot: {} })])[0]!.request).toBe('あ'.repeat(REQUEST_CHARS));
    const many = Array.from({ length: EARLIER_MAX + 2 }, (_, i) => [user(i * 2, `r${i}`), answer(i * 2 + 1, { snapshot: { steps: i } })]).flat();
    const kept = earlierSettings(many);
    expect(kept).toHaveLength(EARLIER_MAX);
    expect(kept[0]!.request).toBe('r2');
    expect(kept.at(-1)!.request).toBe(`r${EARLIER_MAX + 1}`);
  });
});
