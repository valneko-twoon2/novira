// AI assistant conversations. A request runs the user's `claude` or `codex` with the app's tools (an MCP server in the
// backend); each tool call comes here as an event, runs in `agentTools.ts` and is answered, so changes are applied as
// the assistant makes them. The answer keeps the request's undo snapshots and a log of what changed (the chips).
// The user can keep several chat sessions; each request carries only the current session's history.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AGENT_MAX_ATTACHMENTS, backend, type AgentEffort, type AgentEndpointInput, type AgentModelOption, type AgentProvider, type AgentStatus, type AgentToolCall } from '@/backend';
import { EDIT_SCREENS, maxMessageId, newSessionId, persistedSessions, restoreSessions, type AgentMessage, type AgentSession, type AgentToolLog } from './agentSessions';
import { extensionId } from './agentExtensions';
import { agentEditor } from './agentRegistry';
import { createToolRun, currentScreen, runAgentTool, webQuestion, type PermissionChoice, type ToolRun } from './agentTools';
import { useParams } from './params';
import { useSettings } from './settings';
import { t } from '@/i18n';

export type { AgentMessage, AgentSession, AgentToolLog, EditScreen } from './agentSessions';
export { isChange } from './agentSessions';
export { registerAgentEditor, registerAgentExtensionNodes, registerAgentModelSelector, registerAgentWorkflow, type AgentEditor } from './agentRegistry';

/** The model and effort the user chose for one tool. An empty model is the tool's own default; an empty effort is the model's. */
export interface AgentChoice {
  model: string;
  effort: AgentEffort | '';
}

/** Every effort, from the lightest. */
const ALL_EFFORTS: readonly AgentEffort[] = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];

/** The efforts of the tool's own default model (or a typed Claude name), and the one it starts at. */
const DEFAULT_MODEL_EFFORTS: Record<AgentProvider, { efforts: readonly AgentEffort[]; initial: AgentEffort }> = {
  claude: { efforts: ['low', 'medium', 'high', 'xhigh', 'max'], initial: 'high' },
  codex: { efforts: ['low', 'medium', 'high'], initial: 'medium' },
  // A server's model has no effort setting.
  openai: { efforts: [], initial: 'medium' },
};

/** The efforts the chosen model takes and the one it starts at: the model's own when the tool listed it. */
export function effortsFor(provider: AgentProvider, models: readonly AgentModelOption[], model: string): { efforts: readonly AgentEffort[]; initial: AgentEffort } {
  const listed = model ? models.find((m) => m.id === model) : undefined;
  return listed?.efforts.length ? { efforts: listed.efforts, initial: listed.defaultEffort } : DEFAULT_MODEL_EFFORTS[provider];
}

/** The effort a request goes with: the chosen one when the model takes it, else the model's starting effort. */
export function effectiveEffort(provider: AgentProvider, models: readonly AgentModelOption[], choice: AgentChoice): AgentEffort {
  const { efforts, initial } = effortsFor(provider, models, choice.model);
  return choice.effort && efforts.includes(choice.effort) ? choice.effort : initial;
}

/** The heights (px) the message box may take. */
export const AGENT_INPUT_HEIGHT = { min: 56, max: 480, default: 96 } as const;
const clampInputHeight = (h: number) => Math.round(Math.min(AGENT_INPUT_HEIGHT.max, Math.max(AGENT_INPUT_HEIGHT.min, Number.isFinite(h) ? h : AGENT_INPUT_HEIGHT.default)));

const NO_CHOICE: AgentChoice = { model: '', effort: '' };

/** A saved choice read back, with anything unknown left at the default. */
function readChoice(v: unknown): AgentChoice {
  const o = (typeof v === 'object' && v !== null ? v : {}) as { model?: unknown; effort?: unknown };
  const model = typeof o.model === 'string' ? o.model.trim().slice(0, 64) : '';
  const effort = ALL_EFFORTS.find((e) => e === o.effort) ?? '';
  return { model, effort };
}

/** A read of the user's pictures or prompts, or a look-up on the web, waiting for the user's answer in the chat window. */
export interface PermissionQuestion {
  tool: string;
  /** For a web look-up: the words that would be sent, and the Wikipedia language they go to. */
  query?: string;
  language?: 'ja' | 'en';
}

/** How a sent message ended: `ok` when the assistant answered, `cancelled` when the user stopped it. */
export interface SendResult {
  ok: boolean;
  cancelled: boolean;
  text: string;
}

interface AgentState {
  /** The model and effort chosen for each tool; they go with every message to that tool. */
  choice: Record<AgentProvider, AgentChoice>;
  setChoice: (provider: AgentProvider, choice: Partial<AgentChoice>) => void;
  open: boolean;
  /** A request is in flight (one at a time, whichever session sent it). */
  busy: boolean;
  /** The session waiting for that reply. */
  busySessionId: string | null;
  /** What the running request has changed so far (shown while it works). */
  working: AgentToolLog[];
  /** The assistant wants to read pictures or prompts and the user has not answered yet. */
  permission: PermissionQuestion | null;
  /** The user's answer to `permission`. */
  answerPermission: (choice: PermissionChoice) => void;
  /** Which tool powers the assistant and whether it is signed in; null while loading. */
  status: AgentStatus | null;
  /** The tool the user picked is signing in (the browser is open). */
  signingIn: AgentProvider | null;
  signInError: string | null;
  refreshStatus: () => Promise<void>;
  signIn: (provider: AgentProvider) => Promise<void>;
  /** Saves the OpenAI-compatible server (address, model, key), selects it and refreshes the status. Rejects with the reason. */
  saveEndpoint: (input: AgentEndpointInput) => Promise<void>;
  /** Back to the choice between the tools. */
  changeProvider: () => void;
  /** Every chat session, in creation order (see `sortSessions` for the list order). */
  sessions: AgentSession[];
  /** The session on screen; null = a new chat that starts with the next message. */
  currentId: string | null;
  /** Window size (px) once the user has changed it; null = the default size. */
  size: { w: number; h: number } | null;
  setSize: (size: { w: number; h: number }) => void;
  /** Height (px) of the message box, which the user drags from its top edge. */
  inputHeight: number;
  setInputHeight: (height: number) => void;
  /** Stops the request in flight: its tool calls end, and the changes it made so far can still be undone. */
  cancel: () => void;
  /** Starts a new chat (the session is created by its first message). */
  newSession: () => void;
  switchSession: (id: string) => void;
  /** An empty title goes back to the one taken from the first message. */
  renameSession: (id: string, title: string) => void;
  deleteSession: (id: string) => void;
  /** Window position (top-left, px) once the user has moved it; null = default corner. */
  pos: { x: number; y: number } | null;
  setPos: (pos: { x: number; y: number }) => void;
  setOpen: (open: boolean) => void;
  /** Sends a message, with the gallery pictures (names) the user attached; a message of pictures alone asks for a prompt. */
  send: (text: string, images?: readonly string[]) => Promise<SendResult>;
  undo: (id: number) => void;
  /** Extensions (folder names) the chat is about, chosen in the extension manager; kept for the follow-up questions. */
  focus: string[];
  /** A question waiting for the window to be ready (signed in) to be sent. */
  pendingAsk: string | null;
  /** Opens the window on a new chat about these extensions and asks `text` as soon as the assistant is ready. */
  ask: (text: string, focus: string[]) => void;
  /** Sends the waiting question, if any. */
  flushAsk: () => Promise<void>;
}

const NO_MESSAGES: AgentMessage[] = [];

/** The current session's messages (a stable empty list for a new chat). */
export function currentMessages(s: Pick<AgentState, 'sessions' | 'currentId'>): AgentMessage[] {
  return s.sessions.find((x) => x.id === s.currentId)?.messages ?? NO_MESSAGES;
}

/** Whether the assistant can take a message: a tool chosen, installed and signed in (or a server saved). */
export function agentReady(status: AgentStatus | null): boolean {
  return !!status?.provider && status.installed && status.loggedIn;
}

export function currentSession(s: Pick<AgentState, 'sessions' | 'currentId'>): AgentSession | undefined {
  return s.sessions.find((x) => x.id === s.currentId);
}

let nextId = 1;
/** Set by `cancel`, read by the `send` that is waiting; a new `send` starts with it cleared. */
let cancelled = false;
/** The running request's tool state; calls that arrive for another (or none) are refused. */
let activeRun: ToolRun | null = null;
/** Answers the permission question on screen. */
let answerQuestion: ((choice: PermissionChoice) => void) | null = null;

/** The model (none for the tool's default) and effort of the tool in use for a request. */
export function agentOptions(status: AgentStatus | null, choice: Record<AgentProvider, AgentChoice>): { agentModel?: string; effort?: AgentEffort } {
  const provider = status?.provider;
  if (!provider) return {};
  // A server's model is part of its saved settings, and it has no effort.
  if (provider === 'openai') return {};
  const picked = choice[provider];
  return { ...(picked.model ? { agentModel: picked.model } : {}), effort: effectiveEffort(provider, status.models ?? [], picked) };
}

/** The sessions with `message` added to session `id` (which then counts as the most recently used). */
function withMessage(sessions: AgentSession[], id: string, message: AgentMessage): AgentSession[] {
  return sessions.map((s) => (s.id === id ? { ...s, updatedAt: Date.now(), messages: [...s.messages, message] } : s));
}

/** The undo state of a request's changes, for its answer. */
function undoState(run: ToolRun): Pick<AgentMessage, 'snapshot' | 'editSnapshots'> {
  return { ...(run.snapshot ? { snapshot: run.snapshot } : {}), ...(Object.keys(run.editSnapshots).length ? { editSnapshots: run.editSnapshots } : {}) };
}

export const useAgent = create<AgentState>()(
  persist(
    (set, get) => {
      /** Runs one tool call of the running request and answers it. */
      const onToolCall = async (call: AgentToolCall) => {
        const run = activeRun;
        const result = run ? await runAgentTool(call, run) : { ok: false, content: 'No request is running.' };
        if (run && run === activeRun) set({ working: [...run.log] });
        await backend.agentToolResult({ callId: call.callId, ok: result.ok, content: result.content }).catch(() => undefined);
      };
      /** Shows the permission question and waits for the answer (the window opens for it). */
      const askPermission = (tool: string, args?: unknown) =>
        new Promise<PermissionChoice>((resolve) => {
          answerQuestion = (choice) => {
            answerQuestion = null;
            set({ permission: null });
            resolve(choice);
          };
          set({ permission: { tool, ...webQuestion(tool, args) }, open: true });
        });
      return {
        open: false,
        busy: false,
        busySessionId: null,
        working: [],
        permission: null,
        answerPermission: (choice) => answerQuestion?.(choice),
        status: null,
        signingIn: null,
        signInError: null,
        refreshStatus: async () => {
          try {
            set({ status: await backend.agentStatus() });
          } catch {
            set({ status: { provider: null, installed: false, loggedIn: false, models: [] } });
          }
        },
        signIn: async (provider) => {
          set({ signingIn: provider, signInError: null });
          try {
            set({ status: await backend.agentLogin(provider) });
          } catch (err) {
            set({ signInError: err instanceof Error ? err.message : String(err) });
          } finally {
            set({ signingIn: null });
          }
        },
        choice: { claude: NO_CHOICE, codex: NO_CHOICE, openai: NO_CHOICE },
        setChoice: (provider, patch) => set({ choice: { ...get().choice, [provider]: readChoice({ ...get().choice[provider], ...patch }) } }),
        saveEndpoint: async (input) => {
          set({ status: await backend.agentEndpointSave(input), signInError: null });
        },
        // The saved server stays in the status, so its form keeps the values.
        changeProvider: () => set({ status: { provider: null, installed: false, loggedIn: false, models: [], ...(get().status?.endpoint ? { endpoint: get().status?.endpoint } : {}) } as AgentStatus, signInError: null }),
        sessions: [],
        currentId: null,
        newSession: () => set({ currentId: null, focus: [] }),
        switchSession: (id) => {
          if (get().sessions.some((s) => s.id === id)) set({ currentId: id, focus: [] });
        },
        renameSession: (id, title) => {
          const name = title.replace(/\s+/g, ' ').trim();
          set({
            sessions: get().sessions.map((s) => {
              if (s.id !== id) return s;
              const next = { ...s };
              if (name) next.title = name;
              else delete next.title;
              return next;
            }),
          });
        },
        deleteSession: (id) => {
          const { sessions, currentId } = get();
          set({ sessions: sessions.filter((s) => s.id !== id), ...(currentId === id ? { currentId: null, focus: [] } : {}) });
        },
        pos: null,
        setPos: (pos) => set({ pos }),
        size: null,
        setSize: (size) => set({ size }),
        inputHeight: AGENT_INPUT_HEIGHT.default,
        setInputHeight: (height) => set({ inputHeight: clampInputHeight(height) }),
        cancel: () => {
          if (!get().busy) return;
          cancelled = true;
          // A question on screen is answered "no", so the waiting call ends at once.
          answerQuestion?.('deny');
          void backend.agentCancel().catch(() => {});
        },
        setOpen: (open) => set({ open }),
        focus: [],
        pendingAsk: null,
        ask: (text, focus) => set({ open: true, currentId: null, focus, pendingAsk: text }),
        flushAsk: async () => {
          const text = get().pendingAsk;
          if (text === null || get().busy) return;
          set({ pendingAsk: null });
          await get().send(text);
        },
        send: async (text, attached = []) => {
          const images = attached.slice(0, AGENT_MAX_ATTACHMENTS);
          const message = text.trim() || (images.length ? t('agent.attach.defaultAsk') : '');
          if (!message || get().busy) return { ok: false, cancelled: false, text: '' };
          let session = currentSession(get());
          if (!session) {
            const now = Date.now();
            session = { id: newSessionId(now), createdAt: now, updatedAt: now, messages: [] };
            set({ sessions: [...get().sessions, session], currentId: session.id });
          }
          const sessionId = session.id;
          // Only this session's earlier exchange goes with the request; failed replies are left out.
          const history = session.messages.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
          cancelled = false;
          const run = createToolRun(askPermission);
          activeRun = run;
          const unsubscribe = backend.subscribe((event) => {
            if (event.type === 'agent_tool_call') void onToolCall(event.call);
          });
          set({ busy: true, busySessionId: sessionId, working: [], sessions: withMessage(get().sessions, sessionId, { id: nextId++, role: 'user', text: message, ...(images.length ? { images } : {}), tools: [] }) });
          try {
            const focus = get().focus[0];
            const reply = await backend.agentChat({
              message,
              screen: currentScreen(),
              locale: useSettings.getState().language,
              history,
              ...(images.length ? { images } : {}),
              ...(focus ? { focus: extensionId(focus) } : {}),
              ...agentOptions(get().status, get().choice),
            });
            // The session was deleted while waiting: nothing to show the answer in (the changes stay).
            if (!get().sessions.some((s) => s.id === sessionId)) return { ok: true, cancelled: false, text: reply.text };
            if (cancelled) throw new Error('Stopped');
            set({
              sessions: withMessage(get().sessions, sessionId, {
                id: nextId++,
                role: 'assistant',
                text: reply.text,
                ...(reply.thoughts?.length ? { thoughts: reply.thoughts } : {}),
                tools: run.log,
                ...undoState(run),
              }),
            });
            return { ok: true, cancelled: false, text: reply.text };
          } catch (err) {
            // A stopped request is not a failure: say so plainly. What it changed before stopping can still be undone.
            const text = cancelled ? t('agent.stopped') : String(err instanceof Error ? err.message : err);
            // A server that turned out not to take tools is shown so in the picker and the banner.
            if (get().status?.provider === 'openai') void get().refreshStatus();
            set({ sessions: withMessage(get().sessions, sessionId, { id: nextId++, role: 'assistant', text, tools: run.log, ...undoState(run), ...(cancelled ? {} : { error: true }) }) });
            return { ok: false, cancelled, text };
          } finally {
            unsubscribe();
            if (activeRun === run) activeRun = null;
            answerQuestion?.('deny');
            set({ busy: false, busySessionId: null, working: [] });
          }
        },
        undo: (id) => {
          const msg = get()
            .sessions.flatMap((s) => s.messages)
            .find((m) => m.id === id);
          if (!msg || msg.undone || (!msg.snapshot && !msg.editSnapshots)) return;
          if (msg.snapshot) useParams.getState().set(msg.snapshot);
          for (const screen of EDIT_SCREENS) {
            if (msg.editSnapshots && screen in msg.editSnapshots) agentEditor(screen)?.restore(msg.editSnapshots[screen]);
          }
          set({ sessions: get().sessions.map((s) => (s.messages.some((m) => m.id === id) ? { ...s, messages: s.messages.map((m) => (m.id === id ? { ...m, undone: true } : m)) } : s)) });
        },
      };
    },
    {
      name: 'novira.agent',
      version: 1,
      // Undo snapshots are large and refer to this run's state, so only what the chat shows is kept.
      partialize: (s) => ({ sessions: persistedSessions(s.sessions), currentId: s.currentId, size: s.size, inputHeight: s.inputHeight, choice: s.choice }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { sessions?: unknown; currentId?: unknown; size?: { w?: unknown; h?: unknown }; inputHeight?: unknown; choice?: Partial<Record<AgentProvider, unknown>> };
        const sessions = restoreSessions(p.sessions);
        nextId = Math.max(nextId, maxMessageId(sessions) + 1);
        const currentId = typeof p.currentId === 'string' && sessions.some((s) => s.id === p.currentId) ? p.currentId : null;
        const size = typeof p.size?.w === 'number' && typeof p.size.h === 'number' ? { w: p.size.w, h: p.size.h } : null;
        const choice = { claude: readChoice(p.choice?.claude), codex: readChoice(p.choice?.codex), openai: NO_CHOICE };
        const inputHeight = typeof p.inputHeight === 'number' ? clampInputHeight(p.inputHeight) : AGENT_INPUT_HEIGHT.default;
        return { ...current, sessions, currentId, size, inputHeight, choice };
      },
    },
  ),
);
