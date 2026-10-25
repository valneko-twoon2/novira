// Expanded queue item: timestamps, error, produced image and the full parameter JSON.
import { ImageBroken } from '@phosphor-icons/react';
import { backend, type QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { Button } from '@/ui';
import { formatTime } from './queueFormat';

export function QueueItemDetail({ item }: { item: QueueItem }) {
  const image = useGallery((s) => (item.imageName ? s.images.find((i) => i.name === item.imageName) : undefined));
  const batchActive = item.status === 'pending' || item.status === 'in_progress';
  return (
    <div className="qt-detail">
      <div className="qt-detail__side">
        <dl className="qt-detail__facts">
          <dt>{t('queue.detail.itemId')}</dt>
          <dd className="qt-mono">{item.id}</dd>
          <dt>{t('queue.detail.batchId')}</dt>
          <dd className="qt-mono">{item.batchId}</dd>
          <dt>{t('queue.detail.created')}</dt>
          <dd>{formatTime(item.createdAt)}</dd>
          <dt>{t('queue.detail.started')}</dt>
          <dd>{formatTime(item.startedAt) || '-'}</dd>
          <dt>{t('queue.detail.completed')}</dt>
          <dd>{formatTime(item.completedAt) || '-'}</dd>
        </dl>
        {item.error && (
          <div className="qt-detail__error">
            <strong>{t('queue.detail.error')}</strong>
            <span>{item.error}</span>
          </div>
        )}
        {batchActive && (
          <Button size="xs" scheme="danger" variant="outline" onClick={() => void backend.cancelBatch(item.batchId)}>
            {t('queue.action.cancelBatch')}
          </Button>
        )}
        {item.imageName && (
          <div className="qt-detail__image">
            {image ? <img src={image.thumbnailUrl} alt={image.name} /> : <ImageBroken size={24} />}
            <span className="qt-mono qt-faint">{item.imageName}</span>
          </div>
        )}
      </div>
      <div className="qt-detail__json">
        <div className="qt-detail__label">{t('queue.detail.params')}</div>
        <pre>{JSON.stringify(item.params, null, 2)}</pre>
      </div>
    </div>
  );
}
