// Aspect ratio select with swap / lock / optimal-size buttons, plus the aspect preview box.
import { ArrowsLeftRight, LockSimple, LockSimpleOpen, Sparkle } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { ASPECT_RATIOS, useParams, type AspectRatioId } from '@/state/params';
import { Field, IconButton, Select } from '@/ui';
import { optimalDimension } from '../labels';
import { useMainModel } from '../model/useMainModel';

export function aspectLabel(id: AspectRatioId): string {
  return id === 'free' ? t('params.image.aspectFree') : id;
}

export function AspectControls() {
  const aspect = useParams((s) => s.aspectRatio);
  const locked = useParams((s) => s.aspectLocked);
  const p = useParams.getState;
  const set = useParams((s) => s.set);
  const base = useMainModel()?.base;
  return (
    <Field label={t('params.image.aspect')}>
      <Select
        value={aspect}
        onChange={(v) => p().setAspectRatio(v)}
        aria-label={t('params.image.aspect')}
        options={ASPECT_RATIOS.map((a) => ({ value: a.id, label: aspectLabel(a.id) }))}
      />
      <IconButton label={t('params.image.swap')} icon={<ArrowsLeftRight />} onClick={() => p().swapDimensions()} />
      <IconButton
        label={locked ? t('params.image.unlock') : t('params.image.lock')}
        icon={locked ? <LockSimple /> : <LockSimpleOpen />}
        isActive={locked}
        onClick={() => set({ aspectLocked: !locked })}
      />
      <IconButton label={t('params.image.optimal')} icon={<Sparkle />} onClick={() => p().optimizeSize(optimalDimension(base))} />
    </Field>
  );
}

export function AspectPreview() {
  const width = useParams((s) => s.width);
  const height = useParams((s) => s.height);
  const ratio = width / height;
  const w = ratio >= 1 ? 100 : ratio * 100;
  const h = ratio >= 1 ? 100 / ratio : 100;
  return (
    <div className="pp-aspect" aria-hidden>
      <div className="pp-aspect__box" style={{ width: `${w}%`, height: `${h}%` }}>
        <span>
          {width}×{height}
        </span>
      </div>
    </div>
  );
}
