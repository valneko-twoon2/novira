import { beforeEach, describe, expect, it } from 'vitest';
import { useCanvas, type PoseObject } from '@/state/canvas';
import { jointBounds } from '@/state/pose/pose';
import { placePose } from '@/state/pose/poseSpec';
import { applyPose3d, pose3dSource } from './pose3dActions';

const c = () => useCanvas.getState();
const baked = (offset = 0) => ({ points: Array.from({ length: 36 }, (_, i) => i + offset), depth: Array.from({ length: 18 }, (_, i) => i) });
const poses = () => c().entities.flatMap((e) => e.objects.filter((o): o is PoseObject => o.kind === 'pose'));

describe('the 3D pose editor source and result', () => {
  beforeEach(() => {
    c().replaceEntities([]);
    c().select(null);
    c().setBbox({ x: 0, y: 0, width: 512, height: 512 }, { history: false, syncParams: false });
  });

  it('starts from the first pose of the selected control layer', () => {
    const id = c().addEntity('control');
    const pose = placePose('p1', {}, { x: 0, y: 0, width: 512, height: 512 }, 4);
    c().addObject(id, pose);
    c().select(id);
    expect(pose3dSource()).toEqual({ entityId: id, pose });
  });

  it('starts from a standing figure in the middle of the box when there is no pose, on the selected layer or none', () => {
    const none = pose3dSource();
    expect(none.entityId).toBeNull();
    const b = jointBounds(none.pose)!;
    expect(b.x + b.width / 2).toBeCloseTo(256, 0);
    const id = c().addEntity('control', { x: 100, y: 0 });
    c().select(id);
    const onLayer = pose3dSource();
    expect(onLayer.entityId).toBe(id);
    // Layer space starts at the layer's position, so the figure is 100 to the left of where it is in the box.
    expect(jointBounds(onLayer.pose)!.x + jointBounds(onLayer.pose)!.width / 2).toBeCloseTo(156, 0);
  });

  it('does not use a locked layer or a layer that is not a control layer', () => {
    const id = c().addEntity('control');
    c().addObject(id, placePose('p1', {}, { x: 0, y: 0, width: 512, height: 512 }, 4));
    c().updateEntity(id, { isLocked: true });
    c().select(id);
    expect(pose3dSource().entityId).toBeNull();
    c().select(c().addEntity('raster'));
    expect(pose3dSource().entityId).toBeNull();
  });

  it('replaces the pose in place with the new joints and depth, keeping its id, hidden joints and width, in one undo step', () => {
    const id = c().addEntity('control');
    const pose: PoseObject = { ...placePose('p1', {}, { x: 0, y: 0, width: 512, height: 512 }, 4), hidden: [16] };
    c().addObject(id, pose);
    c().select(id);
    const past = c().past.length;
    applyPose3d({ entityId: id, pose }, baked());
    expect(poses()).toHaveLength(1);
    expect(poses()[0]).toMatchObject({ id: 'p1', hidden: [16], width: 4, points: baked().points, depth: baked().depth });
    expect(c().past.length).toBe(past + 1);
  });

  it('makes a pose layer for a figure that was not on the canvas, and adds to an existing layer without a pose', () => {
    const source = pose3dSource();
    applyPose3d(source, baked());
    expect(c().entities.filter((e) => e.type === 'control')).toHaveLength(1);
    expect(poses()).toHaveLength(1);
    expect(poses()[0]!.depth).toEqual(baked().depth);
    const id = c().addEntity('control');
    c().select(id);
    applyPose3d(pose3dSource(), baked(1));
    expect(c().entities.find((e) => e.id === id)!.objects).toHaveLength(1);
  });
});
