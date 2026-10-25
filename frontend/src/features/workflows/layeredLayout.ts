// Left-to-right layered layout of a workflow graph. A node's column is its longest path from a source; nodes in a
// column are ordered to reduce edge crossings (barycenter sweeps, keeping the best order found) and stacked by their
// heights. The result depends on the graph's structure and node sizes only, never on the current positions, so laying
// out a laid-out graph changes nothing.
import type { WorkflowEdge, WorkflowNode } from '@/state/workflows/workflows';
import { getTemplate } from './templates';

/** Horizontal distance between columns (the assistant places nodes this far apart too). */
export const LAYER_SPACING = 380;
/** Vertical gap between nodes stacked in a column. */
export const NODE_GAP = 40;
/** Minimum room between the widest node of a column and the next column. */
const COLUMN_PADDING = 60;
const DEFAULT_WIDTH = 320;
const SWEEPS = 8;

export interface Point {
  x: number;
  y: number;
}

/** The rendered height of a node, or an estimate from its fields before it has been drawn. */
export function nodeHeight(node: WorkflowNode): number {
  const measured = node.measured?.height ?? node.height;
  if (measured) return measured;
  if (node.data && node.data.isOpen === false) return 48;
  const template = getTemplate(node.data?.type ?? '');
  if (!template) return 120;
  const handles = Math.max(template.inputs.filter((i) => i.input === 'connection').length, template.outputs.length);
  const controls = template.inputs.filter((i) => i.input !== 'connection').reduce((h, i) => h + (i.ui === 'textarea' ? 96 : 52), 0);
  return 76 + handles * 28 + controls;
}

function nodeWidth(node: WorkflowNode): number {
  return node.measured?.width ?? node.width ?? DEFAULT_WIDTH;
}

/** Node ids in topological order (ties: the order of `nodes`); nodes on a cycle come last in their array order. */
export function topologicalOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const indegree = new Map(nodes.map((n) => [n.id, 0]));
  const succ = new Map<string, string[]>();
  for (const e of edges) {
    if (!index.has(e.source) || !index.has(e.target) || e.source === e.target) continue;
    succ.set(e.source, [...(succ.get(e.source) ?? []), e.target]);
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  }
  const ready = nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];
  while (ready.length) {
    ready.sort((a, b) => (index.get(a) ?? 0) - (index.get(b) ?? 0));
    const id = ready.shift() as string;
    order.push(id);
    for (const t of succ.get(id) ?? []) {
      const d = (indegree.get(t) ?? 0) - 1;
      indegree.set(t, d);
      if (d === 0) ready.push(t);
    }
  }
  const placed = new Set(order);
  return [...order, ...nodes.filter((n) => !placed.has(n.id)).map((n) => n.id)];
}

interface Link {
  source: string;
  target: string;
}

/** Number of crossing edge pairs between the same pair of columns. */
function crossings(links: Link[], layer: Map<string, number>, rank: Map<string, number>): number {
  let count = 0;
  for (let i = 0; i < links.length; i++) {
    const a = links[i]!;
    for (let j = i + 1; j < links.length; j++) {
      const b = links[j]!;
      if (layer.get(a.source) !== layer.get(b.source) || layer.get(a.target) !== layer.get(b.target)) continue;
      const ds = (rank.get(a.source) ?? 0) - (rank.get(b.source) ?? 0);
      const dt = (rank.get(a.target) ?? 0) - (rank.get(b.target) ?? 0);
      if (ds * dt < 0) count++;
    }
  }
  return count;
}

/** New positions for every node. `origin` is the top-left corner of the layout (default: that of the nodes now). */
export function layeredLayout(nodes: WorkflowNode[], edges: WorkflowEdge[], origin?: Point): Map<string, Point> {
  const result = new Map<string, Point>();
  if (!nodes.length) return result;
  const corner = origin ?? { x: Math.min(...nodes.map((n) => n.position.x)), y: Math.min(...nodes.map((n) => n.position.y)) };
  // Whole pixels from the start, so laying out the result again lands on the same pixels.
  const start = { x: Math.round(corner.x), y: Math.round(corner.y) };
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const links: Link[] = [];
  for (const e of edges) {
    const key = `${e.source}\u0000${e.target}`;
    if (!byId.has(e.source) || !byId.has(e.target) || e.source === e.target || seen.has(key)) continue;
    seen.add(key);
    links.push({ source: e.source, target: e.target });
  }

  // Columns: longest path from a source.
  const order = topologicalOrder(nodes, edges);
  const position = new Map(order.map((id, i) => [id, i]));
  const layer = new Map<string, number>();
  for (const id of order) {
    let l = 0;
    for (const k of links) {
      // Only predecessors placed before: on a cycle the back edge is ignored.
      if (k.target === id && layer.has(k.source) && (position.get(k.source) ?? 0) < (position.get(id) ?? 0)) l = Math.max(l, (layer.get(k.source) ?? 0) + 1);
    }
    layer.set(id, l);
  }
  const depth = Math.max(...layer.values()) + 1;
  let columns: string[][] = Array.from({ length: depth }, () => []);
  for (const n of nodes) columns[layer.get(n.id) ?? 0]!.push(n.id);

  const ranks = (cols: string[][]) => {
    const r = new Map<string, number>();
    for (const col of cols) col.forEach((id, i) => r.set(id, (i + 0.5) / col.length));
    return r;
  };
  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  for (const k of links) {
    preds.set(k.target, [...(preds.get(k.target) ?? []), k.source]);
    succs.set(k.source, [...(succs.get(k.source) ?? []), k.target]);
  }
  const reorder = (cols: string[][], l: number, neighbours: Map<string, string[]>, before: (other: number) => boolean) => {
    const rank = ranks(cols);
    const col = cols[l]!;
    const keyed = col.map((id, i) => {
      const ns = (neighbours.get(id) ?? []).filter((n) => before(layer.get(n) ?? 0));
      const own = rank.get(id) ?? 0;
      return { id, i, bc: ns.length ? ns.reduce((s, n) => s + (rank.get(n) ?? 0), 0) / ns.length : own };
    });
    keyed.sort((a, b) => a.bc - b.bc || a.i - b.i);
    cols[l] = keyed.map((k) => k.id);
  };

  let best = columns.map((c) => [...c]);
  let bestCount = crossings(links, layer, ranks(best));
  for (let s = 0; s < SWEEPS && bestCount > 0; s++) {
    const down = s % 2 === 0;
    if (down) for (let l = 1; l < depth; l++) reorder(columns, l, preds, (o) => o < l);
    else for (let l = depth - 2; l >= 0; l--) reorder(columns, l, succs, (o) => o > l);
    const count = crossings(links, layer, ranks(columns));
    if (count < bestCount) {
      best = columns.map((c) => [...c]);
      bestCount = count;
    }
  }
  columns = best;

  // Coordinates: columns side by side, each centred on the tallest one.
  const heightOf = (col: string[]) => col.reduce((h, id) => h + nodeHeight(byId.get(id)!), 0) + NODE_GAP * Math.max(0, col.length - 1);
  const tallest = Math.max(...columns.map(heightOf));
  let x = start.x;
  for (const col of columns) {
    let y = start.y + Math.round((tallest - heightOf(col)) / 2);
    for (const id of col) {
      const n = byId.get(id)!;
      result.set(id, { x: Math.round(x), y: Math.round(y) });
      y += nodeHeight(n) + NODE_GAP;
    }
    const widest = Math.max(0, ...col.map((id) => nodeWidth(byId.get(id)!)));
    x += Math.max(LAYER_SPACING, widest + COLUMN_PADDING);
  }
  return result;
}
