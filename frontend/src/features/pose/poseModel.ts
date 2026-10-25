// The pose of one person as the 18 points OpenPose uses, and how it is drawn for a ControlNet: coloured limbs and joints
// on black, in the same colours and widths as the OpenPose preprocessor so that the OpenPose ControlNet models read it.
import { POSE_COLORS, POSE_LIMBS, POSE_MIRROR, poseLimbColor, poseStick } from '@/state/poseSkeleton';

/** A point in the picture as fractions of its width and height (0 to 1; may leave the picture a little). */
export interface Point {
  x: number;
  y: number;
}

export type Pose = Point[];

/** The 18 points from a short list of `[x, y]` pairs. */
const pose = (points: [number, number][]): Pose => points.map(([x, y]) => ({ x, y }));

/** Standing, facing the viewer, arms a little away from the body. */
const STANDING = pose([
  [0.5, 0.14], // nose
  [0.5, 0.22], // neck
  [0.4, 0.23], // right shoulder (the person's right is on the left of the picture)
  [0.33, 0.35], // right elbow
  [0.3, 0.46], // right wrist
  [0.6, 0.23], // left shoulder
  [0.67, 0.35], // left elbow
  [0.7, 0.46], // left wrist
  [0.44, 0.5], // right hip
  [0.43, 0.7], // right knee
  [0.42, 0.9], // right ankle
  [0.56, 0.5], // left hip
  [0.57, 0.7], // left knee
  [0.58, 0.9], // left ankle
  [0.47, 0.12], // right eye
  [0.53, 0.12], // left eye
  [0.43, 0.14], // right ear
  [0.57, 0.14], // left ear
]);

/** Both arms raised. */
const ARMS_UP = pose([
  [0.5, 0.14],
  [0.5, 0.22],
  [0.4, 0.23],
  [0.33, 0.13],
  [0.3, 0.03],
  [0.6, 0.23],
  [0.67, 0.13],
  [0.7, 0.03],
  [0.44, 0.5],
  [0.43, 0.7],
  [0.42, 0.9],
  [0.56, 0.5],
  [0.57, 0.7],
  [0.58, 0.9],
  [0.47, 0.12],
  [0.53, 0.12],
  [0.43, 0.14],
  [0.57, 0.14],
]);

/** Sitting on a chair, hands on the knees. */
const SITTING = pose([
  [0.5, 0.2],
  [0.5, 0.28],
  [0.4, 0.29],
  [0.35, 0.42],
  [0.4, 0.55],
  [0.6, 0.29],
  [0.65, 0.42],
  [0.6, 0.55],
  [0.44, 0.58],
  [0.3, 0.6],
  [0.3, 0.85],
  [0.56, 0.58],
  [0.7, 0.6],
  [0.7, 0.85],
  [0.47, 0.18],
  [0.53, 0.18],
  [0.43, 0.2],
  [0.57, 0.2],
]);

/** Mid-stride, one arm forward and one back. */
const WALKING = pose([
  [0.5, 0.14],
  [0.5, 0.22],
  [0.4, 0.23],
  [0.36, 0.36],
  [0.4, 0.48],
  [0.6, 0.23],
  [0.63, 0.35],
  [0.56, 0.45],
  [0.45, 0.5],
  [0.38, 0.7],
  [0.3, 0.9],
  [0.55, 0.5],
  [0.58, 0.69],
  [0.65, 0.9],
  [0.47, 0.12],
  [0.53, 0.12],
  [0.43, 0.14],
  [0.57, 0.14],
]);

export const PRESETS = { standing: STANDING, armsUp: ARMS_UP, sitting: SITTING, walking: WALKING } as const;
export type PresetName = keyof typeof PRESETS;
export const PRESET_NAMES = Object.keys(PRESETS) as PresetName[];

/** A copy of a preset, so editing it never changes the preset. */
export const copyPose = (p: Pose): Pose => p.map((point) => ({ ...point }));

/** The person seen in a mirror: left and right swap places and every point flips across the middle of the picture. */
export function mirrorPose(p: Pose): Pose {
  return p.map((_, i) => {
    const { x, y } = p[POSE_MIRROR[i] as number]!;
    return { x: 1 - x, y };
  });
}

/** Moves one point; the others stay. A point may leave the picture by a fifth of its size, no further. */
export function movePoint(p: Pose, index: number, to: Point): Pose {
  const clamp = (v: number) => Math.min(1.2, Math.max(-0.2, v));
  return p.map((point, i) => (i === index ? { x: clamp(to.x), y: clamp(to.y) } : point));
}

/** The joint nearest to a point, within `radius` (in fractions of the picture's short side), or null. */
export function nearestJoint(p: Pose, at: Point, aspect: number, radius: number): number | null {
  let best: number | null = null;
  let bestDistance = radius;
  p.forEach((point, i) => {
    // Distances are measured in the short side's unit so that a round handle is round on a tall picture too.
    const dx = (point.x - at.x) * Math.max(aspect, 1);
    const dy = (point.y - at.y) * Math.max(1 / aspect, 1);
    const d = Math.hypot(dx, dy);
    if (d <= bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  return best;
}

/** Draws the pose on black the way the OpenPose preprocessor does. */
export function drawPose(ctx: CanvasRenderingContext2D, p: Pose, width: number, height: number): void {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  const stick = poseStick(width, height);
  POSE_LIMBS.forEach(([a, b], i) => {
    const from = p[a]!;
    const to = p[b]!;
    const x1 = from.x * width;
    const y1 = from.y * height;
    const x2 = to.x * width;
    const y2 = to.y * height;
    const length = Math.hypot(x2 - x1, y2 - y1);
    ctx.save();
    ctx.translate((x1 + x2) / 2, (y1 + y2) / 2);
    ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
    ctx.beginPath();
    ctx.ellipse(0, 0, length / 2, stick, 0, 0, Math.PI * 2);
    ctx.fillStyle = poseLimbColor(i);
    ctx.fill();
    ctx.restore();
  });
  p.forEach((point, i) => {
    ctx.beginPath();
    ctx.arc(point.x * width, point.y * height, stick, 0, Math.PI * 2);
    ctx.fillStyle = POSE_COLORS[i]!;
    ctx.fill();
  });
}
