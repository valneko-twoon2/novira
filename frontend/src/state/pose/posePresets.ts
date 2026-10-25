// Ready-made poses for the pose tool, in categories, written the way the assistant describes a person (angles of bones,
// see PoseSpec). A pose does not say where the body stands or how big it is: the pose tool keeps those of the pose it
// replaces. A composition (the panels of a manga) is the opposite: it is one or more people with their places and sizes,
// and it replaces every pose of the layer. The names are catalog keys `canvas.pose.preset.<id>`,
// `canvas.pose.category.<id>` and `canvas.pose.group.<id>`.
import type { MessageKey } from '@/i18n';
import type { PoseObject, Rect } from '@/state/canvas';
import { jointBounds } from './pose';
import { PANEL_POSES } from './posePresetsPanel';
import { MANGA_POSES } from './posePresetsManga';
import { placePose, type PoseSpec } from './poseSpec';

export interface PosePreset {
  id: string;
  label: MessageKey;
  /** The people: one with only the shape of the body (`x`, `y`, `size` and `neck` left out), or a composition. */
  people: readonly PoseSpec[];
  /** True for a composition: each person says where they stand and how big, and applying it replaces the layer's poses. */
  composed: boolean;
}

export interface PoseCategory {
  id: string;
  label: MessageKey;
  group: PoseGroupId;
  presets: readonly PosePreset[];
}

export type PoseGroupId = 'panel' | 'standard' | 'manga';

/** The groups of categories in the order the picker lists them. */
export const POSE_GROUPS: readonly { id: PoseGroupId; label: MessageKey }[] = [
  { id: 'panel', label: 'canvas.pose.group.panel' },
  { id: 'standard', label: 'canvas.pose.group.standard' },
  { id: 'manga', label: 'canvas.pose.group.manga' },
];

const down = { upper: 8, fore: 6 };
const downR = { upper: -8, fore: -6 };

const RAW: readonly { category: string; poses: readonly [id: string, spec: PoseSpec][] }[] = [
  {
    category: 'standing',
    poses: [
      ['standing', {}],
      ['relaxed', { rArm: downR, lArm: down, rLeg: { thigh: -5 }, lLeg: { thigh: 5 } }],
      ['handInPocket', { rArm: { upper: -18, fore: 38 }, lArm: down, lLeg: { thigh: 6 } }],
      ['handsBehindBack', { rArm: { upper: -10, fore: 32, reach: 0.85 }, lArm: { upper: 10, fore: -32, reach: 0.85 } }],
      ['lookingBack', { turn: 0.7, head: { turn: -0.9 }, rArm: downR, lArm: down }],
      ['weightOnOneLeg', { lean: 4, rArm: downR, lArm: down, rLeg: { thigh: -9 }, lLeg: { thigh: 7, shin: -4 } }],
      ['armsCrossed', { rArm: { upper: -8, fore: 100 }, lArm: { upper: 8, fore: -100 } }],
      ['salute', { rArm: { upper: -70, fore: 160 }, lArm: down }],
      ['shy', { head: { tilt: 8 }, rArm: { upper: -8, fore: 22 }, lArm: { upper: 8, fore: -22 }, rLeg: { thigh: 4, shin: 6 }, lLeg: { thigh: -4, shin: -6 } }],
    ],
  },
  {
    category: 'fashion',
    poses: [
      ['handsOnHips', { rArm: { upper: -38, fore: 40 }, lArm: { upper: 38, fore: -40 } }],
      ['sCurve', { lean: 7, head: { tilt: -8 }, rArm: { upper: -12, fore: -4 }, lArm: { upper: 38, fore: -40 }, rLeg: { thigh: -4, shin: 0 }, lLeg: { thigh: 14, shin: -6 } }],
      ['hairTouch', { head: { tilt: -8 }, rArm: { upper: -125, fore: 135 }, lArm: { upper: 38, fore: -40 }, rLeg: { thigh: -3 }, lLeg: { thigh: 10, shin: -4 } }],
      ['handsBehindHead', { lean: -3, rArm: { upper: -112, fore: 150 }, lArm: { upper: 112, fore: -150 }, rLeg: { thigh: -4 }, lLeg: { thigh: 10, shin: -4 } }],
      ['overShoulder', { turn: 0.55, lean: 4, head: { turn: -0.9, tilt: -6 }, rArm: downR, lArm: down }],
      ['crossedLegs', { head: { tilt: 6 }, rArm: { upper: -30, fore: 28 }, lArm: { upper: 14, fore: -4 }, rLeg: { thigh: 6, shin: 22 }, lLeg: { thigh: -6, shin: -22 } }],
      ['leaningBack', { lean: -9, head: { tilt: 10 }, rArm: { upper: -30, fore: 30 }, lArm: { upper: 30, fore: -30 }, rLeg: { thigh: -6 }, lLeg: { thigh: 8, shin: -4 } }],
      ['oneArmUp', { lean: 6, rArm: { upper: -165, fore: -175 }, lArm: { upper: 38, fore: -40 }, lLeg: { thigh: 12, shin: -4 } }],
      ['runway', { lean: -3, head: { tilt: 4 }, rArm: { upper: -16, fore: 8 }, lArm: { upper: 22, fore: 18 }, rLeg: { thigh: 14, shin: 0 }, lLeg: { thigh: -9, shin: -6 } }],
    ],
  },
  {
    category: 'arms',
    poses: [
      ['armsUp', { rArm: { upper: -150, fore: -165 }, lArm: { upper: 150, fore: 165 } }],
      ['stretchUp', { head: { tilt: 8 }, rArm: { upper: -172, fore: 178 }, lArm: { upper: 172, fore: -178 } }],
      ['wave', { rArm: { upper: -115, fore: -170 }, lArm: down }],
      ['pointing', { rArm: { upper: -90, fore: -90 }, lArm: down }],
      ['armsOpen', { rArm: { upper: -90, fore: -90 }, lArm: { upper: 90, fore: 90 } }],
      ['cheer', { rArm: { upper: -170, fore: -176 }, lArm: { upper: 38, fore: -40 } }],
      ['praying', { head: { tilt: 8 }, rArm: { upper: -22, fore: 135 }, lArm: { upper: 22, fore: -135 } }],
      ['thinking', { head: { tilt: 8 }, rArm: { upper: -25, fore: 155 }, lArm: { upper: 22, fore: -105 }, rLeg: { thigh: -4 }, lLeg: { thigh: 6, shin: -3 } }],
    ],
  },
  {
    category: 'motion',
    poses: [
      ['walking', { turn: 0.6, rArm: { upper: 22, fore: 40 }, lArm: { upper: -20, fore: -30 }, rLeg: { thigh: -20, shin: -45 }, lLeg: { thigh: 25, shin: 5 } }],
      ['running', { turn: 0.6, lean: 12, rArm: { upper: -45, fore: -110 }, lArm: { upper: 50, fore: 150 }, rLeg: { thigh: -28, shin: -115 }, lLeg: { thigh: 70, shin: 15 } }],
      ['jumping', { rArm: { upper: -150, fore: -165 }, lArm: { upper: 150, fore: 165 }, rLeg: { thigh: -22, shin: 25 }, lLeg: { thigh: 22, shin: -25 } }],
      ['dancing', { lean: 6, head: { tilt: -8 }, rArm: { upper: -140, fore: -170 }, lArm: { upper: 80, fore: 100 }, rLeg: { thigh: -4 }, lLeg: { thigh: 38, shin: 10 } }],
      ['twirling', { lean: 8, rArm: { upper: -100, fore: -105 }, lArm: { upper: 100, fore: 105 }, rLeg: { thigh: 5, shin: 20 }, lLeg: { thigh: -5, shin: -20 } }],
      ['kneeUp', { rArm: { upper: -35, fore: 40 }, lArm: { upper: 25, fore: -20 }, rLeg: { thigh: -5 }, lLeg: { thigh: 80, shin: -5 } }],
      ['skipping', { rArm: { upper: -60, fore: -150 }, lArm: { upper: 40, fore: 30 }, rLeg: { thigh: -12 }, lLeg: { thigh: 45, shin: -30 } }],
      ['sidestep', { lean: 3, rArm: { upper: -20, fore: 15 }, lArm: { upper: 20, fore: -15 }, rLeg: { thigh: -35, shin: -25 }, lLeg: { thigh: 4, shin: 4 } }],
    ],
  },
  {
    category: 'seated',
    poses: [
      ['sittingOnChair', { rArm: { upper: -12, fore: 70 }, lArm: { upper: 12, fore: -70 }, rLeg: { thigh: -6, shin: 0, reach: 0.42 }, lLeg: { thigh: 6, shin: 0, reach: 0.42 } }],
      ['sittingCrossLegged', { rArm: { upper: -20, fore: 70 }, lArm: { upper: 20, fore: -70 }, rLeg: { thigh: -55, shin: 100, reach: 0.8 }, lLeg: { thigh: 55, shin: -100, reach: 0.8 } }],
      ['sittingSideways', { turn: 0.5, rArm: { upper: 25, fore: 80 }, lArm: { upper: 20, fore: 85 }, rLeg: { thigh: 90, shin: 0 }, lLeg: { thigh: 92, shin: 2 } }],
      ['kneeling', { turn: 0.55, rArm: { upper: 10, fore: 40 }, lArm: { upper: 14, fore: 45 }, rLeg: { thigh: 8, shin: -80 }, lLeg: { thigh: 14, shin: -78 } }],
      ['crouching', { rArm: { upper: -30, fore: 60 }, lArm: { upper: 30, fore: -60 }, rLeg: { thigh: -45, shin: 8, reach: 0.6 }, lLeg: { thigh: 45, shin: -8, reach: 0.6 } }],
      ['bowing', { lean: 55, head: { tilt: -10 }, rArm: { upper: -5, fore: -2 }, lArm: { upper: 5, fore: 2 } }],
      ['bendingForward', { lean: 42, rArm: { upper: -12, fore: -4 }, lArm: { upper: 12, fore: 4 } }],
      ['sideStretch', { lean: 28, rArm: { upper: -30, fore: -20 }, lArm: { upper: 140, fore: 150 }, rLeg: { thigh: -8 }, lLeg: { thigh: 8 } }],
      ['backBend', { lean: -28, head: { tilt: 14 }, rArm: { upper: -40, fore: -60 }, lArm: { upper: 40, fore: 60 }, rLeg: { thigh: -6 }, lLeg: { thigh: 6 } }],
    ],
  },
  {
    category: 'action',
    poses: [
      ['fightingStance', { turn: 0.7, rArm: { upper: -22, fore: 150 }, lArm: { upper: 22, fore: -150 }, rLeg: { thigh: -22, shin: 10 }, lLeg: { thigh: 22, shin: -10 } }],
      ['punching', { turn: 0.55, lean: 6, rArm: { upper: -90, fore: -90 }, lArm: { upper: 20, fore: -150 }, rLeg: { thigh: -26, shin: 8 }, lLeg: { thigh: 20, shin: -8 } }],
      ['highKick', { turn: 0.7, lean: -10, rArm: { upper: -60, fore: 100 }, lArm: { upper: 60, fore: -100 }, rLeg: { thigh: -118, shin: -120 }, lLeg: { thigh: 4, shin: 0 } }],
      ['swordStance', { turn: 0.7, rArm: { upper: -35, fore: 95 }, lArm: { upper: 30, fore: 100 }, rLeg: { thigh: -26, shin: 6 }, lLeg: { thigh: 26, shin: -8 } }],
      ['throwing', { turn: 0.7, lean: -8, rArm: { upper: -150, fore: -100 }, lArm: { upper: 60, fore: 90 }, rLeg: { thigh: -10 }, lLeg: { thigh: 28, shin: -6 } }],
      ['drawingBow', { turn: 0.5, rArm: { upper: -90, fore: 110 }, lArm: { upper: 90, fore: 90 }, rLeg: { thigh: -14 }, lLeg: { thigh: 14 } }],
      ['guarding', { head: { tilt: 8 }, rArm: { upper: -150, fore: 150 }, lArm: { upper: 150, fore: -150 }, rLeg: { thigh: -8 }, lLeg: { thigh: 8 } }],
      ['sprinting', { turn: 0.6, lean: 30, rArm: { upper: -60, fore: -120 }, lArm: { upper: 60, fore: 140 }, rLeg: { thigh: -40, shin: -120 }, lLeg: { thigh: 70, shin: 20 } }],
      ['victory', { head: { tilt: 8 }, rArm: { upper: -120, fore: -165 }, lArm: { upper: 120, fore: 165 }, rLeg: { thigh: -12 }, lLeg: { thigh: 12 } }],
    ],
  },
];

const single = (id: string, spec: PoseSpec): PosePreset => ({ id, label: `canvas.pose.preset.${id}` as MessageKey, people: [spec], composed: false });

/** The ready-made poses by category, in the order the picker shows them. */
export const POSE_CATEGORIES: readonly PoseCategory[] = [
  ...PANEL_POSES.map(({ category, scenes }) => ({
    id: `panel.${category}`,
    label: `canvas.pose.category.panel.${category}` as MessageKey,
    group: 'panel' as const,
    presets: scenes.map(([id, people]) => ({ id, label: `canvas.pose.preset.${id}` as MessageKey, people, composed: true })),
  })),
  ...RAW.map(({ category, poses }) => ({
    id: category,
    label: `canvas.pose.category.${category}` as MessageKey,
    group: 'standard' as const,
    presets: poses.map(([id, spec]) => single(id, spec)),
  })),
  ...MANGA_POSES.map(({ category, poses }) => ({
    id: `manga.${category}`,
    label: `canvas.pose.category.manga.${category}` as MessageKey,
    group: 'manga' as const,
    presets: poses.map(([id, spec]) => single(id, spec)),
  })),
];

/** Every ready-made pose, flat. */
export const POSE_PRESETS: readonly PosePreset[] = POSE_CATEGORIES.flatMap((c) => c.presets);

/**
 * The people of a preset placed in `area` (layer space), with the `ids` for their poses. A composition stands where it
 * says. A single pose takes `where` (the place and size of the pose it replaces) and is shrunk to stay inside the box:
 * raised arms and kicks make a body bigger than a standing one.
 */
export function placePreset(preset: PosePreset, area: Rect, width: number, ids: readonly string[], where: { x?: number; y?: number; size?: number } = {}): PoseObject[] {
  const id = (i: number) => ids[i] ?? `pose${i}`;
  if (preset.composed) return preset.people.map((spec, i) => placePose(id(i), spec, area, width));
  const spec = { ...preset.people[0], ...where };
  const first = placePose(id(0), spec, area, width);
  const fit = jointBounds(first);
  if (fit && (fit.width > area.width * 0.96 || fit.height > area.height * 0.96)) {
    const k = Math.min((area.width * 0.96) / fit.width, (area.height * 0.96) / fit.height);
    return [placePose(id(0), { ...spec, size: (where.size ?? 0.85) * k }, area, width)];
  }
  return [first];
}
