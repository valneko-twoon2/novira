// Right-side detail panel for the selected model.
import { ArrowCircleUp, ArrowSquareOut, ArrowsClockwise, Copy, PencilSimple, Trash, X } from '@phosphor-icons/react';
import { useState } from 'react';
import { backend, type ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { BASE_LABELS, useModels } from '@/state/models';
import { useModelUpdates } from '@/state/modelUpdates';
import { toast } from '@/state/toasts';
import { Button, CommercialTag, IconButton, Modal, writeClipboardText } from '@/ui';
import { ModelGallery } from './ModelGallery';
import { DefaultSettingsForm } from './DefaultSettingsForm';
import { DeleteModelDialog } from './DeleteModelDialog';
import { ModelEditForm } from './ModelEditForm';
import { TYPE_KEYS, formatBytes, formatTag, modelPageUrl } from './modelLabels';
import { TriggerPhrases } from './TriggerPhrases';



export function ModelDetail({ model }: { model: ModelConfig }) {
  const setSelectedKey = useModels((s) => s.setSelectedKey);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [busy, setBusy] = useState(false);
  const canConvert = model.type === 'main' && model.format === 'checkpoint';
  const update = useModelUpdates((s) => s.updates.find((u) => u.key === model.key));

  // The system browser opens it, and only after the backend checked the address (https, a model site).
  const pageUrl = modelPageUrl(model);
  const openSource = () => {
    if (!pageUrl) return;
    if (backend.kind === 'mock') {
      toast({ status: 'info', title: t('browse.toast.openMock'), description: model.name }, 2200);
      return;
    }
    backend.openSourcePage(pageUrl).catch((e: unknown) => {
      toast({ status: 'error', title: t('browse.toast.openFailed'), description: e instanceof Error ? e.message : String(e) });
    });
  };

  // The newer version's page, checked by the backend like the model's own.
  const openUpdate = () => {
    if (!update) return;
    if (backend.kind === 'mock') {
      toast({ status: 'info', title: t('browse.toast.openMock'), description: model.name }, 2200);
      return;
    }
    backend.openSourcePage(update.pageUrl).catch((e: unknown) => {
      toast({ status: 'error', title: t('browse.toast.openFailed'), description: e instanceof Error ? e.message : String(e) });
    });
  };

  const convert = async () => {
    setBusy(true);
    try {
      const updated = await backend.updateModel(model.key, { format: 'diffusers' });
      useModels.getState().upsertModel(updated);
      toast({ status: 'success', title: t('models.toast.converted'), description: model.name });
    } catch (err) {
      toast({ status: 'error', title: t('models.toast.convertFailed'), description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
      setConverting(false);
    }
  };

  const copyPath = () => {
    writeClipboardText(model.path).then(
      () => toast({ status: 'success', title: t('models.detail.copied') }),
      () => toast({ status: 'error', title: t('gallery.toast.copyFailed') }),
    );
  };

  return (
    <aside className="mm-detail" data-testid="mm-model-view">
      <div className="mm-detail__top">
        <IconButton label={t('models.detail.close')} icon={<X size={14} />} size="sm" onClick={() => setSelectedKey(null)} />
      </div>
      <div className="mm-detail__scroll">
        <ModelGallery key={model.key} model={model} />
        <h2 className="mm-detail__name">{model.name}</h2>
        <div className="mm-detail__badges">
          <span className="mm-tag mm-tag--accent">{BASE_LABELS[model.base]}</span>
          <span className="mm-tag">{t(TYPE_KEYS[model.type])}</span>
          {formatTag(model) && <span className="mm-tag">{formatTag(model)}</span>}
        </div>
        {update && (
          <div className="mm-update" role="note" data-testid="mm-update">
            <ArrowCircleUp size={16} weight="fill" className="mm-update__icon" />
            <span className="mm-update__text">{t('models.updates.detail', { name: update.latestName, date: new Date(update.publishedAt).toLocaleDateString() })}</span>
            <Button size="sm" variant="outline" leftIcon={<ArrowSquareOut size={14} />} onClick={openUpdate} data-testid="mm-update-open">
              {t('models.updates.open')}
            </Button>
          </div>
        )}
        <div className="mm-detail__actions">
          {canConvert && (
            <Button size="sm" variant="outline" leftIcon={<ArrowsClockwise size={14} />} onClick={() => setConverting(true)}>
              {t('models.convert')}
            </Button>
          )}
          {!editing && (
            <Button size="sm" variant="outline" leftIcon={<PencilSimple size={14} />} onClick={() => setEditing(true)} data-testid="mm-edit">
              {t('common.edit')}
            </Button>
          )}
          <Button size="sm" scheme="danger" variant="outline" leftIcon={<Trash size={14} />} onClick={() => setDeleting(true)}>
            {t('common.delete')}
          </Button>
        </div>
        {editing ? (
          <ModelEditForm model={model} onDone={() => setEditing(false)} />
        ) : (
          <>
            {model.description && <p className="mm-detail__desc">{model.description}</p>}
            <dl className="mm-details">
              <dt>{t('models.details.size')}</dt>
              <dd>{formatBytes(model.size)}</dd>
              <dt>{t('models.details.path')}</dt>
              <dd className="mm-mono mm-details__path">
                {model.path}
                <IconButton label={t('models.detail.copyPath')} icon={<Copy size={12} />} size="xs" onClick={copyPath} />
              </dd>
              <dt>{t('models.details.license')}</dt>
              <dd data-testid="mm-license">
                {model.license ? (
                  <CommercialTag value={model.license.commercial} permissions={model.license.permissions} license={model.license.name ? [model.license.name] : []} source={model.license.site} />
                ) : (
                  <span className="mm-faint">{t('models.details.licenseUnknown')}</span>
                )}
              </dd>
              <dt>{t('models.details.source')}</dt>
              <dd className="mm-mono">{model.source}</dd>
              {pageUrl && (
                <>
                  <dt>{t('models.details.page')}</dt>
                  <dd className="mm-mono">
                    <button type="button" className="mm-link" data-testid="mm-page-link" onClick={openSource}>
                      {pageUrl}
                    </button>
                  </dd>
                </>
              )}
              <dt>{t('models.details.key')}</dt>
              <dd className="mm-mono">{model.key}</dd>
            </dl>
            {(model.type === 'main' || model.type === 'lora') && <TriggerPhrases model={model} />}
            {model.type === 'main' && <DefaultSettingsForm model={model} />}
          </>
        )}
      </div>

      <DeleteModelDialog model={deleting ? model : null} onClose={() => setDeleting(false)} />
      <Modal
        open={converting}
        onOpenChange={setConverting}
        title={t('models.convertTitle')}
        size="sm"
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConverting(false)}>
              {t('common.cancel')}
            </Button>
            <Button scheme="accent" isLoading={busy} onClick={() => void convert()}>
              {t('models.convert')}
            </Button>
          </>
        }
      >
        <p className="mm-dialog__text">{t('models.convertConfirm', { name: model.name })}</p>
      </Modal>
    </aside>
  );
}
