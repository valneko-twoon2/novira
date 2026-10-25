// The AI assistant: request, status, reply, and the tool calls of a request with their answers.
import type { AgentEndpointInput, AgentEndpointTest, AgentReply, AgentRequest, AgentStatus, AgentToolAnswer, AgentToolCall } from '../../types';

export const agentRequest = {
  message: 'make it brighter',
  locale: 'ja',
  history: [
    { role: 'user', text: 'hi' },
    { role: 'assistant', text: 'hello' },
  ],
  screen: 'workflows',
  focus: 'ext:ComfyUI-Foo',
  agentModel: 'opus',
  effort: 'high',
  images: ['0123456789abcdef0123456789abcdef.png'],
} satisfies Required<AgentRequest>;

export const agentStatus = {
  provider: 'codex',
  installed: true,
  loggedIn: false,
  models: [{ id: 'gpt-6-sol', name: 'GPT-6-Sol', efforts: ['low', 'medium', 'high', 'ultra'], defaultEffort: 'medium' }],
  endpoint: { baseUrl: 'http://192.168.1.5:11434/v1', model: 'qwen3:8b', hasKey: true, remote: true, insecure: true, tools: 'unsupported', toolsReason: 'qwen3:8b does not support tools' },
} satisfies Required<AgentStatus>;

export const agentEndpointInput = { baseUrl: 'http://127.0.0.1:11434/v1', model: 'llama3.2', apiKey: 'sk-test' } satisfies Required<AgentEndpointInput>;

export const agentEndpointTest = { reachable: true, error: 'the model is not loaded', modelFound: false, tools: 'unsupported', toolsReason: 'the model answered in words instead of calling the tool' } satisfies Required<AgentEndpointTest>;

export const agentReply = { thoughts: ['Read it as a request for a brighter picture.'], text: 'Done.' } satisfies Required<AgentReply>;

export const agentToolCall = {
  callId: 'c-0123456789abcdef0123456789abcdef',
  tool: 'set_generation_settings',
  args: { positivePrompt: 'a cute girl', steps: 28 },
  readGated: false,
} satisfies Required<AgentToolCall>;

export const agentToolAnswer = {
  callId: 'c-0123456789abcdef0123456789abcdef',
  ok: true,
  content: { set: ['positivePrompt', 'steps'] },
} satisfies Required<AgentToolAnswer>;
