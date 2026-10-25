// "Starter Models" tab: curated models with bundles per base, search and per-model install.
import { MagnifyingGlass } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { backend, type BaseModel, type StarterModel } from '@/backend';
import { t } from '@/i18n';
import { BASE_LABELS, useModels } from '@/state/models';
import { Badge, Button, EmptyState, InstallSlot, Spinner, TextInput } from '@/ui';
import { installModel, sourceState } from '@/state/modelInstall';
import { TYPE_KEYS } from './modelLabels';

const BUNDLES: BaseModel[] = ['sd-1', 'sdxl', 'flux'];

export function InstallStarter() {
  const [starters, setStarters] = useState<StarterModel[] | null>(null);
  const [search, setSearch] = useState('');
  const models = useModels((s) => s.models);
  const jobs = useModels((s) => s.installJobs);

  useEffect(() => {
    let alive = true;
    void backend.listStarterModels().then((list) => alive && setStarters(list));
    return () => {
      alive = false;
    };
  }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (starters ?? []).filter((s) => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.base.includes(q) || s.type.includes(q));
  }, [starters, search]);

  if (!starters) {
    return (
      <div className="mm-loading">
        <Spinner />
      </div>
    );
  }

  const installBundle = (base: BaseModel) => {
    for (const s of starters) if (s.base === base && !sourceState(s.source, models, jobs)) void installModel(s.source, s.name);
  };

  return (
    <div className="mm-form">
      <div className="mm-form__help">{t('models.starter.help')}</div>
      <div className="mm-bundles">
        <span className="mm-form__label">{t('models.starter.bundles')}</span>
        {BUNDLES.map((b) => (
          <Button key={b} size="xs" variant="outline" scheme="accent" onClick={() => installBundle(b)} disabled={!starters.some((s) => s.base === b && !sourceState(s.source, models, jobs))}>
            {t('models.starter.bundle', { base: BASE_LABELS[b] })}
          </Button>
        ))}
      </div>
      <div className="mm-search">
        <MagnifyingGlass size={14} className="mm-search__icon" />
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('models.starter.search')} aria-label={t('models.starter.search')} />
      </div>
      <div className="mm-results">
        {shown.length === 0 && <EmptyState title={t('models.noMatch')} />}
        {shown.map((s) => {
          return (
            <div key={s.id} className="mm-starter" data-testid="mm-starter">
              <div className="mm-starter__main">
                <div className="mm-item__top">
                  <Badge scheme="accent">{BASE_LABELS[s.base]}</Badge>
                  <Badge>{t(TYPE_KEYS[s.type])}</Badge>
                  <span className="mm-item__name">{s.name}</span>
                </div>
                <div className="mm-item__desc">{s.description}</div>
                {s.dependencies && s.dependencies.length > 0 && (
                  <div className="mm-starter__deps">{t('models.starter.dependencies', { list: s.dependencies.join(', ') })}</div>
                )}
              </div>
              <InstallSlot source={s.source}>
                <Button size="xs" onClick={() => void installModel(s.source, s.name)}>
                  {t('models.install.install')}
                </Button>
              </InstallSlot>
            </div>
          );
        })}
      </div>
    </div>
  );
}
