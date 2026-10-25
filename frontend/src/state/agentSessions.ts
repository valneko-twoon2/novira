// AI assistant chat sessions: the message and session shapes, their titles and order, and the part of them that is
// kept between app runs (text and the summary of the tool calls only; undo snapshots stay in memory).
import { AGENT_MAX_ATTACHMENTS } from '@/backend';
import type { ParamsFields } from './params';
import type { MediaKind, TabName } from './ui';

/** Screens whose existing data the assistant can change (each registers an editor; `app/registerFeatures.test.ts` checks). */
export const EDIT_SCREENS = ['text', 'workflows', 'video', 'music', 'voice', 'canvas', 'comic'] as const satisfies readonly (TabName | MediaKind)[];
export type EditScreen = (typeof EDIT_SCREENS)[number];

/** What a chip under an answer says about one tool call that did something. */
export const TOOL_LOG_KINDS = ['model', 'lora', 'prompt', 'params', 'workflow', 'editText', 'editWorkflow', 'editComic', 'video', 'music', 'voice', 'pose', 'queued', 'packs'] as const;
export type ToolLogKind = (typeof TOOL_LOG_KINDS)[number];

/** One tool call that changed something, queued something or showed extensions, as the chat shows it. */
export interface AgentToolLog {
  kind: ToolLogKind;
  /** A model's key (model, lora) or a workflow's name. */
  key?: string;
  weight?: number;
  /** Operations, fields, people or queue items. */
  count?: number;
  /** The parameters set, in short. */
  summary?: string;
  /** Extensions shown as cards with an install button (packs). */
  ids?: string[];
}

/** Whether a logged call changed the user's settings or editors (a recommendation only suggests; queued work is not undone). */
export const isChange = (log: AgentToolLog) => log.kind !== 'packs';

export interface AgentMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  /** Gallery pictures the user attached (user messages only). */
  images?: string[];
  /** What the assistant's tool calls did (assistant messages only). */
  tools: AgentToolLog[];
  /** The assistant's short account of how it read the request (assistant messages only). */
  thoughts?: string[];
  /** Settings before the request changed them (assistant messages only). Not kept between runs. */
  snapshot?: Partial<ParamsFields>;
  /** The editors' data before the request changed it, by screen. Not kept between runs. */
  editSnapshots?: Partial<Record<EditScreen, unknown>>;
  undone?: boolean;
  error?: boolean;
}

export interface AgentSession {
  id: string;
  /** The name the user gave the session; without it the title comes from the first message. */
  title?: string;
  createdAt: number;
  /** When a message was last added; the list shows the most recent first. */
  updatedAt: number;
  messages: AgentMessage[];
}

/** Longest title taken from a first message (characters). */
export const TITLE_MAX = 48;
/** Sessions kept between runs, most recent first; older ones are dropped when the app saves. */
export const PERSISTED_SESSIONS_MAX = 100;

let seq = 0;

export function newSessionId(now = Date.now()): string {
  seq += 1;
  return `s-${now.toString(36)}-${seq.toString(36)}`;
}

/** The session's title: the user's name for it, else its first message on one line; '' for a session with neither. */
export function sessionTitle(session: Pick<AgentSession, 'title' | 'messages'>): string {
  if (session.title?.trim()) return session.title.trim();
  const first = session.messages.find((m) => m.role === 'user')?.text.replace(/\s+/g, ' ').trim() ?? '';
  const chars = [...first];
  return chars.length > TITLE_MAX ? `${chars.slice(0, TITLE_MAX - 1).join('')}…` : first;
}

/** Most recently used first. */
export function sortSessions(sessions: readonly AgentSession[]): AgentSession[] {
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
}

function persistedMessage(m: AgentMessage): AgentMessage {
  return {
    id: m.id,
    role: m.role,
    text: m.text,
    tools: m.tools,
    ...(m.images?.length ? { images: m.images } : {}),
    ...(m.thoughts?.length ? { thoughts: m.thoughts } : {}),
    ...(m.undone ? { undone: true } : {}),
    ...(m.error ? { error: true } : {}),
  };
}

/** What is saved: the most recent sessions, each message without its undo snapshots. */
export function persistedSessions(sessions: readonly AgentSession[]): AgentSession[] {
  return sortSessions(sessions)
    .slice(0, PERSISTED_SESSIONS_MAX)
    .map((s) => ({ ...s, messages: s.messages.map(persistedMessage) }));
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown) => (typeof v === 'string' ? v.slice(0, 200) : undefined);
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** One saved chip; anything that is not one is dropped. */
function restoreLog(v: unknown): AgentToolLog | null {
  if (!isRecord(v)) return null;
  const kind = TOOL_LOG_KINDS.find((k) => k === v.kind);
  if (!kind) return null;
  const key = text(v.key);
  const summary = text(v.summary);
  const weight = count(v.weight);
  const n = count(v.count);
  const ids = Array.isArray(v.ids) ? v.ids.filter((x): x is string => typeof x === 'string').slice(0, 4) : undefined;
  return { kind, ...(key !== undefined ? { key } : {}), ...(weight !== undefined ? { weight } : {}), ...(n !== undefined ? { count: n } : {}), ...(summary !== undefined ? { summary } : {}), ...(ids?.length ? { ids } : {}) };
}

/** The chips of a message saved before the assistant used tools (it kept `actions`). */
function fromOldActions(actions: unknown[]): AgentToolLog[] {
  const kinds: Record<string, ToolLogKind> = {
    selectModel: 'model',
    addLora: 'lora',
    setPrompt: 'prompt',
    setParams: 'params',
    createWorkflow: 'workflow',
    editText: 'editText',
    editWorkflow: 'editWorkflow',
    editComic: 'editComic',
    setVideo: 'video',
    setMusic: 'music',
    setVoice: 'voice',
    setPose: 'pose',
    recommendPacks: 'packs',
  };
  return actions.flatMap((a): AgentToolLog[] => {
    if (!isRecord(a) || typeof a.type !== 'string' || !kinds[a.type]) return [];
    const kind = kinds[a.type]!;
    if (kind === 'packs') return Array.isArray(a.ids) ? [{ kind, ids: a.ids.filter((x): x is string => typeof x === 'string').slice(0, 4) }] : [];
    if (kind === 'model' || kind === 'lora') return [{ kind, key: text(a.key) ?? '', ...(count(a.weight) !== undefined ? { weight: count(a.weight) } : {}) }];
    if (kind === 'workflow') return [{ kind, key: text(a.name) ?? '' }];
    return [{ kind }];
  });
}

function restoreMessage(v: unknown): AgentMessage | null {
  if (!isRecord(v) || typeof v.id !== 'number' || (v.role !== 'user' && v.role !== 'assistant') || typeof v.text !== 'string') return null;
  const tools = Array.isArray(v.tools) ? v.tools.map(restoreLog).filter((l): l is AgentToolLog => !!l) : Array.isArray(v.actions) ? fromOldActions(v.actions) : [];
  const thoughts = Array.isArray(v.thoughts) ? v.thoughts.filter((x): x is string => typeof x === 'string') : [];
  const images = Array.isArray(v.images) ? v.images.filter((x): x is string => typeof x === 'string').slice(0, AGENT_MAX_ATTACHMENTS) : [];
  return { id: v.id, role: v.role, text: v.text, tools, ...(images.length ? { images } : {}), ...(thoughts.length ? { thoughts } : {}), ...(v.undone === true ? { undone: true } : {}), ...(v.error === true ? { error: true } : {}) };
}

/** Sessions read back from storage; anything malformed is skipped rather than breaking the window. */
export function restoreSessions(value: unknown): AgentSession[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v): AgentSession[] => {
    if (!isRecord(v) || typeof v.id !== 'string' || !Array.isArray(v.messages)) return [];
    // A note the app sent by itself to go on with a long job (the scheme before tools) is not a message any more.
    const messages = v.messages.filter((m) => !(isRecord(m) && typeof m.auto === 'number')).map(restoreMessage).filter((m): m is AgentMessage => !!m);
    const updatedAt = typeof v.updatedAt === 'number' ? v.updatedAt : 0;
    return [
      {
        id: v.id,
        ...(typeof v.title === 'string' && v.title.trim() ? { title: v.title } : {}),
        createdAt: typeof v.createdAt === 'number' ? v.createdAt : updatedAt,
        updatedAt,
        messages,
      },
    ];
  });
}

/** The largest message id in the sessions (0 when there is none), so new ids do not collide with restored ones. */
export function maxMessageId(sessions: readonly AgentSession[]): number {
  return sessions.reduce((max, s) => s.messages.reduce((m, msg) => Math.max(m, msg.id), max), 0);
}
