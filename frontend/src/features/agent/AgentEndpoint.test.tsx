// @vitest-environment jsdom
// Connecting the assistant to an OpenAI-compatible server: the setup form (presets, warnings, key, model list, test
// connection, saving), the model picker of a saved server, the banner for a model without tools, and the note on
// the permission question about where what it reads is sent.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type AgentEndpointInfo, type AgentStatus } from '@/backend';
import { t } from '@/i18n';
import { useAgent } from '@/state/agent';
import { TooltipProvider } from '@/ui';
import { AgentWindow } from './AgentWindow';

const OLLAMA = 'http://127.0.0.1:11434/v1';

const endpoint = (extra: Partial<AgentEndpointInfo> = {}): AgentEndpointInfo => ({
  baseUrl: OLLAMA,
  model: 'qwen3:8b',
  hasKey: false,
  remote: false,
  insecure: false,
  tools: 'unknown',
  ...extra,
});

const statusOf = (extra: Partial<AgentStatus> = {}): AgentStatus => ({ provider: 'openai', installed: true, loggedIn: true, models: [], endpoint: endpoint(), ...extra });

function renderWindow() {
  return render(
    <TooltipProvider>
      <AgentWindow />
    </TooltipProvider>,
  );
}

const type = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } });

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  localStorage.clear();
  useAgent.setState({ sessions: [], currentId: null, busy: false, busySessionId: null, permission: null, pendingAsk: null, status: null });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The window on the setup screen with the form open. */
async function openForm(saved?: AgentEndpointInfo) {
  const status: AgentStatus = { provider: null, installed: false, loggedIn: false, models: [], ...(saved ? { endpoint: saved } : {}) };
  vi.spyOn(backend, 'agentStatus').mockResolvedValue(status);
  useAgent.setState({ status });
  renderWindow();
  fireEvent.click(await screen.findByTestId('agent-choose-openai'));
  return screen.findByTestId('agent-endpoint-form');
}

describe('the server form', () => {
  it('is a third choice beside Claude and Codex, and the back arrow returns to the choice', async () => {
    await openForm();
    expect(screen.queryByTestId('agent-choose-claude')).toBeNull();
    fireEvent.click(screen.getByTestId('agent-endpoint-back'));
    expect(screen.getByTestId('agent-choose-claude')).toBeTruthy();
  });

  it('fills the address and reads the model list with one click on the Ollama preset', async () => {
    const models = vi.spyOn(backend, 'agentEndpointModels').mockResolvedValue(['llama3.2:latest', 'qwen3:8b']);
    await openForm();
    fireEvent.click(screen.getByTestId('agent-endpoint-preset-ollama'));
    expect((screen.getByTestId('agent-endpoint-url') as HTMLInputElement).value).toBe(OLLAMA);
    await screen.findByTestId('agent-endpoint-models-found');
    expect(models).toHaveBeenCalledWith({ baseUrl: OLLAMA, model: '' });
    expect(screen.getByTestId('agent-endpoint-models-found').textContent).toBe(t('agent.endpoint.modelsFound', { count: 2 }));
    expect([...document.querySelectorAll('#agent-endpoint-models option')].map((o) => o.getAttribute('value'))).toEqual(['llama3.2:latest', 'qwen3:8b']);
    // No warning for a server on this PC.
    expect(screen.queryByTestId('agent-endpoint-warn-http')).toBeNull();
    expect(screen.queryByTestId('agent-endpoint-warn-remote')).toBeNull();
  });

  it('falls back to a typed model name when the server gives no list, with the reason', async () => {
    vi.spyOn(backend, 'agentEndpointModels').mockRejectedValue(new Error('the server answered 404: not found'));
    await openForm();
    fireEvent.click(screen.getByTestId('agent-endpoint-preset-ollama'));
    const none = await screen.findByTestId('agent-endpoint-models-none');
    expect(none.textContent).toContain('404');
    type('agent-endpoint-model', 'my-model');
    expect((screen.getByTestId('agent-endpoint-model') as HTMLInputElement).value).toBe('my-model');
  });

  it('warns about an unencrypted address on another machine and about reads leaving this PC', async () => {
    await openForm();
    type('agent-endpoint-url', 'http://192.168.1.5:11434/v1');
    expect(screen.getByTestId('agent-endpoint-warn-http')).toBeTruthy();
    expect(screen.getByTestId('agent-endpoint-warn-remote')).toBeTruthy();
    type('agent-endpoint-url', 'https://api.example.com/v1');
    expect(screen.queryByTestId('agent-endpoint-warn-http')).toBeNull();
    expect(screen.getByTestId('agent-endpoint-warn-remote')).toBeTruthy();
    type('agent-endpoint-url', 'ftp://host/v1');
    expect(screen.getByTestId('agent-endpoint-warn-invalid')).toBeTruthy();
    expect((screen.getByTestId('agent-endpoint-save') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('agent-endpoint-test') as HTMLButtonElement).disabled).toBe(true);
  });

  it('saving needs an address and a model, sends the key only when it was touched, and opens the chat', async () => {
    const save = vi.spyOn(backend, 'agentEndpointSave').mockResolvedValue(statusOf());
    await openForm();
    type('agent-endpoint-url', OLLAMA);
    expect((screen.getByTestId('agent-endpoint-save') as HTMLButtonElement).disabled).toBe(true);
    type('agent-endpoint-model', ' qwen3:8b ');
    fireEvent.click(screen.getByTestId('agent-endpoint-save'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    // The key field was never touched: no key field is sent, so a saved key stays.
    expect(save.mock.calls[0]![0]).toEqual({ baseUrl: OLLAMA, model: 'qwen3:8b' });
    await waitFor(() => expect(useAgent.getState().status?.provider).toBe('openai'));
    expect(await screen.findByTestId('agent-input')).toBeTruthy();
    expect(screen.getByTestId('agent-provider').textContent).toBe('OpenAI API');
  });

  it('sends a typed key, and an emptied saved key removes it', async () => {
    const save = vi.spyOn(backend, 'agentEndpointSave').mockResolvedValue(statusOf());
    await openForm(endpoint({ hasKey: true }));
    expect((screen.getByTestId('agent-endpoint-url') as HTMLInputElement).value).toBe(OLLAMA);
    expect((screen.getByTestId('agent-endpoint-key') as HTMLInputElement).placeholder).toBe(t('agent.endpoint.keySaved'));
    fireEvent.click(screen.getByTestId('agent-endpoint-key-remove'));
    fireEvent.click(screen.getByTestId('agent-endpoint-save'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]![0]).toEqual({ baseUrl: OLLAMA, model: 'qwen3:8b', apiKey: '' });
    cleanup();
    await openForm();
    type('agent-endpoint-model', 'm');
    type('agent-endpoint-url', OLLAMA);
    type('agent-endpoint-key', 'sk-123');
    expect((screen.getByTestId('agent-endpoint-key') as HTMLInputElement).type).toBe('password');
    fireEvent.click(screen.getByTestId('agent-endpoint-save'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1]![0]).toEqual({ baseUrl: OLLAMA, model: 'm', apiKey: 'sk-123' });
  });

  it('shows a save that the backend refuses', async () => {
    vi.spyOn(backend, 'agentEndpointSave').mockRejectedValue(new Error('The address must start with http:// or https://'));
    await openForm();
    type('agent-endpoint-url', OLLAMA);
    type('agent-endpoint-model', 'm');
    fireEvent.click(screen.getByTestId('agent-endpoint-save'));
    expect((await screen.findByTestId('agent-endpoint-error')).textContent).toContain('must start with http');
    expect(screen.getByTestId('agent-endpoint-form')).toBeTruthy();
  });

  it('shows what test connection found: the server, the model and the tools', async () => {
    const test = vi.spyOn(backend, 'agentEndpointTest');
    await openForm();
    type('agent-endpoint-url', OLLAMA);
    type('agent-endpoint-model', 'gemma:2b');
    test.mockResolvedValueOnce({ reachable: true, modelFound: true, tools: 'unsupported', toolsReason: 'gemma:2b does not support tools' });
    fireEvent.click(screen.getByTestId('agent-endpoint-test'));
    const result = await screen.findByTestId('agent-endpoint-result');
    expect(test).toHaveBeenCalledWith({ baseUrl: OLLAMA, model: 'gemma:2b' });
    expect(result.textContent).toContain(t('agent.endpoint.result.modelFound'));
    expect(screen.getByTestId('agent-endpoint-tools').textContent).toBe(t('agent.endpoint.result.toolsNo', { reason: 'gemma:2b does not support tools' }));

    test.mockResolvedValueOnce({ reachable: false, error: 'cannot connect to the server', tools: 'unknown' });
    fireEvent.click(screen.getByTestId('agent-endpoint-test'));
    await waitFor(() => expect(screen.getByTestId('agent-endpoint-unreachable').textContent).toContain('cannot connect'));
    expect(screen.queryByTestId('agent-endpoint-tools')).toBeNull();

    test.mockResolvedValueOnce({ reachable: true, modelFound: true, tools: 'supported' });
    fireEvent.click(screen.getByTestId('agent-endpoint-test'));
    await waitFor(() => expect(screen.getByTestId('agent-endpoint-tools').textContent).toBe(t('agent.endpoint.result.toolsOk')));
  });
});

describe('a saved server in the chat', () => {
  it('lets the model be chosen from the server list or typed, and saves it without touching the key', async () => {
    useAgent.setState({ status: statusOf() });
    vi.spyOn(backend, 'agentStatus').mockResolvedValue(statusOf());
    vi.spyOn(backend, 'agentEndpointModels').mockResolvedValue(['llama3.2:latest', 'qwen3:8b']);
    const save = vi.spyOn(backend, 'agentEndpointSave').mockResolvedValue(statusOf({ endpoint: endpoint({ model: 'llama3.2:latest' }) }));
    renderWindow();
    expect((await screen.findByTestId('agent-model')).textContent).toContain('qwen3:8b');
    fireEvent.click(screen.getByTestId('agent-model'));
    const pressed = (id: string) => screen.getByTestId(id).getAttribute('aria-pressed');
    await screen.findByTestId('agent-model-llama3.2:latest');
    expect(pressed('agent-model-qwen3:8b')).toBe('true');
    // A server's model has no thinking effort.
    expect(screen.queryByTestId('agent-effort-high')).toBeNull();
    fireEvent.click(screen.getByTestId('agent-model-llama3.2:latest'));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ baseUrl: OLLAMA, model: 'llama3.2:latest' }));
    await waitFor(() => expect(screen.getByTestId('agent-model').textContent).toContain('llama3.2:latest'));
    save.mockResolvedValueOnce(statusOf({ endpoint: endpoint({ model: 'typed-model' }) }));
    type('agent-model-name', 'typed-model');
    fireEvent.keyDown(screen.getByTestId('agent-model-name'), { key: 'Enter' });
    await waitFor(() => expect(save).toHaveBeenLastCalledWith({ baseUrl: OLLAMA, model: 'typed-model' }));
  });

  it('says so when the server gives no list, and shows what is known about tools with the reason', async () => {
    const info = endpoint({ tools: 'unsupported', toolsReason: 'qwen3:8b does not support tools' });
    useAgent.setState({ status: statusOf({ endpoint: info }) });
    vi.spyOn(backend, 'agentStatus').mockResolvedValue(statusOf({ endpoint: info }));
    vi.spyOn(backend, 'agentEndpointModels').mockRejectedValue(new Error('404'));
    renderWindow();
    fireEvent.click(await screen.findByTestId('agent-model'));
    expect(await screen.findByTestId('agent-model-nolist')).toBeTruthy();
    expect(screen.getByTestId('agent-endpoint-tools-state').textContent).toBe(t('agent.endpoint.tools.unsupported', { reason: 'qwen3:8b does not support tools' }));
  });

  it('runs test connection from the picker and refreshes the status with its verdict', async () => {
    let current = statusOf();
    useAgent.setState({ status: current });
    vi.spyOn(backend, 'agentStatus').mockImplementation(async () => current);
    vi.spyOn(backend, 'agentEndpointModels').mockResolvedValue(['qwen3:8b']);
    const test = vi.spyOn(backend, 'agentEndpointTest').mockImplementation(async () => {
      current = statusOf({ endpoint: endpoint({ tools: 'supported' }) });
      return { reachable: true, modelFound: true, tools: 'supported' };
    });
    renderWindow();
    fireEvent.click(await screen.findByTestId('agent-model'));
    expect((await screen.findByTestId('agent-endpoint-tools-state')).textContent).toBe(t('agent.endpoint.tools.unknown'));
    fireEvent.click(screen.getByTestId('agent-endpoint-test'));
    await waitFor(() => expect(test).toHaveBeenCalledWith({ baseUrl: OLLAMA, model: 'qwen3:8b' }));
    await waitFor(() => expect(screen.getByTestId('agent-endpoint-tools-state').textContent).toBe(t('agent.endpoint.tools.supported')));
  });

  it('warns above the input while the model cannot use the app tools, and not for a model that can', async () => {
    const bad = statusOf({ endpoint: endpoint({ tools: 'unsupported', toolsReason: 'does not support tools' }) });
    useAgent.setState({ status: bad });
    vi.spyOn(backend, 'agentStatus').mockResolvedValue(bad);
    renderWindow();
    const banner = await screen.findByTestId('agent-tools-banner');
    expect(banner.textContent).toContain('does not support tools');
    act(() => useAgent.setState({ status: statusOf() }));
    expect(screen.queryByTestId('agent-tools-banner')).toBeNull();
  });

  it('refreshes the status after a request fails, so a model found to lack tools is shown at once', async () => {
    const before = statusOf();
    const after = statusOf({ endpoint: endpoint({ tools: 'unsupported', toolsReason: 'x does not support tools' }) });
    let current = before;
    useAgent.setState({ status: before });
    vi.spyOn(backend, 'agentStatus').mockImplementation(async () => current);
    vi.spyOn(backend, 'agentChat').mockImplementation(async () => {
      current = after;
      throw new Error("This model cannot use the app's tools (x does not support tools).");
    });
    renderWindow();
    await screen.findByTestId('agent-input');
    await act(async () => {
      await useAgent.getState().send('hello');
    });
    await waitFor(() => expect(screen.getByTestId('agent-tools-banner')).toBeTruthy());
    expect(screen.getByText(/cannot use the app's tools/)).toBeTruthy();
  });

  it('tells where what the assistant reads is sent, in the permission question', async () => {
    useAgent.setState({ status: statusOf() });
    vi.spyOn(backend, 'agentStatus').mockResolvedValue(statusOf());
    const { rerender } = renderWindow();
    await screen.findByTestId('agent-input');
    useAgent.setState({ busy: true, busySessionId: 'x', currentId: 'x', sessions: [{ id: 'x', createdAt: 1, updatedAt: 1, messages: [] }], permission: { tool: 'list_gallery_images' } });
    rerender(
      <TooltipProvider>
        <AgentWindow />
      </TooltipProvider>,
    );
    expect((await screen.findByTestId('agent-permission-sent')).textContent).toBe(t('agent.permission.sentLocal'));
    const remote = statusOf({ endpoint: endpoint({ baseUrl: 'https://api.example.com/v1', remote: true }) });
    act(() => useAgent.setState({ status: remote }));
    expect(screen.getByTestId('agent-permission-sent').textContent).toBe(t('agent.permission.sentRemote', { host: 'api.example.com' }));
    // A command-line tool has no such note.
    act(() => useAgent.setState({ status: { provider: 'claude', installed: true, loggedIn: true, models: [] } }));
    expect(screen.queryByTestId('agent-permission-sent')).toBeNull();
  });

  it('keeps the saved server in the form after switching the AI, and sends no model or effort for a server', async () => {
    useAgent.setState({ status: statusOf() });
    vi.spyOn(backend, 'agentStatus').mockResolvedValue(statusOf());
    renderWindow();
    await screen.findByTestId('agent-input');
    const chat = vi.spyOn(backend, 'agentChat').mockResolvedValue({ text: 'ok' });
    await act(async () => {
      await useAgent.getState().send('hello');
    });
    expect(chat.mock.calls[0]![0]).not.toHaveProperty('agentModel');
    expect(chat.mock.calls[0]![0]).not.toHaveProperty('effort');
    act(() => useAgent.getState().changeProvider());
    fireEvent.click(await screen.findByTestId('agent-choose-openai'));
    expect((await screen.findByTestId('agent-endpoint-url') as HTMLInputElement).value).toBe(OLLAMA);
    expect((screen.getByTestId('agent-endpoint-model') as HTMLInputElement).value).toBe('qwen3:8b');
  });
});
