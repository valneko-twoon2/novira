// The viewer on a job that is being drawn: its picture in progress, large, and how far it is. It follows the job until
// the job ends (the finished picture then takes the viewer, as for any new picture).
import type { QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useQueue } from '@/state/queue';
import { useSettings } from '@/state/settings';
import { ProgressBar, Spinner } from '@/ui';
import { FittedImage } from './FittedImage';

export function LiveView({ item, boxWidth, boxHeight }: { item: QueueItem; boxWidth: number; boxHeight: number }) {
  const progress = useQueue((s) => (s.progress?.itemId === item.id ? s.progress : null));
  const antialias = useSettings((s) => s.antialiasProgressImages);
  const { width, height } = item.params;
  return (
    <div className="vlive" data-testid="viewer-live">
      {progress?.progressImageUrl ? (
        <FittedImage src={progress.progressImageUrl} width={width} height={height} boxWidth={boxWidth} boxHeight={boxHeight} pixelated={!antialias} testId="viewer-live-image" />
      ) : (
        <Spinner size={28} />
      )}
      <div className="vlive__bar">
        <span className="vlive__step">{progress ? t('gallery.generating.step', { step: progress.step, total: progress.totalSteps }) : t('gallery.generating.starting')}</span>
        <ProgressBar value={progress ? progress.step / Math.max(1, progress.totalSteps) : 0} indeterminate={!progress} />
      </div>
    </div>
  );
}
