// The short way to write a person in the ready-made poses: `l` lean, `t` turn, `h` head [tilt, turn], `ra`/`la` arm
// [upper, fore, reach?] and `rl`/`ll` leg [thigh, shin, reach?] (the person's right is on the left of the picture).
import type { PoseSpec } from './poseSpec';

export interface Short {
  l?: number;
  t?: number;
  h?: [tilt?: number, turn?: number];
  ra?: [number, number, number?];
  la?: [number, number, number?];
  rl?: [number, number, number?];
  ll?: [number, number, number?];
}

const arm = (a: [number, number, number?] | undefined) => (a ? { upper: a[0], fore: a[1], ...(a[2] === undefined ? {} : { reach: a[2] }) } : undefined);
const leg = (a: [number, number, number?] | undefined) => (a ? { thigh: a[0], shin: a[1], ...(a[2] === undefined ? {} : { reach: a[2] }) } : undefined);

/** The `PoseSpec` a short description stands for. */
export function shortSpec(s: Short): PoseSpec {
  const out: PoseSpec = {};
  if (s.l !== undefined) out.lean = s.l;
  if (s.t !== undefined) out.turn = s.t;
  if (s.h) out.head = { ...(s.h[0] === undefined ? {} : { tilt: s.h[0] }), ...(s.h[1] === undefined ? {} : { turn: s.h[1] }) };
  if (s.ra) out.rArm = arm(s.ra);
  if (s.la) out.lArm = arm(s.la);
  if (s.rl) out.rLeg = leg(s.rl);
  if (s.ll) out.lLeg = leg(s.ll);
  return out;
}
