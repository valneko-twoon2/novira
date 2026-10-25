// Chat window of the AI assistant: session bar (past chats, new chat), conversation (selectable, each message with a copy
// button), applied-change chips with undo, and the input box with the pictures attached to the next message.
import { ArrowsLeftRight, CaretDown, CaretUp, ChatsCircle, NotePencil, Sparkle, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { backend, type AgentProvider } from '@/backend';
import { t } from '@/i18n';
import { agentReady, currentSession, useAgent } from '@/state/agent';
import { sessionTitle } from '@/state/agentSessions';
import { IconButton, Spinner, cx } from '@/ui';
import { AgentEndpointForm } from './AgentEndpointForm';
import { AgentModelPicker } from './AgentModelPicker';
import { ChatMessages } from './ChatMessages';
import { Composer, ToolsBanner, useDraft } from './Composer';
import { SessionList } from './SessionList';

/** The sides and corners the window is resized from. */
const RESIZE_DIRS = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'] as const;
type ResizeDir = (typeof RESIZE_DIRS)[number];

/** Smallest size (px) the window can be dragged to. */
const MIN_W = 320;
const MIN_H = 360;

export function AgentWindow() {
  const { pos, size, status, setOpen, setPos, setSize, changeProvider } = useAgent();
  const ready = agentReady(status);
  const winRef = useRef<HTMLElement>(null);
  // Drag the window by its header (ignoring presses on the header's buttons).
  const startDrag = (e: ReactPointerEvent<HTMLElement>) => {
    const win = winRef.current;
    if (!win || (e.target as HTMLElement).closest('button')) return;
    const rect = win.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    const move = (ev: PointerEvent) => {
      const x = Math.min(Math.max(0, ev.clientX - dx), window.innerWidth - rect.width);
      const y = Math.min(Math.max(0, ev.clientY - dy), window.innerHeight - 48);
      setPos({ x, y });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    e.preventDefault();
  };

  // Drag an edge or a corner to change the size. The window stays inside the screen; the opposite side stays where it is.
  const startResize = (dir: ResizeDir) => (e: ReactPointerEvent<HTMLElement>) => {
    const win = winRef.current;
    if (!win) return;
    const rect = win.getBoundingClientRect();
    const from = { x: e.clientX, y: e.clientY };
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - from.x;
      const dy = ev.clientY - from.y;
      let { left, top, right, bottom } = rect;
      if (dir.includes('e')) right = clamp(rect.right + dx, rect.left + MIN_W, window.innerWidth);
      if (dir.includes('w')) left = clamp(rect.left + dx, 0, rect.right - MIN_W);
      if (dir.includes('s')) bottom = clamp(rect.bottom + dy, rect.top + MIN_H, window.innerHeight);
      if (dir.includes('n')) top = clamp(rect.top + dy, 0, rect.bottom - MIN_H);
      setSize({ w: right - left, h: bottom - top });
      setPos({ x: left, y: top });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <section
      ref={winRef}
      className={cx('agent-win', pos && 'is-moved')}
      style={{ ...(pos ? { left: pos.x, top: pos.y } : {}), ...(size ? { width: size.w, height: size.h } : {}) }}
      role="dialog"
      aria-label={t('agent.title')}
      data-testid="agent-window"
    >
      {RESIZE_DIRS.map((dir) => (
        <span key={dir} className={`agent-win__grip agent-win__grip--${dir}`} role="separator" aria-label={t('agent.resize')} data-testid={`agent-resize-${dir}`} onPointerDown={startResize(dir)} />
      ))}
      <header className="agent-win__head" onPointerDown={startDrag}>
        <Sparkle size={16} weight="fill" className="agent-win__icon" />
        <h2 className="agent-win__title">{t('agent.title')}</h2>
        {backend.kind === 'mock' && <span className="ui-badge">{t('agent.mock')}</span>}
        {ready && status?.provider && <span className="ui-badge" data-testid="agent-provider">{PROVIDER_NAMES[status.provider]}</span>}
        <span className="agent-win__spacer" />
        {ready && <IconButton size="xs" label={t('agent.changeProvider')} icon={<ArrowsLeftRight />} onClick={changeProvider} />}
        <IconButton size="xs" label={t('agent.close')} icon={<X />} onClick={() => setOpen(false)} />
      </header>
      <AgentChat />
    </section>
  );
}

/** The chat itself, without a frame: the window puts it in a floating box, and the comic screen puts it in its side column. */
export function AgentChat() {
  const { busy, status, refreshStatus, newSession, pendingAsk, flushAsk } = useAgent();
  const [listOpen, setListOpen] = useState(false);
  const ready = agentReady(status);
  const draft = useDraft();

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  // A question asked from another screen (the extension manager) goes out once the assistant is signed in.
  useEffect(() => {
    if (ready && pendingAsk !== null && !busy) void flushAsk();
  }, [ready, pendingAsk, busy, flushAsk]);

  if (!ready) return <AgentSetup />;
  return (
    <>
      <SessionBar
        listOpen={listOpen}
        onToggleList={() => setListOpen(!listOpen)}
        onNew={() => {
          newSession();
          setListOpen(false);
        }}
      />
      {listOpen ? (
        <SessionList onPick={() => setListOpen(false)} />
      ) : (
        <>
          <ChatMessages onSuggest={draft.submit} />
          <ToolsBanner />
          <Composer draft={draft} />
        </>
      )}
    </>
  );
}

const PROVIDER_NAMES: Record<AgentProvider, string> = { claude: 'Claude', codex: 'Codex', openai: 'OpenAI API' };

/** The current session's title, which opens the past chats, the model and effort of the tool, and the new-chat button. */
function SessionBar({ listOpen, onToggleList, onNew }: { listOpen: boolean; onToggleList: () => void; onNew: () => void }) {
  const session = useAgent(currentSession);
  const provider = useAgent((s) => s.status?.provider ?? null);
  const title = (session && sessionTitle(session)) || t('agent.session.untitled');
  return (
    <div className="agent-sessbar">
      <button
        type="button"
        className="agent-sessbar__pick"
        aria-expanded={listOpen}
        title={t('agent.session.history')}
        data-testid="agent-session-toggle"
        onClick={onToggleList}
      >
        <ChatsCircle size={14} className="agent-sessbar__icon" />
        <span className="agent-sessbar__title" data-testid="agent-session-title">
          {listOpen ? t('agent.session.history') : title}
        </span>
        {listOpen ? <CaretUp size={12} /> : <CaretDown size={12} />}
      </button>
      {provider && <AgentModelPicker provider={provider} />}
      <IconButton size="xs" label={t('agent.session.new')} icon={<NotePencil />} onClick={onNew} data-testid="agent-session-new" />
    </div>
  );
}

/** First run (or signed out): choose Claude, Codex or a server, then sign in to it or enter the server's address. */
function AgentSetup() {
  const { status, signingIn, signInError, signIn } = useAgent();
  const [serverForm, setServerForm] = useState(false);
  if (!status) {
    return (
      <div className="agent-setup">
        <Spinner size={18} />
      </div>
    );
  }
  const notInstalled = status.provider && !status.installed;
  if (serverForm) return <AgentEndpointForm onBack={() => setServerForm(false)} />;
  return (
    <div className="agent-setup" data-testid="agent-setup">
      <p>{t('agent.setup.intro')}</p>
      <div className="agent-setup__choices">
        {(['claude', 'codex'] as const).map((p) => (
          <button key={p} type="button" className="agent-choice" disabled={!!signingIn} onClick={() => void signIn(p)} data-testid={`agent-choose-${p}`}>
            <strong>{PROVIDER_NAMES[p]}</strong>
            <span>{t(`agent.setup.${p}`)}</span>
          </button>
        ))}
      </div>
      <button type="button" className="agent-choice" disabled={!!signingIn} onClick={() => setServerForm(true)} data-testid="agent-choose-openai">
        <strong>{PROVIDER_NAMES.openai}</strong>
        <span>{t('agent.setup.openai')}</span>
      </button>
      {signingIn && (
        <p className="agent-setup__wait">
          <Spinner size={14} /> {t('agent.setup.waiting', { name: PROVIDER_NAMES[signingIn] })}
        </p>
      )}
      {!signingIn && notInstalled && status.provider && <p className="agent-setup__error">{t('agent.setup.notInstalled', { name: PROVIDER_NAMES[status.provider] })}</p>}
      {!signingIn && signInError && <p className="agent-setup__error">{signInError}</p>}
    </div>
  );
}
