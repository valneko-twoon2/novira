import { ArrowSquareOut, Star, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import type { CivitaiModel, CivitaiVersion } from '@/backend';
import { t } from '@/i18n';
import { Badge, Button, CommercialTag, IconButton, Select } from '@/ui';
import { Cover } from './Cover';
import { DownloadButton } from './DownloadButton';
import { formatCount, formatSize } from './format';
import { openOnCivitai } from './openCivitai';
import { TriggerChips } from './TriggerChips';

export function DetailDrawer({ model, onClose }: { model: CivitaiModel; onClose: () => void }) {
  const [image, setImage] = useState(0);
  const [versionId, setVersionId] = useState((model.versions[0] as CivitaiVersion).id);
  const version = model.versions.find((v) => v.id === versionId) ?? (model.versions[0] as CivitaiVersion);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // A press anywhere outside the drawer closes it. Menus, popovers and dialogs opened from the drawer render in portals
  // outside it, so they do not count as outside.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || ref.current?.contains(target)) return;
      if (target.closest('[data-radix-popper-content-wrapper], [role="dialog"], [role="alertdialog"]')) return;
      onClose();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [onClose]);

  return (
    <aside ref={ref} className="browse-drawer" aria-label={model.name} data-testid="browse-drawer">
      <div className="browse-drawer__head">
        <div className="browse-drawer__title">
          <h2>{model.name}</h2>
          <div className="browse-drawer__sub">{t('browse.detail.by', { creator: model.creator })}</div>
        </div>
        <IconButton label={t('browse.detail.close')} icon={<X size={14} />} onClick={onClose} />
      </div>
      <div className="browse-drawer__scroll">
        <div className="browse-drawer__hero">
          <Cover model={model} index={image} play="controls" />
        </div>
        <div className="browse-thumbs">
          {Array.from({ length: model.imageCount }, (_, i) => (
            <button key={i} type="button" className={i === image ? 'is-on' : ''} aria-label={t('browse.card.imageN', { n: i + 1 })} onClick={() => setImage(i)}>
              <Cover model={model} index={i} />
            </button>
          ))}
        </div>
        <div className="browse-drawer__stats">
          <Badge>{model.kind}</Badge>
          <Badge>{model.baseModel}</Badge>
          <CommercialTag value={model.commercial} permissions={model.permissions} license={model.license} source={model.source} />
          <span>{t('browse.stats.downloadsN', { count: formatCount(model.downloads) })}</span>
          <span>{t('browse.stats.likesN', { count: formatCount(model.likes) })}</span>
          {model.ratingCount > 0 && (
          <span className="browse-drawer__rating">
            <Star size={12} weight="fill" /> {t('browse.detail.rating', { rating: model.rating.toFixed(1), count: formatCount(model.ratingCount) })}
          </span>
          )}
        </div>

        <section>
          <h3>{t('browse.detail.version')}</h3>
          <Select
            aria-label={t('browse.detail.version')}
            value={version.id}
            onChange={setVersionId}
            options={model.versions.map((v) => ({ value: v.id, label: `${v.name} · ${v.baseModel}` }))}
          />
        </section>

        <section>
          <h3>{t('browse.detail.files')}</h3>
          <ul className="browse-files">
            {version.files.map((f) => (
              <li key={f.id}>
                <div className="browse-files__info">
                  <div className="browse-files__name">{f.name}</div>
                  <div className="browse-files__meta">
                    {formatSize(f.sizeBytes)} · {f.format} · {f.precision}
                  </div>
                </div>
                <div className="browse-files__dl">
                  <DownloadButton model={model} file={f} fullWidth={false} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        {version.triggerWords.length > 0 && (
          <section>
            <h3>{t('browse.detail.triggerWords')}</h3>
            <TriggerChips words={version.triggerWords} />
          </section>
        )}

        <section>
          <h3>{t('browse.detail.tags')}</h3>
          <div className="browse-chips">
            {model.tags.map((tag) => (
              <span key={tag} className="browse-tag">
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section>
          <h3>{t('browse.detail.description')}</h3>
          <p className="browse-drawer__desc">{model.description}</p>
        </section>

        <section>
          <h3>{t('browse.detail.license')}</h3>
          <div className="browse-chips">
            <CommercialTag value={model.commercial} permissions={model.permissions} license={model.license} source={model.source} />
            {model.license.map((l) => (
              <Badge key={l}>{l}</Badge>
            ))}
          </div>
        </section>
      </div>
      <div className="browse-drawer__foot">
        <Button variant="outline" fullWidth leftIcon={<ArrowSquareOut size={13} />} onClick={() => openOnCivitai(model)}>
          {t('browse.detail.openCivitai')}
        </Button>
      </div>
    </aside>
  );
}
