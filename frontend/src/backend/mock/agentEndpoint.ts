// The mock's OpenAI-compatible server for the assistant: what the form, the picker and the tests can try without a
// real Ollama. Addresses and models decide the behaviour: an address with "unreachable" cannot be connected to, one
// with "nolist" has no model list, one with "smallctx" has a context window that cuts the request, the model
// "gemma:2b" cannot call tools, and any other model works.
import type { AgentEndpointInfo, AgentEndpointInput, AgentEndpointTest, AgentToolsState } from '../types';

/** The models the mock server lists. */
export const MOCK_SERVER_MODELS = ['gemma:2b', 'llama3.2:latest', 'qwen3:8b'];
/** Models that cannot call tools, with the server's own words about it. */
const NO_TOOLS: Record<string, string> = { 'gemma:2b': 'registry.ollama.ai/library/gemma:2b does not support tools' };

/** The address as it is saved, or an error with the words the backend uses. */
export function normalizeAddress(text: string): string {
  const trimmed = text.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('This is not a valid address');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('The address must start with http:// or https://');
  if (url.username || url.password) throw new Error('Do not put a user name or password in the address; use the key field');
  return trimmed.replace(/\/+$/, '');
}

function isLocal(address: string): boolean {
  const host = new URL(address).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return host === 'localhost' || host === '::1' || /^127\.\d+\.\d+\.\d+$/.test(host);
}

/** What the window may know about a saved server. */
export function endpointInfo(baseUrl: string, model: string, hasKey: boolean, tools: AgentToolsState, toolsReason?: string): AgentEndpointInfo {
  const local = isLocal(baseUrl);
  return {
    baseUrl,
    model,
    hasKey,
    remote: !local,
    insecure: !local && baseUrl.startsWith('http:'),
    tools,
    ...(toolsReason ? { toolsReason } : {}),
  };
}

/** The models the server at this address lists, or why it cannot be asked. */
export function serverModels(address: string): string[] {
  if (address.includes('unreachable')) throw new Error('cannot connect to the server; is it running, and is the address right?');
  if (address.includes('nolist')) throw new Error('the server answered 404: not found');
  return MOCK_SERVER_MODELS;
}

/** The words the backend uses when the server's context window cuts the request short. */
const SMALL_CONTEXT =
  'the server read only 2051 tokens of a request of at least 4776, so it cut off the start (the rules and the tools): its context window is too small. Raise its context length to 32768 or more (Ollama: Settings, Context length, or the OLLAMA_CONTEXT_LENGTH variable)';

/** Why the model cannot use tools on this server, or undefined when it can. */
export function noToolsReason(model: string, address = ''): string | undefined {
  return address.includes('smallctx') ? SMALL_CONTEXT : NO_TOOLS[model];
}

/** The message a request fails with when the model cannot use the app's tools (as the backend words it). */
export function noToolsMessage(reason: string): string {
  return `This model cannot use the app's tools (${reason}). The assistant needs a model, and server settings, that allow tool calls: choose another model in the assistant's settings or fix the server, then test the connection.`;
}

/** Test connection: reachability, the model, and the tool round trip. */
export function testServer(input: AgentEndpointInput): AgentEndpointTest {
  const address = normalizeAddress(input.baseUrl);
  const model = input.model.trim();
  let listed: string[] | null = null;
  try {
    listed = serverModels(address);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith('cannot connect')) return { reachable: false, error: message, tools: 'unknown' };
  }
  const found = listed ? listed.includes(model) : undefined;
  if (!model) return { reachable: true, error: 'No model is chosen', tools: 'unknown', ...(found === undefined ? {} : { modelFound: found }) };
  if (listed && !found) return { reachable: true, error: `the server answered 404: model "${model}" not found`, modelFound: false, tools: 'unknown' };
  const reason = noToolsReason(model, address);
  return {
    reachable: true,
    ...(found === undefined ? {} : { modelFound: found }),
    tools: reason ? 'unsupported' : 'supported',
    ...(reason ? { toolsReason: reason } : {}),
  };
}
