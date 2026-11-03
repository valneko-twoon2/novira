// Pose tool options: a new random pose for the selected control layer, and a batch that generates one picture per random pose.
import { Cube, ImageSquare, Lightning, Shuffle } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { t } from '@/i18n';
import { useCanvasStore, useCanvasStoreApi } from '@/state/canvasStoreContext';
import { usePose3dDialog } from '@/state/dialogs/pose3d';
import { quickRunTool } from '@/state/imageTools/actions';
import { selectedStill, uploadPicture } from '@/state/imageTools/pickPicture';
import { IconButton, NumberInput, TOOLBAR_BUTTON_SIZE } from '@/ui';
import { generateWithRandomPoses, MAX_POSE_BATCH, randomizePoses } from '../actions';
import { PosePresetPicker } from './PosePresetPicker';

export function PoseControls() {
  const tool = useCanvasStore((s) => s.tool);
  const store = useCanvasStoreApi();
  const [count, setCount] = useState(4);
  const fileInput = useRef<HTMLInputElement>(null);
  // Reads the poses of the picture selected in the gallery, or of a file picked here; the viewer shows the result.
  const readPoses = (name: string) => void quickRunTool('pose', name);
  if (tool !== 'pose') return null;
  return (
    <div className="canvas-width">
      <PosePresetPicker />
      <IconButton size={TOOLBAR_BUTTON_SIZE}
        label={`${t('canvas.pose.random')} (R)`}
        icon={<Shuffle />}
        onClick={() => randomizePoses(store.getState().selectedEntityId, undefined, store)}
        data-testid="canvas-pose-random"
      />
      <IconButton size={TOOLBAR_BUTTON_SIZE}
        label={t('canvas.pose3d.menu')}
        icon={<Cube />}
        onClick={() => usePose3dDialog.getState().show()}
        data-testid="canvas-pose-3d"
      />
      <IconButton size={TOOLBAR_BUTTON_SIZE}
        label={t('canvas.poseFromImage.menu')}
        icon={<ImageSquare />}
        onClick={() => {
          const picked = selectedStill();
          if (picked) readPoses(picked);
          else fileInput.current?.click();
        }}
        data-testid="canvas-pose-from-image"
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        data-testid="canvas-pose-from-image-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void uploadPicture(file).then((name) => name && readPoses(name));
        }}
      />
      <NumberInput value={count} onChange={setCount} min={1} max={MAX_POSE_BATCH} className="canvas-width__input" aria-label={t('canvas.pose.batchCount')} />
      <IconButton size={TOOLBAR_BUTTON_SIZE}
        label={t('canvas.pose.batch', { count })}
        icon={<Lightning />}
        onClick={() => void generateWithRandomPoses(count)}
        data-testid="canvas-pose-batch"
      />
    </div>
  );
}
