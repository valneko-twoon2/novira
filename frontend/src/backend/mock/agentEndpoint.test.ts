// @vitest-environment jsdom
// The mock's OpenAI-compatible server: what the form and the picker can try without a real one, and the mock backend's
// saved server (what is kept, what is cleared, and a model without tools refusing a request as the backend does).
import { describe, expect, it } from 'vitest';
import { MockBackend } from './MockBackend';
import { MOCK_SERVER_MODELS, normalizeAddress, testServer } from './agentEndpoint';

const OLLAMA = 'http://127.0.0.1:11434/v1';

describe('the mock server', () => {
  it('checks addresses like the backend', () => {
    expect(normalizeAddress(` ${OLLAMA}/ `)).toBe(OLLAMA);
    for (const bad of ['', 'ftp://x/v1', 'http://user:pw@host/v1', 'nope']) expect(() => normalizeAddress(bad), bad).toThrow();
  });

  it('tests reachability, the model and a tool call round trip', () => {
    expect(testServer({ baseUrl: OLLAMA, model: 'qwen3:8b' })).toEqual({ reachable: true, modelFound: true, tools: 'supported' });
    expect(testServer({ baseUrl: OLLAMA, model: 'gemma:2b' })).toMatchObject({ reachable: true, tools: 'unsupported', toolsReason: expect.stringContaining('does not support tools') });
    expect(testServer({ baseUrl: OLLAMA, model: 'nope' })).toMatchObject({ reachable: true, modelFound: false, tools: 'unknown' });
    expect(testServer({ baseUrl: 'http://unreachable.lan/v1', model: 'x' })).toMatchObject({ reachable: false, tools: 'unknown' });
    expect(testServer({ baseUrl: 'http://nolist.lan/v1', model: 'whatever' })).toMatchObject({ reachable: true, tools: 'supported' });
    // A server whose context window cuts the request is reported as one that cannot use the tools, with how to fix it.
    expect(testServer({ baseUrl: 'http://smallctx.lan/v1', model: 'qwen3:8b' })).toMatchObject({ reachable: true, tools: 'unsupported', toolsReason: expect.stringContaining('OLLAMA_CONTEXT_LENGTH') });
    expect(testServer({ baseUrl: OLLAMA, model: ' ' })).toMatchObject({ reachable: true, error: 'No model is chosen', tools: 'unknown' });
  });
});

describe('the mock backend with a saved server', () => {
  it('saves and selects the server, keeps the key for the same address only and reports the address kind', async () => {
    const b = new MockBackend();
    expect((await b.agentStatus()).endpoint).toBeUndefined();
    const saved = await b.agentEndpointSave({ baseUrl: OLLAMA, model: 'llama3.2:latest', apiKey: 'k' });
    expect(saved).toMatchObject({ provider: 'openai', installed: true, loggedIn: true, models: [] });
    expect(saved.endpoint).toEqual({ baseUrl: OLLAMA, model: 'llama3.2:latest', hasKey: true, remote: false, insecure: false, tools: 'unknown' });
    // No key field keeps the key at the same address and drops it at another.
    expect((await b.agentEndpointSave({ baseUrl: OLLAMA, model: 'qwen3:8b' })).endpoint?.hasKey).toBe(true);
    const lan = (await b.agentEndpointSave({ baseUrl: 'http://192.168.1.5:11434/v1', model: 'qwen3:8b' })).endpoint;
    expect(lan).toMatchObject({ hasKey: false, remote: true, insecure: true });
    expect((await b.agentEndpointSave({ baseUrl: 'https://api.example.com/v1', model: 'm' })).endpoint).toMatchObject({ remote: true, insecure: false });
    await expect(b.agentEndpointSave({ baseUrl: OLLAMA, model: ' ' })).rejects.toThrow();
    await expect(b.agentLogin('openai')).rejects.toThrow('no sign-in');
  });

  it('lists the models, and a server without a list or unreachable is an error', async () => {
    const b = new MockBackend();
    expect(await b.agentEndpointModels({ baseUrl: OLLAMA, model: '' })).toEqual(MOCK_SERVER_MODELS);
    await expect(b.agentEndpointModels({ baseUrl: 'http://nolist.lan/v1', model: '' })).rejects.toThrow('404');
    await expect(b.agentEndpointModels({ baseUrl: 'http://unreachable.lan/v1', model: '' })).rejects.toThrow('cannot connect');
  });

  it('keeps a tools verdict only for the saved server and model, and refuses requests of a model without tools', async () => {
    const b = new MockBackend();
    await b.agentEndpointSave({ baseUrl: OLLAMA, model: 'qwen3:8b' });
    await b.agentEndpointTest({ baseUrl: OLLAMA, model: 'gemma:2b' });
    expect((await b.agentStatus()).endpoint?.tools).toBe('unknown');
    await b.agentEndpointTest({ baseUrl: OLLAMA, model: 'qwen3:8b' });
    expect((await b.agentStatus()).endpoint?.tools).toBe('supported');
    // A model that cannot call tools fails the first request (the server refuses tools), is then marked, and stays refused.
    await b.agentEndpointSave({ baseUrl: OLLAMA, model: 'gemma:2b' });
    await expect(b.agentChat({ message: 'hi', locale: 'en' })).rejects.toThrow("cannot use the app's tools");
    const marked = (await b.agentStatus()).endpoint;
    expect(marked).toMatchObject({ tools: 'unsupported', toolsReason: expect.stringContaining('gemma:2b') });
    await expect(b.agentChat({ message: 'hi', locale: 'en' })).rejects.toThrow("cannot use the app's tools");
    // Choosing another model clears it.
    expect((await b.agentEndpointSave({ baseUrl: OLLAMA, model: 'qwen3:8b' })).endpoint?.tools).toBe('unknown');
  });
});
