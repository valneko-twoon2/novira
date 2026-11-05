// The bell at the right end of the status bar: every notification of the session, with the count of those not seen yet (like VS Code's).
import { Bell, CheckCircle, Info, Trash, Warning, WarningCircle, X } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { getLocale, t, tCount } from '@/i18n';
import { useToasts, type Notice, type ToastStatus } from '@/state/toasts';
import { Button, IconButton, Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/ui';

const ICONS: Record<ToastStatus, typeof Info> = { info: Info, success: CheckCircle, warning: Warning, error: WarningCircle };

export function NotificationBell() {
  const unread = useToasts((s) => s.unread);
  const history = useToasts((s) => s.history);
  const [open, setOpen] = useState(false);
  useEffect(() => useToasts.getState().attachBell(), []);
  // What comes while the list is open is seen at once.
  useEffect(() => {
    if (open && unread) useToasts.getState().markRead();
  }, [open, unread]);
  const label = unread ? tCount('app.notifications.unread', unread) : t('app.notifications.title');
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content={label}>
        <PopoverTrigger asChild>
          <button type="button" className={`notify-bell${unread ? ' has-unread' : ''}`} aria-label={label} data-testid="notification-bell">
            <Bell size={14} weight={unread ? 'fill' : 'regular'} />
            {unread > 0 && (
              <span className="notify-bell__count" data-testid="notification-count">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent side="top" align="end" className="notify-panel">
        <div className="notify-panel__head">
          <span className="notify-panel__title">{t('app.notifications.title')}</span>
          <Button size="xs" variant="ghost" leftIcon={<Trash size={12} />} disabled={!history.length} onClick={() => useToasts.getState().forget()}>
            {t('app.notifications.clear')}
          </Button>
        </div>
        {history.length ? (
          <ul className="notify-panel__list" data-testid="notification-list">
            {history.map((notice) => (
              <NoticeRow key={notice.id} notice={notice} />
            ))}
          </ul>
        ) : (
          <div className="notify-panel__empty">{t('app.notifications.empty')}</div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NoticeRow({ notice }: { notice: Notice }) {
  const Icon = ICONS[notice.status];
  const time = new Intl.DateTimeFormat(getLocale(), { hour: '2-digit', minute: '2-digit' }).format(notice.at);
  return (
    <li className={`notify-item notify-item--${notice.status}`}>
      <Icon size={16} weight="fill" className="notify-item__icon" />
      <div className="notify-item__body">
        <div className="notify-item__title">{notice.title}</div>
        {notice.description && <div className="notify-item__desc">{notice.description}</div>}
        {notice.pictures && notice.pictures.length > 0 && (
          <div className="notify-item__pictures" data-testid="notification-pictures">
            {notice.pictures.map((src, i) => (
              <img key={i} src={src} alt="" draggable={false} />
            ))}
          </div>
        )}
        {notice.actions && notice.actions.length > 0 && (
          <div className="notify-item__actions">
            {notice.actions.map((action, index) => (
              <Button key={action.label} size="xs" variant="outline" onClick={() => useToasts.getState().runAction(notice.id, index)}>
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      <time className="notify-item__time" dateTime={new Date(notice.at).toISOString()}>
        {time}
      </time>
      <IconButton size="xs" label={t('app.notifications.remove')} icon={<X size={12} />} tooltip={false} onClick={() => useToasts.getState().forget(notice.id)} />
    </li>
  );
}
