// Settings popover of a reference image (IP-Adapter model, method, weight, begin/end).
import { BoundingBox, DownloadSimple, Trash, X } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useCanvas } from '@/state/canvas';
import { findImage } from '@/state/gallery';
import { BASE_LABELS, modelsOfType, useModels } from '@/state/models';
import { useParams, type RefImage, type RefImageMethod } from '@/state/params';
import { useUi } from '@/state/ui';
import { Button, Field, IconButton, ImageDropZone, Select, SliderNumber, Switch } from '@/ui';
import { methodLabel } from '../labels';
import { imageFromNames, uploadFirst } from './useImageDrop';

const METHODS: RefImageMethod[] = ['full', 'style', 'composition', 'style_strong', 'style_precise'];
const CLIP_VISION: RefImage['clipVisionModel'][] = ['ViT-H', 'ViT-G', 'ViT-L'];

interface Props {
  refImage: RefImage;
  index: number;
  onImage: (img: { name: string; url: string } | undefined) => void;
}

export function RefImageSettings({ refImage: r, index, onImage }: Props) {
  const update = useParams((s) => s.updateRefImage);
  const remove = useParams((s) => s.removeRefImage);
  const modelKey = useParams((s) => s.modelKey);
  const models = useModels((s) => s.models);
  const mainBase = models.find((m) => m.key === modelKey)?.base;
  const ipModels = modelsOfType(models, 'ip_adapter', mainBase);
  const selected = models.find((m) => m.key === r.modelKey);
  const isFlux = mainBase === 'flux';
  const image = findImage(r.imageName);
  const patch = (p: Partial<RefImage>) => update(r.id, p);
  return (
    <div className="pp-refpop__body">
      <div className="pp-refpop__head">
        <span className="pp-refpop__title">{t('params.refImage.title', { index: index + 1 })}</span>
        <Switch checked={r.isEnabled} onChange={(v) => patch({ isEnabled: v })} aria-label={t('params.refImage.enabled')} />
        <span className="pp-spacer" />
        <IconButton size="xs" scheme="danger" label={t('params.refImage.delete')} icon={<Trash />} onClick={() => remove(r.id)} />
      </div>
      <ImageDropZone
        className="pp-refpop__image"
        label={t('params.refImage.dropShort')}
        onImages={(names) => onImage(imageFromNames(names))}
        onFiles={(files) => void uploadFirst(files).then(onImage)}
      >
        {r.imageUrl ? (
          <>
            <img src={r.imageUrl} alt="" draggable={false} />
            <IconButton
              className="pp-refpop__clear"
              size="xs"
              variant="solid"
              label={t('params.refImage.clearImage')}
              icon={<X />}
              onClick={() => patch({ imageName: null, imageUrl: null })}
            />
          </>
        ) : (
          <span className="pp-hint">{t('params.refImage.dropHint')}</span>
        )}
      </ImageDropZone>
      {image && (
        <div className="pp-refpop__note">
          <span>{t('params.refImage.i2iHelp')}</span>
          <Button size="xs" variant="outline" leftIcon={<BoundingBox />} onClick={() => useCanvas.getState().importImage(image, 'newCanvasRaster')} data-testid="ref-to-canvas">
            {t('params.refImage.openI2i')}
          </Button>
        </div>
      )}
      <Field label={t('params.refImage.model')}>
        <Select
          value={selected ? r.modelKey : null}
          onChange={(v) => patch({ modelKey: v })}
          placeholder={ipModels.length ? t('params.refImage.selectModel') : t('params.refImage.noModels')}
          disabled={!ipModels.length}
          aria-label={t('params.refImage.model')}
          options={ipModels.map((m) => ({ value: m.key, label: m.name, description: BASE_LABELS[m.base] }))}
        />
      </Field>
      {!ipModels.length && (
        <div className="pp-refpop__note is-warning" data-testid="ref-no-models">
          <span>{t('params.refImage.noModelHelp', { base: mainBase ? BASE_LABELS[mainBase] : '—' })}</span>
          <Button size="xs" variant="outline" scheme="accent" leftIcon={<DownloadSimple />} onClick={() => useUi.getState().setTab('models')}>
            {t('params.refImage.installModels')}
          </Button>
        </div>
      )}
      {!isFlux && (
        <Field label={t('params.refImage.clipVision')}>
          <Select
            value={r.clipVisionModel}
            onChange={(v) => patch({ clipVisionModel: v })}
            aria-label={t('params.refImage.clipVision')}
            options={CLIP_VISION.map((c) => ({ value: c, label: c }))}
          />
        </Field>
      )}
      {!isFlux && (
        <Field label={t('params.refImage.methodLabel')}>
          <Select
            value={r.method}
            onChange={(v) => patch({ method: v })}
            aria-label={t('params.refImage.methodLabel')}
            options={METHODS.map((m) => ({ value: m, label: methodLabel(m) }))}
          />
        </Field>
      )}
      <Field label={t('params.refImage.weight')}>
        <SliderNumber
          value={r.weight}
          onChange={(v) => patch({ weight: v })}
          min={-1}
          max={2}
          step={0.01}
          precision={2}
          marks={[-1, 0, 1, 2]}
          aria-label={t('params.refImage.weight')}
        />
      </Field>
      <Field label={t('params.refImage.begin')}>
        <SliderNumber
          value={r.beginEnd[0]}
          onChange={(v) => patch({ beginEnd: [Math.min(v, r.beginEnd[1]), r.beginEnd[1]] })}
          min={0}
          max={1}
          step={0.01}
          precision={2}
          aria-label={t('params.refImage.begin')}
        />
      </Field>
      <Field label={t('params.refImage.end')}>
        <SliderNumber
          value={r.beginEnd[1]}
          onChange={(v) => patch({ beginEnd: [r.beginEnd[0], Math.max(v, r.beginEnd[0])] })}
          min={0}
          max={1}
          step={0.01}
          precision={2}
          aria-label={t('params.refImage.end')}
        />
      </Field>
      <div className="pp-row pp-row--end">
        <Button size="xs" variant="ghost" onClick={() => patch({ weight: 1, beginEnd: [0, 1], method: 'full' })}>
          {t('params.refImage.resetSettings')}
        </Button>
      </div>
    </div>
  );
}
