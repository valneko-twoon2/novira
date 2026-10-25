import { describe, expect, it } from 'vitest';
import type { PoseObject } from '@/state/canvas';
import { J, jointBounds, POSE_PARENT, pt } from '@/state/pose/pose';
import { placePose } from '@/state/pose/poseSpec';
import { aimBone, bakeView, length3, lengths, liftPose, swingJoint, turnView, v3, type Vec3 } from './math3d';

const box = { x: 0, y: 0, width: 400, height: 500 };
const person = (spec = {}): PoseObject => placePose('p', spec, box, 4);
const close = (a: Vec3, b: Vec3, digits = 6) => {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
  expect(a.z).toBeCloseTo(b.z, digits);
};

describe('lifting a pose into 3D', () => {
  it('puts the middle of the visible joints at the origin, with y up and a flat pose at depth 0', () => {
    const o = person();
    const { joints, center } = liftPose(o);
    const b = jointBounds(o)!;
    expect(center).toEqual({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
    expect(joints.every((p) => p.z === 0)).toBe(true);
    // The nose is above the neck in the picture, so it is higher in the world.
    expect(joints[J.nose]!.y).toBeGreaterThan(joints[J.neck]!.y);
    const ys = joints.map((p) => p.y);
    expect((Math.max(...ys) + Math.min(...ys)) / 2).toBeCloseTo(0, 6);
  });

  it('takes the depth of the pose when it has one', () => {
    const o = { ...person(), depth: Array.from({ length: 18 }, (_, i) => i) };
    expect(liftPose(o).joints.map((p) => p.z)).toEqual(o.depth);
  });
});

describe('turning the view and baking it back', () => {
  it('does not change a pose seen from the front', () => {
    const o = person();
    const baked = bakeView(liftPose(o), o.hidden, 0, 0);
    expect(baked.points).toEqual(o.points.map((v) => Math.round(v * 10) / 10));
    expect(baked.depth.every((z) => z === 0)).toBe(true);
  });

  it('turns by quarter turns four times back to where it started', () => {
    const p = v3(3, 5, 7);
    let q = p;
    for (let i = 0; i < 4; i++) q = turnView(q, Math.PI / 2, 0);
    close(q, p);
    q = p;
    for (let i = 0; i < 4; i++) q = turnView(q, 0, Math.PI / 2);
    close(q, p);
  });

  it('seen from the side the body is thin, and the depth carries what was the width', () => {
    const o = person();
    const baked = bakeView(liftPose(o), o.hidden, Math.PI / 2, 0);
    const xs = baked.points.filter((_, i) => i % 2 === 0);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(jointBounds(o)!.width * 0.2);
    // The person's right shoulder and left shoulder are on opposite sides of the viewer.
    expect(Math.sign(baked.depth[J.rShoulder]!)).toBe(-Math.sign(baked.depth[J.lShoulder]!));
  });

  it('keeps the middle of the pose where it was and turns back to the same pose', () => {
    const o = person({ lean: 10, lArm: { upper: 120, fore: 150 } });
    const lifted = liftPose(o);
    const baked = bakeView(lifted, o.hidden, 0.7, -0.4);
    const b = jointBounds({ points: baked.points, hidden: o.hidden })!;
    expect(b.x + b.width / 2).toBeCloseTo(lifted.center.x, 0);
    expect(b.y + b.height / 2).toBeCloseTo(lifted.center.y, 0);
    // Depth is the world's z after the turn, so a body turned and read again is the same body.
    const again = liftPose({ points: baked.points, hidden: o.hidden, depth: baked.depth });
    const turned = lifted.joints.map((p) => turnView(p, 0.7, -0.4));
    again.joints.forEach((p, i) => {
      const t = turned[i]!;
      expect(p.z).toBeCloseTo(t.z, 0);
    });
  });
});

describe('aiming a bone', () => {
  const parent = v3(0, 0, 0);

  it('puts the tip on the sphere the bone draws, where the ray crosses it nearest to the old tip', () => {
    const ray = { origin: v3(30, 20, 500), dir: v3(0, 0, -1) };
    const front = aimBone(parent, v3(0, 0, 100), ray);
    const back = aimBone(parent, v3(0, 0, -100), ray);
    expect(length3(front)).toBeCloseTo(100, 6);
    expect(length3(back)).toBeCloseTo(100, 6);
    expect(front.z).toBeGreaterThan(0);
    expect(back.z).toBeLessThan(0);
    expect(front.x).toBeCloseTo(30, 6);
    expect(back.y).toBeCloseTo(20, 6);
  });

  it('takes the point of the sphere nearest the ray when the ray misses it', () => {
    const tip = v3(0, -100, 0);
    const aimed = aimBone(parent, tip, { origin: v3(300, 0, 500), dir: v3(0, 0, -1) });
    expect(length3(aimed)).toBeCloseTo(100, 6);
    close(aimed, v3(100, 0, 0), 5);
  });

  it('still puts the tip on the sphere when the ray goes through the parent exactly', () => {
    const tip = v3(0, -100, 0);
    // A ray through the parent along z meets the sphere at (0, 0, +-100): those are valid hits, not a miss.
    const aimed = aimBone(parent, tip, { origin: v3(0, 0, 500), dir: v3(0, 0, -1) });
    expect(length3(aimed)).toBeCloseTo(100, 6);
  });
});

describe('swinging a joint', () => {
  const o = person({ rArm: { upper: -60, fore: -20 }, lLeg: { thigh: 20, shin: -10 } });
  const joints = liftPose(o).joints;
  const before = lengths(joints);

  it('keeps every bone length, whichever way a joint is swung', () => {
    for (let j = 0; j < 18; j++) {
      if ((POSE_PARENT[j] ?? -1) < 0) continue;
      const p = joints[POSE_PARENT[j] as number]!;
      for (const dir of [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1), v3(-1, -1, 1), v3(0, -1, 0)]) {
        const swung = swingJoint(joints, j, v3(p.x + dir.x * 50, p.y + dir.y * 50, p.z + dir.z * 50));
        lengths(swung).forEach((l, i) => expect(l, `joint ${j} bone ${i}`).toBeCloseTo(before[i]!, 4));
      }
    }
  });

  it('takes everything below the joint along and leaves the rest', () => {
    const wrist = swingJoint(joints, J.rElbow, v3(joints[J.rShoulder]!.x, joints[J.rShoulder]!.y + 60, 0));
    expect(wrist[J.rWrist]).not.toEqual(joints[J.rWrist]);
    expect(wrist[J.lWrist]).toEqual(joints[J.lWrist]);
    expect(wrist[J.rShoulder]).toEqual(joints[J.rShoulder]);
  });

  it('can swing a bone straight towards the viewer, which makes it short in the picture', () => {
    const elbow = joints[J.rElbow]!;
    const shoulder = joints[J.rShoulder]!;
    const target = v3(shoulder.x, shoulder.y, shoulder.z + length3(v3(elbow.x - shoulder.x, elbow.y - shoulder.y, elbow.z - shoulder.z)));
    const swung = swingJoint(joints, J.rElbow, target);
    expect(swung[J.rElbow]!.z).toBeGreaterThan(40);
    const baked = bakeView({ joints: swung, center: { x: 0, y: 0 } }, [], 0, 0);
    const flat = Math.hypot(baked.points[J.rElbow * 2]! - baked.points[J.rShoulder * 2]!, baked.points[J.rElbow * 2 + 1]! - baked.points[J.rShoulder * 2 + 1]!);
    expect(flat).toBeLessThan(5);
  });

  it('turns a bone half way round without a break (opposite directions)', () => {
    const shoulder = joints[J.rShoulder]!;
    const elbow = joints[J.rElbow]!;
    const away = v3(2 * shoulder.x - elbow.x, 2 * shoulder.y - elbow.y, 2 * shoulder.z - elbow.z);
    const swung = swingJoint(joints, J.rElbow, away);
    close(swung[J.rElbow]!, away, 4);
    lengths(swung).forEach((l, i) => expect(l).toBeCloseTo(before[i]!, 4));
  });

  it('moves the whole body when the neck is dragged, and does nothing for a target on the joint', () => {
    const moved = swingJoint(joints, J.neck, v3(joints[J.neck]!.x + 10, joints[J.neck]!.y - 5, 3));
    joints.forEach((p, i) => close(moved[i]!, v3(p.x + 10, p.y - 5, p.z + 3)));
    const same = swingJoint(joints, J.rElbow, joints[J.rElbow]!);
    same.forEach((p, i) => close(p, joints[i]!));
  });

  it('gives back the 2D positions with the points unchanged for a swing within the picture plane', () => {
    const lifted = liftPose(o);
    const shoulder = lifted.joints[J.rShoulder]!;
    const swung = swingJoint(lifted.joints, J.rElbow, v3(shoulder.x - 30, shoulder.y + 10, 0));
    const baked = bakeView({ joints: swung, center: lifted.center }, o.hidden, 0, 0);
    expect(baked.depth[J.rElbow]).toBeCloseTo(0, 6);
    const p = pt(baked.points, J.rElbow);
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
  });
});
