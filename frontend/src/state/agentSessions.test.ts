import { describe, expect, it } from 'vitest';
import { maxMessageId, newSessionId, PERSISTED_SESSIONS_MAX, persistedSessions, restoreSessions, sessionTitle, sortSessions, TITLE_MAX, type AgentSession } from './agentSessions';

const session = (id: string, updatedAt: number, messages: AgentSession['messages'] = []): AgentSession => ({ id, createdAt: updatedAt, updatedAt, messages });

describe('sessionTitle', () => {
  it('uses the first user message on one line', () => {
    const s = session('a', 1, [
      { id: 1, role: 'assistant', text: 'hello', tools: [] },
      { id: 2, role: 'user', text: '  a cat\n on a  roof ', tools: [] },
      { id: 3, role: 'user', text: 'second', tools: [] },
    ]);
    expect(sessionTitle(s)).toBe('a cat on a roof');
  });

  it('shortens a long first message and prefers the name the user gave', () => {
    const long = session('a', 1, [{ id: 1, role: 'user', text: 'あ'.repeat(TITLE_MAX + 10), tools: [] }]);
    const title = sessionTitle(long);
    expect([...title]).toHaveLength(TITLE_MAX);
    expect(title.endsWith('…')).toBe(true);
    expect(sessionTitle({ ...long, title: ' My chat ' })).toBe('My chat');
  });

  it('is empty for a session without a user message or a name', () => {
    expect(sessionTitle(session('a', 1))).toBe('');
    expect(sessionTitle({ ...session('a', 1), title: '   ' })).toBe('');
  });
});

describe('session order and ids', () => {
  it('sorts the most recently used first without changing the input', () => {
    const input = [session('old', 1), session('new', 3), session('mid', 2)];
    expect(sortSessions(input).map((s) => s.id)).toEqual(['new', 'mid', 'old']);
    expect(input.map((s) => s.id)).toEqual(['old', 'new', 'mid']);
  });

  it('gives a different id each time, even in the same millisecond', () => {
    expect(newSessionId(5)).not.toBe(newSessionId(5));
  });

  it('finds the largest message id across sessions', () => {
    expect(maxMessageId([])).toBe(0);
    expect(maxMessageId([session('a', 1, [{ id: 4, role: 'user', text: '', tools: [] }]), session('b', 1, [{ id: 9, role: 'user', text: '', tools: [] }])])).toBe(9);
  });
});

describe('persisted sessions', () => {
  it('keeps the pictures a message carried, and reads back only names, at most four', () => {
    const [saved] = persistedSessions([{ ...session('a', 1), messages: [{ id: 1, role: 'user', text: 'like this', images: ['a.png'], tools: [] }] }]);
    expect(saved!.messages[0]).toEqual({ id: 1, role: 'user', text: 'like this', images: ['a.png'], tools: [] });
    const [restored] = restoreSessions([
      { id: 'a', updatedAt: 1, messages: [{ id: 1, role: 'user', text: 'x', images: ['1.png', 7, null, '2.png', '3.png', '4.png', '5.png'], tools: [] }, { id: 2, role: 'user', text: 'y', images: 'a.png', tools: [] }] },
    ]);
    expect(restored!.messages[0]!.images).toEqual(['1.png', '2.png', '3.png', '4.png']);
    expect(restored!.messages[1]).not.toHaveProperty('images');
  });

  it('keeps what the chat shows and drops the undo snapshots', () => {
    const [saved] = persistedSessions([
      {
        ...session('a', 1),
        title: 'named',
        messages: [
          {
            id: 1,
            role: 'assistant',
            text: 'done',
            tools: [{ kind: 'workflow', key: 'wf' }, { kind: 'editText', count: 2 }, { kind: 'prompt' }, { kind: 'packs', ids: ['rmbg'] }],
            snapshot: { positivePrompt: 'before' },
            editSnapshots: { text: { big: true } },
            undone: true,
          },
        ],
      },
    ]);
    expect(saved).toEqual({
      id: 'a',
      title: 'named',
      createdAt: 1,
      updatedAt: 1,
      messages: [{ id: 1, role: 'assistant', text: 'done', tools: [{ kind: 'workflow', key: 'wf' }, { kind: 'editText', count: 2 }, { kind: 'prompt' }, { kind: 'packs', ids: ['rmbg'] }], undone: true }],
    });
  });

  it('keeps only the most recent sessions', () => {
    const many = Array.from({ length: PERSISTED_SESSIONS_MAX + 5 }, (_, i) => session(`s${i}`, i));
    const saved = persistedSessions(many);
    expect(saved).toHaveLength(PERSISTED_SESSIONS_MAX);
    expect(saved[0]!.id).toBe(`s${PERSISTED_SESSIONS_MAX + 4}`);
    expect(saved.some((s) => s.id === 's0')).toBe(false);
  });

  it('reads saved sessions back and skips malformed entries and chips', () => {
    const restored = restoreSessions([
      {
        id: 'a',
        updatedAt: 5,
        messages: [
          { id: 1, role: 'user', text: 'hi', tools: [] },
          { id: 'x', role: 'user', text: 'bad id' },
          { id: 2, role: 'robot', text: 'bad role' },
          { id: 4, role: 'assistant', text: 'set', tools: [{ kind: 'lora', key: 'l1', weight: 0.5 }, { kind: 'explode' }, 'junk', { kind: 'packs', ids: ['a', 3, 'b'] }] },
        ],
      },
      { id: 7, messages: [] },
      'junk',
      { id: 'b', title: 'kept', messages: [{ id: 3, role: 'assistant', text: 'ok', error: true }] },
    ]);
    expect(restored).toEqual([
      {
        id: 'a',
        createdAt: 5,
        updatedAt: 5,
        messages: [
          { id: 1, role: 'user', text: 'hi', tools: [] },
          { id: 4, role: 'assistant', text: 'set', tools: [{ kind: 'lora', key: 'l1', weight: 0.5 }, { kind: 'packs', ids: ['a', 'b'] }] },
        ],
      },
      { id: 'b', title: 'kept', createdAt: 0, updatedAt: 0, messages: [{ id: 3, role: 'assistant', text: 'ok', tools: [], error: true }] },
    ]);
    expect(restoreSessions(undefined)).toEqual([]);
    expect(restoreSessions({ not: 'a list' })).toEqual([]);
  });

  it('reads chats saved before the assistant used tools: their actions become chips, and the going-on notes are dropped', () => {
    const [old] = restoreSessions([
      {
        id: 'o',
        updatedAt: 1,
        messages: [
          { id: 1, role: 'user', text: 'make it', tools: [] },
          { id: 2, role: 'assistant', text: 'done', actions: [{ type: 'selectModel', key: 'm1' }, { type: 'setPrompt', positive: 'p', negative: '' }, { type: 'recommendPacks', ids: ['rmbg'] }, { type: 'createWorkflow', name: 'W', graph: null }, { type: 'nope' }] },
          { id: 3, role: 'user', text: 'Continue the work', actions: [], auto: 1 },
        ],
      },
    ]);
    expect(old!.messages.map((m) => m.id)).toEqual([1, 2]);
    expect(old!.messages[1]!.tools).toEqual([{ kind: 'model', key: 'm1' }, { kind: 'prompt' }, { kind: 'packs', ids: ['rmbg'] }, { kind: 'workflow', key: 'W' }]);
  });
});
