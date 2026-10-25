// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type AgentReply } from '@/backend';
import { t } from '@/i18n';
import { useAgent, type AgentSession } from '@/state/agent';
import { TooltipProvider } from '@/ui';
import { AgentWindow } from './AgentWindow';

const session = (id: string, updatedAt: number, text: string, extra: Partial<AgentSession> = {}): AgentSession => ({
  id,
  createdAt: updatedAt,
  updatedAt,
  messages: [
    { id: updatedAt * 10, role: 'user', text, tools: [] },
    { id: updatedAt * 10 + 1, role: 'assistant', text: `reply to ${text}`, tools: [] },
  ],
  ...extra,
});

function renderWindow() {
  return render(
    <TooltipProvider>
      <AgentWindow />
    </TooltipProvider>,
  );
}

const title = () => screen.getByTestId('agent-session-title').textContent;
const openList = () => fireEvent.click(screen.getByTestId('agent-session-toggle'));
const rows = () => screen.queryAllByTestId('agent-session');

beforeAll(() => {
  // jsdom does not lay out, so it has no scrolling.
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(backend, 'agentStatus').mockResolvedValue({ provider: 'claude', installed: true, loggedIn: true, models: [] });
  const now = Date.now();
  useAgent.setState({
    sessions: [session('older', now - 3 * 3_600_000, 'a cat on a roof'), session('newer', now - 5 * 60_000, 'a dog in the rain')],
    currentId: 'older',
    busy: false,
    busySessionId: null,
    status: { provider: 'claude', installed: true, loggedIn: true, models: [] },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('assistant chat sessions', () => {
  it('shows the current session and lists past chats most recent first', async () => {
    renderWindow();
    await screen.findByTestId('agent-session-toggle');
    expect(title()).toBe('a cat on a roof');
    expect(screen.getByText('reply to a cat on a roof')).toBeTruthy();

    openList();
    expect(rows().map((r) => r.getAttribute('data-session'))).toEqual(['newer', 'older']);
    expect(rows()[1]!.querySelector('[aria-current="true"]')).not.toBeNull();
    expect(screen.queryByTestId('agent-input')).toBeNull();

    fireEvent.click(within(rows()[0]!).getByText('a dog in the rain'));
    expect(useAgent.getState().currentId).toBe('newer');
    expect(screen.queryByTestId('agent-sessions')).toBeNull();
    expect(title()).toBe('a dog in the rain');
    expect(screen.getByText('reply to a dog in the rain')).toBeTruthy();
  });

  it('starts a new chat that becomes a session with its first message', async () => {
    let resolve: (r: AgentReply) => void = () => {};
    vi.spyOn(backend, 'agentChat').mockImplementation(() => new Promise<AgentReply>((r) => (resolve = r)));
    renderWindow();
    fireEvent.click(await screen.findByTestId('agent-session-new'));
    expect(title()).toBe(t('agent.session.untitled'));
    expect(screen.getByText(t('agent.greeting'))).toBeTruthy();

    fireEvent.change(screen.getByTestId('agent-input'), { target: { value: 'a fox in snow' } });
    fireEvent.click(screen.getByTestId('agent-send'));
    expect(title()).toBe('a fox in snow');
    expect(screen.getByText(t('agent.thinking'))).toBeTruthy();

    // The thinking indicator belongs to the session that asked.
    fireEvent.click(screen.getByTestId('agent-session-new'));
    expect(screen.queryByText(t('agent.thinking'))).toBeNull();
    await act(async () => resolve({ text: 'here you go' }));
    expect(useAgent.getState().sessions).toHaveLength(3);
  });

  it('renames a session from the list, and Escape cancels', async () => {
    renderWindow();
    openList();
    fireEvent.click(within(rows()[1]!).getByTestId('agent-session-rename'));
    const input = screen.getByTestId('agent-session-name') as HTMLInputElement;
    expect(input.value).toBe('a cat on a roof');
    fireEvent.change(input, { target: { value: 'Roof cat' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(within(rows()[1]!).getByText('Roof cat')).toBeTruthy());

    fireEvent.click(within(rows()[1]!).getByTestId('agent-session-rename'));
    fireEvent.change(screen.getByTestId('agent-session-name'), { target: { value: 'ignored' } });
    fireEvent.keyDown(screen.getByTestId('agent-session-name'), { key: 'Escape' });
    expect(useAgent.getState().sessions.find((s) => s.id === 'older')!.title).toBe('Roof cat');
  });

  it('deletes a session only after confirming', async () => {
    renderWindow();
    openList();
    fireEvent.click(within(rows()[0]!).getByTestId('agent-session-delete'));
    fireEvent.click(within(rows()[0]!).getByText(t('common.cancel')));
    expect(rows()).toHaveLength(2);

    fireEvent.click(within(rows()[1]!).getByTestId('agent-session-delete'));
    fireEvent.click(screen.getByTestId('agent-session-delete-confirm'));
    expect(rows().map((r) => r.getAttribute('data-session'))).toEqual(['newer']);
    expect(useAgent.getState().currentId).toBeNull();

    fireEvent.click(within(rows()[0]!).getByTestId('agent-session-delete'));
    fireEvent.click(screen.getByTestId('agent-session-delete-confirm'));
    expect(screen.getByText(t('agent.session.empty'))).toBeTruthy();
  });

  it('cannot undo a change restored from an earlier run', async () => {
    useAgent.setState({
      sessions: [
        {
          id: 'restored',
          createdAt: 1,
          updatedAt: 1,
          messages: [{ id: 1, role: 'assistant', text: 'set', tools: [{ kind: 'prompt' }] }],
        },
      ],
      currentId: 'restored',
    });
    renderWindow();
    const undo = (await screen.findByTestId('agent-undo')) as HTMLButtonElement;
    expect(undo.disabled).toBe(true);
    expect(undo.title).toBe(t('agent.undoExpired'));
  });
});
