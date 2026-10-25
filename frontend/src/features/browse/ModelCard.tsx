import { ArrowSquareOut, DownloadSimple, Heart, Images } from '@phosphor-icons/react';
import type { CivitaiModel } from '@/backend';
import { t } from '@/i18n';
import { CommercialTag, IconButton } from '@/ui';
import { CoverCarousel } from './CoverCarousel';
import { DownloadButton } from './DownloadButton';
import { defaultFile } from './download';
import { formatCount } from './format';
import { openOnCivitai } from './openCivitai';
import { TriggerChips } from './TriggerChips';

export function ModelCard({ model, onOpen }: { model: CivitaiModel; onOpen: () => void }) {
  return (
    <article
      className="browse-card"
      tabIndex={0}
      data-testid="browse-card"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="browse-card__media">
        <CoverCarousel model={model} />
        <span className="browse-pill">
          {model.kind} · {model.baseModel}
        </span>
        <span className="browse-count" title={t('browse.card.images', { count: model.imageCount })}>
          <Images size={11} /> {model.imageCount}
        </span>
        <div className="browse-card__shade">
          <div className="browse-card__name">{model.name}</div>
          <div className="browse-card__meta">
            <span className="browse-card__creator" title={model.creator} data-truncate-ok>
              {model.creator}
            </span>
            <span className="browse-stat" title={t('browse.stats.downloads')}>
              <DownloadSimple size={11} /> {formatCount(model.downloads)}
            </span>
            <span className="browse-stat" title={t('browse.stats.likes')}>
              <Heart size={11} /> {formatCount(model.likes)}
            </span>
          </div>
        </div>
      </div>
      <div className="browse-card__body">
        <CommercialTag value={model.commercial} permissions={model.permissions} license={model.license} source={model.source} />
        {model.triggerWords.length > 0 && <TriggerChips words={model.triggerWords} max={3} />}
        <div className="browse-card__actions">
          <DownloadButton model={model} file={defaultFile(model)} />
          <IconButton
            label={t('browse.card.openCivitai')}
            icon={<ArrowSquareOut size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              openOnCivitai(model);
            }}
          />
        </div>
      </div>
    </article>
  );
}
