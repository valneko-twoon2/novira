// The title bar of the phone layout: the app's mark (the tab's name is at the foot, and here only for a screen reader), the job being drawn (pressing it shows the picture large) and the assistant's chat.
import { Sparkle } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useAgent } from '@/state/agent';
import { useGeneratingItems } from '@/state/generating';
import { useQueue } from '@/state/queue';
import { useSettings } from '@/state/settings';
import { ProgressBar, Spinner } from '@/ui';
import { tabLabel, usePhone } from './phoneStore';

export function PhoneHeader() {
  const tab = usePhone((s) => s.tab);
  return (
    <header className="phone-head">
      <span className="phone-head__logo" aria-hidden="true">
        <span className="sidenav__logo-mark">n</span>
      </span>
      <h1 className="sr-only">{tabLabel(tab)}</h1>
      <span className="phone-head__spacer" />
      <LiveChip />
      <button type="button" className="phone-head__menu" aria-label={t('agent.open')} onClick={() => useAgent.getState().setOpen(true)} data-testid="phone-chat-open">
        <Sparkle size={22} />
      </button>
    </header>
  );
}

/** The job being drawn: its picture in progress, the step and a thin bar; nothing while no job runs. */
function LiveChip() {
  const [item] = useGeneratingItems();
  const progress = useQueue((s) => (item && s.progress?.itemId === item.id ? s.progress : null));
  const antialias = useSettings((s) => s.antialiasProgressImages);
  if (!item) return null;
  return (
    <button
      type="button"
      className="phone-live"
      aria-label={t('phone.openLive')}
      data-testid="phone-live-chip"
      onClick={() => usePhone.getState().show({ kind: 'live', itemId: item.id })}
    >
      <span className="phone-live__thumb">
        {progress?.progressImageUrl ? <img src={progress.progressImageUrl} alt="" draggable={false} style={antialias ? undefined : { imageRendering: 'pixelated' }} /> : <Spinner size={14} />}
      </span>
      <span className="phone-live__info">
        <span className="phone-live__step">
          {progress ? t('gallery.generating.step', { step: progress.step, total: progress.totalSteps }) : t('gallery.generating.starting')}
        </span>
        <ProgressBar value={progress ? progress.step / Math.max(1, progress.totalSteps) : 0} indeterminate={!progress} className="phone-live__bar" />
      </span>
    </button>
  );
}
