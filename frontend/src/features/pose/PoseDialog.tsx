// "Make a pose": a stick figure the user bends into the pose they want. It is drawn the way the OpenPose preprocessor
// draws one, saved as a picture and put on the canvas as a control layer, so the next generation follows the pose.
import { ArrowCounterClockwise, FlipHorizontal, WarningCircle } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { useCanvas } from '@/state/canvas';
import { usePoseDialog } from '@/state/dialogs/pose';
import { useGallery } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';
import { findModel, useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { toast } from '@/state/toasts';
import { Button, Modal, Select } from '@/ui';
import { PoseStage } from './PoseStage';
import { pickPoseModel, POSE_CONTROL } from '@/state/poseSkeleton';
import { PRESETS, PRESET_NAMES, copyPose, drawPose, mirrorPose, type Pose, type PresetName } from './poseModel';
import './pose.css';

const SIZES = { portrait: { width: 832, height: 1216 }, landscape: { width: 1216, height: 832 }, square: { width: 1024, height: 1024 } } as const;
type SizeChoice = keyof typeof SIZES | 'canvas';

/** The pose as a PNG of the given size: coloured skeleton on black. */
function poseBlob(pose: Pose, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('no canvas'));
  drawPose(ctx, pose, width, height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('empty image'))), 'image/png'));
}

export function PoseDialog() {
  const isOpen = usePoseDialog((s) => s.isOpen);
  const close = usePoseDialog((s) => s.close);
  const target = usePoseDialog((s) => s.target);
  const bbox = useCanvas((s) => s.bbox);
  const models = useModels((s) => s.models);
  const mainKey = useParams((s) => s.modelKey);

  const [pose, setPose] = useState<Pose>(() => copyPose(PRESETS.standing));
  const [preset, setPreset] = useState<PresetName>('standing');
  const [size, setSize] = useState<SizeChoice>('canvas');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A target (a comic panel) starts from its own pose and draws at its own size; the canvas choice does not apply.
  useEffect(() => {
    if (target) setPose(target.initial ? copyPose(target.initial) : copyPose(PRESETS.standing));
  }, [target]);

  const { width, height } = target ?? (size === 'canvas' ? { width: bbox.width, height: bbox.height } : SIZES[size]);
  const sizeOptions = useMemo(
    () => [
      { value: 'canvas' as const, label: t('pose.size.canvas', { width: bbox.width, height: bbox.height }) },
      { value: 'portrait' as const, label: t('pose.size.portrait') },
      { value: 'landscape' as const, label: t('pose.size.landscape') },
      { value: 'square' as const, label: t('pose.size.square') },
    ],
    [bbox.width, bbox.height],
  );

  const choosePreset = (name: PresetName) => {
    setPreset(name);
    setPose(copyPose(PRESETS[name]));
  };

  const use = async () => {
    setSaving(true);
    setError(null);
    try {
      const blob = await poseBlob(pose, width, height);
      if (target) {
        await target.onUse(copyPose(pose), blob);
        close();
        return;
      }
      const image = await backend.uploadImage(blob, { boardId: autoAddBoardId(), category: 'control' });
      useGallery.getState().addImage(image);
      const canvas = useCanvas.getState();
      const empty = canvas.entities.length === 0;
      canvas.importImage(image, empty ? 'newCanvasControl' : 'control');
      // The new control layer is the last one added; give it the OpenPose model when one is installed.
      const layers = useCanvas.getState().entities.filter((e) => e.type === 'control');
      const layer = layers[layers.length - 1];
      const model = pickPoseModel(models, findModel(mainKey)?.base ?? null);
      if (layer) useCanvas.getState().updateEntity(layer.id, { ...POSE_CONTROL, beginEnd: [...POSE_CONTROL.beginEnd], ...(model ? { modelKey: model.key } : {}) });
      if (layer && model) toast({ status: 'success', title: t('pose.saved'), description: t('pose.modelSet', { model: model.name }) });
      else toast({ status: 'warning', title: t('pose.saved'), description: t('pose.noModel') });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={isOpen} onOpenChange={(o) => !o && !saving && close()} size="xl" closeLabel={t('common.close')} title={target ? t('comic.pose.title') : t('pose.title')}>
      <div className="pose" data-testid="pose-dialog">
        <div className="pose__surface">
          <PoseStage pose={pose} width={width} height={height} onChange={setPose} />
        </div>
        <aside className="pose__side">
          <p className="pose__hint">{t('pose.hint')}</p>
          <label className="pose__field">
            <span>{t('pose.preset')}</span>
            <Select value={preset} onChange={choosePreset} options={PRESET_NAMES.map((n) => ({ value: n, label: t(`pose.preset.${n}`) }))} aria-label={t('pose.preset')} />
          </label>
          {!target && (
            <label className="pose__field">
              <span>{t('pose.size')}</span>
              <Select value={size} onChange={setSize} options={sizeOptions} aria-label={t('pose.size')} />
            </label>
          )}
          <div className="pose__row">
            <Button size="sm" variant="outline" leftIcon={<FlipHorizontal size={14} />} onClick={() => setPose(mirrorPose(pose))} data-testid="pose-mirror">
              {t('pose.mirror')}
            </Button>
            <Button size="sm" variant="outline" leftIcon={<ArrowCounterClockwise size={14} />} onClick={() => setPose(copyPose(PRESETS[preset]))} data-testid="pose-reset">
              {t('pose.reset')}
            </Button>
          </div>
          {error && (
            <p className="pose__error" role="alert">
              <WarningCircle size={14} /> {t('pose.failed')}: {error}
            </p>
          )}
          <Button variant="solid" scheme="invoke" isLoading={saving} onClick={() => void use()} data-testid="pose-use">
            {saving ? t('pose.saving') : target ? t('comic.pose.use') : t('pose.use')}
          </Button>
        </aside>
      </div>
    </Modal>
  );
}
