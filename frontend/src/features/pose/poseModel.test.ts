import { describe, expect, it } from 'vitest';
import { recordingContext } from '@/backend/mock/canvas2dRecorder.testkit';
import { POSE_COLORS, POSE_JOINT_NAMES, POSE_LIMBS } from '@/state/poseSkeleton';
import { PRESETS, PRESET_NAMES, copyPose, drawPose, mirrorPose, movePoint, nearestJoint } from './poseModel';

describe('the pose presets', () => {
  it('hold 18 points inside the picture', () => {
    for (const name of PRESET_NAMES) {
      const pose = PRESETS[name];
      expect(pose).toHaveLength(18);
      for (const { x, y } of pose) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('put the person\'s right side on the left of the picture', () => {
    for (const name of PRESET_NAMES) {
      const pose = PRESETS[name];
      expect(pose[POSE_JOINT_NAMES.indexOf('rightShoulder')]!.x).toBeLessThan(pose[POSE_JOINT_NAMES.indexOf('leftShoulder')]!.x);
    }
  });
});

describe('copyPose, movePoint and mirrorPose', () => {
  it('copies a pose so that editing it leaves the preset alone', () => {
    const copy = copyPose(PRESETS.standing);
    const moved = movePoint(copy, 0, { x: 0.9, y: 0.9 });
    expect(moved[0]).toEqual({ x: 0.9, y: 0.9 });
    expect(PRESETS.standing[0]).toEqual({ x: 0.5, y: 0.14 });
    expect(copy[0]).toEqual({ x: 0.5, y: 0.14 });
  });

  it('moves one point and keeps it near the picture', () => {
    const moved = movePoint(PRESETS.standing, 4, { x: 5, y: -5 });
    expect(moved[4]).toEqual({ x: 1.2, y: -0.2 });
    expect(moved.filter((_, i) => i !== 4)).toEqual(PRESETS.standing.filter((_, i) => i !== 4));
  });

  it('mirrors a pose: sides swap and it is the same pose after mirroring twice', () => {
    const mirrored = mirrorPose(PRESETS.walking);
    const rightWrist = POSE_JOINT_NAMES.indexOf('rightWrist');
    const leftWrist = POSE_JOINT_NAMES.indexOf('leftWrist');
    expect(mirrored[rightWrist]!.x).toBeCloseTo(1 - PRESETS.walking[leftWrist]!.x);
    expect(mirrored[rightWrist]!.y).toBeCloseTo(PRESETS.walking[leftWrist]!.y);
    const twice = mirrorPose(mirrored);
    twice.forEach((point, i) => {
      expect(point.x).toBeCloseTo(PRESETS.walking[i]!.x);
      expect(point.y).toBeCloseTo(PRESETS.walking[i]!.y);
    });
  });

  it('keeps the person\'s right on the picture\'s left when mirrored', () => {
    const mirrored = mirrorPose(PRESETS.standing);
    expect(mirrored[POSE_JOINT_NAMES.indexOf('rightShoulder')]!.x).toBeLessThan(mirrored[POSE_JOINT_NAMES.indexOf('leftShoulder')]!.x);
  });
});

describe('nearestJoint', () => {
  it('finds the joint under the pointer, the nearest of two close ones, and null when none is near', () => {
    const pose = PRESETS.standing;
    expect(nearestJoint(pose, { x: 0.5, y: 0.14 }, 1, 0.03)).toBe(0);
    expect(nearestJoint(pose, { x: 0.5, y: 0.2 }, 1, 0.05)).toBe(1);
    expect(nearestJoint(pose, { x: 0.05, y: 0.05 }, 1, 0.03)).toBeNull();
  });

  it('measures in the short side so a handle is round on a tall picture', () => {
    const pose = PRESETS.standing;
    // On a picture twice as tall as wide, a step of 0.035 of the height is 0.07 of the short side: out of reach of 0.06.
    expect(nearestJoint(pose, { x: 0.5, y: 0.14 + 0.035 }, 0.5, 0.06)).toBeNull();
    expect(nearestJoint(pose, { x: 0.5, y: 0.14 + 0.02 }, 0.5, 0.06)).toBe(0);
  });
});

describe('drawPose', () => {
  it('paints black, then every limb as a dimmed rotated ellipse and every joint as a bright dot', () => {
    const rec = recordingContext();
    drawPose(rec.ctx, PRESETS.standing, 512, 512);
    expect(rec.of('fillRect')[0]).toEqual([0, 0, 512, 512]);
    expect(rec.of('ellipse')).toHaveLength(POSE_LIMBS.length);
    expect(rec.of('arc')).toHaveLength(POSE_JOINT_NAMES.length);
    expect(rec.of('save')).toHaveLength(POSE_LIMBS.length);
    expect(rec.of('restore')).toHaveLength(POSE_LIMBS.length);
    const fills = rec.sets.filter((s) => s.name === 'fillStyle').map((s) => s.value);
    // Limbs are drawn at 60 % of the joint colour, joints at full colour.
    const [r, g, b] = [parseInt(POSE_COLORS[0]!.slice(1, 3), 16), parseInt(POSE_COLORS[0]!.slice(3, 5), 16), parseInt(POSE_COLORS[0]!.slice(5, 7), 16)];
    expect(fills[1]).toBe(`rgb(${Math.round(r * 0.6)} ${Math.round(g * 0.6)} ${Math.round(b * 0.6)})`);
    expect(fills.at(-1)).toBe(POSE_COLORS[POSE_JOINT_NAMES.length - 1]);
  });

  it('scales the stick width with the short side of the picture and never below 2 pixels', () => {
    const big = recordingContext();
    const small = recordingContext();
    drawPose(big.ctx, PRESETS.standing, 1024, 2048);
    drawPose(small.ctx, PRESETS.standing, 16, 16);
    expect(Number(big.of('arc')[0]![2])).toBeGreaterThan(Number(small.of('arc')[0]![2]));
    expect(Number(small.of('arc')[0]![2])).toBe(2);
    // Joints are placed in picture pixels.
    expect(big.of('arc')[0]!.slice(0, 2)).toEqual([PRESETS.standing[0]!.x * 1024, PRESETS.standing[0]!.y * 2048]);
  });
});
