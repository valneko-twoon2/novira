// Past chat sessions of the assistant, most recent first: switch to one, rename it, or delete it.
import { PencilSimple, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import { t } from '@/i18n';
import { useAgent, type AgentSession } from '@/state/agent';
import { sessionTitle, sortSessions } from '@/state/agentSessions';
import { Button, cx, IconButton, Spinner, TextInput } from '@/ui';
import { relativeTime } from './relativeTime';

export function SessionList({ onPick }: { onPick: () => void }) {
  const sessions = useAgent((s) => s.sessions);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const now = Date.now();
  if (!sessions.length) {
    return (
      <div className="agent-sessions agent-sessions--empty" data-testid="agent-sessions">
        <p>{t('agent.session.empty')}</p>
      </div>
    );
  }
  return (
    <ul className="agent-sessions" data-testid="agent-sessions" aria-label={t('agent.session.history')}>
      {sortSessions(sessions).map((s) =>
        renaming === s.id ? (
          <RenameRow key={s.id} session={s} onDone={() => setRenaming(null)} />
        ) : confirming === s.id ? (
          <DeleteRow key={s.id} session={s} onDone={() => setConfirming(null)} />
        ) : (
          <SessionRow
            key={s.id}
            session={s}
            now={now}
            onPick={onPick}
            onRename={() => {
              setConfirming(null);
              setRenaming(s.id);
            }}
            onDelete={() => {
              setRenaming(null);
              setConfirming(s.id);
            }}
          />
        ),
      )}
    </ul>
  );
}

function SessionRow({ session, now, onPick, onRename, onDelete }: { session: AgentSession; now: number; onPick: () => void; onRename: () => void; onDelete: () => void }) {
  const current = useAgent((s) => s.currentId === session.id);
  const busy = useAgent((s) => s.busySessionId === session.id);
  const switchSession = useAgent((s) => s.switchSession);
  const title = sessionTitle(session) || t('agent.session.untitled');
  return (
    <li className={cx('agent-session', current && 'is-current')} data-testid="agent-session" data-session={session.id}>
      <button
        type="button"
        className="agent-session__pick"
        aria-current={current || undefined}
        onClick={() => {
          switchSession(session.id);
          onPick();
        }}
      >
        <span className="agent-session__title">{title}</span>
        <span className="agent-session__time">
          {busy && <Spinner size={10} />}
          {relativeTime(session.updatedAt, now)}
        </span>
      </button>
      <IconButton size="xs" label={t('agent.session.rename')} icon={<PencilSimple />} onClick={onRename} data-testid="agent-session-rename" />
      <IconButton size="xs" label={t('agent.session.delete')} icon={<Trash />} onClick={onDelete} data-testid="agent-session-delete" />
    </li>
  );
}

function RenameRow({ session, onDone }: { session: AgentSession; onDone: () => void }) {
  const renameSession = useAgent((s) => s.renameSession);
  const [value, setValue] = useState(sessionTitle(session));
  const commit = () => {
    renameSession(session.id, value);
    onDone();
  };
  return (
    <li className="agent-session is-editing" data-testid="agent-session" data-session={session.id}>
      <TextInput
        autoFocus
        value={value}
        aria-label={t('agent.session.name')}
        data-testid="agent-session-name"
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onDone();
          }
        }}
      />
    </li>
  );
}

function DeleteRow({ session, onDone }: { session: AgentSession; onDone: () => void }) {
  const deleteSession = useAgent((s) => s.deleteSession);
  return (
    <li className="agent-session is-confirming" data-testid="agent-session" data-session={session.id}>
      <span className="agent-session__ask">{t('agent.session.deleteConfirm', { title: sessionTitle(session) || t('agent.session.untitled') })}</span>
      <Button
        size="xs"
        variant="solid"
        scheme="danger"
        data-testid="agent-session-delete-confirm"
        onClick={() => {
          deleteSession(session.id);
          onDone();
        }}
      >
        {t('common.delete')}
      </Button>
      <Button size="xs" variant="ghost" onClick={onDone}>
        {t('common.cancel')}
      </Button>
    </li>
  );
}
