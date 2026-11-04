// The detail view's "Example settings": what Civitai kept with the example pictures of a version (prompt, sampler, steps, ...),
// each with a button that puts them into the Generate form. The models and LoRAs a picture used are marked installed or not.
import { MagicWand } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { backend, type CivitaiModel, type CivitaiSample, type CivitaiSampleResource, type CivitaiVersion } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { toast } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { Button, cx } from '@/ui';
import { installedFor, sampleUse } from './applySample';
import { useBrowse } from './browseStore';

type Load = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; samples: CivitaiSample[] };

/** The settings a card shows on one line: the ones the picture recorded. */
function summary(s: CivitaiSample): string {
  const size = s.width !== null && s.height !== null ? `${s.width}×${s.height}` : null;
  return [s.sampler, s.steps !== null ? t('browse.samples.steps', { n: s.steps }) : null, s.cfgScale !== null ? `CFG ${s.cfgScale}` : null, size]
    .filter(Boolean)
    .join(' · ');
}

/** What a resource is called: the name the picture recorded, the model itself when it is the version shown, else its Civitai version. */
function resourceLabel(r: CivitaiSampleResource, model: CivitaiModel, version: CivitaiVersion): string {
  const base = r.name ?? (r.versionId === version.id ? model.name : t('browse.samples.versionN', { id: r.versionId ?? '?' }));
  return r.kind === 'lora' && r.weight !== null ? `${base} ×${r.weight}` : base;
}

export function SamplesSection({ model, version }: { model: CivitaiModel; version: CivitaiVersion }) {
  const includeNsfw = useBrowse((s) => s.includeNsfw);
  const models = useModels((s) => s.models);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setLoad({ state: 'loading' });
    backend.civitaiSamples(version.id, includeNsfw).then(
      (samples) => live && setLoad({ state: 'ready', samples }),
      () => live && setLoad({ state: 'failed' }),
    );
    return () => {
      live = false;
    };
  }, [version.id, includeNsfw, attempt]);

  const apply = useCallback(
    (sample: CivitaiSample) => {
      const use = sampleUse(sample, models);
      useParams.getState().set(use.patch);
      const ui = useUi.getState();
      ui.setTab('generate');
      ui.setMedia('image');
      const notes: string[] = [];
      if (use.missing.length > 0) notes.push(t('browse.samples.missing', { names: use.missing.map((r) => resourceLabel(r, model, version)).join(', ') }));
      if (use.unknownSampler) notes.push(t('browse.samples.samplerUnknown', { name: use.unknownSampler }));
      toast({ status: notes.length > 0 ? 'warning' : 'success', title: t('browse.samples.applied'), ...(notes.length > 0 ? { description: notes.join(' ') } : {}) });
    },
    [models, model, version],
  );

  return (
    <section data-testid="browse-samples">
      <h3>{t('browse.samples.title')}</h3>
      {load.state === 'loading' && <p className="browse-samples__note">{t('browse.samples.loading')}</p>}
      {load.state === 'failed' && (
        <div className="browse-samples__note">
          <span>{t('browse.samples.failed')}</span>
          <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            {t('browse.status.retry')}
          </Button>
        </div>
      )}
      {load.state === 'ready' && load.samples.length === 0 && <p className="browse-samples__note">{t('browse.samples.none')}</p>}
      {load.state === 'ready' && load.samples.length > 0 && (
        <ul className="browse-samples">
          {load.samples.map((s) => (
            <li key={s.id} className="browse-sample" data-testid="browse-sample">
              <img className="browse-sample__pic" src={s.imageUrl} alt="" loading="lazy" decoding="async" draggable={false} onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
              <div className="browse-sample__body">
                {summary(s) && <div className="browse-sample__meta">{summary(s)}</div>}
                <p className="browse-sample__prompt" title={s.prompt}>
                  {s.prompt}
                </p>
                <div className="browse-chips">
                  {s.resources
                    .filter((r) => r.kind === 'checkpoint' || r.kind === 'model' || r.kind === 'lora')
                    .map((r, i) => {
                      const installed = installedFor(r, models) !== null;
                      return (
                        <span key={`${r.kind}-${r.versionId ?? r.name}-${i}`} className={cx('browse-chip', !installed && 'is-missing')} title={installed ? t('browse.samples.installed') : t('browse.samples.notInstalled')}>
                          {resourceLabel(r, model, version)}
                        </span>
                      );
                    })}
                </div>
                <Button size="sm" variant="outline" leftIcon={<MagicWand size={13} />} onClick={() => apply(s)} data-testid="browse-sample-use">
                  {t('browse.samples.use')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
