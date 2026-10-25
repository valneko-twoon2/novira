import { List, MagnifyingGlass } from '@phosphor-icons/react';
import { useState } from 'react';
import type { CivitaiKind, CivitaiPeriod, CivitaiSort } from '@/backend';
import { t } from '@/i18n';
import { isPhoneLayout } from '@/state/layout';
import { IconButton, Select, Slider, Switch, TextInput, type SelectOption } from '@/ui';
import { CARD_MAX, CARD_MIN, useBrowse } from './browseStore';
import { FilterPopover } from './FilterPopover';

const KINDS: { value: CivitaiKind | 'all'; label: () => string }[] = [
  { value: 'LoRA', label: () => t('browse.kind.lora') },
  { value: 'Checkpoint', label: () => t('browse.kind.checkpoint') },
  { value: 'ControlNet', label: () => t('browse.kind.controlnet') },
  { value: 'VAE', label: () => t('browse.kind.vae') },
  { value: 'Diffusion', label: () => t('browse.kind.diffusion') },
  { value: 'all', label: () => t('browse.kind.all') },
];

function baseOptions(): SelectOption[] {
  return [
    { value: 'sdxl-compat', label: t('browse.base.sdxlCompat') },
    { value: 'Illustrious', label: t('browse.base.illustrious') },
    { value: 'NoobAI', label: t('browse.base.noobai') },
    { value: 'SDXL 1.0', label: t('browse.base.sdxl') },
    { value: 'Pony', label: t('browse.base.pony') },
    { value: 'SD 1.5', label: t('browse.base.sd15') },
    { value: 'FLUX.1', label: t('browse.base.flux') },
    { value: 'Anima', label: t('browse.base.anima') },
    { value: 'all', label: t('browse.base.all') },
  ];
}

export function BrowseBar({ queryInput, onQueryInput }: { queryInput: string; onQueryInput: (q: string) => void }) {
  const { source, kind, baseModel, sort, period, includeNsfw, cardSize, setFilter, setCardSize } = useBrowse();
  const civitai = source === 'civitai';
  // On a phone the controls fold behind one button, so the cards get the screen.
  const phone = isPhoneLayout();
  const [open, setOpen] = useState(false);
  const controls = (
    <div className={phone ? 'browse-bar browse-bar--menu' : 'browse-bar'} id="browse-menu">
      <div className="browse-seg" role="tablist" aria-label={t('browse.source.label')}>
        {(['civitai', 'huggingface'] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={source === s} className={source === s ? 'is-on' : ''} onClick={() => setFilter('source', s)} data-testid={`browse-source-${s}`}>
            {t(s === 'civitai' ? 'browse.source.civitai' : 'browse.source.huggingface')}
          </button>
        ))}
      </div>
      {civitai && (
      <>
      <div className="browse-seg" role="tablist" aria-label={t('browse.kind.label')}>
        {KINDS.map((k) => (
          <button key={k.value} type="button" role="tab" aria-selected={kind === k.value} className={kind === k.value ? 'is-on' : ''} onClick={() => setFilter('kind', k.value)} data-testid={`browse-kind-${k.value}`}>
            {k.label()}
          </button>
        ))}
      </div>
      <label className="browse-search">
        <MagnifyingGlass size={14} />
        <TextInput value={queryInput} onChange={(e) => onQueryInput(e.target.value)} placeholder={t('browse.search.placeholder')} aria-label={t('browse.search.label')} data-testid="browse-search" />
      </label>
      <div className="browse-bar__filters">
        <Select aria-label={t('browse.base.label')} value={baseModel} onChange={(v) => setFilter('baseModel', v)} options={baseOptions()} />
        <Select<CivitaiSort>
          aria-label={t('browse.sort.label')}
          value={sort}
          onChange={(v) => setFilter('sort', v)}
          options={[
            { value: 'downloads', label: t('browse.sort.downloads') },
            { value: 'rating', label: t('browse.sort.rating') },
            { value: 'newest', label: t('browse.sort.newest') },
          ]}
        />
        {civitai && (
        <Select<CivitaiPeriod>
          aria-label={t('browse.period.label')}
          value={period}
          onChange={(v) => setFilter('period', v)}
          options={[
            { value: 'all', label: t('browse.period.all') },
            { value: 'year', label: t('browse.period.year') },
            { value: 'month', label: t('browse.period.month') },
            { value: 'week', label: t('browse.period.week') },
            { value: 'day', label: t('browse.period.day') },
          ]}
        />
        )}
        <FilterPopover />
        <label className="browse-nsfw">
          <Switch checked={includeNsfw} onChange={(v) => setFilter('includeNsfw', v)} aria-label={t('browse.nsfw.label')} />
          <span>{t('browse.nsfw.label')}</span>
        </label>
      </div>
      </>
      )}
      {civitai && (
        <label className="browse-size" data-testid="browse-card-size">
          <span>{t('browse.cardSize')}</span>
          <Slider value={cardSize} onChange={setCardSize} min={CARD_MIN} max={CARD_MAX} step={10} aria-label={t('browse.cardSize')} />
        </label>
      )}
    </div>
  );
  if (!phone) return controls;
  return (
    <>
      <div className="browse-bar browse-bar--head">
        <IconButton
          label={t('browse.menu')}
          icon={<List size={18} />}
          isActive={open}
          aria-expanded={open}
          aria-controls="browse-menu"
          onClick={() => setOpen((v) => !v)}
          data-testid="browse-menu"
        />
      </div>
      {open && controls}
    </>
  );
}
