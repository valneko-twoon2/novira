// OpenPose skeletons: placing, random poses, dragging joints, mirroring, turning and drawing.
import { describe, expect, it } from 'vitest';
import { recordingContext } from '@/backend/mock/canvas2dRecorder.testkit';
import { POSE_JOINTS, useCanvas, type PoseObject } from '@/state/canvas';
import { POSE_LIMBS } from '@/state/poseSkeleton';
import { dragJoint, drawPose, hitJoint, J, jointBounds, POSE_PARENT, standingPose, subtree, toggleJoint, transformPose } from './pose';

const at = (o: PoseObject, i: number) => ({ x: o.points[i * 2]!, y: o.points[i * 2 + 1]! });
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('the skeleton', () => {
  it('has a parent for every joint but the neck, and bones that follow the parents', () => {
    expect(POSE_PARENT).toHaveLength(POSE_JOINTS);
    expect(POSE_PARENT.filter((p) => p < 0)).toEqual([-1]);
    for (const [a, b] of POSE_LIMBS) expect(POSE_PARENT[b] === a || POSE_PARENT[a] === b).toBe(true);
    expect(subtree(J.rShoulder).sort()).toEqual([J.rShoulder, J.rElbow, J.rWrist].sort());
    expect(subtree(J.nose).sort((a, b) => a - b)).toEqual([J.nose, J.rEye, J.lEye, J.rEar, J.lEar]);
  });
});

describe('placing a standing pose', () => {
  it('stands a person facing the viewer, their right side on the left, centred and as tall as asked', () => {
    const o = standingPose('p', { x: 300, y: 200 }, 400, 4);
    const b = jointBounds(o)!;
    expect(b.height).toBeCloseTo(400, 0);
    expect(b.x + b.width / 2).toBeCloseTo(300, 0);
    expect(b.y + b.height / 2).toBeCloseTo(200, 0);
    expect(at(o, J.rShoulder).x).toBeLessThan(at(o, J.lShoulder).x);
    expect(at(o, J.nose).y).toBeLessThan(at(o, J.neck).y);
    expect(at(o, J.neck).y).toBeLessThan(at(o, J.rAnkle).y);
  });
});

describe('editing a pose', () => {
  const o = standingPose('p', { x: 256, y: 256 }, 400, 4);

  it('finds the nearest joint within the tolerance, and skips hidden ones when asked', () => {
    const wrist = at(o, J.rWrist);
    expect(hitJoint(o, { x: wrist.x + 3, y: wrist.y }, 8)).toBe(J.rWrist);
    expect(hitJoint(o, { x: wrist.x + 30, y: wrist.y + 30 }, 8)).toBeNull();
    const hidden = toggleJoint(o, J.rWrist);
    expect(hitJoint(hidden, wrist, 8, false)).toBeNull();
    expect(hitJoint(hidden, wrist, 8)).toBe(J.rWrist);
  });

  it('moves the whole body by the neck', () => {
    const moved = dragJoint(o, J.neck, { x: at(o, J.neck).x + 10, y: at(o, J.neck).y - 5 }, false);
    o.points.forEach((v, i) => expect(moved.points[i]).toBeCloseTo(v + (i % 2 === 0 ? 10 : -5), 6));
  });

  it('turns a limb around its parent so every bone below keeps its length, and leaves the rest', () => {
    const moved = dragJoint(o, J.lElbow, { x: at(o, J.lShoulder).x + 100, y: at(o, J.lShoulder).y }, false);
    expect(dist(at(moved, J.lShoulder), at(moved, J.lElbow))).toBeCloseTo(dist(at(o, J.lShoulder), at(o, J.lElbow)), 6);
    expect(dist(at(moved, J.lElbow), at(moved, J.lWrist))).toBeCloseTo(dist(at(o, J.lElbow), at(o, J.lWrist)), 6);
    // The elbow now points straight out from the shoulder.
    expect(at(moved, J.lElbow).y).toBeCloseTo(at(o, J.lShoulder).y, 6);
    for (const j of [J.neck, J.rWrist, J.lShoulder, J.nose]) expect(at(moved, j)).toEqual(at(o, j));
  });

  it('moves a single joint freely, changing the bone length', () => {
    const to = { x: 1, y: 2 };
    const moved = dragJoint(o, J.lElbow, to, true);
    expect(at(moved, J.lElbow)).toEqual(to);
    expect(at(moved, J.lWrist)).toEqual(at(o, J.lWrist));
  });

  it('shows and hides joints, and leaves hidden joints out of the bounds', () => {
    const hidden = toggleJoint(toggleJoint(o, J.rAnkle), J.lAnkle);
    expect(hidden.hidden).toEqual([J.rAnkle, J.lAnkle]);
    expect(toggleJoint(hidden, J.rAnkle).hidden).toEqual([J.lAnkle]);
    expect(jointBounds(hidden)!.height).toBeLessThan(jointBounds(o)!.height);
    const all = Array.from({ length: POSE_JOINTS }, (_, i) => i);
    expect(jointBounds({ ...o, hidden: all })).toBeNull();
  });

  it('turns a quarter around a centre and scales with the line width', () => {
    const c = { x: 256, y: 256 };
    const right = transformPose(o, 'rotateRight', c);
    const n = at(o, J.nose);
    expect(at(right, J.nose).x).toBeCloseTo(c.x - (n.y - c.y), 6);
    expect(at(right, J.nose).y).toBeCloseTo(c.y + (n.x - c.x), 6);
    expect(transformPose(right, 'rotateLeft', c).points.map((v) => Math.round(v * 1e6))).toEqual(o.points.map((v) => Math.round(v * 1e6)));
    const big = transformPose(o, 'scaleUp', c);
    expect(jointBounds(big)!.height).toBeCloseTo(jointBounds(o)!.height * 2, 6);
    expect(big.width).toBe(8);
    expect(transformPose(o, 'scaleDown', c).width).toBe(2);
  });

  it('mirrors a pose through the layer flip, swapping left and right so colours stay on the right side', () => {
    const asymmetric = toggleJoint(dragJoint(o, J.lElbow, { x: 400, y: 100 }, false), J.rEar);
    useCanvas.setState({ entities: [], past: [], future: [] });
    const id = useCanvas.getState().addEntity('control', { objects: [asymmetric] });
    useCanvas.getState().flipEntity(id, 'horizontal', 256);
    const flipped = useCanvas.getState().entities[0]!.objects[0] as PoseObject;
    // The raised left arm becomes a raised arm on the other side of the picture, now the person's right arm.
    expect(at(flipped, J.rElbow).x).toBeCloseTo(512 - at(asymmetric, J.lElbow).x, 6);
    expect(at(flipped, J.rElbow).y).toBeCloseTo(at(asymmetric, J.lElbow).y, 6);
    expect(at(flipped, J.rShoulder).x).toBeLessThan(at(flipped, J.lShoulder).x);
    expect(flipped.hidden).toEqual([J.lEar]);
  });

  it('keeps the depth of each joint with the joint through a mirror and scales it with the pose', () => {
    const withDepth: PoseObject = { ...o, depth: Array.from({ length: 18 }, (_, i) => i * 10) };
    useCanvas.setState({ entities: [], past: [], future: [] });
    const id = useCanvas.getState().addEntity('control', { objects: [withDepth] });
    useCanvas.getState().flipEntity(id, 'horizontal', 256);
    const flipped = useCanvas.getState().entities[0]!.objects[0] as PoseObject;
    // The right elbow of the mirrored pose is the old left elbow, with its depth.
    expect(flipped.depth![J.rElbow]).toBe(withDepth.depth![J.lElbow]);
    expect(flipped.depth![J.nose]).toBe(withDepth.depth![J.nose]);
    useCanvas.getState().flipEntity(id, 'vertical', 256);
    expect((useCanvas.getState().entities[0]!.objects[0] as PoseObject).depth).toEqual(flipped.depth);
    const big = transformPose(withDepth, 'scaleUp', { x: 256, y: 256 });
    expect(big.depth).toEqual(withDepth.depth!.map((z) => z * 2));
    expect(transformPose(withDepth, 'rotateRight', { x: 256, y: 256 }).depth).toEqual(withDepth.depth);
  });
});

describe('drawing a pose', () => {
  it('draws an ellipse per bone between shown joints and a dot per shown joint, in OpenPose colours', () => {
    const rec = recordingContext();
    drawPose(rec.ctx, standingPose('p', { x: 256, y: 256 }, 400, 4), false);
    expect(rec.of('arc')).toHaveLength(POSE_JOINTS);
    expect(rec.of('ellipse')).toHaveLength(POSE_LIMBS.length);
    // Bones first at 60 % of their colour, then the joints over them in full colour.
    const fills = rec.sets.filter((s) => s.name === 'fillStyle').map((s) => s.value);
    expect(fills[0]).toBe('rgb(153 0 0)');
    expect(fills.at(-1)).toBe('#ff0055');
    const hidden = toggleJoint(standingPose('p', { x: 256, y: 256 }, 400, 4), J.nose);
    drawPose(rec.ctx, hidden, true);
    // The nose and its three bones (to the neck and both eyes) are left out.
    expect(rec.of('arc')).toHaveLength(POSE_JOINTS * 2 - 1);
    expect(rec.of('ellipse')).toHaveLength(POSE_LIMBS.length * 2 - 3);
  });
});
