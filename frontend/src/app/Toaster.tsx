import { CheckCircle, Info, Warning, WarningCircle, X } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useToasts, type ToastStatus } from '@/state/toasts';
import { Button } from '@/ui';

const ICONS: Record<ToastStatus, typeof Info> = { info: Info, success: CheckCircle, warning: Warning, error: WarningCircle };

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  const runAction = useToasts((s) => s.runAction);
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.status];
        return (
          <div key={toast.id} className={`toast toast--${toast.status}`}>
            <Icon size={18} weight="fill" className="toast__icon" />
            <div className="toast__body">
              <div className="toast__title">{toast.title}</div>
              {toast.description && <div className="toast__desc">{toast.description}</div>}
              {toast.pictures && toast.pictures.length > 0 && (
                <div className="notify-item__pictures">
                  {toast.pictures.map((src, i) => (
                    <img key={i} src={src} alt="" draggable={false} />
                  ))}
                </div>
              )}
              {toast.actions && toast.actions.length > 0 && (
                <div className="toast__actions">
                  {toast.actions.map((action, index) => (
                    <Button key={action.label} size="xs" variant="outline" onClick={() => runAction(toast.id, index)}>
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="toast__close" aria-label={t('common.close')} onClick={() => dismiss(toast.id)}>
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
