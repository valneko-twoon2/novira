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

/** The most tokens (estimated) of the earlier conversation a request carries; the oldest turns beyond it are not sent. */
export const CONTEXT_TOKENS = 30_000;

/** A rough token count of a text in any language: about one token per three characters. */
export const roughTokens = (text: string): number => Math.ceil([...text].length / 3);

/** The newest turns that fit `CONTEXT_TOKENS` (the newest one always goes), oldest first, with what they cost and how many older ones were left out. */
export function fitHistory(turns: readonly AgentTurn[], budget = CONTEXT_TOKENS): { turns: AgentTurn[]; tokens: number; dropped: number } {
  const kept: AgentTurn[] = [];
  let tokens = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const cost = roughTokens(turns[i]!.text) + 4;
    if (kept.length && tokens + cost > budget) break;
    kept.unshift(turns[i]!);
    tokens += cost;
  }
  return { turns: kept, tokens, dropped: turns.length - kept.length };
}

/** What the next message of a session would carry along of the earlier conversation (the same cut `send` makes). */
export function contextUsage(messages: readonly AgentMessage[]) {
  return fitHistory(messages.filter((m) => !m.error).map(historyTurn));
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
export function historyTurn(m: Pick<AgentMessage, 'role' | 'text' | 'tools' | 'undone' | 'images'>): AgentTurn {
  const notes: string[] = [];
  // The pictures themselves are not sent again: their names are, so the model can look at one again (view_picture).
  if (m.images?.length) notes.push(`[${m.role === 'user' ? 'The user attached' : 'This answer showed'} the pictures ${m.images.join(', ')}. Look at one again with view_picture and its name when the request is about it.]`);
  if (m.role === 'assistant' && m.tools.length) {
    notes.push(`[This answer ${m.tools.map((l) => NOTE[l.kind](l)).join('; ')}.]`);
    if (m.undone) notes.push('[The user undid these changes with the undo button: they are not in the app any more.]');
  }
  return { role: m.role, text: notes.length ? `${m.text}\n${notes.join('\n')}` : m.text };
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
