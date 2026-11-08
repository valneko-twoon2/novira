// The settings of each picture tool in the band. Changes are kept at once: the next run from the picture menu uses
// them. The face fix's model and prompt start from the picture's own and are kept only for that picture.
import type { ReactNode } from 'react';
import type { ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { cutoutModels } from '@/state/comfy/cutout';
import { faceDetectors } from '@/state/comfy/faceFix';
import { useToolBand } from '@/state/imageTools/band';
import { faceFixModel, faceFixPrompt } from '@/state/imageTools/request';
import { useImageToolSettings } from '@/state/imageTools/settings';
import { TOOL_RANGES, type ImageToolId } from '@/state/imageTools/tools';
import { checkpointModels, useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { InfoMark, ModelPicker, Select, SliderNumber, TextInput } from '@/ui';

function Field({ label, info, wide, children }: { label: string; info?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? 'toolband__field toolband__field--wide' : 'toolband__field'}>
      <span className="toolband__label">{label}</span>
      {info && <InfoMark info={info} />}
      {children}
    </div>
  );
}

function FaceFixFields({ image }: { image: ImageDTO }) {
  const s = useImageToolSettings((x) => x.values.facefix);
  const set = useImageToolSettings((x) => x.set);
  const face = useToolBand((x) => x.face);
  const setFace = useToolBand((x) => x.setFace);
  const defs = useComfyNodes((x) => x.defs);
  const models = useModels((x) => x.models);
  const formModel = useParams((x) => x.modelKey);
  const detectors = faceDetectors(defs);
  const mains = checkpointModels(models);
  return (
    <>
      <Field label={t('facefix.model')}>
        <ModelPicker
          models={mains}
          value={faceFixModel(image, face, { models }, formModel)}
          onPick={(m) => setFace({ modelKey: m.key })}
          placeholder={t('params.model.noModels')}
          disabled={!mains.length}
          aria-label={t('facefix.model')}
          testId="tool-band-face-model"
        />
      </Field>
      <Field label={t('facefix.detector')}>
        <Select
          className="toolband__select"
          value={s.detector && detectors.includes(s.detector) ? s.detector : (detectors[0] ?? null)}
          onChange={(detector) => set('facefix', { detector })}
          options={detectors.map((d) => ({ value: d, label: d }))}
          aria-label={t('facefix.detector')}
        />
      </Field>
      <Field label={t('facefix.prompt')} info={t('facefix.promptHint')} wide>
        <TextInput value={faceFixPrompt(image, face)} onChange={(e) => setFace({ prompt: e.target.value })} aria-label={t('facefix.prompt')} data-testid="tool-band-face-prompt" />
      </Field>
      <Field label={t('facefix.strength')} info={t('facefix.strengthHint')}>
        <SliderNumber value={s.strength} onChange={(strength) => set('facefix', { strength })} {...TOOL_RANGES.faceStrength} precision={2} aria-label={t('facefix.strength')} />
      </Field>
      <Field label={t('facefix.sensitivity')} info={t('facefix.sensitivityHint')}>
        <SliderNumber value={s.sensitivity} onChange={(sensitivity) => set('facefix', { sensitivity })} {...TOOL_RANGES.faceSensitivity} precision={2} aria-label={t('facefix.sensitivity')} />
      </Field>
    </>
  );
}

function CutoutFields() {
  const s = useImageToolSettings((x) => x.values.cutout);
  const set = useImageToolSettings((x) => x.set);
  const models = cutoutModels(useComfyNodes((x) => x.defs));
  return (
    <>
      <Field label={t('cutout.model')}>
        <Select
          className="toolband__select"
          value={s.model && models.includes(s.model) ? s.model : (models[0] ?? null)}
          onChange={(model) => set('cutout', { model })}
          options={models.map((m) => ({ value: m, label: m }))}
          aria-label={t('cutout.model')}
        />
      </Field>
      <Field label={t('cutout.background')}>
        <Select
          className="toolband__select"
          value={s.background}
          onChange={(v) => set('cutout', { background: v === 'white' ? 'white' : 'alpha' })}
          options={[
            { value: 'alpha', label: t('cutout.background.alpha') },
            { value: 'white', label: t('cutout.background.white') },
          ]}
          aria-label={t('cutout.background')}
          data-testid="tool-band-cutout-background"
        />
      </Field>
      <Field label={t('cutout.sensitivity')} info={t('cutout.sensitivityHint')}>
        <SliderNumber value={s.sensitivity} onChange={(sensitivity) => set('cutout', { sensitivity })} {...TOOL_RANGES.cutoutSensitivity} precision={2} aria-label={t('cutout.sensitivity')} />
      </Field>
      <Field label={t('cutout.edge')} info={t('cutout.edgeHint')}>
        <SliderNumber value={s.edge} onChange={(edge) => set('cutout', { edge })} {...TOOL_RANGES.cutoutEdge} precision={0} aria-label={t('cutout.edge')} />
      </Field>
    </>
  );
}

function CaptionFields() {
  const style = useImageToolSettings((x) => x.values.caption.style);
  const set = useImageToolSettings((x) => x.set);
  return (
    <Field label={t('caption.style')}>
      <Select
        className="toolband__select"
        value={style}
        onChange={(v) => set('caption', { style: v === 'sentence' ? 'sentence' : 'tags' })}
        options={[
          { value: 'tags', label: t('caption.style.tags') },
          { value: 'sentence', label: t('caption.style.sentence') },
        ]}
        aria-label={t('caption.style')}
        data-testid="tool-band-caption-style"
      />
    </Field>
  );
}

const FIELDS: Record<ImageToolId, (image: ImageDTO) => ReactNode> = {
  facefix: (image) => <FaceFixFields image={image} />,
  cutout: () => <CutoutFields />,
  caption: () => <CaptionFields />,
  // Reading the poses has nothing to choose.
  pose: () => null,
};

export function ToolFields({ tool, image }: { tool: ImageToolId; image: ImageDTO }) {
  return FIELDS[tool](image);
}
