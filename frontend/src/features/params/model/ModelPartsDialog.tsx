// Confirmation before the files a model needs are downloaded: their names and sizes, and the total. Opened right after
// such a model is added, and by the Generate panel's button when the download is large.
import { t } from '@/i18n';
import { CONFIRM_BYTES, formatPartsSize, installParts, partsBytes, partsToInstall, useModelParts } from '@/state/modelParts';
import { useModels } from '@/state/models';
import { Button, Modal } from '@/ui';

export function ModelPartsDialog() {
  const offer = useModelParts((s) => s.offer);
  const models = useModels((s) => s.models);
  useModels((s) => s.installJobs);
  const parts = offer ? partsToInstall(offer, models) : [];
  const total = partsBytes(parts);
  const close = () => useModelParts.getState().closeOffer();
  const install = () => {
    close();
    void installParts(parts);
  };
  return (
    <Modal
      open={offer !== null}
      onOpenChange={(open) => !open && close()}
      title={t('params.parts.title')}
      size="sm"
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="ghost" onClick={close} data-testid="model-parts-later">
            {t('params.parts.later')}
          </Button>
          <Button scheme="accent" onClick={install} disabled={parts.length === 0} data-testid="model-parts-install">
            {t('params.parts.install', { size: formatPartsSize(total) })}
          </Button>
        </>
      }
    >
      <div data-testid="model-parts-dialog">
        <p className="pp-parts__text">{t('params.parts.body', { model: offer?.modelName ?? '' })}</p>
        <ul className="pp-parts">
          {parts.map((p) => (
            <li key={p.id} className="pp-parts__item" data-testid="model-parts-item">
              <span className="pp-parts__name">{p.name}</span>
              <span className="pp-parts__size">{p.sizeBytes ? formatPartsSize(p.sizeBytes) : ''}</span>
            </li>
          ))}
        </ul>
        <p className="pp-parts__total">{t('params.parts.total', { size: formatPartsSize(total) })}</p>
        {total > CONFIRM_BYTES && <p className="pp-parts__warn">{t('params.parts.large')}</p>}
        {offer && offer.unavailable.length > 0 && <p className="pp-parts__text">{t('params.parts.unavailable', { list: offer.unavailable.join(', ') })}</p>}
      </div>
    </Modal>
  );
}
