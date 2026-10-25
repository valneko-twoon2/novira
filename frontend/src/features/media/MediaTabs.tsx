// Tabs at the top of the Generate and Comic left panels: what to make (image, video, music, voice, logo, text) and the
// comic. The first six pick a media kind on the Generate tab; the comic switches the whole workspace. Icons only, so the
// row fits whatever the language; the name is the tooltip and the accessible label.
import { BookOpenText, FilmSlate, ImageSquare, MicrophoneStage, MusicNotes, Shapes, TextAa } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { t, type MessageKey } from '@/i18n';
import { isScreenShown, MEDIA_KINDS, useUi, type MediaKind } from '@/state/ui';
import { cx, Tooltip } from '@/ui';
import './media.css';

const ICONS: Record<MediaKind, ReactNode> = {
  image: <ImageSquare size={20} />,
  video: <FilmSlate size={20} />,
  music: <MusicNotes size={20} />,
  voice: <MicrophoneStage size={20} />,
  logo: <Shapes size={20} />,
  text: <TextAa size={20} />,
};

const LABELS: Record<MediaKind, MessageKey> = {
  image: 'media.tab.image',
  video: 'media.tab.video',
  music: 'media.tab.music',
  voice: 'media.tab.voice',
  logo: 'media.tab.logo',
  text: 'media.tab.text',
};

export function MediaTabs() {
  const media = useUi((s) => s.media);
  const comic = useUi((s) => s.activeTab === 'comic');
  const setMedia = useUi((s) => s.setMedia);
  const setTab = useUi((s) => s.setTab);
  const tab = (id: string, label: string, icon: ReactNode, on: boolean, onClick: () => void) => (
    <Tooltip key={id} content={label}>
      <button type="button" role="tab" aria-selected={on} aria-label={label} className={cx('mt__tab', on && 'is-on')} data-testid={`media-${id}`} onClick={onClick}>
        {icon}
      </button>
    </Tooltip>
  );
  return (
    <div className="mt" role="tablist" aria-label={t('media.label')} data-testid="media-tabs">
      {MEDIA_KINDS.filter(isScreenShown).map((m) =>
        tab(m, t(LABELS[m]), ICONS[m], !comic && media === m, () => {
          setMedia(m);
          // From the comic, a media kind brings the Generate tab back.
          if (comic) setTab('generate');
        }),
      )}
      {isScreenShown('comic') && tab('comic', t('app.tabs.comic'), <BookOpenText size={20} />, comic, () => setTab('comic'))}
    </div>
  );
}
