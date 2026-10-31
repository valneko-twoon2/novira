// @vitest-environment jsdom
// The assistant's chat screen on a phone: the state shown while it is not set up (set up on the PC, no form), the
// conversation and the message box, Enter for a new line, the past chats sheet, a new chat and the way back.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type AgentStatus } from '@/backend';
import { t } from '@/i18n';
import { useAgent, type AgentMessage } from '@/state/agent';
import { TooltipProvider } from '@/ui';
import { PhoneChat, PhoneChatLayer } from './PhoneChat';

const ready: AgentStatus = { provider: 'claude', installed: true, loggedIn: true, models: [] };
const message = (id: number, role: 'user' | 'assistant', text: string, extra: Partial<AgentMessage> = {}): AgentMessage => ({ id, role, text, tools: [], ...extra });
const show = () =>
  render(
    <TooltipProvider>
      <PhoneChat />
    </TooltipProvider>,
  );

function seed(status: AgentStatus, over: Partial<ReturnType<typeof useAgent.getState>> = {}) {
  vi.spyOn(backend, 'agentStatus').mockResolvedValue(status);
  useAgent.setState({
    status,
    open: true,
    busy: false,
    busySessionId: null,
    sessions: [
      { id: 's1', createdAt: 1, updatedAt: 1, messages: [message(1, 'user', 'a cat'), message(2, 'assistant', 'Done.', { tools: [{ kind: 'prompt' }], snapshot: {} })] },
      { id: 's2', createdAt: 2, updatedAt: 2, title: 'Sunset', messages: [message(3, 'user', 'a sunset')] },
    ],
    currentId: 's1',
    ...over,
  });
}

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});
afterAll(() => {
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('phone chat', () => {
  it('says the assistant is set up on the PC while it is not ready, without a form or a box', async () => {
    seed({ provider: null, installed: false, loggedIn: false, models: [] });
    show();
    expect(await screen.findByText(t('phone.agentSetup'))).toBeTruthy();
    expect(screen.getByTestId('agent-session-title').textContent).toBe(t('agent.title'));
    expect(screen.queryByTestId('agent-choose-claude')).toBeNull();
    expect(screen.queryByTestId('agent-input')).toBeNull();
    expect(screen.queryByTestId('phone-chat-history')).toBeNull();
    expect(screen.queryByTestId('phone-chat-new')).toBeNull();
  });

  it('shows the conversation with its chips under the session title, and goes back', async () => {
    seed(ready);
    show();
    expect(screen.getByTestId('agent-session-title').textContent).toBe('a cat');
    expect(screen.getByTestId('agent-msg-user').textContent).toContain('a cat');
    const answer = screen.getByTestId('agent-msg-assistant');
    expect(within(answer).getByText(t('agent.action.prompt'))).toBeTruthy();
    expect(within(answer).getByTestId('agent-undo')).toBeTruthy();
    // The CLI's model and effort can be chosen here; they only go with the next message.
    expect(screen.getByTestId('agent-model')).toBeTruthy();
    fireEvent.click(screen.getByTestId('phone-chat-close'));
    expect(useAgent.getState().open).toBe(false);
    await waitFor(() => expect(backend.agentStatus).toHaveBeenCalled());
  });

  it("leaves out the server's model picker, whose list and test are the PC's", () => {
    seed({
      provider: 'openai',
      installed: true,
      loggedIn: true,
      models: [],
      endpoint: { baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen3:8b', hasKey: false, remote: false, insecure: false, tools: 'supported' },
    });
    show();
    expect(screen.getByTestId('agent-input')).toBeTruthy();
    expect(screen.queryByTestId('agent-model')).toBeNull();
  });

  it('starts a new line on Enter and sends with the button; Stop shows while the assistant works', () => {
    const send = vi.fn().mockResolvedValue({ ok: true, cancelled: false, text: '' });
    const cancel = vi.fn();
    seed(ready, { send, cancel });
    show();
    const input = screen.getByTestId('agent-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'make it blue' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('agent-send'));
    expect(send).toHaveBeenCalledWith('make it blue', []);
    expect(input.value).toBe('');
    act(() => useAgent.setState({ busy: true, busySessionId: 's1' }));
    expect(screen.getByTestId('agent-working')).toBeTruthy();
    fireEvent.click(screen.getByTestId('agent-stop'));
    expect(cancel).toHaveBeenCalled();
  });

  it('offers the starting suggestions on a new chat and sends the one tapped', () => {
    const send = vi.fn().mockResolvedValue({ ok: true, cancelled: false, text: '' });
    seed(ready, { send });
    show();
    fireEvent.click(screen.getByTestId('phone-chat-new'));
    expect(useAgent.getState().currentId).toBeNull();
    expect(screen.getByTestId('agent-session-title').textContent).toBe(t('agent.session.untitled'));
    fireEvent.click(screen.getByText(t('agent.suggestion.photo')));
    expect(send).toHaveBeenCalledWith(t('agent.suggestion.photo'), []);
  });

  it('opens the past chats as a sheet; picking one shows it and closes the sheet', () => {
    seed(ready);
    show();
    fireEvent.click(screen.getByTestId('phone-chat-history'));
    const sheet = screen.getByTestId('phone-chat-sheet');
    expect(within(sheet).getAllByTestId('agent-session')).toHaveLength(2);
    fireEvent.click(within(sheet).getByText('Sunset'));
    expect(screen.queryByTestId('phone-chat-sheet')).toBeNull();
    expect(useAgent.getState().currentId).toBe('s2');
    expect(screen.getByTestId('agent-session-title').textContent).toBe('Sunset');
    // The close button of the sheet closes it too.
    fireEvent.click(screen.getByTestId('phone-chat-history'));
    fireEvent.click(screen.getByTestId('phone-chat-sheet-close'));
    expect(screen.queryByTestId('phone-chat-sheet')).toBeNull();
    // And so does Escape.
    fireEvent.click(screen.getByTestId('phone-chat-history'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('phone-chat-sheet')).toBeNull();
  });
});

describe('the chat layer', () => {
  it('renders nothing until the assistant is first opened, then stays mounted (hidden) after it closes', () => {
    seed(ready, { open: false });
    const { container } = render(
      <TooltipProvider>
        <PhoneChatLayer />
      </TooltipProvider>,
    );
    expect(screen.queryByTestId('phone-chat')).toBeNull();
    expect(container.innerHTML).toBe('');
    act(() => useAgent.setState({ open: true }));
    expect(screen.getByTestId('phone-chat')).toBeTruthy();
    act(() => useAgent.setState({ open: false }));
    // Hidden, not removed: the draft in the message box survives.
    expect(document.querySelector('[data-testid="phone-chat"]')).not.toBeNull();
  });
});

describe('the visible area above the keyboard', () => {
  class FakeViewport extends EventTarget {
    height = 500;
    offsetTop = 20;
  }
  afterEach(() => delete (window as { visualViewport?: unknown }).visualViewport);

  it('follows the visual viewport as the keyboard opens, and stops listening on unmount', () => {
    const vv = new FakeViewport();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
    seed(ready);
    const { unmount } = show();
    const chat = () => screen.getByTestId('phone-chat');
    expect(chat().style.height).toBe('500px');
    expect(chat().style.top).toBe('20px');
    vv.height = 300;
    act(() => void vv.dispatchEvent(new Event('resize')));
    expect(chat().style.height).toBe('300px');
    vv.offsetTop = 40;
    act(() => void vv.dispatchEvent(new Event('scroll')));
    expect(chat().style.top).toBe('40px');
    const el = chat();
    unmount();
    vv.height = 100;
    vv.dispatchEvent(new Event('resize'));
    expect(el.style.height).toBe('300px');
  });

  it('leaves the size to the style sheet when the browser has no visual viewport', () => {
    seed(ready);
    show();
    expect(screen.getByTestId('phone-chat').style.height).toBe('');
  });
});
