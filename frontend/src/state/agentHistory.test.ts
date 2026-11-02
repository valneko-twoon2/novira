// What the assistant is told about the earlier part of a chat: the note under each answer of what it changed, and the
// settings before each earlier request.
import { describe, expect, it } from 'vitest';
import { contextUsage, EARLIER_MAX, earlierSettings, fitHistory, historyTurn, REQUEST_CHARS, roughTokens } from './agentHistory';
import { TOOL_LOG_KINDS, type AgentMessage } from './agentSessions';

const user = (id: number, text: string, extra: Partial<AgentMessage> = {}): AgentMessage => ({ id, role: 'user', text, tools: [], ...extra });
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

  it('names the pictures a turn carried, so the model can look at them again', () => {
    expect(historyTurn(user(1, 'like this', { images: ['a.png', 'b.png'] })).text).toMatch(/^like this\n\[The user attached the pictures a\.png, b\.png\. Look at one again with view_picture/);
    expect(historyTurn(answer(2, { images: ['t1.png'], tools: [{ kind: 'prompt' }] })).text).toBe(
      'done\n[This answer showed the pictures t1.png. Look at one again with view_picture and its name when the request is about it.]\n[This answer rewrote the prompt boxes of the Generate tab.]',
    );
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

describe('fitHistory', () => {
  const turn = (text: string) => ({ role: 'user' as const, text });

  it('keeps the newest turns that fit the budget, oldest first, and counts the rest as dropped', () => {
    const turns = ['a'.repeat(300), 'b'.repeat(300), 'c'.repeat(300)].map(turn);
    const each = roughTokens('a'.repeat(300)) + 4;
    expect(fitHistory(turns, each * 2)).toMatchObject({ turns: [turns[1], turns[2]], tokens: each * 2, dropped: 1 });
    expect(fitHistory(turns, each * 3)).toMatchObject({ dropped: 0 });
    expect(fitHistory([], 10)).toEqual({ turns: [], tokens: 0, dropped: 0 });
  });

  it('always sends the newest turn, even when it alone is over the budget', () => {
    const turns = [turn('old'), turn('x'.repeat(3000))];
    expect(fitHistory(turns, 10)).toMatchObject({ turns: [turns[1]], dropped: 1 });
  });

  it('counts about a token for three characters, in any script', () => {
    expect(roughTokens('')).toBe(0);
    expect(roughTokens('abcdefg')).toBe(3);
    expect(roughTokens('あいう')).toBe(1);
  });

  it('measures a session like a request does: failed replies are left out and notes are counted', () => {
    const messages = [user(1, 'hi'), answer(2, { error: true }), answer(3, { tools: [{ kind: 'prompt' }] })];
    const { turns, tokens, dropped } = contextUsage(messages);
    expect(turns.map((t) => t.role)).toEqual(['user', 'assistant']);
    expect(turns[1]!.text).toContain('[This answer rewrote');
    expect(tokens).toBeGreaterThan(roughTokens('hi'));
    expect(dropped).toBe(0);
  });
});
