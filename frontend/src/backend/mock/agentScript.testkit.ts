// A stand-in for the app's tools in the mock assistant's tests: answers each tool with the given data and records the
// calls, so a test checks which tools a rule calls and with what.
import type { MockToolAnswer, MockToolCall } from './agentScript';

export interface FakeTools {
  call: MockToolCall;
  calls: { tool: string; args: Record<string, unknown> }[];
  /** The arguments of the first call of `tool`. */
  args: (tool: string) => Record<string, unknown> | undefined;
  /** The tools called, in order. */
  tools: () => string[];
}

/** `answers` gives each tool's content (a function gets the call's arguments); a tool not given answers `{ ok: true }`. */
export function fakeTools(answers: Record<string, unknown> = {}, failing: string[] = []): FakeTools {
  const calls: FakeTools['calls'] = [];
  const call: MockToolCall = async (tool, args = {}) => {
    calls.push({ tool, args });
    if (failing.includes(tool)) return { ok: false, content: 'declined' } satisfies MockToolAnswer;
    const answer = answers[tool];
    return { ok: true, content: typeof answer === 'function' ? (answer as (a: unknown) => unknown)(args) : (answer ?? { ok: true }) };
  };
  return { call, calls, args: (tool) => calls.find((c) => c.tool === tool)?.args, tools: () => calls.map((c) => c.tool) };
}
