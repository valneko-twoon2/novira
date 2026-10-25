// The rules of the layout scan (layout.spec.ts), as pure functions over a snapshot of the page's boxes. The page side
// (layoutScan.ts) only measures; everything that decides what is a fault lives here, so the rules are unit tested
// (tests/layout-rules.test.ts) on hand-made snapshots without a browser.

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** One ancestor of a control, nearest first, up to the first one that clips or floats. */
export interface ChainStep {
  /** The padding box (inside the border): what a child may fill. */
  rect: Rect;
  where: string;
  /**
   * How the ancestor treats a child that is too wide: `none` lets it stick out, `clip` cuts it off, `scroll` scrolls it
   * (a panel that gains a sideways scroll bar), `strip` is a row that scrolls sideways on purpose (tabs, thumbnails).
   */
  clip: 'none' | 'clip' | 'scroll' | 'strip';
  /** A floating surface (fixed or absolute): the walk stops after it. */
  layer: boolean;
}

export interface LayoutNode {
  id: number;
  /** `tag.class[data-testid]`. */
  where: string;
  /** Its own text, shortened. */
  text: string;
  rect: Rect;
  /** A button, field or picker. */
  control: boolean;
  /** A rounded box with a border on every side (a card or a panel), compared with its neighbours like a control. */
  card: boolean;
  /** Draws a box people see: a border or a background. Boxes nobody sees cannot look like they touch. */
  boxed: boolean;
  /** Corner radii: top left, top right, bottom right, bottom left. */
  radii: [number, number, number, number];
  /** The surface it sits on (the nearest floating or sticky box, itself included, or the nearest box that clips or scrolls), 0 for the page. Only boxes of one surface are compared. */
  layer: number;
  /** Ids of the collected nodes that contain it. */
  parents: number[];
  /** The control is placed on purpose (positioned itself), so it is not checked against its ancestors. */
  positioned: boolean;
  /** `data-truncate-ok` on it or an ancestor: shortening to "…" is the design here. */
  truncateOk: boolean;
  /** `data-touch-ok` on it or an ancestor: the boxes are joined on purpose. */
  touchOk: boolean;
  /** Text metrics, for nodes with text of their own. */
  hasText: boolean;
  ellipsis: boolean;
  clamp: boolean;
  hidesOverflow: boolean;
  leaf: boolean;
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
  chain: ChainStep[];
}

export interface LayoutSnapshot {
  viewport: { width: number; height: number };
  nodes: LayoutNode[];
}

export type LayoutFaultKind = 'overflow' | 'offscreen' | 'clipped' | 'truncated' | 'touching' | 'overlap';

export interface LayoutFault {
  kind: LayoutFaultKind;
  where: string;
  text: string;
  /** What it overflows or touches. */
  other?: string;
}

/** How far (px) a box may cross a line before it counts: rounding of sub-pixel layout. */
const SLACK = 1;
/** Two boxes closer than this read as touching. */
const MIN_GAP = 1;
/** Two neighbours must share at least this much of their side to be neighbours (not just corners). */
const MIN_SHARED = 4;

const width = (r: Rect) => r.right - r.left;
const height = (r: Rect) => r.bottom - r.top;

/** A control that sticks out of the box that holds it, or out of the window. */
export function overflowFaults(snapshot: LayoutSnapshot): LayoutFault[] {
  const out: LayoutFault[] = [];
  for (const node of snapshot.nodes) {
    if (!node.control || node.positioned) continue;
    const r = node.rect;
    let stopped = false;
    for (const step of node.chain) {
      if (step.clip === 'strip') {
        stopped = true;
        break;
      }
      if (r.right > step.rect.right + SLACK || r.left < step.rect.left - SLACK) {
        out.push({ kind: 'overflow', where: node.where, text: node.text, other: step.where });
        stopped = true;
        break;
      }
      if (step.clip !== 'none' || step.layer) {
        stopped = true;
        break;
      }
    }
    if (!stopped && (r.right > snapshot.viewport.width + SLACK || r.left < -SLACK)) out.push({ kind: 'offscreen', where: node.where, text: node.text });
  }
  return out;
}

/** Text cut off by its box (no "…"), and text shortened to "…" where the design did not ask for it. */
export function textFaults(snapshot: LayoutSnapshot): LayoutFault[] {
  const out: LayoutFault[] = [];
  for (const node of snapshot.nodes) {
    if (!node.hasText) continue;
    const wide = node.scrollWidth > node.clientWidth + SLACK;
    const tall = node.scrollHeight > node.clientHeight + SLACK;
    if (node.ellipsis || node.clamp) {
      if (!node.truncateOk && (wide || (node.clamp && tall))) out.push({ kind: 'truncated', where: node.where, text: node.text });
    } else if (node.hidesOverflow && node.leaf && (wide || tall)) {
      out.push({ kind: 'clipped', where: node.where, text: node.text });
    }
  }
  return out;
}

/** Whether two neighbours are joined on purpose: the corners that face each other are square on both. */
function joined(first: LayoutNode, second: LayoutNode, axis: 'row' | 'column'): boolean {
  const square = (n: number) => n <= 0.5;
  // `first` is the left (row) or upper (column) one.
  if (axis === 'row') return square(first.radii[1]) && square(first.radii[2]) && square(second.radii[0]) && square(second.radii[3]);
  return square(first.radii[2]) && square(first.radii[3]) && square(second.radii[0]) && square(second.radii[1]);
}

/** Controls and cards of one surface that touch (less than a pixel apart) or overlap, unless they are joined on purpose. */
export function spacingFaults(snapshot: LayoutSnapshot): LayoutFault[] {
  const out: LayoutFault[] = [];
  const boxes = snapshot.nodes.filter((n) => (n.control || n.card) && n.boxed && !n.touchOk && width(n.rect) >= MIN_SHARED && height(n.rect) >= MIN_SHARED);
  const byLayer = new Map<number, LayoutNode[]>();
  for (const b of boxes) byLayer.set(b.layer, [...(byLayer.get(b.layer) ?? []), b]);
  for (const group of byLayer.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        if (a.parents.includes(b.id) || b.parents.includes(a.id)) continue;
        const hGap = Math.max(b.rect.left - a.rect.right, a.rect.left - b.rect.right);
        const vGap = Math.max(b.rect.top - a.rect.bottom, a.rect.top - b.rect.bottom);
        if (hGap >= MIN_GAP || vGap >= MIN_GAP) continue;
        // How much of their sides they share (negative gap = overlap along that axis).
        const sharedRows = -vGap;
        const sharedCols = -hGap;
        if (hGap < -SLACK && vGap < -SLACK) {
          out.push({ kind: 'overlap', where: a.where, text: a.text, other: b.where });
        } else if (sharedRows >= MIN_SHARED && hGap > -SLACK) {
          const [left, right] = a.rect.left <= b.rect.left ? [a, b] : [b, a];
          if (!joined(left, right, 'row')) out.push({ kind: 'touching', where: left.where, text: left.text, other: right.where });
        } else if (sharedCols >= MIN_SHARED && vGap > -SLACK) {
          const [upper, lower] = a.rect.top <= b.rect.top ? [a, b] : [b, a];
          if (!joined(upper, lower, 'column')) out.push({ kind: 'touching', where: upper.where, text: upper.text, other: lower.where });
        }
      }
    }
  }
  return out;
}

/** Every fault of a snapshot, each distinct one once. */
export function layoutFaults(snapshot: LayoutSnapshot): LayoutFault[] {
  const seen = new Set<string>();
  return [...overflowFaults(snapshot), ...textFaults(snapshot), ...spacingFaults(snapshot)].filter((f) => {
    const key = `${f.kind}|${f.where}|${f.other ?? ''}|${f.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
