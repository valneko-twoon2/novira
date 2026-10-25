// "Upscale" accordion of the Upscaling tab.
import { Warning } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { modelsOfType, useModels } from '@/state/models';
import { useParams, type UpscaleParams } from '@/state/params';
import { useUi } from '@/state/ui';
import { Button, cx, Field, Section, Select, SliderNumber } from '@/ui';
import { useMainModel } from '../model/useMainModel';
import { UpscaleInitialImage } from './UpscaleInitialImage';
import { UpscalerChoice } from './UpscalerChoice';

const SCALES: UpscaleParams['scale'][] = [2, 4, 8];
const MAX_SIDE = 8192;
const NONE = '__none__';

export function UpscaleSection() {
  const u = useParams((s) => s.upscale);
  const setUpscale = useParams((s) => s.setUpscale);
  const models = useModels((s) => s.models);
  const main = useMainModel();
  const upscalers = modelsOfType(models, 'spandrel_image_to_image');
  const tiles = modelsOfType(models, 'controlnet', main?.base);
  const hasUpscaler = upscalers.some((m) => m.key === u.upscaleModelKey);
  const hasTile = tiles.some((m) => m.key === u.tileControlnetModelKey);
  const img = u.initialImage;
  const outW = img ? img.width * u.scale : 0;
  const outH = img ? img.height * u.scale : 0;
  const tooLarge = outW > MAX_SIDE || outH > MAX_SIDE;

  return (
    <Section title={t('params.upscale.title')} badges={[`${u.scale}x`]} defaultOpen>
      <div className="pp-upscale">
        <UpscaleInitialImage />
        <div className="pp-upscale__side">
          <Field label={t('params.upscale.model')} orientation="vertical">
            <Select
              value={hasUpscaler ? u.upscaleModelKey : null}
              onChange={(v) => setUpscale({ upscaleModelKey: v })}
              placeholder={upscalers.length ? t('params.upscale.selectModel') : t('params.upscale.noModels')}
              disabled={!upscalers.length}
              aria-label={t('params.upscale.model')}
              options={upscalers.map((m) => ({ value: m.key, label: m.name }))}
            />
          </Field>
          <Field label={t('params.upscale.scale')} orientation="vertical">
            <div className="pp-segment" role="radiogroup" aria-label={t('params.upscale.scale')}>
              {SCALES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={u.scale === s}
                  className={cx('pp-segment__item', u.scale === s && 'is-active')}
                  onClick={() => setUpscale({ scale: s })}
                >
                  {s}x
                </button>
              ))}
            </div>
          </Field>
          {img && (
            <div className={cx('pp-upscale__out', tooLarge && 'is-warning')}>
              {t('params.upscale.output', { width: outW, height: outH })}
            </div>
          )}
        </div>
      </div>
      {tooLarge && <InlineWarning text={t('params.upscale.tooLarge', { max: MAX_SIDE })} />}
      {!upscalers.length && <UpscalerChoice />}
      {!tiles.length && main && <InlineWarning text={t('params.upscale.missingTile')} withLink />}
      <Field label={t('params.upscale.creativity')} info={t('params.upscale.creativityInfo')}>
        <SliderNumber
          value={u.creativity}
          onChange={(v) => setUpscale({ creativity: Math.round(v) })}
          min={-10}
          max={10}
          step={1}
          marks={[-10, 0, 10]}
          aria-label={t('params.upscale.creativity')}
        />
      </Field>
      <Field label={t('params.upscale.structure')} info={t('params.upscale.structureInfo')}>
        <SliderNumber
          value={u.structure}
          onChange={(v) => setUpscale({ structure: Math.round(v) })}
          min={-10}
          max={10}
          step={1}
          marks={[-10, 0, 10]}
          disabled={!hasTile}
          aria-label={t('params.upscale.structure')}
        />
      </Field>
      <Field label={t('params.upscale.tileControlnet')}>
        <Select
          value={hasTile ? u.tileControlnetModelKey : null}
          onChange={(v) => setUpscale({ tileControlnetModelKey: v })}
          placeholder={tiles.length ? t('params.upscale.selectModel') : t('params.upscale.noModels')}
          disabled={!tiles.length}
          aria-label={t('params.upscale.tileControlnet')}
          options={tiles.map((m) => ({ value: m.key, label: m.name }))}
        />
      </Field>
      <Field label={t('params.upscale.postProcessing')} info={t('params.upscale.postProcessingInfo')}>
        <Select
          value={upscalers.some((m) => m.key === u.postProcessingModelKey) ? (u.postProcessingModelKey as string) : NONE}
          onChange={(v) => setUpscale({ postProcessingModelKey: v === NONE ? null : v })}
          aria-label={t('params.upscale.postProcessing')}
          options={[{ value: NONE, label: t('common.none') }, ...upscalers.map((m) => ({ value: m.key, label: m.name }))]}
        />
      </Field>
      {hasUpscaler || !upscalers.length ? null : <InlineWarning text={t('params.upscale.selectUpscaler')} />}
    </Section>
  );
}

function InlineWarning({ text, withLink }: { text: string; withLink?: boolean }) {
  return (
    <div className="pp-inline-warning" role="alert">
      <Warning size={14} weight="fill" />
      <span>{text}</span>
      {withLink && (
        <Button size="xs" variant="link" scheme="accent" onClick={() => useUi.getState().setTab('models')}>
          {t('params.upscale.openModels')}
        </Button>
      )}
    </div>
  );
}
