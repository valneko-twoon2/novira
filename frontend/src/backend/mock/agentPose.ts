// Mock of the assistant on the canvas: a few pose words turn into the description of a person (angles of the limbs).
import type { AgentReply, AgentRequest } from '../types';
import type { MockToolCall } from './agentScript';

type Person = Record<string, unknown>;

const POSES: { re: RegExp; person: Person }[] = [
  { re: /手を?上げ|万歳|ばんざい|arms? up|raise/i, person: { rArm: { upper: -170, fore: -175 }, lArm: { upper: 170, fore: 175 } } },
  { re: /座|すわ|sit/i, person: { lean: 4, rLeg: { thigh: -85, shin: -5 }, lLeg: { thigh: 85, shin: 5 }, rArm: { upper: -15, fore: -60 }, lArm: { upper: 15, fore: 60 } } },
  { re: /走|はし|run/i, person: { lean: 12, rArm: { upper: -60, fore: -150 }, lArm: { upper: 40, fore: 120 }, rLeg: { thigh: -40, shin: -75 }, lLeg: { thigh: 35, shin: 5 }, turn: 0.7 } },
  { re: /歩|ある|walk/i, person: { rArm: { upper: -25, fore: -30 }, lArm: { upper: 25, fore: 30 }, rLeg: { thigh: -20, shin: -15 }, lLeg: { thigh: 20, shin: 15 } } },
  { re: /ジャンプ|跳|jump/i, person: { rArm: { upper: -140, fore: -170 }, lArm: { upper: 140, fore: 170 }, rLeg: { thigh: -35, shin: -70 }, lLeg: { thigh: 35, shin: 70 }, y: 0.45 } },
  { re: /手を?振|wave/i, person: { lArm: { upper: 150, fore: 175 } } },
  { re: /立|stand/i, person: {} },
];

/** The person a pose request names on the canvas screen; null otherwise. */
export function posePerson(req: AgentRequest): Person | null {
  if (req.screen !== 'canvas') return null;
  const match = POSES.find((p) => p.re.test(req.message));
  return match && /ポーズ|姿勢|pose|posture/i.test(req.message) ? match.person : null;
}

/** A pose on the canvas screen when the message names one; null otherwise (the ordinary mock answers). */
export async function poseAgentReply(req: AgentRequest, call: MockToolCall): Promise<AgentReply | null> {
  const person = posePerson(req);
  if (!person) return null;
  await call('set_pose', { people: [person] });
  return { text: req.locale === 'ja' ? 'ポーズを置きました。' : 'I placed the pose.' };
}
