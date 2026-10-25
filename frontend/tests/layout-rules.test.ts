// The rules of the layout scan (e2e/layoutRules.ts) on hand-made snapshots: what each kind of fault is and what is left alone.
import { describe, expect, it } from 'vitest';
import { layoutFaults, overflowFaults, spacingFaults, textFaults, type ChainStep, type LayoutNode, type LayoutSnapshot, type Rect } from '../e2e/layoutRules';

let nextId = 1;
const rect = (left: number, top: number, w: number, h: number): Rect => ({ left, top, right: left + w, bottom: top + h });
const step = (r: Rect, clip: ChainStep['clip'] = 'none', layer = false): ChainStep => ({ rect: r, where: `div.box${nextId}`, clip, layer });

function node(over: Partial<LayoutNode> = {}): LayoutNode {
  const id = nextId++;
  return {
    id,
    where: `button.b${id}`,
    text: `b${id}`,
    rect: rect(0, 0, 50, 20),
    control: true,
    card: false,
    boxed: true,
    radii: [4, 4, 4, 4],
    layer: 0,
    parents: [],
    positioned: false,
    truncateOk: false,
    touchOk: false,
    hasText: false,
    ellipsis: false,
    clamp: false,
    hidesOverflow: false,
    leaf: true,
    scrollWidth: 0,
    clientWidth: 0,
    scrollHeight: 0,
    clientHeight: 0,
    chain: [],
    ...over,
  };
}
const snap = (...nodes: LayoutNode[]): LayoutSnapshot => ({ viewport: { width: 1000, height: 800 }, nodes });
const kinds = (faults: { kind: string }[]) => faults.map((f) => f.kind);

describe('overflow', () => {
  it('finds a control wider than the box that holds it, on either side', () => {
    expect(kinds(overflowFaults(snap(node({ rect: rect(10, 0, 200, 20), chain: [step(rect(10, 0, 120, 40))] }))))).toEqual(['overflow']);
    expect(kinds(overflowFaults(snap(node({ rect: rect(5, 0, 50, 20), chain: [step(rect(10, 0, 120, 40))] }))))).toEqual(['overflow']);
  });

  it('allows a pixel of rounding and leaves a fitting control alone', () => {
    expect(overflowFaults(snap(node({ rect: rect(10, 0, 120.9, 20), chain: [step(rect(10, 0, 120, 40))] })))).toEqual([]);
  });

  it('finds the box it overflows further up, past a parent that grew with it', () => {
    const card = { ...step(rect(0, 0, 200, 40)), where: 'div.card' };
    const faults = overflowFaults(snap(node({ rect: rect(0, 0, 300, 20), chain: [step(rect(0, 0, 300, 20)), card] })));
    expect(faults).toEqual([expect.objectContaining({ kind: 'overflow', other: 'div.card' })]);
  });

  it('stops at a box that clips or floats, and at a strip that scrolls sideways on purpose', () => {
    // Past the clipping box, the ancestors further out do not matter (the control does not stick out of the clip).
    expect(overflowFaults(snap(node({ rect: rect(0, 0, 100, 20), chain: [step(rect(0, 0, 120, 40), 'clip'), step(rect(0, 0, 50, 40))] })))).toEqual([]);
    expect(overflowFaults(snap(node({ rect: rect(0, 0, 100, 20), chain: [step(rect(0, 0, 120, 40), 'none', true), step(rect(0, 0, 50, 40))] })))).toEqual([]);
    expect(overflowFaults(snap(node({ rect: rect(400, 0, 100, 20), chain: [step(rect(0, 0, 200, 40), 'strip')] })))).toEqual([]);
    // A panel that scrolls up and down but gains a sideways scroll bar is a fault.
    expect(kinds(overflowFaults(snap(node({ rect: rect(0, 0, 300, 20), chain: [step(rect(0, 0, 200, 400), 'scroll')] }))))).toEqual(['overflow']);
  });

  it('finds a control outside the window when nothing on the way clips it', () => {
    expect(kinds(overflowFaults(snap(node({ rect: rect(950, 0, 100, 20) }))))).toEqual(['offscreen']);
    expect(overflowFaults(snap(node({ rect: rect(950, 0, 100, 20), chain: [step(rect(0, 0, 2000, 40), 'clip')] })))).toEqual([]);
  });

  it('leaves alone what is not a control, and a control placed on purpose', () => {
    expect(overflowFaults(snap(node({ control: false, rect: rect(0, 0, 300, 20), chain: [step(rect(0, 0, 100, 40))] })))).toEqual([]);
    expect(overflowFaults(snap(node({ positioned: true, rect: rect(950, 0, 100, 20) })))).toEqual([]);
  });
});

describe('text', () => {
  const text = (over: Partial<LayoutNode>) => node({ hasText: true, scrollWidth: 100, clientWidth: 100, scrollHeight: 20, clientHeight: 20, ...over });

  it('finds text shortened to "…" by an ellipsis or a line clamp', () => {
    expect(kinds(textFaults(snap(text({ ellipsis: true, scrollWidth: 160 }))))).toEqual(['truncated']);
    expect(kinds(textFaults(snap(text({ clamp: true, scrollHeight: 60 }))))).toEqual(['truncated']);
  });

  it('leaves alone an ellipsis that is not triggered, and a place designed to shorten', () => {
    expect(textFaults(snap(text({ ellipsis: true, scrollWidth: 100.5 })))).toEqual([]);
    expect(textFaults(snap(text({ ellipsis: true, scrollWidth: 160, truncateOk: true })))).toEqual([]);
  });

  it('finds text cut off by a box that hides its overflow, without "…"', () => {
    expect(kinds(textFaults(snap(text({ hidesOverflow: true, scrollWidth: 140 }))))).toEqual(['clipped']);
    expect(kinds(textFaults(snap(text({ hidesOverflow: true, scrollHeight: 30 }))))).toEqual(['clipped']);
    // A box with children is a container, not a label: what clips inside it is judged on the children.
    expect(textFaults(snap(text({ hidesOverflow: true, leaf: false, scrollWidth: 140 })))).toEqual([]);
    expect(textFaults(snap(text({ scrollWidth: 140 })))).toEqual([]);
  });

  it('looks only at elements with text of their own', () => {
    expect(textFaults(snap(node({ ellipsis: true, scrollWidth: 160, clientWidth: 100 })))).toEqual([]);
  });
});

describe('spacing', () => {
  it('finds two buttons side by side with no gap, and two stacked with no gap', () => {
    expect(kinds(spacingFaults(snap(node({ rect: rect(0, 0, 50, 20) }), node({ rect: rect(50, 0, 50, 20) }))))).toEqual(['touching']);
    expect(kinds(spacingFaults(snap(node({ rect: rect(0, 0, 50, 20) }), node({ rect: rect(0, 20.5, 50, 20) }))))).toEqual(['touching']);
  });

  it('finds two boxes that overlap', () => {
    expect(kinds(spacingFaults(snap(node({ rect: rect(0, 0, 50, 20) }), node({ rect: rect(40, 5, 50, 20) }))))).toEqual(['overlap']);
  });

  it('names the left or upper box first', () => {
    const right = node({ rect: rect(50, 0, 50, 20), where: 'button.right' });
    const left = node({ rect: rect(0, 0, 50, 20), where: 'button.left' });
    expect(spacingFaults(snap(right, left))[0]).toMatchObject({ where: 'button.left', other: 'button.right' });
  });

  it('leaves alone a gap of a pixel or more, and boxes that meet only at a corner', () => {
    expect(spacingFaults(snap(node({ rect: rect(0, 0, 50, 20) }), node({ rect: rect(51, 0, 50, 20) })))).toEqual([]);
    expect(spacingFaults(snap(node({ rect: rect(0, 0, 50, 20) }), node({ rect: rect(50, 20, 50, 20) })))).toEqual([]);
    expect(spacingFaults(snap(node({ rect: rect(0, 0, 50, 20) }), node({ rect: rect(50, 18, 50, 20) })))).toEqual([]);
  });

  it('leaves alone a joined group: the corners that face each other are square', () => {
    const left = node({ rect: rect(0, 0, 50, 20), radii: [4, 0, 0, 4] });
    const right = node({ rect: rect(50, 0, 50, 20), radii: [0, 4, 4, 0] });
    expect(spacingFaults(snap(left, right))).toEqual([]);
    const upper = node({ rect: rect(0, 0, 50, 20), radii: [4, 4, 0, 0] });
    const lower = node({ rect: rect(0, 20, 50, 20), radii: [0, 0, 4, 4] });
    expect(spacingFaults(snap(upper, lower))).toEqual([]);
    // Square only on one side is not a join.
    expect(kinds(spacingFaults(snap(node({ rect: rect(0, 0, 50, 20), radii: [4, 0, 0, 4] }), node({ rect: rect(50, 0, 50, 20) }))))).toEqual(['touching']);
  });

  it('compares only visible boxes of controls and cards on one surface, not a box and what it holds', () => {
    const a = node({ rect: rect(0, 0, 50, 20) });
    expect(spacingFaults(snap(a, node({ rect: rect(50, 0, 50, 20), boxed: false })))).toEqual([]);
    expect(spacingFaults(snap(a, node({ rect: rect(50, 0, 50, 20), layer: 7 })))).toEqual([]);
    expect(spacingFaults(snap(a, node({ rect: rect(50, 0, 50, 20), control: false })))).toEqual([]);
    expect(kinds(spacingFaults(snap(a, node({ rect: rect(50, 0, 50, 20), control: false, card: true }))))).toEqual(['touching']);
    const card = node({ rect: rect(0, 0, 200, 100), control: false, card: true });
    expect(spacingFaults(snap(card, node({ rect: rect(0, 0, 50, 20), parents: [card.id] })))).toEqual([]);
    expect(spacingFaults(snap(a, node({ rect: rect(50, 0, 50, 20), touchOk: true })))).toEqual([]);
    // A sliver (a divider, a focus line) is not a box.
    expect(spacingFaults(snap(a, node({ rect: rect(50, 0, 2, 20) })))).toEqual([]);
  });
});

describe('every fault', () => {
  it('lists each distinct fault once', () => {
    const twin = { where: 'button.same', text: 'same' };
    const a = node({ ...twin, hasText: true, ellipsis: true, scrollWidth: 200, clientWidth: 50 });
    const b = node({ ...twin, hasText: true, ellipsis: true, scrollWidth: 200, clientWidth: 50, rect: rect(0, 100, 50, 20) });
    expect(layoutFaults(snap(a, b))).toEqual([{ kind: 'truncated', where: 'button.same', text: 'same' }]);
  });
});
