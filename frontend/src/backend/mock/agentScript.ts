// What the mock assistant works with: the request, and a way to call the app's tools. The mock cannot run a model, so
// each of its rules is a fixed script of tool calls; the calls go to the window as `agent_tool_call` events and are run
// by the same dispatcher (state/agentTools.ts) as a real assistant's, so the screens change exactly as they would.
import type { AgentReply, AgentRequest } from '../types';

/** A tool's answer as the mock reads it. */
export interface MockToolAnswer {
  ok: boolean;
  content: unknown;
}

/** Calls one of the app's tools and waits for the window's answer. */
export type MockToolCall = (tool: string, args?: Record<string, unknown>) => Promise<MockToolAnswer>;

/** One rule of the mock: a scripted answer, or null when the request is not for it. */
export type MockRule = (req: AgentRequest, call: MockToolCall) => Promise<AgentReply | null>;

/** The data of a successful answer (an empty object for a failed one). */
export function data<T>(answer: MockToolAnswer): Partial<T> {
  return answer.ok && typeof answer.content === 'object' && answer.content !== null ? (answer.content as Partial<T>) : {};
}

/** Whether the backend would tag the call as reading the user's pictures or prompts (as `agent/tools.rs` does). */
export function mockReadGated(tool: string, args: Record<string, unknown>): boolean {
  return tool === 'list_gallery_images' || tool === 'get_image_info' || (tool === 'get_generation_settings' && args.includePrompts === true);
}
