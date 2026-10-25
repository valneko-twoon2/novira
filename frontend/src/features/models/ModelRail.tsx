// Left rail: categories with counts, like the Stability Matrix model browser.
import { Cube, Star } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import type { ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { cx } from '@/ui';
import { CATEGORIES, matchesCategory, type CategoryId } from './modelCategories';

function RailItem({ active, icon, label, count, onClick, id }: { active: boolean; icon?: ReactNode; label: string; count: number; onClick: () => void; id: CategoryId }) {
  return (
    <button type="button" className={cx('mm-rail__item', active && 'is-active')} aria-pressed={active} data-testid={`mm-cat-${id}`} onClick={onClick}>
      {icon && <span className="mm-rail__icon">{icon}</span>}
      <span className="mm-rail__label">{label}</span>
      <span className="mm-rail__count">{count}</span>
    </button>
  );
}

export function ModelRail({ category, onCategory, models, favorites }: { category: CategoryId; onCategory: (id: CategoryId) => void; models: ModelConfig[]; favorites: string[] }) {
  return (
    <nav className="mm-rail" aria-label={t('models.rail.title')}>
      <h2 className="mm-rail__title">{t('models.title')}</h2>
      <RailItem id="all" active={category === 'all'} icon={<Cube size={14} />} label={t('models.rail.all')} count={models.length} onClick={() => onCategory('all')} />
      <RailItem
        id="favorites"
        active={category === 'favorites'}
        icon={<Star size={14} />}
        label={t('models.rail.favorites')}
        count={models.filter((m) => favorites.includes(m.key)).length}
        onClick={() => onCategory('favorites')}
      />
      <div className="mm-rail__divider" />
      {CATEGORIES.map((c) => (
        <RailItem key={c.id} id={c.id} active={category === c.id} label={t(c.labelKey)} count={models.filter((m) => matchesCategory(m.type, c.id)).length} onClick={() => onCategory(c.id)} />
      ))}
    </nav>
  );
}
