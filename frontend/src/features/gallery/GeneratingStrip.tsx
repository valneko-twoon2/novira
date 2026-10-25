// What is being generated right now, at the top of the Images list: the denoising preview, the step and a thin bar.
// It lives here and not in the viewer, so the picture the user is looking at is never taken over by a running job.
// A picture that just ran out of GPU memory stays here with what to do about it until it is retried or closed.
import { useMemo } from 'react';
import type { GenerationMode, QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useGeneratingItems } from '@/state/generating';
import { isOutOfMemory, useOutOfMemoryNotices } from '@/state/outOfMemory';
import { useQueue } from '@/state/queue';
import { useSettings } from '@/state/settings';
import { GENERATED_MEDIA } from '@/state/ui';
import { OutOfMemoryNotice, ProgressBar, Spinner } from '@/ui';

/** Video, music, speech and logos show their failures on their own screens. */
const MEDIA_MODES: ReadonlySet<GenerationMode> = new Set<GenerationMode>(GENERATED_MEDIA);

export function GeneratingStrip() {
  // Drafts are made for the Drafts list; a job for the canvas shows on the canvas.
  const queueItems = useQueue((s) => s.items);
  const items = useGeneratingItems();
  const progress = useQueue((s) => s.progress);
  const antialias = useSettings((s) => s.antialiasProgressImages);
  const noticeIds = useOutOfMemoryNotices((s) => s.ids);
  const outOfMemory = useMemo(
    () =>
      noticeIds
        .map((id) => queueItems.find((i) => i.id === id))
        .filter((i): i is QueueItem => i !== undefined && isOutOfMemory(i) && i.destination !== 'intermediate' && i.params.draftAt === undefined && !MEDIA_MODES.has(i.params.generationMode)),
    [noticeIds, queueItems],
  );
  if (items.length === 0 && outOfMemory.length === 0) return null;
  return (
    <div className="gen-strip" data-testid="gallery-generating">
      {outOfMemory.map((item) => (
        <OutOfMemoryNotice key={item.id} item={item} onDismiss={() => useOutOfMemoryNotices.getState().dismiss(item.id)} />
      ))}
      {items.map((item) => {
        const own = progress?.itemId === item.id ? progress : null;
        const frac = own ? own.step / Math.max(1, own.totalSteps) : 0;
        return (
          <div className="gen-strip__item" key={item.id} data-testid="gallery-generating-item">
            <div className="gen-strip__thumb" style={{ aspectRatio: `${item.params.width} / ${item.params.height}` }}>
              {own?.progressImageUrl ? <img src={own.progressImageUrl} alt="" draggable={false} style={antialias ? undefined : { imageRendering: 'pixelated' }} /> : <Spinner size={18} />}
            </div>
            <div className="gen-strip__info">
              <span className="gen-strip__label">{t('gallery.generating.title')}</span>
              <span className="gen-strip__step">{own ? t('gallery.generating.step', { step: own.step, total: own.totalSteps }) : t('gallery.generating.starting')}</span>
              <ProgressBar value={frac} indeterminate={!own} className="gen-strip__bar" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
