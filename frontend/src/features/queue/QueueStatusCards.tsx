// Count cards for each queue status.
import { t, type MessageKey } from '@/i18n';
import { useQueue } from '@/state/queue';

export function QueueStatusCards() {
  const status = useQueue((s) => s.status);
  const cards: { key: string; label: MessageKey; value: number }[] = [
    { key: 'pending', label: 'queue.status.pending', value: status.pending },
    { key: 'in_progress', label: 'queue.status.inProgress', value: status.inProgress },
    { key: 'completed', label: 'queue.status.completed', value: status.completed },
    { key: 'failed', label: 'queue.status.failed', value: status.failed },
    { key: 'canceled', label: 'queue.status.canceled', value: status.canceled },
    { key: 'total', label: 'queue.status.total', value: status.total },
  ];
  return (
    <div className="qt-stats" data-testid="queue-stats">
      {cards.map((c) => (
        <div key={c.key} className="qt-stat" data-status={c.key}>
          <span className="qt-stat__label">{t(c.label)}</span>
          <span className="qt-stat__value">{c.value}</span>
        </div>
      ))}
    </div>
  );
}
