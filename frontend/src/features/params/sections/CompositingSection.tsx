// "Compositing" accordion (Canvas tab): coherence pass, mask blur, infill.
import { t } from '@/i18n';
import { useParams, type CoherenceMode, type InfillMethod } from '@/state/params';
import { Field, Section, Select, SliderNumber, TextInput } from '@/ui';
import { coherenceLabel, infillLabel } from '../labels';

const MODES: CoherenceMode[] = ['Gaussian Blur', 'Box Blur', 'Staged'];
const INFILLS: InfillMethod[] = ['patchmatch', 'lama', 'cv2', 'color', 'tile'];
const COLORS = ['black', 'white', 'gray'] as const;

function colorLabel(c: (typeof COLORS)[number]): string {
  if (c === 'black') return t('params.compositing.colorBlack');
  if (c === 'white') return t('params.compositing.colorWhite');
  return t('params.compositing.colorGray');
}

export function CompositingSection() {
  const coherenceMode = useParams((s) => s.coherenceMode);
  const coherenceEdgeSize = useParams((s) => s.coherenceEdgeSize);
  const coherenceMinDenoise = useParams((s) => s.coherenceMinDenoise);
  const maskBlur = useParams((s) => s.maskBlur);
  const infillMethod = useParams((s) => s.infillMethod);
  const infillTileSize = useParams((s) => s.infillTileSize);
  const infillColor = useParams((s) => s.infillColor);
  const set = useParams((s) => s.set);
  return (
    <Section title={t('params.compositing.title')} defaultOpen={false}>
      <div className="pp-subhead">{t('params.compositing.coherence')}</div>
      <Field label={t('params.compositing.mode.label')} info={t('params.compositing.modeInfo')}>
        <Select<CoherenceMode>
          value={coherenceMode}
          onChange={(v) => set({ coherenceMode: v })}
          aria-label={t('params.compositing.mode.label')}
          options={MODES.map((m) => ({ value: m, label: coherenceLabel(m) }))}
        />
      </Field>
      <Field label={t('params.compositing.edgeSize')}>
        <SliderNumber
          value={coherenceEdgeSize}
          onChange={(v) => set({ coherenceEdgeSize: Math.round(v) })}
          min={0}
          max={128}
          step={8}
          marks={[0, 64, 128]}
          aria-label={t('params.compositing.edgeSize')}
        />
      </Field>
      <Field label={t('params.compositing.minDenoise')}>
        <SliderNumber
          value={coherenceMinDenoise}
          onChange={(v) => set({ coherenceMinDenoise: v })}
          min={0}
          max={1}
          step={0.01}
          precision={2}
          marks={[0, 0.5, 1]}
          aria-label={t('params.compositing.minDenoise')}
        />
      </Field>
      <Field label={t('params.compositing.maskBlur')}>
        <SliderNumber
          value={maskBlur}
          onChange={(v) => set({ maskBlur: Math.round(v) })}
          min={0}
          max={128}
          step={1}
          marks={[0, 64, 128]}
          aria-label={t('params.compositing.maskBlur')}
        />
      </Field>
      <div className="pp-subhead">{t('params.compositing.infillTitle')}</div>
      <Field label={t('params.compositing.infillMethod')}>
        <Select<InfillMethod>
          value={infillMethod}
          onChange={(v) => set({ infillMethod: v })}
          aria-label={t('params.compositing.infillMethod')}
          options={INFILLS.map((m) => ({ value: m, label: infillLabel(m) }))}
        />
      </Field>
      {infillMethod === 'tile' && (
        <Field label={t('params.compositing.tileSize')}>
          <SliderNumber
            value={infillTileSize}
            onChange={(v) => set({ infillTileSize: Math.round(v) })}
            min={16}
            max={64}
            step={8}
            marks={[16, 32, 64]}
            aria-label={t('params.compositing.tileSize')}
          />
        </Field>
      )}
      {infillMethod === 'color' && (
        <Field label={t('params.compositing.color')}>
          <div className="pp-swatches">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`pp-swatch pp-swatch--${c}${infillColor === c ? ' is-active' : ''}`}
                aria-label={colorLabel(c)}
                title={colorLabel(c)}
                onClick={() => set({ infillColor: c })}
              />
            ))}
            <TextInput
              className="pp-swatches__input"
              value={infillColor}
              onChange={(e) => set({ infillColor: e.target.value })}
              aria-label={t('params.compositing.color')}
            />
          </div>
        </Field>
      )}
    </Section>
  );
}
