import { describe, expect, it } from 'vitest';
import { J } from '@/state/pose/pose';
import { v3 } from '@/state/pose/math3d';
import { defaultCamera, newPerson, type RoughCamera } from './rough';
import { cameraFrame, liftPoses, personJoints, placeLocal, project, toLocal } from './roughView';

const straight: RoughCamera = { target: { x: 0, y: 1, z: 0 }, yaw: 0, pitch: 0, distance: 3, fov: 40 };

describe('the camera of a rough', () => {
  it('stands in front of what it looks at, its picture upright', () => {
    const frame = cameraFrame(straight);
    expect(frame.position.x).toBeCloseTo(0);
    expect(frame.position.y).toBeCloseTo(1);
    expect(frame.position.z).toBeCloseTo(3);
    expect(frame.forward.z).toBeCloseTo(-1);
    expect(frame.right.x).toBeCloseTo(1);
    expect(frame.up.y).toBeCloseTo(1);
  });

  it('looks down on the set when tilted up, and from the side when turned', () => {
    expect(cameraFrame({ ...straight, pitch: 0.5 }).position.y).toBeGreaterThan(1);
    const side = cameraFrame({ ...straight, yaw: Math.PI / 2 });
    expect(side.position.x).toBeCloseTo(3);
    expect(side.forward.x).toBeCloseTo(-1);
  });

  it('puts what it looks at in the middle of the picture, right to the right and up to the top', () => {
    const aspect = 1.5;
    expect(project(straight, aspect, straight.target)).toMatchObject({ x: 0.5, y: 0.5, depth: 3 });
    const right = project(straight, aspect, v3(0.5, 1, 0));
    const up = project(straight, aspect, v3(0, 1.5, 0));
    expect(right.x).toBeGreaterThan(0.5);
    expect(up.y).toBeLessThan(0.5);
    // The top edge of the picture is half the angle of view above the middle.
    const edge = Math.tan((20 * Math.PI) / 180) * 3;
    expect(project(straight, aspect, v3(0, 1 + edge, 0)).y).toBeCloseTo(0);
    expect(project(straight, aspect, v3(0, 1, 5)).depth).toBeLessThan(0);
  });
});

describe('the people of a rough', () => {
  it('places a point of its own space on the set and back', () => {
    const at = { x: 1, y: 0.5, z: -2, yaw: 0.7 };
    const p = v3(0.3, 1.2, -0.4);
    const back = toLocal(at, placeLocal(at, p));
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
    expect(back.z).toBeCloseTo(p.z);
  });

  it('shows a person facing the camera with the right side on the left of the picture, and one turned away the other way round', () => {
    const toward = personJoints(newPerson(0, 0, 0));
    const away = personJoints(newPerson(0, 0, Math.PI));
    const x = (joints: typeof toward, i: number) => project(straight, 1, joints[i]!).x;
    expect(x(toward, J.rShoulder)).toBeLessThan(x(toward, J.lShoulder));
    expect(x(away, J.rShoulder)).toBeGreaterThan(x(away, J.lShoulder));
    // The face is in front of the head, so it is nearer the camera only when the person faces it.
    expect(project(straight, 1, toward[J.nose]!).depth).toBeLessThan(project(straight, 1, away[J.nose]!).depth);
  });

  it.each([0, 0.5, 1])('stands a flat pose up so the camera, tilted by %s, sees it as it was', (pitch) => {
    // A camera that looks down a long way saw an upright figure shortened and moved off the pose.
    const camera = { ...defaultCamera(), pitch, yaw: 0.6 };
    const aspect = 0.75;
    const flat = personJoints(newPerson(0.4, -1, 0)).map((p) => project({ ...camera, pitch: 0 }, aspect, p));
    const [person] = liftPoses([flat], camera, aspect);
    const seen = personJoints(person!).map((p) => project(camera, aspect, p));
    seen.forEach((p, i) => {
      if ([J.nose, J.rEye, J.lEye].includes(i as 0)) return; // the face is stood in front of the head
      expect(p.x).toBeCloseTo(flat[i]!.x, 2);
      expect(p.y).toBeCloseTo(flat[i]!.y, 2);
    });
    expect(person!.yaw).toBeCloseTo(camera.yaw);
  });

  it('turns a flat figure away from the camera when its right shoulder is on the right, and skips one with no torso', () => {
    const camera = defaultCamera();
    const away = personJoints(newPerson(0, 0, Math.PI)).map((p) => project(camera, 1, p));
    expect(liftPoses([away], camera, 1)[0]!.yaw).toBeCloseTo(camera.yaw + Math.PI);
    const dot = Array.from({ length: 18 }, () => ({ x: 0.5, y: 0.5 }));
    expect(liftPoses([dot, away.slice(0, 5)], camera, 1)).toEqual([]);
  });
});
