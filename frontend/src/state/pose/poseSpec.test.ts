// Poses described by angles: building the body, reading the assistant's answer, writing it back, random poses.
import { describe, expect, it } from 'vitest';
import { POSE_JOINTS, type PoseObject } from '@/state/canvas';
import { J, jointBounds, pt } from './pose';
import { placeExtractedPerson, placePose, poseFromSpec, poseToSpec, randomPose, randomPosePoints, randomPoseSpec, readPoseSpec, rerollPose, seededRandom, type PoseSpec } from './poseSpec';

const at = (o: Pick<PoseObject, 'points'>, i: number) => pt(o.points, i);
const area = { x: 0, y: 0, width: 512, height: 512 };
const deg = (from: { x: number; y: number }, to: { x: number; y: number }) => Math.round((Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI);

describe('a body from a description', () => {
  it('hangs a person upright with arms a little away from the body when nothing is said', () => {
    const o = poseFromSpec({});
    expect(deg(at(o, J.rShoulder), at(o, J.rElbow))).toBe(-10);
    expect(deg(at(o, J.lShoulder), at(o, J.lElbow))).toBe(10);
    expect(at(o, J.rShoulder).x).toBeLessThan(at(o, J.lShoulder).x);
    expect(at(o, J.nose).y).toBeLessThan(at(o, J.neck).y);
    expect(o.hidden).toEqual([]);
  });

  it('points each bone by its own angle: 0 down, 90 to the right edge, 180 up, -90 to the left edge', () => {
    const o = poseFromSpec({ rArm: { upper: -90, fore: 180 }, lArm: { upper: 90, fore: 0 }, rLeg: { thigh: 45, shin: -45 } });
    expect(deg(at(o, J.rShoulder), at(o, J.rElbow))).toBe(-90);
    expect(deg(at(o, J.rElbow), at(o, J.rWrist))).toBe(180);
    expect(at(o, J.rWrist).y).toBeLessThan(at(o, J.rElbow).y);
    expect(deg(at(o, J.lShoulder), at(o, J.lElbow))).toBe(90);
    expect(deg(at(o, J.rHip), at(o, J.rKnee))).toBe(45);
    expect(deg(at(o, J.rKnee), at(o, J.rAnkle))).toBe(-45);
  });

  it('shortens a limb by its reach, leans the body and turns the head', () => {
    const full = poseFromSpec({ rArm: { upper: -30, fore: -30 } });
    const short = poseFromSpec({ rArm: { upper: -30, fore: -30, reach: 0.5 } });
    const len = (o: { points: number[] }, a: number, b: number) => Math.hypot(at(o, a).x - at(o, b).x, at(o, a).y - at(o, b).y);
    expect(len(short, J.rShoulder, J.rElbow)).toBeCloseTo(len(full, J.rShoulder, J.rElbow) / 2, 6);
    const leaning = poseFromSpec({ lean: 20 });
    expect(at(leaning, J.neck).x).toBeGreaterThan(at(leaning, J.rHip).x);
    expect(poseFromSpec({ head: { turn: 1 } }).hidden).toEqual([J.lEar]);
    expect(poseFromSpec({ head: { turn: -1 } }).hidden).toEqual([J.rEar]);
    expect(poseFromSpec({ head: { turn: 0.3 } }).hidden).toEqual([]);
    expect(at(poseFromSpec({ head: { tilt: 30 } }), J.nose).x).toBeGreaterThan(0);
  });

  it('places the person in the box by x, y and size, the middle of the visible joints on the point', () => {
    const o = placePose('p', { x: 0.25, y: 0.6, size: 0.5 }, { x: 100, y: 50, width: 400, height: 400 }, 4);
    const b = jointBounds(o)!;
    expect(b.x + b.width / 2).toBeCloseTo(100 + 0.25 * 400, 0);
    expect(b.y + b.height / 2).toBeCloseTo(50 + 0.6 * 400, 0);
    expect(b.height).toBeCloseTo(0.5 * 400, -1);
    expect(o).toMatchObject({ kind: 'pose', id: 'p', width: 4 });
    const big = jointBounds(placePose('q', {}, area, 4))!;
    expect(big.height).toBeCloseTo(0.85 * 512, -1);
  });
});

describe('reading what the assistant sent', () => {
  it('keeps known numbers in range and drops everything else', () => {
    const spec = readPoseSpec({ x: 5, size: 0, lean: 'x', turn: 0.1, head: { tilt: 500, turn: -3, junk: 1 }, rArm: { upper: 400, fore: -400, reach: 2, hand: 1 }, rLeg: 'no', evil: { a: 1 } });
    expect(spec).toEqual({ x: 1.2, size: 0.1, turn: 0.4, head: { tilt: 90, turn: -1 }, rArm: { upper: 360, fore: -360, reach: 1 } });
  });

  it('refuses what is not an object and ignores non-finite numbers', () => {
    for (const bad of [null, 3, 'pose', [1, 2], undefined]) expect(readPoseSpec(bad)).toBeNull();
    expect(readPoseSpec({ lean: Infinity, x: NaN })).toEqual({});
  });

  // The assistant is told to give a back view with back true and a framed figure by its neck; both were once dropped,
  // so a person said to be seen from behind was drawn facing the viewer.
  it('reads a person seen from behind and a neck that frames the figure, up to a figure larger than the panel', () => {
    expect(readPoseSpec({ back: true, neck: { x: 0.4, y: 0.45 }, size: 2 })).toEqual({ back: true, neck: { x: 0.4, y: 0.45 }, size: 2 });
    expect(readPoseSpec({ size: 9 })!.size).toBe(2.5);
    // Only true turns a person round; a neck needs both of its numbers.
    expect(readPoseSpec({ back: 'yes', neck: { x: 0.4 } })).toEqual({});
    expect(readPoseSpec({ neck: [0.4, 0.5] })).toEqual({});
  });
});

describe('writing a pose back for the assistant', () => {
  it('gives a description that builds the same pose again, to the nearest degree', () => {
    for (let seed = 0; seed < 40; seed++) {
      const o = randomPose('p', seededRandom(seed), { x: 20, y: 30, width: 300, height: 400 }, 4);
      const spec = poseToSpec(o, area);
      const again = placePose('p', spec, area, 4);
      const b0 = jointBounds(o)!;
      const b1 = jointBounds(again)!;
      // The same shape: bones point the same way (within a degree or two), at about the same size.
      for (const [a, c] of [[J.rShoulder, J.rElbow], [J.lElbow, J.lWrist], [J.rHip, J.rKnee], [J.lKnee, J.lAnkle]] as const) {
        const d = Math.abs(deg(at(o, a), at(o, c)) - deg(at(again, a), at(again, c)));
        expect(Math.min(d, 360 - d)).toBeLessThanOrEqual(2);
      }
      expect(b1.height / b0.height).toBeGreaterThan(0.85);
      expect(b1.height / b0.height).toBeLessThan(1.15);
    }
  });

  it('describes a plain standing person with the default angles', () => {
    const spec: PoseSpec = poseToSpec(placePose('p', {}, area, 4), area);
    expect(spec).toMatchObject({ x: 0.5, y: 0.5, lean: 0, rArm: { upper: -10 }, lArm: { upper: 10 }, head: { tilt: 0, turn: 0 } });
    expect(spec.size).toBeCloseTo(0.85, 1);
    expect(spec).not.toHaveProperty('back');
  });

  it('describes a person seen from behind as such, with the arms named as they were given', () => {
    const made = placePose('p', { back: true, rArm: { upper: -40, fore: -60 }, lArm: { upper: 15, fore: 10 } }, area, 4);
    const spec = poseToSpec(made, area);
    expect(spec).toMatchObject({ back: true, rArm: { upper: -40, fore: -60 }, lArm: { upper: 15, fore: 10 } });
    // Built again from the description, it is the same person (to within the rounding of degrees and sizes).
    const again = placePose('p', spec, area, 4);
    expect(again.hidden).toEqual(made.hidden);
    again.points.forEach((v, i) => expect(v).toBeCloseTo(made.points[i]!, -1));
  });
});

describe('random poses', () => {
  it('describes each random person within the ranges a body can reach, and builds the same body from it', () => {
    for (let seed = 0; seed < 100; seed++) {
      const spec = randomPoseSpec(seededRandom(seed));
      for (const leg of [spec.rLeg!, spec.lLeg!]) expect(Math.abs(leg.shin!)).toBeLessThanOrEqual(80);
      for (const limb of [spec.rArm!, spec.lArm!, spec.rLeg!, spec.lLeg!]) {
        expect(limb.reach!).toBeGreaterThanOrEqual(0.55);
        expect(limb.reach!).toBeLessThanOrEqual(1);
      }
      expect(spec.turn!).toBeGreaterThanOrEqual(0.55);
      expect(Math.abs(spec.head!.turn!)).toBeLessThanOrEqual(1);
      expect(poseFromSpec(spec)).toEqual(randomPosePoints(seededRandom(seed)));
    }
  });


  it('gives the same random pose for the same seed and different ones for others', () => {
    expect(randomPosePoints(seededRandom(7))).toEqual(randomPosePoints(seededRandom(7)));
    expect(randomPosePoints(seededRandom(7)).points).not.toEqual(randomPosePoints(seededRandom(8)).points);
  });

  it('keeps every random pose a whole body inside the area, with the head above the neck', () => {
    for (let seed = 0; seed < 300; seed++) {
      const o = randomPose('p', seededRandom(seed), area, 4);
      expect(o.points).toHaveLength(POSE_JOINTS * 2);
      expect(o.points.every(Number.isFinite)).toBe(true);
      const b = jointBounds(o)!;
      expect(b.x).toBeGreaterThanOrEqual(-0.1);
      expect(b.y).toBeGreaterThanOrEqual(-0.1);
      expect(b.x + b.width).toBeLessThanOrEqual(512.1);
      expect(b.y + b.height).toBeLessThanOrEqual(512.1);
      expect(Math.max(b.width, b.height)).toBeGreaterThan(500);
      expect(at(o, J.nose).y).toBeLessThan(at(o, J.neck).y);
      expect(at(o, J.rAnkle).y).toBeGreaterThan(at(o, J.rKnee).y);
      expect(at(o, J.lAnkle).y).toBeGreaterThan(at(o, J.lKnee).y);
      // At most one ear is hidden: the one turned away.
      expect(o.hidden.length).toBeLessThanOrEqual(1);
      expect(o.hidden.every((j) => j === J.rEar || j === J.lEar)).toBe(true);
    }
  });

  it('rerolls a pose in the place and size of the old one, keeping its id and width', () => {
    const old = randomPose('keep', seededRandom(1), { x: 100, y: 50, width: 200, height: 300 }, 6);
    const b0 = jointBounds(old)!;
    const next = rerollPose(old, seededRandom(2));
    const b1 = jointBounds(next)!;
    expect(next.id).toBe('keep');
    expect(next.width).toBe(6);
    expect(next.points).not.toEqual(old.points);
    expect(b1.x + b1.width / 2).toBeCloseTo(b0.x + b0.width / 2, 0);
    expect(b1.y + b1.height / 2).toBeCloseTo(b0.y + b0.height / 2, 0);
    expect(Math.max(b1.width, b1.height)).toBeCloseTo(Math.max(b0.width, b0.height), 0);
  });
});

describe('a person found in a picture', () => {
  const person = { points: Array.from({ length: 36 }, (_, i) => (i % 2 === 0 ? 0.5 : 0.1 + (i - 1) / 2 / 25)), hidden: [] as number[] };

  it('fits the picture whole inside the box, centred, so a wide picture leaves room above and below', () => {
    const o = placeExtractedPerson('p', person, 2, { x: 0, y: 0, width: 400, height: 400 }, 4);
    expect(at(o, J.nose).x).toBeCloseTo(200, 0);
    // The picture is 400 by 200 inside the 400 by 400 box: it starts 100 down.
    expect(at(o, J.nose).y).toBeCloseTo(100 + 0.1 * 200, 0);
    expect(o.id).toBe('p');
    expect(o.width).toBe(4);
  });

  it('puts a tall picture in the middle of a wide box', () => {
    const o = placeExtractedPerson('p', person, 0.5, { x: 10, y: 20, width: 600, height: 400 }, 4);
    const w = 400 * 0.5;
    expect(at(o, J.nose).x).toBeCloseTo(10 + (600 - w) / 2 + 0.5 * w, 0);
    expect(at(o, J.nose).y).toBeCloseTo(20 + 0.1 * 400, 0);
  });

  it('hides the joints that were not found on the joint they hang from', () => {
    const o = placeExtractedPerson('p', { ...person, hidden: [J.rWrist, J.rElbow] }, 1, { x: 0, y: 0, width: 100, height: 100 }, 4);
    expect(o.hidden).toEqual([J.rWrist, J.rElbow]);
    expect(at(o, J.rElbow)).toEqual(at(o, J.rShoulder));
    expect(at(o, J.rWrist)).toEqual(at(o, J.rShoulder));
  });
});

describe('framing a person', () => {
  const box = { x: 0, y: 0, width: 400, height: 300 };

  it('puts the neck where `neck` says and keeps it there when the size changes', () => {
    for (const size of [0.4, 0.85, 2]) {
      const o = placePose('p', { neck: { x: 0.25, y: 0.4 }, size }, box, 4);
      expect(o.points[2]).toBeCloseTo(100, 0);
      expect(o.points[3]).toBeCloseTo(120, 0);
    }
  });

  it('draws a person seen from behind without the face, the right side on the right of the picture', () => {
    const front = placePose('f', { rArm: { upper: -40, fore: -40 } }, box, 4);
    const back = placePose('b', { back: true, rArm: { upper: -40, fore: -40 } }, box, 4);
    expect(back.hidden).toEqual([0, 14, 15]);
    // The arm drawn on the picture's left is now the person's left arm (joints 5 to 7).
    expect(back.points[6 * 2]).toBeCloseTo(front.points[3 * 2]!, 5);
    expect(back.points[5 * 2]!).toBeLessThan(back.points[2 * 2]!);
  });
});
