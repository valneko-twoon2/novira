// One model card: cover with badges and the license tag, caption, favorite star and a hover menu.
import { DotsThree, PencilSimple, Star, Trash } from '@phosphor-icons/react';
import type { ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { BASE_LABELS } from '@/state/models';
import { CommercialTag, cx, Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui';
import { CoverImage } from './CoverImage';
import { formatBytes, formatTag } from './modelLabels';

export interface ModelCardProps {
  model: ModelConfig;
  selected: boolean;
  favorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}

export function ModelCard({ model, selected, favorite, onSelect, onToggleFavorite, onDelete }: ModelCardProps) {
  return (
    <div className={cx('mm-card-item', selected && 'is-selected')} role="group" aria-label={model.name} data-testid="mm-item">
      {/* One button over the whole card selects it; the license tag, the star and the menu sit above it as its siblings. */}
      <button type="button" className="mm-card-item__select" aria-pressed={selected} aria-label={model.name} onClick={onSelect} />
      <div className="mm-card-item__media">
        <CoverImage model={model} />
        {model.license && (
          <div className="mm-card-item__license">
            <CommercialTag
              value={model.license.commercial}
              permissions={model.license.permissions}
              license={model.license.name ? [model.license.name] : []}
              source={model.license.site}
              ariaLabel={t('models.card.license', { use: t(`browse.commercial.${model.license.commercial}`) })}
            />
          </div>
        )}
        <div className="mm-card-item__badges">
          <span className="mm-tag mm-tag--accent">{BASE_LABELS[model.base]}</span>
          {formatTag(model) && <span className="mm-tag">{formatTag(model)}</span>}
        </div>
        <div className={cx('mm-card-item__actions', favorite && 'has-favorite')}>
          <button
            type="button"
            className={cx('mm-iconbtn', 'mm-iconbtn--star', favorite && 'is-on')}
            aria-label={favorite ? t('models.card.unfavorite') : t('models.card.favorite')}
            aria-pressed={favorite}
            onClick={onToggleFavorite}
          >
            <Star size={14} weight={favorite ? 'fill' : 'regular'} />
          </button>
          <Menu>
            <MenuTrigger asChild>
              <button type="button" className="mm-iconbtn" aria-label={t('models.card.menu')}>
                <DotsThree size={16} weight="bold" />
              </button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem icon={<PencilSimple size={14} />} onSelect={onSelect}>
                {t('models.card.open')}
              </MenuItem>
              <MenuItem icon={<Trash size={14} />} danger onSelect={onDelete}>
                {t('common.delete')}
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>
      <div className="mm-card-item__caption">
        <span className="mm-card-item__name" title={model.name}>
          {model.name}
        </span>
        <span className="mm-card-item__meta">{formatBytes(model.size)}</span>
      </div>
    </div>
  );
}
