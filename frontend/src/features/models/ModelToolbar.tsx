// Top toolbar: search, base filter, sort, view toggle, thumbnail size and the Find / Import buttons.
import { Compass, MagnifyingGlass, Plus, Rows, SquaresFour } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { BASE_LABELS } from '@/state/models';
import { useUi } from '@/state/ui';
import { Button, IconButton, Select, Slider, TextInput, type SelectOption } from '@/ui';
import type { BaseFilter, SortKey } from './filterModels';
import type { ViewMode } from './ModelGrid';
import { BASE_MODELS } from './modelLabels';

export interface ToolbarState {
  search: string;
  base: BaseFilter;
  sort: SortKey;
  view: ViewMode;
  thumb: number;
}

const THUMB_MIN = 120;
const THUMB_MAX = 260;

export function ModelToolbar({ state, onChange, onImport }: { state: ToolbarState; onChange: (patch: Partial<ToolbarState>) => void; onImport: () => void }) {
  const baseOptions: SelectOption<BaseFilter>[] = [
    { value: 'all', label: t('models.filter.allBases') },
    ...BASE_MODELS.map((b) => ({ value: b, label: BASE_LABELS[b] })),
  ];
  const sortOptions: SelectOption<SortKey>[] = [
    { value: 'name', label: t('models.sort.name') },
    { value: 'size', label: t('models.sort.size') },
    { value: 'base', label: t('models.sort.base') },
    { value: 'type', label: t('models.sort.type') },
  ];
  return (
    <div className="mm-toolbar">
      <div className="mm-search">
        <MagnifyingGlass size={14} className="mm-search__icon" />
        <TextInput value={state.search} onChange={(e) => onChange({ search: e.target.value })} placeholder={t('models.searchPlaceholder')} aria-label={t('models.searchPlaceholder')} data-testid="mm-search" />
      </div>
      <div className="mm-toolbar__select">
        <Select value={state.base} onChange={(base) => onChange({ base })} options={baseOptions} aria-label={t('models.filter.base')} />
      </div>
      <div className="mm-toolbar__select">
        <Select value={state.sort} onChange={(sort) => onChange({ sort })} options={sortOptions} aria-label={t('models.sort.label')} />
      </div>
      <div className="mm-toolbar__group">
        <IconButton label={t('models.view.grid')} icon={<SquaresFour size={15} />} size="sm" isActive={state.view === 'grid'} onClick={() => onChange({ view: 'grid' })} />
        <IconButton label={t('models.view.list')} icon={<Rows size={15} />} size="sm" isActive={state.view === 'list'} onClick={() => onChange({ view: 'list' })} />
      </div>
      <div className="mm-toolbar__thumb">
        <Slider value={state.thumb} onChange={(thumb) => onChange({ thumb })} min={THUMB_MIN} max={THUMB_MAX} step={10} aria-label={t('models.thumbSize')} disabled={state.view === 'list'} />
      </div>
      <span className="mm-spacer" />
      <Button variant="outline" leftIcon={<Compass size={14} />} onClick={() => useUi.getState().setTab('browse')} data-testid="mm-find">
        {t('models.find')}
      </Button>
      <Button scheme="accent" leftIcon={<Plus size={14} weight="bold" />} onClick={onImport} data-testid="mm-import">
        {t('models.import')}
      </Button>
    </div>
  );
}
