// What the mock does for jobs whose result is text, not a picture: describing a picture as a prompt (a fixed text
// chosen by the picture's name, so the same picture always gives the same words).
import type { ComfyGraph } from '../types';

const SUBJECTS = ['1girl, solo', '1boy, solo', '1girl, cat ears', '2girls'];
const HAIR = ['long hair, blue hair', 'short hair, brown hair', 'twintails, pink hair', 'ponytail, black hair', 'white hair, bob cut'];
const LOOK = ['smile, looking at viewer', 'closed mouth, upper body', 'open mouth, standing', 'blush, sitting'];
const PLACE = ['white background, simple background', 'outdoors, blue sky', 'indoors, cafe', 'night, city lights'];
const SENTENCE_PLACE = ['against a plain white background', 'outdoors under a blue sky', 'inside a cosy cafe', 'in a city at night'];

function pick<T>(list: T[], hash: number, salt: number): T {
  return list[(hash >>> (salt * 5)) % list.length]!;
}

function hashName(name: string): number {
  let h = 0x811c9dc5;
  for (const c of name) h = Math.imul(h ^ c.codePointAt(0)!, 0x01000193) >>> 0;
  return h;
}

/** The mock's description of a picture for a Florence-2 prompt (`Florence2Run` task), the same each time. */
export function mockCaption(graph: ComfyGraph, imageName: string): string {
  const task = Object.values(graph.prompt).find((n) => n.class_type === 'Florence2Run')?.inputs.task;
  const h = hashName(imageName);
  if (task === 'prompt_gen_tags') return [pick(SUBJECTS, h, 0), pick(HAIR, h, 1), pick(LOOK, h, 2), pick(PLACE, h, 3)].join(', ');
  const hair = pick(HAIR, h, 1).replace(', ', ' and ');
  return `An anime-style illustration of a character with ${hair}, ${pick(LOOK, h, 2).replace(', ', ' and ')}, ${pick(SENTENCE_PLACE, h, 3)}.`;
}

/** Whether a graph job ends in ComfyUI's "Preview as Text" node. */
export function isTextGraph(graph: ComfyGraph | null | undefined): boolean {
  return !!graph && Object.values(graph.prompt).some((n) => n.class_type === 'PreviewAny');
}
