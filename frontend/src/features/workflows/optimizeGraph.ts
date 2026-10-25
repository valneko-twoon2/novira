// Graph optimizer for the workflow editor: merges nodes that compute the same thing, removes nodes whose results never
// reach an output, drops duplicate and dangling edges, and lays the graph out left to right. Pure: the caller decides
// how the result is applied (see optimizeWorkflow.ts).
import type { GraphSnapshot, WorkflowEdge, WorkflowNode } from '@/state/workflows/workflows';
import { makeEdge } from './graph';
import { layeredLayout, topologicalOrder } from './layeredLayout';
import { getInput, getOutput, getTemplate, type NodeTemplate } from './templates';
import { widgetOwnedFields } from './widgetFields';

export interface OptimizeOptions {
  /** Remove nodes whose results never reach an output node (default true). */
  removeDead?: boolean;
  /** Merge only nodes whose outputs are already connected to something (default false). */
  onlyWired?: boolean;
}

export interface OptimizeSummary {
  /** Duplicate nodes merged into another node. */
  merged: number;
  /** Nodes removed because their results reach no output. */
  removed: number;
  /** Edges fewer than before (duplicates, dangling ones, and those of merged or removed nodes). */
  edgesRemoved: number;
  /** Nodes that got a new position. */
  moved: number;
}

export interface OptimizeResult {
  graph: GraphSnapshot;
  summary: OptimizeSummary;
  /** False when the graph is already optimal (the result is the input). */
  changed: boolean;
}

/** Output and side-effect nodes (save, preview, gallery output, ...): never merged, always kept. */
export function isOutputTemplate(template: NodeTemplate): boolean {
  return template.isOutput === true || template.outputs.length === 0;
}

const edgeKey = (e: WorkflowEdge) => `${e.source}\u0000${e.sourceHandle ?? ''}\u0000${e.target}\u0000${e.targetHandle ?? ''}`;

/** JSON with object keys sorted, so equal values give equal text. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Edges whose nodes and handles exist, each connection once. */
function cleanEdges(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  return edges.filter((e) => {
    const src = byId.get(e.source);
    const tgt = byId.get(e.target);
    if (!src || !tgt) return false;
    // Handles are checked only on nodes whose type is known (a pack that is not loaded keeps its edges).
    if (getTemplate(src.data.type) && !getOutput(src.data.type, e.sourceHandle ?? '')) return false;
    if (getTemplate(tgt.data.type) && !getInput(tgt.data.type, e.targetHandle ?? '')) return false;
    const key = edgeKey(e);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Seed inputs that are not connected must hold a fixed number; a random or empty seed makes every run differ. */
function seedsFixed(node: WorkflowNode, template: NodeTemplate, connected: Set<string>): boolean {
  return template.inputs
    .filter((i) => /seed/i.test(i.name) && !connected.has(i.name))
    .every((i) => typeof node.data.inputs[i.name] === 'number' && Number.isFinite(node.data.inputs[i.name]));
}

/** Merges nodes that compute the same value. Returns the surviving edges and the map of merged node -> kept node. */
function mergeDuplicates(graph: GraphSnapshot, edges: WorkflowEdge[], opts: OptimizeOptions): { edges: WorkflowEdge[]; mergedInto: Map<string, string> } {
  const exposed = new Set(graph.form.map((f) => f.nodeId));
  const wired = new Set(edges.map((e) => e.source));
  const incoming = new Map<string, WorkflowEdge[]>();
  for (const e of edges) incoming.set(e.target, [...(incoming.get(e.target) ?? []), e]);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  const mergeable = (n: WorkflowNode): boolean => {
    const template = getTemplate(n.data.type);
    if (n.type !== 'invocation' || !template || isOutputTemplate(template)) return false;
    // Nodes that must run every time (random values, cache turned off) differ between runs.
    if (template.useCache === false || n.data.useCache === false) return false;
    // A custom node's own editor screen or inputs the editor cannot show hold state that cannot be compared here.
    if (widgetOwnedFields(n.data.type).length || template.unsupported?.length) return false;
    // A field in the linear form is meant to be set on its own.
    if (exposed.has(n.id)) return false;
    if (opts.onlyWired && !wired.has(n.id)) return false;
    const connected = new Set((incoming.get(n.id) ?? []).map((e) => e.targetHandle ?? ''));
    return seedsFixed(n, template, connected);
  };

  const mergedInto = new Map<string, string>();
  const rep = (id: string) => mergedInto.get(id) ?? id;
  const kept = new Map<string, string>();
  // Upstream first, so a merge makes the nodes it feeds identical in the same pass.
  for (const id of topologicalOrder(graph.nodes, edges)) {
    const n = byId.get(id)!;
    if (!mergeable(n)) continue;
    const ins = incoming.get(id) ?? [];
    const connected = new Set(ins.map((e) => e.targetHandle ?? ''));
    const values = Object.fromEntries(Object.entries(n.data.inputs).filter(([k]) => !connected.has(k)));
    const links = ins.map((e) => [e.targetHandle ?? '', rep(e.source), e.sourceHandle ?? '']).sort((a, b) => canonical(a).localeCompare(canonical(b)));
    const signature = canonical([n.data.type, n.data.label, n.data.notes, values, links]);
    const first = kept.get(signature);
    if (first) mergedInto.set(id, first);
    else kept.set(signature, id);
  }
  if (!mergedInto.size) return { edges, mergedInto };

  const rewired = edges
    .filter((e) => !mergedInto.has(e.target))
    .map((e) => (mergedInto.has(e.source) ? { ...e, ...makeEdge(rep(e.source), e.sourceHandle ?? '', e.target, e.targetHandle ?? '') } : e));
  const seen = new Set<string>();
  return {
    edges: rewired.filter((e) => {
      const key = edgeKey(e);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
    mergedInto,
  };
}

/** Ids of nodes that are dead: their results reach no output node. Empty when the graph has no output node. */
function deadNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): Set<string> {
  const outputs = nodes.filter((n) => {
    const template = getTemplate(n.data.type);
    return n.type === 'invocation' && template && isOutputTemplate(template);
  });
  if (!outputs.length) return new Set();
  // Also kept: nodes of other kinds (notes) and of types not loaded (their role is unknown), with what feeds them.
  const roots = nodes.filter((n) => n.type !== 'invocation' || !getTemplate(n.data.type) || outputs.includes(n));
  const preds = new Map<string, string[]>();
  for (const e of edges) preds.set(e.target, [...(preds.get(e.target) ?? []), e.source]);
  const live = new Set<string>();
  const stack = roots.map((n) => n.id);
  while (stack.length) {
    const id = stack.pop() as string;
    if (live.has(id)) continue;
    live.add(id);
    stack.push(...(preds.get(id) ?? []));
  }
  return new Set(nodes.filter((n) => !live.has(n.id)).map((n) => n.id));
}

export function optimizeGraph(graph: GraphSnapshot, opts: OptimizeOptions = {}): OptimizeResult {
  let edges = cleanEdges(graph.nodes, graph.edges);
  const merge = mergeDuplicates(graph, edges, opts);
  edges = merge.edges;
  let nodes = graph.nodes.filter((n) => !merge.mergedInto.has(n.id));

  const dead = opts.removeDead === false ? new Set<string>() : deadNodes(nodes, edges);
  if (dead.size) {
    nodes = nodes.filter((n) => !dead.has(n.id));
    edges = edges.filter((e) => !dead.has(e.source) && !dead.has(e.target));
  }
  const gone = (id: string) => merge.mergedInto.has(id) || dead.has(id);
  const form = graph.form.some((f) => gone(f.nodeId)) ? graph.form.filter((f) => !gone(f.nodeId)) : graph.form;

  // The layout keeps the graph's top-left corner where it was.
  const origin = graph.nodes.length
    ? { x: Math.min(...graph.nodes.map((n) => n.position.x)), y: Math.min(...graph.nodes.map((n) => n.position.y)) }
    : undefined;
  const positions = layeredLayout(nodes, edges, origin);
  let moved = 0;
  nodes = nodes.map((n) => {
    const p = positions.get(n.id);
    if (!p || (p.x === n.position.x && p.y === n.position.y)) return n;
    moved++;
    return { ...n, position: p };
  });

  const summary: OptimizeSummary = { merged: merge.mergedInto.size, removed: dead.size, edgesRemoved: graph.edges.length - edges.length, moved };
  const changed = summary.merged + summary.removed + summary.edgesRemoved + summary.moved > 0;
  if (!changed) return { graph, summary, changed };
  return { graph: { nodes, edges, form }, summary, changed };
}
