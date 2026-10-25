// Queue list ordered by item id (InvokeAI order), with a header row and expandable rows.
import { ListChecks } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { t } from '@/i18n';
import { useQueue } from '@/state/queue';
import { EmptyState } from '@/ui';
import { QueueRow } from './QueueRow';

export function QueueList() {
  const items = useQueue((s) => s.items);
  const sorted = useMemo(() => [...items].sort((a, b) => a.id - b.id), [items]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <div className="qt-row qt-row--head" role="row">
        <span />
        <span>#</span>
        <span>{t('queue.col.status')}</span>
        <span>{t('queue.col.origin')}</span>
        <span>{t('queue.col.destination')}</span>
        <span>{t('queue.col.batch')}</span>
        <span>{t('queue.col.fields')}</span>
        <span>{t('queue.col.time')}</span>
        <span />
      </div>
      <div className="panel__scroll qt-list__scroll" data-testid="queue-list">
        {sorted.length === 0 ? (
          <EmptyState icon={<ListChecks size={32} />} title={t('queue.empty.title')} description={t('queue.empty.description')} />
        ) : (
          sorted.map((item) => <QueueRow key={item.id} item={item} expanded={expanded.has(item.id)} onToggle={() => toggle(item.id)} />)
        )}
      </div>
    </>
  );
}
