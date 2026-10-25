// Global reference images (IP-Adapter) from the shared params store, shown as the top layer group.
import { Eye, EyeSlash, ImageSquare, Plus, Trash } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useCanvasStore } from '@/state/canvasStoreContext';
import { useParams, type RefImage, type RefImageMethod } from '@/state/params';
import { cx, Field, IconButton, Select, SliderNumber } from '@/ui';
import { METHOD_LABEL } from '../names';
import { GroupShell } from './EntityGroup';
import { ImagePicker } from './ImagePicker';
import { useCompatibleModels } from './useCompatibleModels';

const METHODS: RefImageMethod[] = ['full', 'style', 'composition', 'style_strong', 'style_precise'];
const IP_TYPES = ['ip_adapter'] as const;

function RefImageSettings({ refImage }: { refImage: RefImage }) {
  const update = useParams((s) => s.updateRefImage);
  const { options } = useCompatibleModels([...IP_TYPES]);
  const id = refImage.id;
  return (
    <div className="canvas-settings">
      <ImagePicker url={refImage.imageUrl} onImage={(img) => update(id, { imageName: img?.name ?? null, imageUrl: img?.url ?? null })} />
      <Field label={t('common.model')}>
        <Select
          value={refImage.modelKey}
          options={options}
          placeholder={options.length ? t('canvas.ref.selectModel') : t('canvas.ref.noModels')}
          onChange={(modelKey) => update(id, { modelKey })}
          aria-label={t('common.model')}
        />
      </Field>
      <Field label={t('canvas.ref.method')}>
        <Select<RefImageMethod>
          value={refImage.method}
          options={METHODS.map((m) => ({ value: m, label: t(METHOD_LABEL[m]) }))}
          onChange={(method) => update(id, { method })}
          aria-label={t('canvas.ref.method')}
        />
      </Field>
      <Field label={t('canvas.ref.weight')}>
        <SliderNumber value={refImage.weight} onChange={(weight) => update(id, { weight })} min={-1} max={2} step={0.01} precision={2} aria-label={t('canvas.ref.weight')} />
      </Field>
      <Field label={t('canvas.control.begin')}>
        <SliderNumber
          value={refImage.beginEnd[0]}
          onChange={(v) => update(id, { beginEnd: [Math.min(v, refImage.beginEnd[1]), refImage.beginEnd[1]] })}
          min={0}
          max={1}
          step={0.01}
          precision={2}
          aria-label={t('canvas.control.begin')}
        />
      </Field>
      <Field label={t('canvas.control.end')}>
        <SliderNumber
          value={refImage.beginEnd[1]}
          onChange={(v) => update(id, { beginEnd: [refImage.beginEnd[0], Math.max(v, refImage.beginEnd[0])] })}
          min={0}
          max={1}
          step={0.01}
          precision={2}
          aria-label={t('canvas.control.end')}
        />
      </Field>
    </div>
  );
}

function RefImageRow({ refImage, index }: { refImage: RefImage; index: number }) {
  const selected = useCanvasStore((s) => s.selectedEntityId === refImage.id);
  const select = useCanvasStore((s) => s.select);
  const update = useParams((s) => s.updateRefImage);
  const remove = useParams((s) => s.removeRefImage);
  return (
    <div className={cx('canvas-entity', selected && 'is-selected', !refImage.isEnabled && 'is-disabled')}>
      <div className="canvas-entity__row" role="button" tabIndex={0} aria-pressed={selected} onClick={() => select(refImage.id)}>
        <span className="canvas-thumb canvas-thumb--img">
          {refImage.imageUrl ? <img src={refImage.imageUrl} alt="" draggable={false} /> : <ImageSquare size={18} />}
        </span>
        <span className="canvas-entity__name">{t('canvas.ref.defaultName', { number: index + 1 })}</span>
        <span className="canvas-entity__actions">
          <IconButton
            label={refImage.isEnabled ? t('canvas.entity.hide') : t('canvas.entity.show')}
            icon={refImage.isEnabled ? <Eye /> : <EyeSlash />}
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              update(refImage.id, { isEnabled: !refImage.isEnabled });
            }}
          />
          <IconButton
            label={t('common.delete')}
            icon={<Trash />}
            size="xs"
            className="canvas-entity__hover"
            onClick={(e) => {
              e.stopPropagation();
              remove(refImage.id);
            }}
          />
        </span>
      </div>
      {selected && <RefImageSettings refImage={refImage} />}
    </div>
  );
}

export function RefImagesGroup() {
  const refs = useParams((s) => s.refImages);
  const add = useParams((s) => s.addRefImage);
  const select = useCanvasStore((s) => s.select);
  if (!refs.length) return null;
  return (
    <GroupShell
      title={t('canvas.groups.refImages')}
      count={refs.length}
      testId="canvas-group-ref"
      actions={<IconButton label={t('canvas.add.globalRef')} icon={<Plus />} size="xs" onClick={() => select(add())} />}
    >
      <div className="canvas-group__list">
        {refs.map((r, i) => (
          <RefImageRow key={r.id} refImage={r} index={i} />
        ))}
      </div>
    </GroupShell>
  );
}
