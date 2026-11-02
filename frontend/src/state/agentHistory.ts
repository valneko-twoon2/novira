// What the assistant is told about the earlier part of a chat (docs/design/assistant-history.md): each earlier turn, an
// answer with a note of what its tool calls did and whether the user undid them, and the Generate tab's settings as they
// were before each earlier request changed them, so "that was fine as it was" can be put back word for word.
import type { AgentTurn } from '@/backend';
import type { AgentMessage, AgentToolLog, ToolLogKind } from './agentSessions';
import type { ParamsFields } from './params';

/** The most earlier versions of the settings a request carries (the oldest are dropped). */
export const EARLIER_MAX = 8;
/** The most characters of the request an earlier version is labelled with. */
export const REQUEST_CHARS = 300;

/** The Generate tab's settings and prompts as they were before one earlier request of the chat changed them. */
export interface EarlierSettings {
  /** The user's message that led to the change, cut to `REQUEST_CHARS`. */
  request: string;
  /** The user undid that request's changes with the undo button. */
  undone?: true;
  settings: Partial<ParamsFields>;
}

/** What one logged tool call did, in a few English words. */
const NOTE: Record<ToolLogKind, (log: AgentToolLog) => string> = {
  model: (l) => `selected the model ${l.key ?? ''}`.trim(),
  lora: (l) => `added the LoRA ${l.key ?? ''}${l.weight === undefined ? '' : ` at ${l.weight}`}`,
  prompt: () => 'rewrote the prompt boxes of the Generate tab',
  params: (l) => `set ${l.summary ?? 'the parameters'}`,
  workflow: (l) => `made the workflow ${l.key ?? ''}`.trim(),
  editText: () => 'edited the text scene',
  editWorkflow: () => 'edited the workflow',
  editComic: () => 'edited the comic',
  video: () => 'set the video form',
  music: () => 'set the music form',
  voice: () => 'set the voice form',
  pose: () => 'set the pose',
  queued: (l) => `queued ${l.count ?? 1} job(s)`,
  packs: () => 'suggested extensions',
};

/** An earlier message as the model is shown it: an answer ends with what its tool calls did, and whether it was undone. */
export function historyTurn(m: Pick<AgentMessage, 'role' | 'text' | 'tools' | 'undone'>): AgentTurn {
  if (m.role === 'user' || !m.tools.length) return { role: m.role, text: m.text };
  const notes = [`[This answer ${m.tools.map((l) => NOTE[l.kind](l)).join('; ')}.]`];
  if (m.undone) notes.push('[The user undid these changes with the undo button: they are not in the app any more.]');
  return { role: m.role, text: `${m.text}\n${notes.join('\n')}` };
}

/** The settings before each earlier request that changed them, oldest first (kept only while the app runs). */
export function earlierSettings(messages: readonly AgentMessage[]): EarlierSettings[] {
  const out: EarlierSettings[] = [];
  let request = '';
  for (const m of messages) {
    if (m.role === 'user') request = [...m.text].slice(0, REQUEST_CHARS).join('');
    else if (m.snapshot) out.push({ request, ...(m.undone ? { undone: true as const } : {}), settings: m.snapshot });
  }
  return out.slice(-EARLIER_MAX);
}
