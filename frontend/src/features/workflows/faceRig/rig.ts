// The pose of the NKD Face Rig node, and what dragging each handle on the face does to it. The pose is the node's own
// `rig` text: weights per axis (`w`), preset intensities (`p`) and the head turn (`rot`). Axis names and ranges come
// from the pack's library; the mapping from a handle to axes is this editor's.
import type { FaceRigAxis } from '@/backend';

export interface RigState {
  /** Weight per axis name (see the pack's library); 0 is where the photo already is. */
  w: Record<string, number>;
  /** Intensity per ready-made expression. */
  p: Record<string, number>;
  /** Head turn in degrees: pitch, yaw, roll. */
  rot: [number, number, number];
}

export const EMPTY_RIG: RigState = { w: {}, p: {}, rot: [0, 0, 0] };

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const round = (v: number) => Math.round(v * 1e5) / 1e5;

/** The pose in a `rig` text; anything unreadable is the photo's own face. */
export function parseRig(text: string): RigState {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    if (typeof raw !== 'object' || raw === null) return structuredClone(EMPTY_RIG);
    const entries = (v: unknown) => Object.entries(typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}).map(([k, x]) => [k, num(x)] as const);
    const rot = Array.isArray(raw.rot) ? [num(raw.rot[0]), num(raw.rot[1]), num(raw.rot[2])] : [0, 0, 0];
    return { w: Object.fromEntries(entries(raw.w)), p: Object.fromEntries(entries(raw.p)), rot: rot as RigState['rot'] };
  } catch {
    return structuredClone(EMPTY_RIG);
  }
}

/** The `rig` text for a pose; empty for the photo's own face. Only what differs from the default is written. */
export function serializeRig(s: RigState): string {
  const w = Object.fromEntries(Object.entries(s.w).filter(([, v]) => Math.abs(v) > 1e-4).map(([k, v]) => [k, round(v)]));
  const p = Object.fromEntries(Object.entries(s.p).filter(([, v]) => Math.abs(v) > 1e-4).map(([k, v]) => [k, round(v)]));
  const rot = s.rot.map(round);
  const turned = rot.some((v) => v !== 0);
  if (!Object.keys(w).length && !Object.keys(p).length && !turned) return '';
  return JSON.stringify({ v: 1, w, ...(Object.keys(p).length ? { p } : {}), ...(turned ? { rot } : {}) });
}

/** How many things differ from the photo's own face. */
export function adjustedCount(s: RigState): number {
  return Object.values(s.w).filter((v) => Math.abs(v) > 1e-4).length + Object.values(s.p).filter((v) => Math.abs(v) > 1e-4).length + (s.rot.some((v) => Math.abs(v) > 1e-4) ? 1 : 0);
}

/** Screen pixels of drag for a full-strength gesture (weight 1). */
export const UNIT_PX = 70;
export const MAX_YAW = 25;
export const MAX_PITCH = 20;
/** Intensity a preset takes when it is switched on. */
export const PRESET_ON = 0.7;

export type HandleId = 'brow_L' | 'brow_R' | 'lid_L' | 'lid_R' | 'corner_L' | 'corner_R' | 'jaw';

export interface HandleSpec {
  id: HandleId;
  side: 'L' | 'R' | 'C';
  /** Message key suffix of its name. */
  label: 'brow' | 'eyelid' | 'mouth' | 'jaw';
  /** The same handle on the other side of the face. */
  mirror?: HandleId;
  /** Axis weights for a drag of (dx, dy) screen pixels from where it was grabbed; +x right, +y down. */
  weights: (dx: number, dy: number) => Record<string, number>;
}

const down = (dy: number) => Math.max(0, dy) / UNIT_PX;

export const HANDLES: HandleSpec[] = [
  // A brow: up raises it, toward the nose furrows it. Down lowers it a little (the axis allows half a unit).
  { id: 'brow_L', side: 'L', label: 'brow', mirror: 'brow_R', weights: (dx, dy) => ({ au1_2_L: -dy / UNIT_PX, au4_L: Math.max(0, dx) / UNIT_PX }) },
  { id: 'brow_R', side: 'R', label: 'brow', mirror: 'brow_L', weights: (dx, dy) => ({ au1_2_R: -dy / UNIT_PX, au4_R: Math.max(0, -dx) / UNIT_PX }) },
  // An eyelid: down closes it.
  { id: 'lid_L', side: 'L', label: 'eyelid', mirror: 'lid_R', weights: (_dx, dy) => ({ au45_L: dy / UNIT_PX }) },
  { id: 'lid_R', side: 'R', label: 'eyelid', mirror: 'lid_L', weights: (_dx, dy) => ({ au45_R: dy / UNIT_PX }) },
  // A mouth corner: up smiles (down frowns a little), outward stretches, inward puckers. Both corners share these.
  {
    id: 'corner_L',
    side: 'L',
    label: 'mouth',
    mirror: 'corner_R',
    weights: (dx, dy) => ({ au12: -dy / UNIT_PX, au20: Math.max(0, -dx) / UNIT_PX, au18: Math.max(0, dx) / UNIT_PX }),
  },
  {
    id: 'corner_R',
    side: 'R',
    label: 'mouth',
    mirror: 'corner_L',
    weights: (dx, dy) => ({ au12: -dy / UNIT_PX, au20: Math.max(0, dx) / UNIT_PX, au18: Math.max(0, -dx) / UNIT_PX }),
  },
  { id: 'jaw', side: 'C', label: 'jaw', weights: (_dx, dy) => ({ au26: down(dy) }) },
];

export type Ranges = Record<string, Pick<FaceRigAxis, 'lo' | 'hi'>>;

export function rangesOf(axes: FaceRigAxis[]): Ranges {
  return Object.fromEntries(axes.map((a) => [a.name, { lo: a.lo, hi: a.hi }]));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clampTo = (ranges: Ranges, axis: string, v: number) => (ranges[axis] ? clamp(v, ranges[axis]!.lo, ranges[axis]!.hi) : clamp(v, -1, 1));

/** The pose after dragging `id` by (dx, dy) from `base` (the pose when it was grabbed); a pair moves together when `mirror`. */
export function dragHandle(base: RigState, id: HandleId, dx: number, dy: number, mirror: boolean, ranges: Ranges): RigState {
  const spec = HANDLES.find((h) => h.id === id)!;
  const w = { ...base.w };
  const set = (weights: Record<string, number>) => {
    for (const [axis, v] of Object.entries(weights)) w[axis] = clampTo(ranges, axis, v);
  };
  set(spec.weights(dx, dy));
  if (mirror && spec.mirror) {
    const twin = HANDLES.find((h) => h.id === spec.mirror)!;
    set(twin.weights(-dx, dy));
  }
  return { ...base, w };
}

/** The gaze as a point in a unit disc: x right, y down. */
export function gazeOf(s: RigState): [number, number] {
  const v = (axis: string) => s.w[axis] ?? 0;
  return [v('au61') - v('au62'), v('au64') - v('au63')];
}

export function setGaze(base: RigState, x: number, y: number): RigState {
  const len = Math.hypot(x, y);
  const k = len > 1 ? 1 / len : 1;
  const [gx, gy] = [x * k, y * k];
  return { ...base, w: { ...base.w, au61: Math.max(0, gx), au62: Math.max(0, -gx), au63: Math.max(0, -gy), au64: Math.max(0, gy) } };
}

/** The head turn as a point in a unit disc: x is the turn to the right, y is looking down. */
export function headOf(s: RigState): [number, number] {
  return [s.rot[1] / MAX_YAW, s.rot[0] / MAX_PITCH];
}

export function setHead(base: RigState, x: number, y: number): RigState {
  const len = Math.hypot(x, y);
  const k = len > 1 ? 1 / len : 1;
  return { ...base, rot: [y * k * MAX_PITCH, x * k * MAX_YAW, base.rot[2]] };
}

export function togglePreset(base: RigState, name: string): RigState {
  const on = (base.p[name] ?? 0) > 0;
  return { ...base, p: { ...base.p, [name]: on ? 0 : PRESET_ON } };
}
