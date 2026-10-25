// The assistant on a phone: a chat screen over the whole phone layout, as a phone's chat apps have it. A top bar (back,
// the chat's title, the model, past chats, a new chat), the conversation filling the screen and the message box pinned
// at the foot, kept above the on-screen keyboard. The conversation and the box are the window's own parts; signing in
// and choosing a server are done on the PC, so a phone that finds the assistant not ready says so instead of a form.
import { CaretLeft, ChatsCircle, NotePencil, X } from '@phosphor-icons/react';
import { Activity, useEffect, useRef, useState, type CSSProperties } from 'react';
import { t } from '@/i18n';
import { agentReady, currentSession, useAgent } from '@/state/agent';
import { sessionTitle } from '@/state/agentSessions';
import { ErrorBoundary, Spinner } from '@/ui';
import { AgentModelPicker } from './AgentModelPicker';
import { ChatMessages } from './ChatMessages';
import { Composer, ToolsBanner, useDraft } from './Composer';
import { SessionList } from './SessionList';
import './agent.css';
import './phoneChat.css';

/** The chat screen while the assistant is open; once opened it stays mounted and hidden, so the draft is kept. */
export function PhoneChatLayer() {
  const open = useAgent((s) => s.open);
  const opened = useRef(false);
  if (open) opened.current = true;
  if (!opened.current) return null;
  return (
    <Activity mode={open ? 'visible' : 'hidden'}>
      <ErrorBoundary area="phone chat">
        <PhoneChat />
      </ErrorBoundary>
    </Activity>
  );
}

/**
 * The part of the screen the keyboard leaves: the visual viewport's height and offset. `100dvh` does not shrink for the
 * keyboard on every phone, so the screen follows the visual viewport where the browser has one.
 */
function useVisibleBox(): CSSProperties | undefined {
  const [box, setBox] = useState<{ height: number; top: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setBox({ height: vv.height, top: vv.offsetTop });
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return box ? { height: box.height, top: box.top } : undefined;
}

export function PhoneChat() {
  const status = useAgent((s) => s.status);
  const refreshStatus = useAgent((s) => s.refreshStatus);
  const newSession = useAgent((s) => s.newSession);
  const setOpen = useAgent((s) => s.setOpen);
  const session = useAgent(currentSession);
  const ready = agentReady(status);
  const provider = status?.provider ?? null;
  const [history, setHistory] = useState(false);
  const draft = useDraft();
  const box = useVisibleBox();

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const title = ready ? (session && sessionTitle(session)) || t('agent.session.untitled') : t('agent.title');
  return (
    <section className="phone-chat" style={box} role="dialog" aria-modal="true" aria-label={t('agent.title')} data-testid="phone-chat">
      <header className="phone-chat__top">
        <button type="button" className="phone-chat__icon" aria-label={t('common.back')} onClick={() => setOpen(false)} data-testid="phone-chat-close">
          <CaretLeft size={22} />
        </button>
        <h2 className="phone-chat__title" data-testid="agent-session-title" data-truncate-ok="chat title in the fixed top bar">
          {title}
        </h2>
        {/* A server's model is changed on the PC (its list and test are the PC's); a CLI's model and effort only go with the message. */}
        {ready && provider && provider !== 'openai' && <AgentModelPicker provider={provider} />}
        {ready && (
          <>
            <button type="button" className="phone-chat__icon" aria-label={t('agent.session.history')} aria-expanded={history} onClick={() => setHistory(true)} data-testid="phone-chat-history">
              <ChatsCircle size={22} />
            </button>
            <button type="button" className="phone-chat__icon" aria-label={t('agent.session.new')} onClick={newSession} data-testid="phone-chat-new">
              <NotePencil size={22} />
            </button>
          </>
        )}
      </header>
      {!status ? (
        <div className="phone-chat__state">
          <Spinner size={18} />
        </div>
      ) : !ready ? (
        <p className="phone-chat__state" data-testid="phone-chat-setup">
          {t('phone.agentSetup')}
        </p>
      ) : (
        <>
          <ChatMessages onSuggest={draft.submit} phone className="phone-chat__body" />
          <ToolsBanner />
          <Composer draft={draft} phone />
        </>
      )}
      {history && <HistorySheet onClose={() => setHistory(false)} />}
    </section>
  );
}

/** Past chats, slid in from the side over the conversation: picking one opens it. */
function HistorySheet({ onClose }: { onClose: () => void }) {
  // Escape closes it, as it closes a menu (a keyboard on a tablet, a screen reader).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="phone-chat__sheet-wrap">
      <button type="button" className="phone-chat__scrim" tabIndex={-1} aria-label={t('agent.close')} onClick={onClose} />
      <div className="phone-chat__sheet" role="dialog" aria-label={t('agent.session.history')} data-testid="phone-chat-sheet">
        <div className="phone-chat__sheet-head">
          <h3 className="phone-chat__sheet-title">{t('agent.session.history')}</h3>
          <button type="button" className="phone-chat__icon" aria-label={t('agent.close')} onClick={onClose} data-testid="phone-chat-sheet-close">
            <X size={22} />
          </button>
        </div>
        <ErrorBoundary area="phone chat history">
          <SessionList onPick={onClose} />
        </ErrorBoundary>
      </div>
    </div>
  );
}
