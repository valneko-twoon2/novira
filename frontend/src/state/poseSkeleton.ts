// The OpenPose body skeleton (the 18 COCO keypoints) as the OpenPose preprocessor draws it, shared by the pose dialog
// and the canvas pose tool, and the models and settings a control layer needs to follow a pose or a depth map.

/** The 18 joints, in OpenPose's order. The person's right side is on the left of the picture. */
export const POSE_JOINT_NAMES = [
  'nose',
  'neck',
  'rightShoulder',
  'rightElbow',
  'rightWrist',
  'leftShoulder',
  'leftElbow',
  'leftWrist',
  'rightHip',
  'rightKnee',
  'rightAnkle',
  'leftHip',
  'leftKnee',
  'leftAnkle',
  'rightEye',
  'leftEye',
  'rightEar',
  'leftEar',
] as const;

export type PoseJointName = (typeof POSE_JOINT_NAMES)[number];

/** The limbs as pairs of joint indices, in the order OpenPose draws (and colours) them. */
export const POSE_LIMBS: readonly (readonly [number, number])[] = [
  [1, 2], [1, 5], [2, 3], [3, 4], [5, 6], [6, 7], [1, 8], [8, 9], [9, 10],
  [1, 11], [11, 12], [12, 13], [1, 0], [0, 14], [14, 16], [0, 15], [15, 17],
];

/** OpenPose's colours: the n-th limb and the n-th joint are drawn in the n-th colour. */
export const POSE_COLORS = [
  '#ff0000', '#ff5500', '#ffaa00', '#ffff00', '#aaff00', '#55ff00', '#00ff00', '#00ff55', '#00ffaa',
  '#00ffff', '#00aaff', '#0055ff', '#0000ff', '#5500ff', '#aa00ff', '#ff00ff', '#ff00aa', '#ff0055',
] as const;

/** For each joint, its partner on the other side of the body (mirroring swaps them so colours stay anatomical). */
export const POSE_MIRROR: readonly number[] = [0, 1, 5, 6, 7, 2, 3, 4, 11, 12, 13, 8, 9, 10, 15, 14, 17, 16];

/** A limb's colour as OpenPose paints it over black: 60 % of the joint colour. */
export function poseLimbColor(index: number): string {
  const n = parseInt((POSE_COLORS[index] as string).slice(1), 16);
  const c = (shift: number) => Math.round(((n >> shift) & 255) * 0.6);
  return `rgb(${c(16)} ${c(8)} ${c(0)})`;
}

/** Limb width and joint radius: the preprocessor's 4 pixels on a 512-pixel short side, never below 2. */
export function poseStick(width: number, height: number): number {
  return Math.max(2, (4 * Math.min(width, height)) / 512);
}

/**
 * How strongly a control layer follows a pose. The canvas default (0.75, until three quarters of the steps) let a
 * generation ignore the pose on a real engine (2026-10-06, WAI-illustrious-SDXL with xinsir's OpenPose ControlNet);
 * 1.0 until the end followed it.
 */
export const POSE_CONTROL = { weight: 1, beginEnd: [0, 1] as [number, number] };

/**
 * How strongly a control layer follows a 3D rough's depth map, and until when. On a real engine (2026-10-15,
 * WAI-illustrious-SDXL v1.7 with xinsir's union ControlNet, CFG 6, the pose at full strength beside it, three sets with two
 * seeds each) 0.4 until half of the steps put the set where the rough had it and left the people drawn as people; 0.6 until
 * 70 % began to draw the props as plain blocks, and 0.8 to the end drew the mannequins themselves.
 */
export const DEPTH_CONTROL = { weight: 0.4, beginEnd: [0, 0.5] as [number, number] };

type ControlModel = { type: string; base: string; name: string; path: string; source?: string };

/** The ControlNets of the main model's family that read one kind of picture, best first: one named for it, then a union ControlNet. */
function pickControlModel<M extends ControlModel>(models: M[], mainBase: string | null, kind: RegExp): M | null {
  const usable = models.filter((m) => m.type === 'controlnet' && (!mainBase || m.base === mainBase || m.base === 'any'));
  const text = (m: M) => `${m.name} ${m.path} ${m.source ?? ''}`;
  return usable.find((m) => kind.test(text(m))) ?? usable.find((m) => /union|promax/i.test(text(m))) ?? null;
}

/** The models that can read an OpenPose picture, best first: a model named for OpenPose, then a union ControlNet. */
export function pickPoseModel<M extends ControlModel>(models: M[], mainBase: string | null): M | null {
  return pickControlModel(models, mainBase, /openpose/i);
}

/** The models that can read a depth map, best first: a model named for depth, then a union ControlNet. */
export function pickDepthModel<M extends ControlModel>(models: M[], mainBase: string | null): M | null {
  return pickControlModel(models, mainBase, /depth/i);
}
