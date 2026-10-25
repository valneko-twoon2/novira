// Scripts the assistant in tests: `backend.agentChat` runs the given tool calls through the window's dispatcher, as
// the backend relays a real assistant's calls (`agent_tool_call` events answered with `agentToolResult`), then answers.
import { vi } from 'vitest';
import { backend, type AgentReply, type AgentRequest } from '@/backend';
import type { MockBackend } from '@/backend/mock/MockBackend';
import type { MockToolAnswer } from '@/backend/mock/agentScript';

export type ScriptCall = (tool: string, args?: Record<string, unknown>) => Promise<MockToolAnswer>;

/** Makes the next requests run `script` (its return value is the answer's text, `done` by default). */
export function scriptAgent(script: (call: ScriptCall, request: AgentRequest) => Promise<string | AgentReply | void>) {
  const mock = backend as unknown as MockBackend;
  return vi.spyOn(backend, 'agentChat').mockImplementation(async (request) => {
    const out = await script((tool, args) => mock.callAgentTool(tool, args), request);
    return typeof out === 'object' ? out : { text: out ?? 'done' };
  });
}
