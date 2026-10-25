// @vitest-environment jsdom
// The assistant window's chat: sending, the change chips of every kind of action, dragging the window and the setup screen.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { useAgent, type AgentMessage, type AgentToolLog } from '@/state/agent';
import { TooltipProvider } from '@/ui';
import { AgentWindow } from './AgentWindow';

const show = () =>
  render(
    <TooltipProvider>
      <AgentWindow />
    </TooltipProvider>,
  );
const message = (id: number, role: 'user' | 'assistant', text: string, extra: Partial<AgentMessage> = {}): AgentMessage => ({ id, role, text, tools: [], ...extra });
const ready = { provider: 'claude' as const, installed: true, loggedIn: true, models: [] };

function seed(messages: AgentMessage[], over: Partial<ReturnType<typeof useAgent.getState>> = {}) {
  useAgent.setState({
    sessions: [{ id: 's1', createdAt: 1, updatedAt: 1, messages }],
    currentId: 's1',
    busy: false,
    busySessionId: null,
    status: ready,
    pos: null,
    ...over,
  });
}

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});
afterAll(() => {
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(backend, 'agentStatus').mockResolvedValue(ready);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('sending', () => {
  it('offers starting suggestions on an empty chat and sends the one picked', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    seed([], { send });
    show();
    fireEvent.click(await screen.findByText(t('agent.suggestion.anime')));
    expect(send).toHaveBeenCalledWith(t('agent.suggestion.anime'), []);
  });

  it('sends on Enter, keeps Shift+Enter and composing for the text, and ignores an empty or busy send', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    seed([message(1, 'user', 'hi')], { send });
    show();
    const input = (await screen.findByTestId('agent-input')) as HTMLTextAreaElement;
    expect((screen.getByTestId('agent-send') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(send).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'make it blue' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(send).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(send).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(send).toHaveBeenCalledWith('make it blue', []);
    expect(input.value).toBe('');

    fireEvent.change(input, { target: { value: 'again' } });
    fireEvent.submit(input.closest('form')!);
    expect(send).toHaveBeenCalledTimes(2);
    act(() => useAgent.setState({ busy: true, busySessionId: 's1' }));
    fireEvent.change(input, { target: { value: 'while busy' } });
    fireEvent.submit(input.closest('form')!);
    expect(send).toHaveBeenCalledTimes(2);
    expect(screen.getByText(t('agent.thinking'))).toBeTruthy();
  });
});

describe('applied changes', () => {
  const tools: AgentToolLog[] = [
    { kind: 'model', key: 'unknown-key' },
    { kind: 'lora', key: 'lora-x', weight: 0.7 },
    { kind: 'prompt' },
    { kind: 'workflow', key: 'My flow' },
    { kind: 'editText', count: 2 },
    { kind: 'video', count: 1 },
    { kind: 'music', count: 2 },
    { kind: 'voice', count: 1 },
    { kind: 'editWorkflow', count: 1 },
    { kind: 'editComic', count: 4 },
    { kind: 'pose', count: 2 },
    { kind: 'params', summary: '512×768 / 30 steps' },
    { kind: 'queued', count: 3 },
    { kind: 'packs', ids: ['rmbg'] },
  ];

  it('names every kind of change in a chip list, shows the recommended extensions, and offers to generate and to undo', async () => {
    const undo = vi.fn();
    seed([message(1, 'user', 'do it'), message(2, 'assistant', 'Done', { tools, snapshot: {} as never })], { undo });
    show();
    const list = await screen.findByText(t('agent.applied'));
    const items = within(list.closest('.agent-msg__actions') as HTMLElement).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual([
      t('agent.action.model', { name: 'unknown-key' }),
      t('agent.action.lora', { name: 'lora-x', weight: 0.7 }),
      t('agent.action.prompt'),
      t('agent.action.workflow', { name: 'My flow' }),
      t('agent.action.editText', { count: 2 }),
      t('agent.action.video', { fields: 1 }),
      t('agent.action.music', { fields: 2 }),
      t('agent.action.voice', { fields: 1 }),
      t('agent.action.editWorkflow', { count: 1 }),
      t('agent.action.editComic', { count: 4 }),
      t('agent.action.pose', { count: 2 }),
      t('agent.action.params', { summary: '512×768 / 30 steps' }),
      t('agent.action.queued', { count: 3 }),
    ]);
    expect(screen.getAllByTestId('agent-pack').map((c) => c.getAttribute('data-pack'))).toEqual(['rmbg']);
    fireEvent.click(screen.getByTestId('agent-undo'));
    expect(undo).toHaveBeenCalledWith(2);
  });

  it('shows a change as undone, or as no longer undoable, and no undo for work that was only queued', async () => {
    seed([
      message(1, 'assistant', 'one', { tools: [{ kind: 'prompt' }], undone: true, snapshot: {} as never }),
      message(2, 'assistant', 'two', { tools: [{ kind: 'prompt' }] }),
      message(3, 'assistant', 'three', { tools: [{ kind: 'queued', count: 1 }] }),
    ]);
    show();
    expect(await screen.findByText(t('agent.undone'))).toBeTruthy();
    const buttons = screen.getAllByTestId('agent-undo') as HTMLButtonElement[];
    expect(buttons.map((b) => b.disabled)).toEqual([true, true]);
    expect(buttons[1]!.getAttribute('title')).toBe(t('agent.undoExpired'));
    expect(screen.getByText(t('agent.action.queued', { count: 1 }))).toBeTruthy();
  });

  it('shows what changed while the assistant works', async () => {
    seed([message(1, 'user', 'go')], { busy: true, busySessionId: 's1', working: [{ kind: 'prompt' }, { kind: 'packs', ids: ['x'] }] });
    show();
    const working = await screen.findByTestId('agent-working');
    expect(within(working).getAllByRole('listitem').map((li) => li.textContent)).toEqual([t('agent.action.prompt')]);
  });

  it('asks before the assistant reads pictures or prompts, and passes on the answer', async () => {
    const answerPermission = vi.fn();
    seed([message(1, 'user', 'look')], { busy: true, busySessionId: 's1', permission: { tool: 'list_gallery_images' }, answerPermission });
    show();
    const prompt = await screen.findByTestId('agent-permission');
    expect(prompt.textContent).toContain(t('agent.permission.title'));
    expect(prompt.textContent).toContain(t('agent.permission.gallery'));
    fireEvent.click(screen.getByTestId('agent-permission-once'));
    fireEvent.click(screen.getByTestId('agent-permission-always'));
    fireEvent.click(screen.getByTestId('agent-permission-deny'));
    expect(answerPermission.mock.calls).toEqual([['once'], ['always'], ['deny']]);
  });

  it('shows an error message as one', async () => {
    seed([message(1, 'assistant', 'It failed', { error: true })]);
    show();
    expect((await screen.findByText('It failed')).closest('.agent-msg')!.className).toContain('is-error');
  });
});

describe('the window', () => {
  it('can be dragged by its header, stays on screen and ignores presses on the header buttons', async () => {
    const setPos = vi.fn();
    seed([message(1, 'user', 'hi')], { setPos });
    show();
    const win = await screen.findByTestId('agent-window');
    win.getBoundingClientRect = () => ({ left: 100, top: 100, width: 300, height: 400, right: 400, bottom: 500, x: 100, y: 100, toJSON: () => ({}) });
    const header = win.querySelector('.agent-win__head')!;
    const at = (el: Element | Window, type: string, x: number, y: number) => {
      const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
      el.dispatchEvent(e);
    };
    at(header.querySelector('button')!, 'pointerdown', 120, 120);
    expect(setPos).not.toHaveBeenCalled();
    at(header, 'pointerdown', 120, 130);
    at(window, 'pointermove', 220, 230);
    expect(setPos).toHaveBeenLastCalledWith({ x: 200, y: 200 });
    at(window, 'pointermove', -500, 5000);
    expect(setPos).toHaveBeenLastCalledWith({ x: 0, y: window.innerHeight - 48 });
    at(window, 'pointerup', 0, 0);
    at(window, 'pointermove', 300, 300);
    expect(setPos).toHaveBeenCalledTimes(2);
  });

  it('closes, and changes the provider', async () => {
    const setOpen = vi.fn();
    const changeProvider = vi.fn();
    seed([message(1, 'user', 'hi')], { setOpen, changeProvider });
    show();
    expect(await screen.findByTestId('agent-provider')).toBeTruthy();
    fireEvent.click(screen.getByLabelText(t('agent.changeProvider')));
    expect(changeProvider).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText(t('agent.close')));
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it('starts a new chat from the session bar and closes the list', async () => {
    const newSession = vi.fn();
    seed([message(1, 'user', 'hi')], { newSession });
    show();
    fireEvent.click(await screen.findByTestId('agent-session-toggle'));
    expect(screen.getAllByText(t('agent.session.history')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('agent-session-new'));
    expect(newSession).toHaveBeenCalled();
    expect(screen.getByTestId('agent-session-toggle').getAttribute('aria-expanded')).toBe('false');
  });

  it('is placed where it was dragged to', async () => {
    seed([], { pos: { x: 40, y: 60 } });
    show();
    const win = await screen.findByTestId('agent-window');
    expect(win.style.left).toBe('40px');
    expect(win.className).toContain('is-moved');
  });
});

describe('setup', () => {
  it('waits while the sign-in state is unknown', async () => {
    vi.spyOn(backend, 'agentStatus').mockReturnValue(new Promise(() => {}));
    seed([], { status: null });
    show();
    expect(screen.queryByTestId('agent-setup')).toBeNull();
    expect(document.querySelector('.agent-setup')).toBeTruthy();
  });

  it('lets the user choose a provider, says it is waiting, and explains a missing install or a failed sign-in', async () => {
    const signIn = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(backend, 'agentStatus').mockResolvedValue({ provider: null, installed: false, loggedIn: false } as never);
    seed([], { status: { provider: null, installed: false, loggedIn: false } as never, signIn });
    show();
    fireEvent.click(await screen.findByTestId('agent-choose-codex'));
    expect(signIn).toHaveBeenCalledWith('codex');
    act(() => useAgent.setState({ signingIn: 'claude' }));
    expect(screen.getByText(t('agent.setup.waiting', { name: 'Claude' }))).toBeTruthy();
    act(() => useAgent.setState({ signingIn: null, signInError: 'denied', status: { provider: 'codex', installed: false, loggedIn: false } as never }));
    expect(screen.getByText('denied')).toBeTruthy();
    expect(screen.getByText(t('agent.setup.notInstalled', { name: 'Codex' }))).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('agent-setup')).toBeTruthy());
  });
});

describe('a question asked from another screen', () => {
  afterEach(() => useAgent.setState({ pendingAsk: null, focus: [] }));

  it('is sent as soon as the assistant is signed in, and only once', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    seed([], { send, status: null, pendingAsk: 'What does it do?' });
    show();
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send).toHaveBeenCalledWith('What does it do?');
    expect(useAgent.getState().pendingAsk).toBeNull();
  });

  it('waits on the sign-in screen when the assistant is not signed in', async () => {
    vi.spyOn(backend, 'agentStatus').mockResolvedValue({ provider: 'claude', installed: true, loggedIn: false, models: [] });
    const send = vi.fn().mockResolvedValue(undefined);
    seed([], { send, status: null, pendingAsk: 'What does it do?' });
    show();
    await screen.findByTestId('agent-setup');
    expect(send).not.toHaveBeenCalled();
    expect(useAgent.getState().pendingAsk).toBe('What does it do?');
  });
});

describe('stopping, reasoning and resizing', () => {
  afterEach(() => useAgent.setState({ size: null, pos: null, busy: false }));

  it('shows a stop button instead of send while a request is running, and it cancels the request', async () => {
    const cancel = vi.fn();
    seed([message(1, 'user', 'hi')], { busy: true, busySessionId: 's1', cancel });
    show();
    expect(screen.queryByTestId('agent-send')).toBeNull();
    fireEvent.click(await screen.findByTestId('agent-stop'));
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('shows the reasoning as one line that opens to the whole account', async () => {
    seed([message(1, 'user', 'hi'), message(2, 'assistant', 'done', { thoughts: ['took it for ComfyUI_TJ_NormalLighting', 'it is not installed'] })]);
    show();
    const box = await screen.findByTestId('agent-thoughts');
    expect(box.textContent).toContain('took it for ComfyUI_TJ_NormalLighting');
    expect(within(box).queryByTestId('agent-thoughts-list')).toBeNull();
    fireEvent.click(within(box).getByRole('button'));
    expect(within(screen.getByTestId('agent-thoughts-list')).getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(within(box).getByRole('button'));
    expect(within(box).queryByTestId('agent-thoughts-list')).toBeNull();
  });

  it('shows no reasoning row for a reply without it', async () => {
    seed([message(1, 'user', 'hi'), message(2, 'assistant', 'done')]);
    show();
    await screen.findByText('done');
    expect(screen.queryByTestId('agent-thoughts')).toBeNull();
  });

  it('changes the size by dragging a corner, within limits, and remembers it', async () => {
    // Earlier tests replace the store's actions with mocks; use the real ones here.
    seed([], { setPos: (pos) => useAgent.setState({ pos }), setSize: (size) => useAgent.setState({ size }) });
    show();
    const win = await screen.findByTestId('agent-window');
    win.getBoundingClientRect = () => ({ left: 700, top: 200, right: 1100, bottom: 780, width: 400, height: 580, x: 700, y: 200, toJSON: () => ({}) });
    fireEvent.pointerDown(screen.getByTestId('agent-resize-nw'), { clientX: 700, clientY: 200 });
    fireEvent.pointerMove(window, { clientX: 600, clientY: 100 });
    expect(useAgent.getState().size).toEqual({ w: 500, h: 680 });
    expect(useAgent.getState().pos).toEqual({ x: 600, y: 100 });
    fireEvent.pointerMove(window, { clientX: 1000, clientY: 700 });
    expect(useAgent.getState().size).toEqual({ w: 320, h: 360 });
    fireEvent.pointerUp(window);
    fireEvent.pointerMove(window, { clientX: 0, clientY: 0 });
    expect(useAgent.getState().size).toEqual({ w: 320, h: 360 });
  });
});
