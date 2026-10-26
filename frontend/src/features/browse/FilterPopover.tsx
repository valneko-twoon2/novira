// The Browse tab's extra filters (Civitai): what the license allows, the kind of checkpoint, safe file formats, and the creator.
import { Funnel } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { Button, Checkbox, Popover, PopoverContent, PopoverTrigger, Select, TextInput } from '@/ui';
import { useBrowse } from './browseStore';

/** The permission keys a search can ask the license for, in the order the model's license lists them. */
export const LICENSE_FILTERS = ['sellImages', 'generationServices', 'sellModel', 'shareMerges', 'differentLicense', 'noCredit'] as const;

/** How many of the extra filters are set. */
export function activeFilterCount(f: { licenses: string[]; checkpointType: string; safetensorsOnly: boolean; creator: string; price: string }): number {
  return f.licenses.length + (f.checkpointType ? 1 : 0) + (f.safetensorsOnly ? 1 : 0) + (f.creator.trim() ? 1 : 0) + (f.price ? 1 : 0);
}

export function FilterPopover() {
  const { kind, licenses, checkpointType, safetensorsOnly, creator, price, setFilter } = useBrowse();
  const count = activeFilterCount({ licenses, checkpointType, safetensorsOnly, creator, price });
  const toggle = (key: string, on: boolean) => setFilter('licenses', on ? [...licenses, key] : licenses.filter((k) => k !== key));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" leftIcon={<Funnel size={14} />} data-testid="browse-filters">
          {t('browse.filter.button')}
          {count > 0 && (
            <span className="browse-filter__count" data-testid="browse-filters-count">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="browse-filter">
        <div className="browse-filter__group" role="group" aria-label={t('browse.permission.title')}>
          <div className="browse-filter__title">{t('browse.permission.title')}</div>
          {LICENSE_FILTERS.map((key) => (
            <Checkbox key={key} checked={licenses.includes(key)} onChange={(on) => toggle(key, on)} label={t(`browse.permission.${key}`)} />
          ))}
        </div>
        {(kind === 'Checkpoint' || kind === 'all') && (
          <div className="browse-filter__group">
            <div className="browse-filter__title">{t('browse.filter.checkpointType')}</div>
            <Select
              aria-label={t('browse.filter.checkpointType')}
              value={checkpointType || 'any'}
              onChange={(v) => setFilter('checkpointType', v === 'any' ? '' : v)}
              options={[
                { value: 'any', label: t('browse.filter.any') },
                { value: 'Trained', label: t('browse.filter.trained') },
                { value: 'Merge', label: t('browse.filter.merge') },
              ]}
            />
          </div>
        )}
        <div className="browse-filter__group">
          <div className="browse-filter__title">{t('browse.filter.price')}</div>
          <Select
            aria-label={t('browse.filter.price')}
            value={price || 'any'}
            onChange={(v) => setFilter('price', v === 'any' ? '' : v)}
            options={[
              { value: 'any', label: t('browse.filter.any') },
              { value: 'free', label: t('browse.filter.free') },
              { value: 'paid', label: t('browse.filter.paid') },
            ]}
            data-testid="browse-filter-price"
          />
        </div>
        <div className="browse-filter__group">
          <Checkbox checked={safetensorsOnly} onChange={(on) => setFilter('safetensorsOnly', on)} label={t('browse.filter.safetensors')} />
        </div>
        <div className="browse-filter__group">
          <div className="browse-filter__title">{t('browse.filter.creator')}</div>
          <TextInput value={creator} onChange={(e) => setFilter('creator', e.target.value)} placeholder={t('browse.filter.creatorPlaceholder')} aria-label={t('browse.filter.creator')} />
        </div>
        <Button
          size="xs"
          variant="ghost"
          disabled={count === 0}
          onClick={() => {
            setFilter('licenses', []);
            setFilter('checkpointType', '');
            setFilter('safetensorsOnly', false);
            setFilter('creator', '');
            setFilter('price', '');
          }}
          data-testid="browse-filters-reset"
        >
          {t('browse.filter.reset')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
