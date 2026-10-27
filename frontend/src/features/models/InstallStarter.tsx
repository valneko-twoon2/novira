// "Starter Models" tab, laid out like the Model Manager: what each entry is for on the left (always the same list), a
// toolbar with search, the family, the view and the card size, and cards of the curated models and the media packs.
import { Cube, MagnifyingGlass, Package, Rows, SquaresFour, TextT } from '@phosphor-icons/react';
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { backend, type BaseModel, type PackKind, type StarterModel } from '@/backend';
import { t } from '@/i18n';
import { formatPackSize, usePacks } from '@/state/media/packs';
import { BASE_LABELS, useModels } from '@/state/models';
import { Button, EmptyState, IconButton, InstallSlot, InstallStatus, Select, Slider, Spinner, TextInput, cx, type SelectOption } from '@/ui';
import { installModel, sourceState } from '@/state/modelInstall';
import type { ViewMode } from './ModelGrid';
import { formatBytes, TYPE_KEYS } from './modelLabels';
import { familiesIn, filterEntries, PURPOSE_KEYS, STARTER_PURPOSES, starterEntries, type StarterEntry, type StarterPurpose } from './starterCatalog';

const BUNDLES: BaseModel[] = ['sd-1', 'sdxl', 'flux'];
const THUMB_MIN = 120;
const THUMB_MAX = 260;

function RailItem({ active, icon, label, count, onClick, testId }: { active: boolean; icon?: ReactNode; label: string; count: number; onClick: () => void; testId: string }) {
  return (
    <button type="button" className={cx('mm-rail__item', active && 'is-active')} aria-pressed={active} data-testid={testId} onClick={onClick}>
      {icon && <span className="mm-rail__icon">{icon}</span>}
      <span className="mm-rail__label">{label}</span>
      <span className="mm-rail__count">{count}</span>
    </button>
  );
}

function entryText(e: StarterEntry): string {
  return e.kind === 'model'
    ? [e.model.name, e.model.description, e.model.base, e.model.type].join(' ')
    : [t(`pack.title.${e.pack}`), e.pack].join(' ');
}

export function InstallStarter() {
  const [starters, setStarters] = useState<StarterModel[] | null>(null);
  const [search, setSearch] = useState('');
  const [purpose, setPurpose] = useState<StarterPurpose | null>(null);
  const [family, setFamily] = useState<BaseModel | 'all'>('all');
  const [view, setView] = useState<ViewMode>('grid');
  const [thumb, setThumb] = useState(160);
  const models = useModels((s) => s.models);
  const jobs = useModels((s) => s.installJobs);

  useEffect(() => {
    let alive = true;
    void backend.listStarterModels().then((list) => alive && setStarters(list));
    return () => {
      alive = false;
    };
  }, []);

  const entries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return starterEntries(starters ?? []).filter((e) => !q || entryText(e).toLowerCase().includes(q));
  }, [starters, search]);

  if (!starters) {
    return (
      <div className="mm-loading">
        <Spinner />
      </div>
    );
  }

  const picked = family === 'all' ? null : family;
  const shown = filterEntries(entries, purpose, picked);
  const familyOptions: SelectOption<BaseModel | 'all'>[] = [
    { value: 'all', label: t('models.starter.allFamilies') },
    ...familiesIn(starterEntries(starters)).map((b) => ({ value: b, label: BASE_LABELS[b] })),
  ];
  const bundleOpen = (base: BaseModel) => starters.some((s) => s.base === base && !sourceState(s.source, models, jobs));
  const installBundle = (base: BaseModel) => {
    for (const s of starters) if (s.base === base && !sourceState(s.source, models, jobs)) void installModel(s.source, s.name);
  };
  const groups = STARTER_PURPOSES.map((p) => ({ purpose: p, entries: shown.filter((e) => e.purpose === p) })).filter((g) => g.entries.length > 0);
  const style = { '--mm-thumb': `${thumb}px` } as CSSProperties;

  return (
    <div className="mm-starters" data-testid="mm-starters">
      <nav className="mm-rail mm-starters__nav" aria-label={t('models.starter.purposes')}>
        <h3 className="mm-rail__title">{t('models.starter.purposes')}</h3>
        <RailItem testId="mm-starter-purpose-all" active={purpose === null} icon={<Cube size={14} />} label={t('models.starter.all')} count={filterEntries(entries, null, picked).length} onClick={() => setPurpose(null)} />
        <div className="mm-rail__divider" />
        {STARTER_PURPOSES.map((p) => (
          <RailItem key={p} testId={`mm-starter-purpose-${p}`} active={purpose === p} label={t(PURPOSE_KEYS[p])} count={filterEntries(entries, p, picked).length} onClick={() => setPurpose(p)} />
        ))}
      </nav>
      <div className="mm-starters__main">
        <div className="mm-form__help">{t('models.starter.help')}</div>
        <div className="mm-starters__toolbar">
          <div className="mm-search">
            <MagnifyingGlass size={14} className="mm-search__icon" />
            <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('models.starter.search')} aria-label={t('models.starter.search')} />
          </div>
          <div className="mm-toolbar__select">
            <Select value={family} onChange={setFamily} options={familyOptions} aria-label={t('models.starter.families')} data-testid="mm-starter-family" />
          </div>
          <div className="mm-toolbar__group">
            <IconButton label={t('models.view.grid')} icon={<SquaresFour size={15} />} size="sm" isActive={view === 'grid'} onClick={() => setView('grid')} />
            <IconButton label={t('models.view.list')} icon={<Rows size={15} />} size="sm" isActive={view === 'list'} onClick={() => setView('list')} />
          </div>
          <div className="mm-toolbar__thumb">
            <Slider value={thumb} onChange={setThumb} min={THUMB_MIN} max={THUMB_MAX} step={10} aria-label={t('models.thumbSize')} disabled={view === 'list'} />
          </div>
          <span className="mm-spacer" />
          {picked && BUNDLES.includes(picked) && (
            <Button size="sm" variant="outline" scheme="accent" onClick={() => installBundle(picked)} disabled={!bundleOpen(picked)}>
              {t('models.starter.bundle', { base: BASE_LABELS[picked] })}
            </Button>
          )}
        </div>
        {groups.length === 0 && <EmptyState title={t('models.noMatch')} />}
        {groups.map((g) => (
          <section key={g.purpose} className="mm-starters__section">
            <h4 className="mm-starters__group">{t(PURPOSE_KEYS[g.purpose])}</h4>
            <div className={`mm-grid mm-grid--${view} mm-starters__grid`} style={style}>
              {g.entries.map((e) => (e.kind === 'model' ? <StarterCard key={e.model.id} s={e.model} /> : <PackCard key={`pack-${e.pack}`} kind={e.pack} />))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/** The card's frame: an icon cover with the badges, then the name, the description, the size and the install control. */
function Card({ testId, icon, badges, name, description, meta, error, action }: { testId: string; icon: ReactNode; badges: ReactNode; name: string; description?: string; meta?: string; error?: boolean; action: ReactNode }) {
  return (
    <div className="mm-card-item mm-starter-card" data-testid={testId}>
      <div className="mm-card-item__media">
        <div className="mm-cover mm-cover--icon" aria-hidden>
          {icon}
        </div>
        <div className="mm-card-item__badges">{badges}</div>
      </div>
      <div className="mm-card-item__caption">
        <span className="mm-card-item__name">{name}</span>
        {description && <span className={cx('mm-starter-card__desc', error && 'mm-starter__error')}>{description}</span>}
        {meta && <span className="mm-card-item__meta">{meta}</span>}
      </div>
      <div className="mm-starter-card__action">{action}</div>
    </div>
  );
}

function StarterCard({ s }: { s: StarterModel }) {
  const Icon = s.type === 'vae' ? Cube : s.type === 'clip_embed' || s.type === 't5_encoder' || s.type === 'text_encoder' ? TextT : Package;
  return (
    <Card
      testId="mm-starter"
      icon={<Icon size={28} weight="light" />}
      badges={
        <>
          {s.base !== 'any' && <span className="mm-tag mm-tag--accent">{BASE_LABELS[s.base]}</span>}
          <span className="mm-tag">{t(TYPE_KEYS[s.type])}</span>
        </>
      }
      name={s.name}
      description={s.description}
      meta={s.sizeBytes ? formatBytes(s.sizeBytes) : undefined}
      action={
        <InstallSlot source={s.source}>
          <Button size="xs" onClick={() => void installModel(s.source, s.name)}>
            {t('models.install.install')}
          </Button>
        </InstallSlot>
      }
    />
  );
}

/** A media pack, installed by the pack download instead of the model install queue. */
function PackCard({ kind }: { kind: PackKind }) {
  const pack = usePacks((s) => s.packs[kind]);
  return (
    <Card
      testId="mm-starter-pack"
      icon={<Package size={28} weight="light" />}
      badges={<span className="mm-tag">{t('models.starter.pack')}</span>}
      name={t(`pack.title.${kind}`)}
      description={pack.state === 'missing' ? t(`pack.missing.${kind}`, { size: formatPackSize(pack.totalBytes) }) : pack.state === 'error' ? pack.message : undefined}
      error={pack.state === 'error'}
      action={
        <>
          {pack.state === 'ready' && <InstallStatus state={{ kind: 'installed' }} />}
          {pack.state === 'downloading' && <InstallStatus state={{ kind: 'queued', progress: pack.totalBytes ? pack.bytes / pack.totalBytes : 0 }} />}
          {pack.state === 'installing' && <InstallStatus state={{ kind: 'queued', progress: 0 }} />}
          {(pack.state === 'missing' || pack.state === 'error') && (
            <Button size="xs" onClick={() => void backend.installPack(kind)} data-testid={`mm-starter-pack-install-${kind}`}>
              {t(pack.state === 'error' ? 'pack.retry' : 'pack.install')}
            </Button>
          )}
        </>
      }
    />
  );
}
