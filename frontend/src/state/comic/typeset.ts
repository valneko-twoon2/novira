// Checks of the lettering of a whole comic that the eye finds at once and the words alone do not show: a balloon on a
// person's face, balloons on each other, one that leaves its panel, one with too many words, an empty one, words too small to
// read on the printed page, and balloons that are in the wrong reading order. Balloon boxes are estimated from the words (see balloonPlace.ts), so a result is a lead to
// look at, not a measurement. Pages, panels and balloons are numbered from 1, as the screen numbers them.
import { estimateBox, TEXT_SHARE, type Box } from './balloonPlace';
import type { ComicBubble, ComicPage, ComicPoint, ComicProject } from './document';
import { pageAspect, panelGeometry, panelPixels } from './layout';

export const TYPESET_RULES = ['onFace', 'overlap', 'offPanel', 'tooLong', 'empty', 'tooSmall', 'readingOrder'] as const;
export type TypesetRule = (typeof TYPESET_RULES)[number];

export interface TypesetIssue {
  rule: TypesetRule;
  page: number;
  panel: number;
  /** The balloon (from 1, in the panel's order); the second one for `overlap` and `readingOrder` is in `other`. */
  balloon: number;
  other?: number;
}

/** The share of a head a balloon may cover before it is reported. */
const FACE_SHARE = 0.2;
/** The share of the smaller of two balloons that the other may cover. */
const OVERLAP_SHARE = 0.15;
/** How far a balloon may reach out of its panel (as a fraction of the panel) before it is reported. */
const OFF_MARGIN = 0.02;
/** The most characters (and lines) of one balloon before it is reported as too long to read at a glance. */
export const TOO_LONG = { chars: 60, lines: 5 } as const;
/** The least text size, as a share of the page's width (about 2.5 mm on an A5 page): below it the words are hard to read in print. */
const MIN_TEXT_SHARE = 0.017;
/** Two balloons whose tops are this close (as a fraction of the panel's height) count as on the same row. */
const ROW_BAND = 0.1;

const plain = (text: string) => text.replace(/\*\*|《《|》》/g, '');
const area = (b: Box) => b.w * b.h;
const common = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * The box of a person's head, from the nose and the ears or eyes (joints 0, 16 and 17, 14 and 15) when they are there;
 * null when the pose has no nose.
 */
export function headBox(joints: ComicPoint[]): Box | null {
  const nose = joints[0];
  if (!nose) return null;
  const [rEye, lEye, rEar, lEar] = [joints[14], joints[15], joints[16], joints[17]];
  const wide = rEar && lEar ? Math.abs(rEar.x - lEar.x) : rEye && lEye ? Math.abs(rEye.x - lEye.x) * 2.2 : 0.12;
  const r = Math.max(0.05, wide * 0.7);
  return { x: nose.x - r, y: nose.y - r * 1.1, w: r * 2, h: r * 2.4 };
}

function bubbleBox(b: ComicBubble, aspect: number): Box {
  return { x: b.x, y: b.y, ...estimateBox(b, aspect) };
}

/** The issues of one panel's balloons. */
function panelIssues(page: ComicPage, pageNo: number, panelNo: number, aspect: number, panelWidth: number): TypesetIssue[] {
  const panel = page.panels[panelNo - 1]!;
  const issues: TypesetIssue[] = [];
  const at = { page: pageNo, panel: panelNo };
  const boxes = panel.bubbles.map((b) => bubbleBox(b, aspect));
  const heads = panel.poses.map(headBox).filter((h): h is Box => h !== null);
  panel.bubbles.forEach((b, i) => {
    const box = boxes[i]!;
    const stamp = b.kind === 'stamp';
    if (!stamp && !plain(b.text).trim()) issues.push({ rule: 'empty', ...at, balloon: i + 1 });
    const text = plain(b.text);
    if (!stamp && b.kind !== 'caption' && b.kind !== 'box' && ([...text.replace(/\n/g, '')].length > TOO_LONG.chars || text.split('\n').length > TOO_LONG.lines)) issues.push({ rule: 'tooLong', ...at, balloon: i + 1 });
    if (!stamp && plain(b.text).trim() && TEXT_SHARE * b.scale * panelWidth < MIN_TEXT_SHARE) issues.push({ rule: 'tooSmall', ...at, balloon: i + 1 });
    if (box.x < -OFF_MARGIN || box.y < -OFF_MARGIN || box.x + box.w > 1 + OFF_MARGIN || box.y + box.h > 1 + OFF_MARGIN) issues.push({ rule: 'offPanel', ...at, balloon: i + 1 });
    if (heads.some((h) => common(box, h) > area(h) * FACE_SHARE)) issues.push({ rule: 'onFace', ...at, balloon: i + 1 });
  });
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      if (common(a, b) > Math.min(area(a), area(b)) * OVERLAP_SHARE) issues.push({ rule: 'overlap', ...at, balloon: i + 1, other: j + 1 });
    }
  }
  // Balloons are read in the panel's order: each next one should lie below, or on the same row further along the page's reading direction.
  const speech = panel.bubbles.map((b, i) => ({ b, box: boxes[i]!, n: i + 1 })).filter(({ b }) => b.kind !== 'stamp');
  for (let i = 0; i + 1 < speech.length; i++) {
    const a = speech[i]!;
    const next = speech[i + 1]!;
    const above = next.box.y + next.box.h < a.box.y;
    const sameRow = Math.abs(next.box.y - a.box.y) < ROW_BAND;
    const wrongWay = sameRow && (page.direction === 'rtl' ? next.box.x - a.box.x > ROW_BAND : a.box.x - next.box.x > ROW_BAND);
    if (above || wrongWay) issues.push({ rule: 'readingOrder', ...at, balloon: a.n, other: next.n });
  }
  return issues;
}

/** All lettering issues of the comic, in page and panel order. */
export function checkTypesetting(project: Pick<ComicProject, 'pages'>): TypesetIssue[] {
  return project.pages.flatMap((page, pi) => {
    const geometry = panelGeometry(page);
    return page.panels.flatMap((_, i) => {
      const box = geometry[i]?.box;
      if (!box || !page.panels[i]!.bubbles.length) return [];
      const { width, height } = panelPixels(box, pageAspect(page.size));
      return panelIssues(page, pi + 1, i + 1, width / height, box.width);
    });
  });
}
