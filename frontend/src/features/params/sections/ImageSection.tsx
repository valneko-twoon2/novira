// "Image" accordion: aspect ratio, width/height, (canvas) denoising strength, seed.
import { t } from '@/i18n';
import { useParams } from '@/state/params';
import type { TabName } from '@/state/ui';
import { Field, Section, SliderNumber } from '@/ui';
import { RecommendedHint } from '../model/RecommendedHint';
import { AspectControls, aspectLabel, AspectPreview } from './AspectControls';

const SIZE_MARKS = [64, 2048, 4096];

export function ImageSection({ tab }: { tab: TabName }) {
  const width = useParams((s) => s.width);
  const height = useParams((s) => s.height);
  const aspect = useParams((s) => s.aspectRatio);
  const strength = useParams((s) => s.strength);
  const random = useParams((s) => s.shouldRandomizeSeed);
  const seed = useParams((s) => s.seed);
  const set = useParams((s) => s.set);
  const setDimension = useParams((s) => s.setDimension);
  const isCanvas = tab === 'canvas';
  const badges = [`${width}×${height}`, aspect !== 'free' ? aspectLabel(aspect) : null, random ? null : t('params.seed.badge', { seed })];
  return (
    <Section title={t('params.image.title')} badges={badges} defaultOpen>
      {isCanvas && <div className="pp-subhead">{t('params.image.bboxHint')}</div>}
      <AspectControls />
      <div className="pp-size">
        <div className="pp-size__controls">
          <Field label={isCanvas ? t('params.image.bboxWidth') : t('common.width')}>
            <SliderNumber
              value={width}
              onChange={(v) => setDimension('width', v)}
              min={64}
              max={4096}
              step={8}
              marks={SIZE_MARKS}
              aria-label={t('common.width')}
            />
          </Field>
          <RecommendedHint k="width" />
          <Field label={isCanvas ? t('params.image.bboxHeight') : t('common.height')}>
            <SliderNumber
              value={height}
              onChange={(v) => setDimension('height', v)}
              min={64}
              max={4096}
              step={8}
              marks={SIZE_MARKS}
              aria-label={t('common.height')}
            />
          </Field>
          <RecommendedHint k="height" />
        </div>
        <AspectPreview />
      </div>
      {isCanvas && (
        <Field label={t('params.image.strength')} info={t('params.image.strengthInfo')}>
          <SliderNumber
            value={strength}
            onChange={(v) => set({ strength: v })}
            min={0}
            max={1}
            step={0.01}
            precision={2}
            marks={[0, 0.5, 1]}
            aria-label={t('params.image.strength')}
          />
        </Field>
      )}
    </Section>
  );
}
