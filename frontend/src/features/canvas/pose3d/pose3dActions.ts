// What the 3D pose editor starts from and where its result goes: the first pose of the selected control layer, or a
// standing figure in the generation box when there is none.
import { newId, useCanvas, type CanvasStore, type PoseObject } from '@/state/canvas';
import { addPoseLayer } from '../actions';
import { poseLineWidth, standingPose } from '@/state/pose/pose';

/** The pose to edit, and the layer it is on (null when it is only a standing figure that is not on the canvas yet). */
export interface Pose3dSource {
  entityId: string | null;
  pose: PoseObject;
}

export function pose3dSource(store: CanvasStore = useCanvas): Pose3dSource {
  const s = store.getState();
  const selected = s.entities.find((x) => x.id === s.selectedEntityId);
  if (selected?.type === 'control' && !selected.isLocked) {
    const pose = selected.objects.find((o): o is PoseObject => o.kind === 'pose');
    if (pose) return { entityId: selected.id, pose };
  }
  const b = s.bbox;
  const layer = selected?.type === 'control' && !selected.isLocked ? selected : undefined;
  // Layer space starts at the layer's own position; a new layer starts at the origin.
  const center = { x: b.x + b.width / 2 - (layer?.x ?? 0), y: b.y + b.height / 2 - (layer?.y ?? 0) };
  const pose = standingPose(newId('pose'), center, b.height * 0.85, poseLineWidth(b));
  return { entityId: layer?.id ?? null, pose };
}

/**
 * Put the edited pose (its flat joints and depth) where it came from: in place of the old pose of its layer, or as a new
 * pose on the selected control layer or a new one. One undo step on a layer that exists.
 */
export function applyPose3d(source: Pose3dSource, baked: { points: number[]; depth: number[] }, store: CanvasStore = useCanvas) {
  const s = store.getState();
  const next: PoseObject = { ...source.pose, points: baked.points, depth: baked.depth };
  const entity = source.entityId ? s.entities.find((e) => e.id === source.entityId) : undefined;
  if (!entity) {
    const id = addPoseLayer(store);
    store.getState().addObject(id, next);
    store.getState().select(id);
    return;
  }
  const has = entity.objects.some((o) => o.id === source.pose.id);
  s.updateEntity(entity.id, { objects: has ? entity.objects.map((o) => (o.id === source.pose.id ? next : o)) : [...entity.objects, next] });
  s.select(entity.id);
}
