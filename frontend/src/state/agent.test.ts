// @vitest-environment jsdom
// The assistant's chat store: sessions, what a request carries, tool calls applied as they come with one undo per
// request, the permission question for reads, stopping, and what is kept between runs.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type AgentReply, type AgentRequest } from '@/backend';
import { t } from '@/i18n';
import { AGENT_INPUT_HEIGHT, currentMessages, currentSession, useAgent } from './agent';
import { scriptAgent, type ScriptCall } from './agentTools.testkit';
import { DECLINED, DECLINED_WEB } from './agentTools';
import { useGallery } from './gallery';
import { useParams } from './params';
import { useSettings } from './settings';
import { useUi } from './ui';

const STORAGE_KEY = 'novira.agent';

let requests: AgentRequest[] = [];

/** The assistant answers `text` after running `script`; every request is recorded. */
function replyWith(text: string, script: (call: ScriptCall) => Promise<unknown> = async () => {}) {
  return scriptAgent(async (call, request) => {
    requests.push(request);
    await script(call);
    return text;
  });
}

/** The assistant sets the positive prompt. */
const setsPrompt = (positive: string) => replyWith(`set ${positive}`, (call) => call('set_generation_settings', { positivePrompt: positive }));

beforeEach(() => {
  localStorage.clear();
  requests = [];
  useAgent.setState({ sessions: [], currentId: null, busy: false, busySessionId: null, permission: null, working: [] });
  useParams.getState().set({ positivePrompt: 'original', negativePrompt: '' });
  useSettings.getState().set({ assistantReadAccess: 'ask', assistantWebAccess: 'ask' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('agent sessions', () => {
  it('creates a session with the first message and adds the reply to it', async () => {
    replyWith('hello');
    expect(currentMessages(useAgent.getState())).toEqual([]);
    await useAgent.getState().send('  a cat  ');
    const { sessions, currentId } = useAgent.getState();
    expect(sessions).toHaveLength(1);
    expect(currentId).toBe(sessions[0]!.id);
    expect(currentMessages(useAgent.getState()).map((m) => [m.role, m.text])).toEqual([
      ['user', 'a cat'],
      ['assistant', 'hello'],
    ]);
  });

  it('ignores blank messages without creating a session', async () => {
    const chat = replyWith('x');
    await useAgent.getState().send('   ');
    expect(useAgent.getState().sessions).toEqual([]);
    expect(chat).not.toHaveBeenCalled();
  });

  it('sends only the current session history, without failed replies', async () => {
    replyWith('first reply');
    await useAgent.getState().send('first chat');
    const first = useAgent.getState().currentId!;

    useAgent.getState().newSession();
    expect(useAgent.getState().currentId).toBeNull();
    await useAgent.getState().send('second chat');
    expect(requests.at(-1)!.history).toEqual([]);
    expect(useAgent.getState().sessions).toHaveLength(2);

    vi.spyOn(backend, 'agentChat').mockRejectedValueOnce(new Error('offline'));
    await useAgent.getState().send('lost');
    expect(currentMessages(useAgent.getState()).at(-1)).toMatchObject({ error: true, text: 'offline' });

    useAgent.getState().switchSession(first);
    await useAgent.getState().send('follow up');
    expect(requests.at(-1)!.history).toEqual([
      { role: 'user', text: 'first chat' },
      { role: 'assistant', text: 'first reply' },
    ]);
  });

  it('switches only to a session that exists, renames and deletes sessions', async () => {
    replyWith('ok');
    await useAgent.getState().send('keep');
    const keep = useAgent.getState().currentId!;
    useAgent.getState().switchSession('missing');
    expect(useAgent.getState().currentId).toBe(keep);
    useAgent.getState().renameSession(keep, '  My   chat ');
    expect(currentSession(useAgent.getState())!.title).toBe('My chat');
    useAgent.getState().renameSession(keep, '   ');
    expect(currentSession(useAgent.getState())).not.toHaveProperty('title');
    useAgent.getState().newSession();
    await useAgent.getState().send('drop');
    const drop = useAgent.getState().currentId!;
    useAgent.getState().deleteSession(keep);
    expect(useAgent.getState().currentId).toBe(drop);
    useAgent.getState().deleteSession(drop);
    expect(useAgent.getState()).toMatchObject({ sessions: [], currentId: null });
  });

  it('shows no answer for a session deleted while waiting', async () => {
    let resolve: (r: AgentReply) => void = () => {};
    vi.spyOn(backend, 'agentChat').mockImplementation(() => new Promise<AgentReply>((r) => (resolve = r)));
    const pending = useAgent.getState().send('change the prompt');
    const id = useAgent.getState().currentId!;
    expect(useAgent.getState()).toMatchObject({ busy: true, busySessionId: id });
    useAgent.getState().deleteSession(id);
    resolve({ text: 'done' });
    await pending;
    expect(useAgent.getState()).toMatchObject({ busy: false, busySessionId: null, sessions: [] });
  });

  it('keeps the reply in the session that asked even after switching to a new chat', async () => {
    let resolve: (r: AgentReply) => void = () => {};
    vi.spyOn(backend, 'agentChat').mockImplementation(() => new Promise<AgentReply>((r) => (resolve = r)));
    const pending = useAgent.getState().send('question');
    const asked = useAgent.getState().currentId!;
    useAgent.getState().newSession();
    resolve({ text: 'answer' });
    await pending;
    expect(useAgent.getState().currentId).toBeNull();
    expect(useAgent.getState().sessions.find((s) => s.id === asked)!.messages.map((m) => m.text)).toEqual(['question', 'answer']);
  });
});

describe('what a request carries', () => {
  afterEach(() => useAgent.setState({ focus: [], pendingAsk: null, open: false }));

  it('names the screen for every tab and kind of media, the language and nothing the tools can read', async () => {
    replyWith('ok');
    const screens: [Partial<ReturnType<typeof useUi.getState>>, string][] = [
      [{ activeTab: 'generate', media: 'image' }, 'generate'],
      [{ activeTab: 'generate', media: 'logo' }, 'logo'],
      [{ activeTab: 'generate', media: 'music' }, 'music'],
      [{ activeTab: 'models' }, 'models'],
      [{ activeTab: 'extensions' }, 'extensions'],
    ];
    for (const [ui, screen] of screens) {
      useUi.setState(ui);
      await useAgent.getState().send('where am I');
      expect(requests.at(-1)!.screen).toBe(screen);
    }
    // The model reads the rest through the tools.
    const allowed = ['message', 'locale', 'screen', 'history', 'focus', 'agentModel', 'effort'];
    expect(Object.keys(requests[0]!).filter((k) => !allowed.includes(k))).toEqual([]);
    useUi.setState({ activeTab: 'generate', media: 'image' });
  });

  it('asks about extensions chosen in the manager: a new chat, sent once, and the follow-ups keep the focus', async () => {
    replyWith('ok');
    await useAgent.getState().send('earlier chat');
    useAgent.getState().ask('What is ComfyUI-Foo?', ['ComfyUI-Foo']);
    expect(useAgent.getState()).toMatchObject({ open: true, currentId: null, pendingAsk: 'What is ComfyUI-Foo?' });
    await useAgent.getState().flushAsk();
    await useAgent.getState().flushAsk();
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ message: 'What is ComfyUI-Foo?', focus: 'ext:ComfyUI-Foo', history: [] });
    await useAgent.getState().send('how do I use it?');
    expect(requests[2]!.focus).toBe('ext:ComfyUI-Foo');
    useAgent.getState().newSession();
    await useAgent.getState().send('something else');
    expect(requests[3]!.focus).toBeUndefined();
  });

  it('keeps a waiting question until the assistant can send it', async () => {
    const chat = replyWith('ok');
    useAgent.setState({ busy: true });
    useAgent.getState().ask('wait for me', []);
    await useAgent.getState().flushAsk();
    expect(chat).not.toHaveBeenCalled();
    expect(useAgent.getState().pendingAsk).toBe('wait for me');
  });
});

describe('tool calls of a request', () => {
  it('applies each change as it comes, logs it for the chips, and undoes the whole request at once', async () => {
    useParams.getState().set({ steps: 20 });
    replyWith('done', async (call) => {
      await call('set_generation_settings', { positivePrompt: 'a fox' });
      expect(useParams.getState().positivePrompt).toBe('a fox');
      await call('set_generation_settings', { positivePrompt: 'a red fox', steps: 30 });
    });
    await useAgent.getState().send('a fox');
    const reply = currentMessages(useAgent.getState()).at(-1)!;
    expect(reply.tools).toEqual([{ kind: 'prompt' }, { kind: 'prompt' }, { kind: 'params', summary: '30 steps' }]);
    expect(useParams.getState()).toMatchObject({ positivePrompt: 'a red fox', steps: 30 });
    // One undo goes back to before the request, not to between its calls.
    useAgent.getState().undo(reply.id);
    expect(useParams.getState()).toMatchObject({ positivePrompt: 'original', steps: 20 });
    expect(currentMessages(useAgent.getState()).at(-1)!.undone).toBe(true);
  });

  it('shows what changed while the request runs', async () => {
    let seen: unknown;
    replyWith('done', async (call) => {
      await call('set_generation_settings', { positivePrompt: 'x' });
      seen = useAgent.getState().working;
    });
    await useAgent.getState().send('x');
    expect(seen).toEqual([{ kind: 'prompt' }]);
    expect(useAgent.getState().working).toEqual([]);
  });

  it('undoes a reply in any session', async () => {
    setsPrompt('from chat one');
    await useAgent.getState().send('one');
    const reply = currentMessages(useAgent.getState()).at(-1)!;
    expect(useParams.getState().positivePrompt).toBe('from chat one');
    useAgent.getState().newSession();
    useAgent.getState().undo(reply.id);
    expect(useParams.getState().positivePrompt).toBe('original');
  });

  it('keeps the reasoning lines with the reply', async () => {
    vi.spyOn(backend, 'agentChat').mockResolvedValue({ thoughts: ['read it as a request for blue'], text: 'done' });
    await useAgent.getState().send('make it blue');
    expect(currentMessages(useAgent.getState()).at(-1)?.thoughts).toEqual(['read it as a request for blue']);
  });
});

describe('reading pictures and prompts', () => {
  const picture = { name: 'a.png', url: '', thumbnailUrl: '', width: 1, height: 1, createdAt: 1, boardId: null, starred: false, isIntermediate: false, category: 'general', metadata: null, workflow: null } as never;
  beforeEach(() => useGallery.setState({ images: [picture] }));

  /** Runs a request that reads the gallery; `answer` answers the question when one is asked. */
  async function readGallery(answer?: 'once' | 'always' | 'deny') {
    let result: { ok: boolean; content: unknown } | undefined;
    replyWith('done', async (call) => {
      result = await call('list_gallery_images', {});
    });
    const sending = useAgent.getState().send('look at my pictures');
    if (answer) {
      await vi.waitFor(() => expect(useAgent.getState().permission).toEqual({ tool: 'list_gallery_images' }));
      expect(useAgent.getState().open).toBe(true);
      useAgent.getState().answerPermission(answer);
    }
    await sending;
    expect(useAgent.getState().permission).toBeNull();
    return result!;
  }

  it('asks each time by default: allowed once it reads, and the next request asks again', async () => {
    expect((await readGallery('once')).ok).toBe(true);
    expect(useSettings.getState().assistantReadAccess).toBe('ask');
    expect((await readGallery('once')).ok).toBe(true);
  });

  it('a declined read is an error telling the model the user declined, and nothing is read', async () => {
    expect(await readGallery('deny')).toEqual({ ok: false, content: DECLINED });
  });

  it('always allow changes the setting, so later reads are not asked', async () => {
    expect((await readGallery('always')).ok).toBe(true);
    expect(useSettings.getState().assistantReadAccess).toBe('always');
    expect((await readGallery()).ok).toBe(true);
  });

  it('never refuses without asking', async () => {
    useSettings.getState().set({ assistantReadAccess: 'never' });
    expect(await readGallery()).toEqual({ ok: false, content: DECLINED });
  });
});

describe('looking facts up on the web', () => {
  /** Runs a request that looks a word up; `answer` answers the question when one is asked. */
  async function lookUp(answer?: 'once' | 'always' | 'deny') {
    let result: { ok: boolean; content: unknown } | undefined;
    replyWith('done', async (call) => {
      result = await call('lookup_reference', { query: 'kimono', language: 'en' });
    });
    const sending = useAgent.getState().send('what is a kimono');
    if (answer) {
      await vi.waitFor(() => expect(useAgent.getState().permission).toEqual({ tool: 'lookup_reference', query: 'kimono', language: 'en' }));
      expect(useAgent.getState().open).toBe(true);
      useAgent.getState().answerPermission(answer);
    }
    await sending;
    expect(useAgent.getState().permission).toBeNull();
    return result!;
  }

  beforeEach(() => {
    vi.spyOn(backend, 'lookupReference').mockResolvedValue([{ title: 'Kimono', extract: 'A garment.', url: 'https://en.wikipedia.org/wiki/Kimono' }]);
  });

  it('shows the words that would be sent, and a decline is an answer about the web, not pictures', async () => {
    expect(await lookUp('deny')).toEqual({ ok: false, content: DECLINED_WEB });
  });

  it('allowed once it looks up, and always allow changes only the web setting', async () => {
    expect((await lookUp('once')).ok).toBe(true);
    expect(useSettings.getState().assistantWebAccess).toBe('ask');
    expect((await lookUp('always')).ok).toBe(true);
    expect(useSettings.getState().assistantWebAccess).toBe('always');
    expect(useSettings.getState().assistantReadAccess).toBe('ask');
    expect((await lookUp()).ok).toBe(true);
  });

  it('a setting of never refuses without asking, and always for pictures does not open the web', async () => {
    useSettings.getState().set({ assistantWebAccess: 'never' });
    expect(await lookUp()).toEqual({ ok: false, content: DECLINED_WEB });
    useSettings.getState().set({ assistantWebAccess: 'ask', assistantReadAccess: 'always' });
    expect((await lookUp('once')).ok).toBe(true);
  });
});

describe('stopping a request', () => {
  afterEach(() => useAgent.setState({ busy: false }));

  it('tells the backend, says it was cancelled, and keeps what was changed before so it can be undone', async () => {
    const cancel = vi.spyOn(backend, 'agentCancel').mockResolvedValue();
    let resolve!: (r: AgentReply) => void;
    scriptAgent(async (call) => {
      await call('set_generation_settings', { positivePrompt: 'half done' });
      return new Promise<AgentReply>((r) => (resolve = r));
    });
    const sending = useAgent.getState().send('a cat');
    await vi.waitFor(() => expect(typeof resolve).toBe('function'));
    expect(useParams.getState().positivePrompt).toBe('half done');
    useAgent.getState().cancel();
    expect(cancel).toHaveBeenCalledTimes(1);
    resolve({ text: 'late answer' });
    await sending;
    const last = currentMessages(useAgent.getState()).at(-1)!;
    expect(last.text).not.toBe('late answer');
    expect(last.error).toBeUndefined();
    expect(last.tools).toEqual([{ kind: 'prompt' }]);
    useAgent.getState().undo(last.id);
    expect(useParams.getState().positivePrompt).toBe('original');
    // The next request is not affected.
    replyWith('ok');
    await useAgent.getState().send('again');
    expect(currentMessages(useAgent.getState()).at(-1)?.text).toBe('ok');
  });

  it('answers a waiting permission question with no', async () => {
    vi.spyOn(backend, 'agentCancel').mockResolvedValue();
    let result: unknown;
    let resolve!: (r: AgentReply) => void;
    scriptAgent(async (call) => {
      result = await call('list_gallery_images', {});
      return new Promise<AgentReply>((r) => (resolve = r));
    });
    const sending = useAgent.getState().send('look');
    await vi.waitFor(() => expect(useAgent.getState().permission).not.toBeNull());
    useAgent.getState().cancel();
    await vi.waitFor(() => expect(result).toEqual({ ok: false, content: DECLINED }));
    resolve({ text: 'x' });
    await sending;
    expect(useAgent.getState().permission).toBeNull();
  });

  it('does nothing when no request is running', () => {
    const cancel = vi.spyOn(backend, 'agentCancel').mockResolvedValue();
    useAgent.getState().cancel();
    expect(cancel).not.toHaveBeenCalled();
  });
});

describe('agent session persistence', () => {
  it('saves sessions with the chips and without undo snapshots', async () => {
    setsPrompt('saved');
    await useAgent.getState().send('remember me');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { version: number; state: Record<string, unknown> };
    expect(saved.version).toBe(1);
    expect(Object.keys(saved.state).sort()).toEqual(['choice', 'currentId', 'inputHeight', 'sessions', 'size']);
    const { sessions, currentId } = saved.state as { sessions: { id: string; messages: Record<string, unknown>[] }[]; currentId: string };
    expect(currentId).toBe(sessions[0]!.id);
    expect(sessions[0]!.messages.map((m) => m.text)).toEqual(['remember me', 'set saved']);
    expect(sessions[0]!.messages[1]).not.toHaveProperty('snapshot');
    expect(sessions[0]!.messages[1]!.tools).toEqual([{ kind: 'prompt' }]);
    // The in-memory message still has its snapshot for undo.
    expect(currentMessages(useAgent.getState()).at(-1)!.snapshot).toBeDefined();
  });

  it('reads back the height of the message box within its limits, and the default when none was kept', async () => {
    for (const [kept, read] of [[200, 200], [9999, AGENT_INPUT_HEIGHT.max], [3, AGENT_INPUT_HEIGHT.min], ['tall', AGENT_INPUT_HEIGHT.default]] as const) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: { sessions: [], currentId: null, inputHeight: kept } }));
      await useAgent.persist.rehydrate();
      expect(useAgent.getState().inputHeight).toBe(read);
    }
  });

  it('restores saved sessions, and new messages get ids that do not collide', async () => {
    const stored = {
      version: 1,
      state: {
        sessions: [{ id: 'old', createdAt: 1, updatedAt: 2, messages: [{ id: 500, role: 'user', text: 'from last run', tools: [] }] }],
        currentId: 'old',
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    await useAgent.persist.rehydrate();
    expect(useAgent.getState().currentId).toBe('old');
    expect(currentMessages(useAgent.getState()).map((m) => m.text)).toEqual(['from last run']);

    replyWith('welcome back');
    await useAgent.getState().send('again');
    expect(requests[0]!.history).toEqual([{ role: 'user', text: 'from last run' }]);
    const ids = currentMessages(useAgent.getState()).map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.min(...ids.slice(1))).toBeGreaterThan(500);
  });

  it('starts a new chat when the saved current session is gone', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: { sessions: 'broken', currentId: 'nope' } }));
    await useAgent.persist.rehydrate();
    expect(useAgent.getState()).toMatchObject({ sessions: [], currentId: null });
  });
});

describe('attached pictures', () => {
  it('go with the message and are kept on it; pictures alone ask for a prompt', async () => {
    replyWith('done');
    await useAgent.getState().send('like this', ['a.png', 'b.png']);
    expect(requests[0]).toMatchObject({ message: 'like this', images: ['a.png', 'b.png'] });
    expect(currentMessages(useAgent.getState()).at(-2)).toMatchObject({ role: 'user', text: 'like this', images: ['a.png', 'b.png'] });
    await useAgent.getState().send('   ', ['c.png']);
    expect(requests[1]).toMatchObject({ message: t('agent.attach.defaultAsk'), images: ['c.png'] });
    // Earlier turns carry only their text.
    expect(requests[1]!.history?.[0]).toEqual({ role: 'user', text: 'like this' });
  });

  it('are left out when there are none, cut to the limit, and an empty message without pictures sends nothing', async () => {
    replyWith('done');
    await useAgent.getState().send('plain');
    expect(requests[0]).not.toHaveProperty('images');
    expect(currentMessages(useAgent.getState()).at(-2)).not.toHaveProperty('images');
    await useAgent.getState().send('many', ['1.png', '2.png', '3.png', '4.png', '5.png']);
    expect(requests[1]!.images).toEqual(['1.png', '2.png', '3.png', '4.png']);
    await useAgent.getState().send('  ', []);
    expect(requests).toHaveLength(2);
  });
});
