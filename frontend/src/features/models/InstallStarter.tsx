// "Starter Models" tab: curated models and the media packs, sorted by what they are for and by family on the left, with
// search, a bundle for the families that have one, and per-entry install.
import { Cube, MagnifyingGlass, Stack } from '@phosphor-icons/react';
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { backend, type BaseModel, type PackKind, type StarterModel } from '@/backend';
import { t } from '@/i18n';
import { formatPackSize, usePacks } from '@/state/media/packs';
import { BASE_LABELS, useModels } from '@/state/models';
import { Badge, Button, EmptyState, InstallSlot, InstallStatus, Spinner, TextInput, cx } from '@/ui';
import { installModel, sourceState } from '@/state/modelInstall';
import { TYPE_KEYS } from './modelLabels';
import { familiesIn, filterEntries, PURPOSE_KEYS, STARTER_PURPOSES, starterEntries, type StarterEntry, type StarterPurpose } from './starterCatalog';

const BUNDLES: BaseModel[] = ['sd-1', 'sdxl', 'flux'];

/** A choice on the left; one with nothing to show under the other choice is left out, unless it is the one picked. */
function NavItem({ active, icon, label, count, onClick, testId }: { active: boolean; icon?: ReactNode; label: string; count: number; onClick: () => void; testId: string }) {
  if (count === 0 && !active) return null;
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
  const [family, setFamily] = useState<BaseModel | null>(null);
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

  const shown = filterEntries(entries, purpose, family);
  const names = new Map(starters.map((s) => [s.id, s.name]));
  const bundleOpen = (base: BaseModel) => starters.some((s) => s.base === base && !sourceState(s.source, models, jobs));
  const installBundle = (base: BaseModel) => {
    for (const s of starters) if (s.base === base && !sourceState(s.source, models, jobs)) void installModel(s.source, s.name);
  };

  return (
    <div className="mm-starters" data-testid="mm-starters">
      <nav className="mm-rail mm-starters__nav" aria-label={t('models.starter.purposes')}>
        <h3 className="mm-rail__title">{t('models.starter.purposes')}</h3>
        <NavItem testId="mm-starter-purpose-all" active={purpose === null} icon={<Cube size={14} />} label={t('models.starter.all')} count={filterEntries(entries, null, family).length} onClick={() => setPurpose(null)} />
        {STARTER_PURPOSES.map((p) => (
          <NavItem key={p} testId={`mm-starter-purpose-${p}`} active={purpose === p} label={t(PURPOSE_KEYS[p])} count={filterEntries(entries, p, family).length} onClick={() => setPurpose(purpose === p ? null : p)} />
        ))}
        <div className="mm-rail__divider" />
        <h3 className="mm-rail__title">{t('models.starter.families')}</h3>
        <NavItem testId="mm-starter-family-all" active={family === null} icon={<Stack size={14} />} label={t('models.starter.allFamilies')} count={filterEntries(entries, purpose, null).length} onClick={() => setFamily(null)} />
        {familiesIn(starterEntries(starters)).map((b) => (
          <NavItem key={b} testId={`mm-starter-family-${b}`} active={family === b} label={BASE_LABELS[b]} count={filterEntries(entries, purpose, b).length} onClick={() => setFamily(family === b ? null : b)} />
        ))}
      </nav>
      <div className="mm-form mm-starters__main">
        <div className="mm-form__help">{t('models.starter.help')}</div>
        <div className="mm-search">
          <MagnifyingGlass size={14} className="mm-search__icon" />
          <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('models.starter.search')} aria-label={t('models.starter.search')} />
        </div>
        {family && BUNDLES.includes(family) && (
          <div className="mm-bundles">
            <Button size="xs" variant="outline" scheme="accent" onClick={() => installBundle(family)} disabled={!bundleOpen(family)}>
              {t('models.starter.bundle', { base: BASE_LABELS[family] })}
            </Button>
          </div>
        )}
        <div className="mm-results">
          {shown.length === 0 && <EmptyState title={t('models.noMatch')} />}
          {shown.map((e, i) => (
            <Fragment key={e.kind === 'model' ? e.model.id : `pack-${e.pack}`}>
              {(i === 0 || shown[i - 1]!.purpose !== e.purpose) && <h4 className="mm-starters__group">{t(PURPOSE_KEYS[e.purpose])}</h4>}
              {e.kind === 'model' ? <StarterRow s={e.model} names={names} /> : <PackRow kind={e.pack} />}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function StarterRow({ s, names }: { s: StarterModel; names: Map<string, string> }) {
  return (
    <div className="mm-starter" data-testid="mm-starter">
      <div className="mm-starter__main">
        <div className="mm-item__top">
          {s.base !== 'any' && <Badge scheme="accent">{BASE_LABELS[s.base]}</Badge>}
          <Badge>{t(TYPE_KEYS[s.type])}</Badge>
          <span className="mm-item__name">{s.name}</span>
        </div>
        <div className="mm-item__desc">{s.description}</div>
        {s.dependencies && s.dependencies.length > 0 && (
          <div className="mm-starter__deps">{t('models.starter.dependencies', { list: s.dependencies.map((d) => names.get(d) ?? d).join(', ') })}</div>
        )}
      </div>
      <InstallSlot source={s.source}>
        <Button size="xs" onClick={() => void installModel(s.source, s.name)}>
          {t('models.install.install')}
        </Button>
      </InstallSlot>
    </div>
  );
}

/** A media pack, installed by the pack download instead of the model install queue. */
function PackRow({ kind }: { kind: PackKind }) {
  const pack = usePacks((s) => s.packs[kind]);
  return (
    <div className="mm-starter" data-testid="mm-starter-pack">
      <div className="mm-starter__main">
        <div className="mm-item__top">
          <Badge>{t('models.starter.pack')}</Badge>
          <span className="mm-item__name">{t(`pack.title.${kind}`)}</span>
        </div>
        {pack.state === 'missing' && <div className="mm-item__desc">{t(`pack.missing.${kind}`, { size: formatPackSize(pack.totalBytes) })}</div>}
        {pack.state === 'error' && <div className="mm-item__desc mm-starter__error">{pack.message}</div>}
      </div>
      {pack.state === 'ready' && <InstallStatus state={{ kind: 'installed' }} />}
      {pack.state === 'downloading' && <InstallStatus state={{ kind: 'queued', progress: pack.totalBytes ? pack.bytes / pack.totalBytes : 0 }} />}
      {pack.state === 'installing' && <InstallStatus state={{ kind: 'queued', progress: 0 }} />}
      {(pack.state === 'missing' || pack.state === 'error') && (
        <Button size="xs" onClick={() => void backend.installPack(kind)} data-testid={`mm-starter-pack-install-${kind}`}>
          {t(pack.state === 'error' ? 'pack.retry' : 'pack.install')}
        </Button>
      )}
    </div>
  );
}
