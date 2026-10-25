// Regional guidance settings: per-region prompts, reference images, auto-negative and mask style.
import { Plus, Trash } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { newId, type RegionalEntity, type RegionalRefImage } from '@/state/canvas';
import { useCanvasStore } from '@/state/canvasStoreContext';
import type { RefImageMethod } from '@/state/params';
import { Button, Field, IconButton, Select, SliderNumber, Switch, Textarea } from '@/ui';
import { METHOD_LABEL } from '../../names';
import { ImagePicker } from '../ImagePicker';
import { useCompatibleModels } from '../useCompatibleModels';
import { MaskStyleFields } from './MaskStyleFields';
import { OpacityField } from './OpacityField';

const METHODS: RefImageMethod[] = ['full', 'style', 'composition', 'style_strong', 'style_precise'];
const IP_TYPES = ['ip_adapter'] as const;

function RegionalRef({ entity, refImage, index }: { entity: RegionalEntity; refImage: RegionalRefImage; index: number }) {
  const update = useCanvasStore((s) => s.updateEntity);
  const { options } = useCompatibleModels([...IP_TYPES]);
  const patch = (p: Partial<RegionalRefImage>, history?: string) =>
    update(entity.id, { refImages: entity.refImages.map((r) => (r.id === refImage.id ? { ...r, ...p } : r)) }, { history: history ?? true });
  return (
    <div className="canvas-ref">
      <div className="canvas-ref__head">
        <span>{t('canvas.regional.refImageN', { number: index + 1 })}</span>
        <IconButton
          label={t('canvas.regional.removeRefImage')}
          icon={<Trash />}
          size="xs"
          onClick={() => update(entity.id, { refImages: entity.refImages.filter((r) => r.id !== refImage.id) })}
        />
      </div>
      <div className="canvas-ref__body">
        <ImagePicker url={refImage.imageUrl} onImage={(img) => patch({ imageName: img?.name ?? null, imageUrl: img?.url ?? null })} />
        <div className="canvas-ref__fields">
          <Select
            value={refImage.modelKey}
            options={options}
            placeholder={options.length ? t('canvas.ref.selectModel') : t('canvas.ref.noModels')}
            onChange={(modelKey) => patch({ modelKey })}
            aria-label={t('common.model')}
          />
          <Select<RefImageMethod>
            value={refImage.method}
            options={METHODS.map((m) => ({ value: m, label: t(METHOD_LABEL[m]) }))}
            onChange={(method) => patch({ method })}
            aria-label={t('canvas.ref.method')}
          />
          <SliderNumber
            value={refImage.weight}
            onChange={(weight) => patch({ weight }, `rw:${refImage.id}`)}
            min={-1}
            max={2}
            step={0.01}
            precision={2}
            aria-label={t('canvas.ref.weight')}
          />
        </div>
      </div>
    </div>
  );
}

export function RegionalSettings({ entity }: { entity: RegionalEntity }) {
  const update = useCanvasStore((s) => s.updateEntity);
  const id = entity.id;
  const addRef = () =>
    update(id, { refImages: [...entity.refImages, { id: newId('rref'), imageName: null, imageUrl: null, modelKey: null, weight: 1, method: 'full' }] });
  return (
    <div className="canvas-settings">
      {entity.positivePrompt !== null && (
        <div className="canvas-prompt">
          <Textarea
            value={entity.positivePrompt}
            placeholder={t('canvas.regional.positivePlaceholder')}
            aria-label={t('canvas.regional.positivePrompt')}
            rows={2}
            onChange={(e) => update(id, { positivePrompt: e.target.value }, { history: `pp:${id}` })}
          />
          <IconButton label={t('canvas.regional.removePrompt')} icon={<Trash />} size="xs" onClick={() => update(id, { positivePrompt: null })} />
        </div>
      )}
      {entity.negativePrompt !== null && (
        <div className="canvas-prompt canvas-prompt--negative">
          <Textarea
            value={entity.negativePrompt}
            placeholder={t('canvas.regional.negativePlaceholder')}
            aria-label={t('canvas.regional.negativePrompt')}
            rows={2}
            onChange={(e) => update(id, { negativePrompt: e.target.value }, { history: `np:${id}` })}
          />
          <IconButton label={t('canvas.regional.removePrompt')} icon={<Trash />} size="xs" onClick={() => update(id, { negativePrompt: null })} />
        </div>
      )}
      {entity.refImages.map((r, i) => (
        <RegionalRef key={r.id} entity={entity} refImage={r} index={i} />
      ))}
      <div className="canvas-settings__buttons">
        <Button size="xs" leftIcon={<Plus />} disabled={entity.positivePrompt !== null} onClick={() => update(id, { positivePrompt: '' })}>
          {t('canvas.regional.addPositive')}
        </Button>
        <Button size="xs" leftIcon={<Plus />} disabled={entity.negativePrompt !== null} onClick={() => update(id, { negativePrompt: '' })}>
          {t('canvas.regional.addNegative')}
        </Button>
        <Button size="xs" leftIcon={<Plus />} onClick={addRef}>
          {t('canvas.regional.addRefImage')}
        </Button>
      </div>
      <Field label={t('canvas.regional.autoNegative')}>
        <Switch checked={entity.autoNegative} onChange={(autoNegative) => update(id, { autoNegative })} aria-label={t('canvas.regional.autoNegative')} />
      </Field>
      <MaskStyleFields entity={entity} />
      <OpacityField entity={entity} />
    </div>
  );
}
