// The cell of a picture being drawn, at the start of the grid: the picture in progress and the step. Pressing it opens
// the viewer on that job, so the picture can be watched at full size.
import type { QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useQueue } from '@/state/queue';
import { useSettings } from '@/state/settings';
import { showViewer } from '@/state/ui';
import { cx, ProgressBar, Spinner } from '@/ui';

export function LiveThumbnail({ item, size }: { item: QueueItem; size: number }) {
  const progress = useQueue((s) => (s.progress?.itemId === item.id ? s.progress : null));
  const selected = useGallery((s) => s.viewerLiveItemId === item.id);
  const antialias = useSettings((s) => s.antialiasProgressImages);
  const open = () => {
    useGallery.getState().showLiveItem(item.id);
    showViewer();
  };
  return (
    <button
      type="button"
      className={cx('gthumb', 'gthumb--live', selected && 'is-selected')}
      style={{ width: size, height: size }}
      aria-label={t('gallery.generating.title')}
      title={t('gallery.generating.title')}
      onClick={open}
      data-testid="gallery-live-thumb"
    >
      {progress?.progressImageUrl ? <img src={progress.progressImageUrl} alt="" draggable={false} style={antialias ? undefined : { imageRendering: 'pixelated' }} /> : <Spinner size={18} />}
      {progress && <span className="gthumb__size is-always">{t('gallery.generating.step', { step: progress.step, total: progress.totalSteps })}</span>}
      <ProgressBar value={progress ? progress.step / Math.max(1, progress.totalSteps) : 0} indeterminate={!progress} className="gthumb__bar" />
    </button>
  );
}
