// Where a balloon goes when the assistant names who speaks: in empty space of the panel, near the speaker, with the tail
// aimed at the speaker's head. The assistant writes balloons before any picture exists, so it cannot see where the people
// are; the poses it set tell us. The balloon's size is estimated from its words (the screen measures the real one later
// and fits it, see fitStep), so the result is a good first place, not an exact one.
import type { BubbleKind, ComicBubble, ComicPoint } from './document';
import { STAMP_HEIGHT_EM, stampById } from './stamps';

/** A box in fractions of the panel. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The kinds that have no tail to aim. */
const TAILLESS: readonly BubbleKind[] = ['caption', 'sfx', 'plain', 'box', 'stamp'];
export const hasTail = (kind: BubbleKind) => !TAILLESS.includes(kind);

/** The longest column (vertical words) or line (horizontal words) the assistant's words are broken into. */
const WRAP_VERTICAL = 8;
const WRAP_HORIZONTAL = 14;
/** Where a long line is broken by choice: after these, when one lies in the second half of the line. */
const BREAK_AFTER = /[、。！？!?…，,」]/;

/**
 * Breaks a long line of words into columns (vertical) or lines (horizontal) of a fitting length: after a punctuation mark
 * when there is one late enough, else at the length. The screen does not wrap words, so one long line would be one very tall
 * column. Lines the writer broke already are kept, and so are words with emphasis marks (their length is not the text's).
 */
export function wrapBalloonText(text: string, vertical: boolean): string {
  if (/\*\*|《《/.test(text)) return text;
  const limit = vertical ? WRAP_VERTICAL : WRAP_HORIZONTAL;
  return text
    .split('\n')
    .map((line) => {
      const chars = [...line];
      const out: string[] = [];
      while (chars.length > limit) {
        let cut = limit;
        for (let i = limit - 1; i >= Math.ceil(limit / 2); i--) {
          if (BREAK_AFTER.test(chars[i - 1]!)) {
            cut = i;
            break;
          }
        }
        out.push(chars.splice(0, cut).join(''));
      }
      out.push(chars.join(''));
      return out.join('\n');
    })
    .join('\n');
}
/** The text size as a share of the panel's width at scale 1 (BUBBLE_TEXT_SHARE). */
export const TEXT_SHARE = 0.045;

/** The balloon's box in fractions of its panel, estimated from its words. `aspect` is the panel's width over its height. */
export function estimateBox(bubble: Pick<ComicBubble, 'text' | 'scale' | 'vertical'> & Partial<Pick<ComicBubble, 'kind'>>, aspect: number): { w: number; h: number } {
  const picture = bubble.kind === 'stamp' ? stampById(bubble.text) : undefined;
  if (picture) {
    const h = TEXT_SHARE * bubble.scale * STAMP_HEIGHT_EM;
    return { w: Math.min(0.95, (h * picture.width) / picture.height / aspect), h: Math.min(0.95, h) };
  }
  const plain = bubble.text.replace(/\*\*|《《|》》/g, '');
  // The screen breaks words only where they are broken, so a line is as long as it was written.
  const lines = plain.split('\n').map((l) => Math.max(1, [...l].length));
  const longest = Math.max(...lines);
  const fs = TEXT_SHARE * bubble.scale;
  const across = bubble.vertical ? lines.length * fs * 1.25 + fs * 1.4 : longest * fs + fs * 1.6;
  const down = bubble.vertical ? longest * fs * 1.05 + fs * 1.4 : lines.length * fs * 1.3 + fs * 1.4;
  return { w: Math.min(0.95, across), h: Math.min(0.95, down * aspect) };
}

/**
 * The box each person fills, in fractions of the panel: all their joints, grown because the joints are narrower than the
 * person (hair, hat, sleeves, the way the picture drifts from the pose) and most above the head, where balloons like to go.
 * `margin` is the least growth on every side.
 */
export function personBoxes(poses: ComicPoint[][], margin = 0.04): Box[] {
  return poses
    .filter((joints) => joints.length > 0)
    .map((joints) => {
      const xs = joints.map((j) => j.x);
      const ys = joints.map((j) => j.y);
      const w0 = Math.max(...xs) - Math.min(...xs);
      const h0 = Math.max(...ys) - Math.min(...ys);
      const side = Math.max(margin, w0 * 0.25);
      const top = Math.max(margin, h0 * 0.18);
      const x = Math.min(...xs) - side;
      const y = Math.min(...ys) - top;
      return { x, y, w: Math.max(...xs) + side - x, h: Math.max(...ys) + margin - y };
    });
}

/** Where a person's mouth is: just under the nose (joint 0), else the neck (joint 1). */
export function mouthOf(joints: ComicPoint[]): ComicPoint | null {
  const nose = joints[0];
  if (nose) return { x: nose.x, y: nose.y + 0.02 };
  return joints[1] ?? null;
}

const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

export interface Placement {
  x: number;
  y: number;
  /** Aimed at the speaker's mouth, as fractions of the balloon's own box; null when no one speaks. */
  tail: ComicPoint | null;
  /** How much of the balloon still lies over a person or another balloon (0 when it found a free place). */
  overlap: number;
}

/**
 * The place for a balloon of the given size: the free spot (no one standing there, no other balloon) nearest to the
 * speaker, or the top of the panel when there is no speaker. `taken` are the boxes of the panel's other balloons.
 */
export function placeBalloon(size: { w: number; h: number }, people: Box[], taken: Box[], speakerMouth: ComicPoint | null): Placement {
  const { w, h } = size;
  const edge = 0.02;
  let best = { x: edge, y: edge, score: Infinity, overlap: 0 };
  for (let y = edge; y <= Math.max(edge, 1 - h - edge) + 1e-9; y += 0.03) {
    for (let x = edge; x <= Math.max(edge, 1 - w - edge) + 1e-9; x += 0.03) {
      const box = { x, y, w, h };
      let score = 0;
      let covered = 0;
      for (const p of people) covered += overlap(box, p);
      for (const t of taken) covered += overlap(box, t);
      score += covered * 400;
      if (speakerMouth) score += Math.hypot(x + w / 2 - speakerMouth.x, y + h / 2 - speakerMouth.y);
      // Balloons sit high in a panel unless the speaker is lower; a higher place is read first.
      score += y * 0.3;
      if (score < best.score) best = { x, y, score, overlap: covered };
    }
  }
  const tail = speakerMouth ? { x: (speakerMouth.x - best.x) / w, y: (speakerMouth.y - best.y) / h } : null;
  const clamp = (v: number) => Math.min(3, Math.max(-2, v));
  return { x: best.x, y: best.y, tail: tail && { x: clamp(tail.x), y: clamp(tail.y) }, overlap: best.overlap };
}

/** The most of a panel one balloon may take: across, down and in all (a balloon that takes more hides the picture). */
export const BALLOON_LIMIT = { w: 0.42, h: 0.5, area: 0.11 } as const;
const SCALE_STEP = 0.9;

/**
 * The largest text scale, not above the bubble's own, at which the balloon stays within BALLOON_LIMIT (and not below
 * `floor`): the balloons of a comic are made to be read without covering the people.
 */
export function fitScale(bubble: Pick<ComicBubble, 'text' | 'scale' | 'vertical'>, aspect: number, floor: number, limit = BALLOON_LIMIT): number {
  let scale = bubble.scale;
  for (;;) {
    const { w, h } = estimateBox({ ...bubble, scale }, aspect);
    if ((w <= limit.w && h <= limit.h && w * h <= limit.area) || scale <= floor) return Math.max(floor, Math.round(scale * 100) / 100);
    scale = Math.max(floor, scale * SCALE_STEP);
  }
}
