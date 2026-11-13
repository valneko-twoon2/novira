// What the assistant is told about the earlier part of a chat (docs/design/03-assistant/02-context/01-assistant-history.md): each earlier turn, an
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

/** The most tokens (estimated) the shortened older part of the conversation takes in a request. */
export const DIGEST_TOKENS = 2_500;
/** The most characters of an older message that its line in the shortened part keeps. */
export const DIGEST_LINE_CHARS = 140;

const turnCost = (turn: AgentTurn): number => roughTokens(turn.text) + 4;

/** One line of an older message: its words on a single line, cut to `DIGEST_LINE_CHARS`. */
function digestLine(turn: AgentTurn): string {
  const flat = turn.text.replace(/\s+/g, ' ').trim();
  const chars = [...flat];
  const text = chars.length > DIGEST_LINE_CHARS ? `${chars.slice(0, DIGEST_LINE_CHARS).join('')}…` : flat;
  return `${turn.role === 'user' ? 'You' : 'Assistant'}: ${text}`;
}

/** The older turns as one turn of a line each, the newest of them first in line for the room `DIGEST_TOKENS` leaves. */
function digestOf(older: readonly AgentTurn[]): { turn: AgentTurn; omitted: number } {
  const lines: string[] = [];
  let tokens = 0;
  for (let i = older.length - 1; i >= 0; i--) {
    const line = digestLine(older[i]!);
    const cost = roughTokens(line) + 1;
    if (lines.length && tokens + cost > DIGEST_TOKENS) break;
    lines.unshift(line);
    tokens += cost;
  }
  const omitted = older.length - lines.length;
  const head = `[The earlier part of this chat, shortened to a line per message${omitted ? `; ${omitted} still older messages are left out` : ''}:`;
  return { turn: { role: 'user', text: `${head}\n${lines.join('\n')}]` }, omitted };
}

export interface HistoryFit {
  turns: AgentTurn[];
  tokens: number;
  /** Older messages that are not sent whole any more. */
  dropped: number;
  /** Of those, the ones left out of the shortened part too. */
  omitted: number;
}

/**
 * The conversation within `budget`: the newest turns whole, and the older ones shortened to a line each in a turn of
 * their own at the start (the token limit's brake), instead of being left out.
 */
export function compressHistory(turns: readonly AgentTurn[], budget = CONTEXT_TOKENS): HistoryFit {
  // A chat that fits whole is sent whole; only when it does not, the older part gives room to the shortened one.
  const whole = fitHistory(turns, budget);
  if (!whole.dropped) return { ...whole, omitted: 0 };
  const recent = fitHistory(turns, Math.max(0, budget - DIGEST_TOKENS));
  const { turn, omitted } = digestOf(turns.slice(0, recent.dropped));
  return { turns: [turn, ...recent.turns], tokens: recent.tokens + turnCost(turn), dropped: recent.dropped, omitted };
}

/**
 * What the next message of a session would carry along of the earlier conversation (the same cut `send` makes): shortened
 * to fit the budget while the token limit is on, whole while it is off.
 */
export function contextUsage(messages: readonly AgentMessage[], limit = true): HistoryFit {
  const turns = messages.filter((m) => !m.error).map(historyTurn);
  if (limit) return compressHistory(turns);
  return { turns, tokens: turns.reduce((sum, turn) => sum + turnCost(turn), 0), dropped: 0, omitted: 0 };
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
  canceled: (l) => `canceled ${l.count ?? 1} queued job(s)`,
  export: (l) => `opened the export dialog on ${l.count ?? 1} picture(s)`,
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
