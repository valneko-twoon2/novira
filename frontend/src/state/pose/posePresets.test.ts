import { describe, expect, it } from 'vitest';
import { t } from '@/i18n';
import { J, jointBounds, pt } from './pose';
import { placePreset, POSE_CATEGORIES, POSE_GROUPS, POSE_PRESETS, type PosePreset } from './posePresets';
import { placePose, readPoseSpec, type PoseSpec } from './poseSpec';

const area = { x: 0, y: 0, width: 512, height: 512 };
const single = POSE_PRESETS.filter((p) => !p.composed);
const scenes = POSE_PRESETS.filter((p) => p.composed);
const by = (id: string) => placePose('x', POSE_PRESETS.find((p) => p.id === id)!.people[0]!, area, 4);
/** The shape of a person without where they stand (what the assistant's format can say). */
const shapeOf = ({ x, y, size, neck, back, ...shape }: PoseSpec) => (void [x, y, size, neck, back], shape);
const sceneOf = (id: string) => placePreset(POSE_PRESETS.find((p) => p.id === id)!, area, 4, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);

describe('ready-made poses', () => {
  it('are about fifty, in several categories, each with a few poses', () => {
    expect(single.filter((p) => !p.id.startsWith('manga.')).length).toBeGreaterThanOrEqual(48);
    expect(POSE_CATEGORIES.length).toBeGreaterThanOrEqual(5);
    for (const c of POSE_CATEGORIES) expect(c.presets.length, c.id).toBeGreaterThanOrEqual(6);
  });

  it('hold more than a hundred active poses for manga in their own categories', () => {
    const manga = POSE_CATEGORIES.filter((c) => c.id.startsWith('manga.')).flatMap((c) => c.presets);
    expect(manga.length).toBeGreaterThanOrEqual(100);
  });

  it('have distinct ids and a name in the catalog for every pose, category and group', () => {
    expect(new Set(POSE_PRESETS.map((p) => p.id)).size).toBe(POSE_PRESETS.length);
    for (const p of POSE_PRESETS) expect(t(p.label), p.id).not.toBe(p.label);
    for (const c of POSE_CATEGORIES) expect(t(c.label), c.id).not.toBe(c.label);
    for (const g of POSE_GROUPS) expect(t(g.label), g.id).not.toBe(g.label);
  });

  it('put every category in a group, composition panels first', () => {
    expect(POSE_CATEGORIES.every((c) => POSE_GROUPS.some((g) => g.id === c.group))).toBe(true);
    expect(POSE_CATEGORIES[0]!.group).toBe('panel');
    expect(POSE_CATEGORIES.filter((c) => c.group === 'panel').every((c) => c.presets.every((p) => p.composed))).toBe(true);
  });

  it('do not set where a single pose stands or how big it is, and only use what the assistant may send', () => {
    for (const p of single) {
      expect(p.people).toHaveLength(1);
      expect(p.people[0], p.id).not.toHaveProperty('x');
      expect(p.people[0], p.id).not.toHaveProperty('size');
      expect(p.people[0], p.id).not.toHaveProperty('neck');
      expect(readPoseSpec(p.people[0]), p.id).toEqual(p.people[0]);
    }
  });

  it.each(single.map((p) => [p.id, p] as const))('%s makes eighteen finite joints', (_id, p) => {
    const o = placePose('x', p.people[0]!, area, 4);
    expect(o.points).toHaveLength(36);
    expect(o.points.every(Number.isFinite)).toBe(true);
    expect(pt(o.points, J.nose).y).toBeLessThan(pt(o.points, J.neck).y + 1);
  });

  it('put the hands where the name says', () => {
    const hips = by('handsOnHips');
    expect(Math.abs(pt(hips.points, J.rWrist).y - pt(hips.points, J.rHip).y)).toBeLessThan(40);
    const behind = by('handsBehindHead');
    expect(pt(behind.points, J.rWrist).y).toBeLessThan(pt(behind.points, J.neck).y);
    expect(pt(behind.points, J.lWrist).y).toBeLessThan(pt(behind.points, J.neck).y);
    const up = by('armsUp');
    expect(pt(up.points, J.rWrist).y).toBeLessThan(pt(up.points, J.nose).y);
    const crossed = by('armsCrossed');
    expect(pt(crossed.points, J.rWrist).x).toBeGreaterThan(pt(crossed.points, J.rElbow).x);
  });

  it('put the legs where the name says', () => {
    const kick = by('highKick');
    expect(pt(kick.points, J.rAnkle).y).toBeLessThan(pt(kick.points, J.rHip).y);
    const crouch = by('crouching');
    const stand = by('standing');
    expect(pt(crouch.points, J.rAnkle).y - pt(crouch.points, J.rHip).y).toBeLessThan(pt(stand.points, J.rAnkle).y - pt(stand.points, J.rHip).y);
    const bow = by('bowing');
    expect(pt(bow.points, J.nose).x - pt(bow.points, J.rHip).x).toBeGreaterThan(80);
  });
});

describe('compositions for manga panels', () => {
  it('are more than fifty scenes in five categories', () => {
    expect(scenes.length).toBeGreaterThanOrEqual(50);
    expect(POSE_CATEGORIES.filter((c) => c.group === 'panel')).toHaveLength(5);
  });

  it('say where every person stands and how big, and only use what a pose may say', () => {
    for (const p of scenes) {
      expect(p.people.length, p.id).toBeGreaterThanOrEqual(1);
      for (const person of p.people) {
        expect(person.neck, p.id).toBeDefined();
        expect(person.size, p.id).toBeGreaterThan(0);
        expect(readPoseSpec(shapeOf(person)), p.id).toEqual(shapeOf(person));
      }
    }
  });

  it('hold two people in the two-person scenes and three or more in the group scenes', () => {
    for (const c of POSE_CATEGORIES.filter((c) => c.group === 'panel')) {
      for (const p of c.presets) {
        if (c.id === 'panel.two') expect(p.people.length, p.id).toBe(2);
        if (c.id === 'panel.group') expect(p.people.length, p.id).toBeGreaterThanOrEqual(3);
        if (c.id === 'panel.shot' || c.id === 'panel.daily') expect(p.people.length, p.id).toBe(1);
      }
    }
  });

  it.each(scenes.map((p) => [p.id, p] as const))('%s keeps every person at least partly inside the frame, with finite joints', (_id, p: PosePreset) => {
    for (const o of placePreset(p, area, 4, p.people.map((_, i) => `p${i}`))) {
      expect(o.points.every(Number.isFinite)).toBe(true);
      const b = jointBounds(o)!;
      expect(b.x + b.width, p.id).toBeGreaterThan(0);
      expect(b.x, p.id).toBeLessThan(area.width);
      expect(b.y + b.height, p.id).toBeGreaterThan(0);
      expect(b.y, p.id).toBeLessThan(area.height);
      // The neck is where the scene put it.
      const spec = p.people[o.id === 'p0' ? 0 : Number(o.id.slice(1))]!;
      expect(pt(o.points, J.neck).x).toBeCloseTo(spec.neck!.x * area.width, 0);
      expect(pt(o.points, J.neck).y).toBeCloseTo(spec.neck!.y * area.height, 0);
    }
  });

  it('crop the body at the frame for the close shots and show it whole for the full-body shots', () => {
    const [bust] = sceneOf('bustUp');
    expect(pt(bust!.points, J.rAnkle).y).toBeGreaterThan(area.height);
    expect(pt(bust!.points, J.neck).y).toBeLessThan(area.height / 2);
    const [full] = sceneOf('fullBody');
    expect(pt(full!.points, J.lAnkle).y).toBeLessThan(area.height);
    expect(pt(full!.points, J.nose).y).toBeGreaterThan(0);
    const [far] = sceneOf('distantFigure');
    const b = jointBounds(far!)!;
    expect(b.height).toBeLessThan(area.height * 0.4);
  });

  it('turn the person around for the shots from behind', () => {
    const [back] = sceneOf('backView');
    expect(back!.hidden).toEqual([J.nose, J.rEye, J.lEye]);
    expect(pt(back!.points, J.rShoulder).x).toBeGreaterThan(pt(back!.points, J.lShoulder).x);
  });

  it('put two people on either side for facing, and a big back in front of a small figure over the shoulder', () => {
    const [a, b] = sceneOf('faceToFace');
    expect(pt(a!.points, J.neck).x).toBeLessThan(pt(b!.points, J.neck).x);
    const [front, far] = sceneOf('overTheShoulder');
    expect(front!.hidden).toContain(J.nose);
    expect(jointBounds(front!)!.height).toBeGreaterThan(jointBounds(far!)!.height);
    const [adult, child] = sceneOf('adultAndChild');
    expect(jointBounds(adult!)!.height).toBeGreaterThan(jointBounds(child!)!.height * 1.4);
  });

  it('lay a person down for sleeping: the head and the feet are level', () => {
    const [sleeper] = sceneOf('sleeping');
    expect(Math.abs(pt(sleeper!.points, J.nose).y - pt(sleeper!.points, J.rAnkle).y)).toBeLessThan(area.height * 0.15);
    expect(pt(sleeper!.points, J.rAnkle).x).toBeGreaterThan(pt(sleeper!.points, J.neck).x + area.width * 0.3);
  });
});

describe('placing a preset', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

  it('gives a composition the ids in order and ignores where the old pose stood', () => {
    const preset = POSE_PRESETS.find((p) => p.id === 'faceToFace')!;
    const placed = placePreset(preset, area, 4, ids, { x: 0.9, y: 0.9, size: 0.2 });
    expect(placed.map((o) => o.id)).toEqual(['a', 'b']);
    expect(pt(placed[0]!.points, J.neck).x).toBeCloseTo(0.32 * 512, 0);
  });

  it('keeps the place and size of the pose a single pose replaces', () => {
    const preset = POSE_PRESETS.find((p) => p.id === 'standing')!;
    const [o] = placePreset(preset, area, 4, ids, { x: 0.25, y: 0.5, size: 0.5 });
    const b = jointBounds(o!)!;
    expect(b.x + b.width / 2).toBeCloseTo(0.25 * 512, -1);
    expect(b.height).toBeLessThan(512 * 0.6);
  });

  it('shrinks a single pose with raised arms or a kick to stay inside the box', () => {
    for (const id of ['armsUp', 'highKick', 'jumping']) {
      const [o] = placePreset(POSE_PRESETS.find((p) => p.id === id)!, area, 4, ids);
      const b = jointBounds(o!)!;
      expect(b.width, id).toBeLessThanOrEqual(512 * 0.97);
      expect(b.height, id).toBeLessThanOrEqual(512 * 0.97);
    }
  });
});
