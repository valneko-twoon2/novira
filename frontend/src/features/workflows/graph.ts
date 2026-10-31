// Pure graph helpers: node creation, connection validation, edge checks.
import type { WorkflowEdge, WorkflowNode } from '@/state/workflows/workflows';
import { isCompatible, type FieldType } from './fieldTypes';
import { getInput, getOutput, getTemplate, type NodeTemplate } from './templates';

let seq = 0;
export function newId(prefix = 'n'): string {
  seq += 1;
  return `${prefix.replace(/[^\w-]/g, '_')}-${Date.now().toString(36)}-${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function createNode(template: NodeTemplate, position: { x: number; y: number }, init: Partial<WorkflowNode['data']> & { id?: string } = {}): WorkflowNode {
  const { id, ...data } = init;
  const inputs: Record<string, unknown> = {};
  for (const i of template.inputs) if (i.input !== 'connection') inputs[i.name] = i.default ?? null;
  return {
    id: id ?? newId(template.type),
    type: 'invocation',
    position,
    data: {
      type: template.type,
      label: '',
      notes: '',
      isOpen: true,
      useCache: template.useCache ?? true,
      ...data,
      inputs: { ...inputs, ...data.inputs },
    },
  };
}

function edgeId(source: string, sourceHandle: string, target: string, targetHandle: string): string {
  return `e-${source}.${sourceHandle}-${target}.${targetHandle}`;
}

export interface ConnectionLike {
  source: string | null;
  target: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/** Field types at both ends of a connection, or null when a handle does not exist. */
export function connectionTypes(nodes: WorkflowNode[], c: ConnectionLike): { from: FieldType; to: FieldType } | null {
  const src = nodes.find((n) => n.id === c.source);
  const tgt = nodes.find((n) => n.id === c.target);
  if (!src || !tgt || !c.sourceHandle || !c.targetHandle) return null;
  const o = getOutput(src.data.type, c.sourceHandle);
  const i = getInput(tgt.data.type, c.targetHandle);
  if (!o || !i || i.input === 'direct') return null;
  return { from: o.type, to: i.type };
}

/** True when adding source -> target would close a cycle. */
export function createsCycle(edges: Pick<WorkflowEdge, 'source' | 'target'>[], source: string, target: string): boolean {
  if (source === target) return true;
  const out = new Map<string, string[]>();
  for (const e of edges) out.set(e.source, [...(out.get(e.source) ?? []), e.target]);
  const stack = [target];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop() as string;
    if (id === source) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(out.get(id) ?? []));
  }
  return false;
}

/** Validation for a new connection. An existing edge into the same input is replaced, so it is ignored here. */
export function isValidConnection(nodes: WorkflowNode[], edges: WorkflowEdge[], c: ConnectionLike): boolean {
  const types = connectionTypes(nodes, c);
  if (!types || !isCompatible(types.from, types.to)) return false;
  const others = edges.filter((e) => !(e.target === c.target && e.targetHandle === c.targetHandle));
  return !createsCycle(others, c.source as string, c.target as string);
}

/** Edges whose endpoints are missing or whose types do not match. */
export function invalidEdges(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowEdge[] {
  return edges.filter((e) => {
    const types = connectionTypes(nodes, e);
    return !types || !isCompatible(types.from, types.to);
  });
}

export function isInputConnected(edges: WorkflowEdge[], nodeId: string, fieldName: string): boolean {
  return edges.some((e) => e.target === nodeId && e.targetHandle === fieldName);
}

export function incomingEdge(edges: WorkflowEdge[], nodeId: string, fieldName: string): WorkflowEdge | undefined {
  return edges.find((e) => e.target === nodeId && e.targetHandle === fieldName);
}

export function makeEdge(source: string, sourceHandle: string, target: string, targetHandle: string): WorkflowEdge {
  return { id: edgeId(source, sourceHandle, target, targetHandle), source, sourceHandle, target, targetHandle, type: 'field' };
}

/** The handle a connection is being dragged from. */
export interface DragFrom {
  nodeId: string;
  handle: string;
  side: 'source' | 'target';
}

/** Whether the handle can take the connection dragged from `from` (opposite side, other node, compatible type, no cycle). */
export function acceptsDrag(nodes: WorkflowNode[], edges: WorkflowEdge[], from: DragFrom, to: { nodeId: string; handle: string; side: 'source' | 'target' }): boolean {
  if (to.side === from.side || to.nodeId === from.nodeId) return false;
  const c: ConnectionLike =
    from.side === 'source'
      ? { source: from.nodeId, sourceHandle: from.handle, target: to.nodeId, targetHandle: to.handle }
      : { source: to.nodeId, sourceHandle: to.handle, target: from.nodeId, targetHandle: from.handle };
  return isValidConnection(nodes, edges, c);
}

/** The handles of a node (inputs with a socket on the left, outputs on the right). */
function handlesOf(template: NodeTemplate): { handle: string; side: 'source' | 'target' }[] {
  return [
    ...template.inputs.filter((i) => i.input !== 'direct').map((i) => ({ handle: i.name, side: 'target' as const })),
    ...template.outputs.map((o) => ({ handle: o.name, side: 'source' as const })),
  ];
}

export function nodeAcceptsDrag(nodes: WorkflowNode[], edges: WorkflowEdge[], from: DragFrom, nodeId: string, template: NodeTemplate): boolean {
  return handlesOf(template).some((h) => acceptsDrag(nodes, edges, from, { nodeId, ...h }));
}

/** The connection to make when a drag is released on a node's body: the first fitting handle, a free one first. */
export function autoConnection(nodes: WorkflowNode[], edges: WorkflowEdge[], from: DragFrom, nodeId: string): ConnectionLike | null {
  const node = nodes.find((n) => n.id === nodeId);
  const template = node && getTemplate(node.data.type);
  if (!template) return null;
  const fits = handlesOf(template).filter((h) => acceptsDrag(nodes, edges, from, { nodeId, ...h }));
  const taken = (h: { handle: string; side: string }) => h.side === 'target' && edges.some((e) => e.target === nodeId && e.targetHandle === h.handle);
  const pick = fits.find((h) => !taken(h)) ?? fits[0];
  if (!pick) return null;
  return from.side === 'source'
    ? { source: from.nodeId, sourceHandle: from.handle, target: nodeId, targetHandle: pick.handle }
    : { source: nodeId, sourceHandle: pick.handle, target: from.nodeId, targetHandle: from.handle };
}

/** Templates offering a handle compatible with the dragged handle, with the field to connect. */
export function compatibleField(template: NodeTemplate, from: { type: FieldType; side: 'source' | 'target' }): string | null {
  if (from.side === 'source') {
    const i = template.inputs.find((x) => x.input !== 'direct' && isCompatible(from.type, x.type));
    return i?.name ?? null;
  }
  const o = template.outputs.find((x) => isCompatible(x.type, from.type));
  return o?.name ?? null;
}

