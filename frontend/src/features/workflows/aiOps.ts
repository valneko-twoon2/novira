// Edits to the workflow being edited that the AI assistant asks for. The operations work on the serialized form of the
// graph and the result goes through the same parser as a loaded file, so unknown node types, missing inputs and
// dangling connections are caught the way they are for any workflow file. What is left out is reported back, so the
// assistant can correct itself.
import type { EditorGraph } from '@/state/workflows/workflows';
import { isCompatible } from './fieldTypes';
import { createNode, createsCycle } from './graph';
import { deserializeWorkflow, serializeWorkflow, type SerializedWorkflow } from './serialize';
import { getInput, getOutput, getTemplate } from './templates';
import { widgetOwnedFields } from './widgetFields';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const MAX_NODES = 200;

function position(v: unknown, fallback: { x: number; y: number }): { x: number; y: number } {
  if (!isRec(v)) return fallback;
  const clamp = (n: unknown, f: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(-100000, Math.min(100000, Math.round(n))) : f);
  return { x: clamp(v.x, fallback.x), y: clamp(v.y, fallback.y) };
}

/**
 * Input values that are plain JSON data, limited to the fields the node type has and its editor screen does not own.
 * The names of the fields that are left out go to `dropped` when it is given.
 */
function inputs(v: unknown, nodeType?: string, dropped?: string[]): Rec {
  if (!isRec(v)) return {};
  const template = nodeType ? getTemplate(nodeType) : undefined;
  if (!template || !nodeType) return v;
  const known = new Set(template.inputs.filter((i) => i.input !== 'connection').map((i) => i.name));
  const owned = new Set(widgetOwnedFields(nodeType));
  const kept = Object.entries(v).filter(([k]) => known.has(k) && !owned.has(k));
  for (const k of Object.keys(v)) if (!known.has(k) || owned.has(k)) dropped?.push(k);
  return Object.fromEntries(kept);
}

interface Link {
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

const LOOP = 'this would make the graph loop back into itself';

/** Why a connection cannot be made between these nodes, or null when it can. */
function connectionProblem(nodes: { id: string; data: { type: string } }[], e: Link): string | null {
  const src = nodes.find((n) => n.id === e.source);
  const dst = nodes.find((n) => n.id === e.target);
  if (!src) return `the node ${e.source} does not exist`;
  if (!dst) return `the node ${e.target} does not exist`;
  const out = getOutput(src.data.type, e.sourceHandle);
  if (!out) return `${src.data.type} has no output named "${e.sourceHandle}"`;
  const input = getInput(dst.data.type, e.targetHandle);
  if (!input) return `${dst.data.type} has no input named "${e.targetHandle}"`;
  if (!isCompatible(out.type, input.type)) return `a ${out.type} output cannot feed a ${input.type} input`;
  return null;
}

/** What was wrong in a graph from the assistant, in words it can act on. */
export interface AssistantGraphReport {
  /** The graph with each node's inputs cleaned. */
  graph: unknown;
  /** The graph cannot open while it holds node types that do not exist. */
  unknownTypes: string[];
  /** Parts the opened graph leaves out: input values a node does not take, and connections that do not fit. */
  dropped: string[];
}

/** A graph from the assistant with each node's inputs cleaned the same way, and what had to be left out or is wrong. */
export function checkAssistantGraph(graph: unknown): AssistantGraphReport {
  const unknownTypes: string[] = [];
  const dropped: string[] = [];
  if (!isRec(graph) || !Array.isArray(graph.nodes)) return { graph, unknownTypes, dropped };
  const typed: { id: string; data: { type: string } }[] = [];
  const nodes = graph.nodes.map((n) => {
    if (!isRec(n) || !isRec(n.data)) return n;
    const type = str(n.data.type);
    typed.push({ id: str(n.id), data: { type } });
    if (!getTemplate(type) && !unknownTypes.includes(type)) unknownTypes.push(type);
    const left: string[] = [];
    const cleaned = inputs(n.data.inputs, type, left);
    for (const k of left) dropped.push(`${str(n.id)}.${k}: ${type} takes no typed value for this`);
    return { ...n, data: { ...n.data, inputs: cleaned } };
  });
  // The connections kept so far, in order, the way loading keeps them: one that closes a loop with them is dropped.
  const kept: Link[] = [];
  for (const e of Array.isArray(graph.edges) ? graph.edges : []) {
    if (!isRec(e)) continue;
    const link = { source: str(e.source), sourceHandle: str(e.sourceHandle), target: str(e.target), targetHandle: str(e.targetHandle) };
    const problem = connectionProblem(typed, link) ?? (createsCycle(kept, link.source, link.target) ? LOOP : null);
    if (problem) dropped.push(`${link.source}.${link.sourceHandle} -> ${link.target}.${link.targetHandle}: ${problem}`);
    else kept.push(link);
  }
  return { graph: { ...graph, nodes }, unknownTypes, dropped };
}

/** A graph from the assistant with each node's inputs cleaned the same way. */
export const cleanedAssistantGraph = (graph: unknown): unknown => checkAssistantGraph(graph).graph;

export interface WorkflowOpsResult {
  graph: SerializedWorkflow;
  /** Operations that took effect. */
  applied: number;
  /** Operations (and parts of them) left out, each with its position in the list and the reason. */
  skipped: string[];
}

/** Applies the operations in order to a copy of the graph. Malformed operations and ones naming something missing are skipped. */
export function applyWorkflowOps(graph: SerializedWorkflow, ops: unknown[]): WorkflowOpsResult {
  let nodes = graph.nodes.map((n) => ({ ...n }));
  let edges = graph.edges.map((e) => ({ ...e }));
  let form = [...graph.form];
  let applied = 0;
  const skipped: string[] = [];
  const has = (id: string) => nodes.some((n) => n.id === id);

  for (const [at, op] of ops.entries()) {
    if (!isRec(op) || typeof op.op !== 'string') {
      skipped.push(`op ${at + 1}: not an object with an "op"`);
      continue;
    }
    const skip = (why: string) => skipped.push(`op ${at + 1} (${op.op}): ${why}`);
    const id = str(op.id);
    switch (op.op) {
      case 'addNode': {
        const template = getTemplate(str(op.nodeType));
        if (!template) {
          skip(`there is no node type "${str(op.nodeType)}"; find one with search_comfy_nodes or take one of get_workflow's nodeTypes`);
          break;
        }
        if (!id || has(id) || nodes.length >= MAX_NODES) {
          skip(!id ? 'a node needs an id' : has(id) ? `a node with the id "${id}" exists already` : `a graph holds at most ${MAX_NODES} nodes`);
          break;
        }
        const left: string[] = [];
        const made = createNode(template, position(op.position, { x: 0, y: 0 }), { id, inputs: inputs(op.inputs, template.type, left) });
        if (left.length) skip(`the node was added, but ${template.type} takes no typed value for: ${left.join(', ')}`);
        nodes = [...nodes, { id, position: { x: Math.round(made.position.x), y: Math.round(made.position.y) }, data: made.data }];
        applied += 1;
        break;
      }
      case 'setInputs': {
        const i = nodes.findIndex((n) => n.id === id);
        if (i < 0 || !isRec(op.inputs)) {
          skip(i < 0 ? `there is no node "${id}"` : 'inputs must be an object');
          break;
        }
        const node = nodes[i]!;
        const left: string[] = [];
        const kept = inputs(op.inputs, node.data.type, left);
        if (left.length) skip(`${node.data.type} takes no typed value for: ${left.join(', ')}`);
        nodes = nodes.map((n, k) => (k === i ? { ...node, data: { ...node.data, inputs: { ...node.data.inputs, ...kept } } } : n));
        applied += 1;
        break;
      }
      case 'move': {
        const i = nodes.findIndex((n) => n.id === id);
        if (i < 0) {
          skip(`there is no node "${id}"`);
          break;
        }
        nodes = nodes.map((n, k) => (k === i ? { ...n, position: position(op.position, n.position) } : n));
        applied += 1;
        break;
      }
      case 'removeNode': {
        if (!has(id)) {
          skip(`there is no node "${id}"`);
          break;
        }
        nodes = nodes.filter((n) => n.id !== id);
        edges = edges.filter((e) => e.source !== id && e.target !== id);
        form = form.filter((f) => f.nodeId !== id);
        applied += 1;
        break;
      }
      case 'connect': {
        const edge = { source: str(op.source), sourceHandle: str(op.sourceHandle), target: str(op.target), targetHandle: str(op.targetHandle) };
        // An input takes one connection, so the one this replaces does not count toward a loop.
        const others = edges.filter((e) => !(e.target === edge.target && e.targetHandle === edge.targetHandle));
        const problem = edge.source === edge.target ? 'a node cannot feed itself' : (connectionProblem(nodes, edge) ?? (createsCycle(others, edge.source, edge.target) ? LOOP : null));
        if (problem) {
          skip(`${edge.source}.${edge.sourceHandle} -> ${edge.target}.${edge.targetHandle}: ${problem}`);
          break;
        }
        // An input takes one connection: a new one replaces the old.
        edges = [...others, edge];
        applied += 1;
        break;
      }
      case 'disconnect': {
        const before = edges.length;
        edges = edges.filter((e) => !(e.source === str(op.source) && e.sourceHandle === str(op.sourceHandle) && e.target === str(op.target) && e.targetHandle === str(op.targetHandle)));
        if (edges.length < before) applied += 1;
        else skip('there is no such connection');
        break;
      }
      default:
        skip(`unknown operation; use addNode, setInputs, move, removeNode, connect or disconnect`);
    }
  }
  return { graph: { ...graph, nodes, edges, form }, applied, skipped };
}

/** What the assistant is told about the workflow being edited. */
export function workflowContext(g: Pick<EditorGraph, 'nodes' | 'edges' | 'meta' | 'form'>): unknown {
  const s = serializeWorkflow(g);
  return {
    name: s.meta.name,
    nodes: s.nodes.map((n) => ({ id: n.id, type: n.data.type, label: n.data.label, position: n.position, inputs: n.data.inputs })),
    edges: s.edges,
  };
}

/** The graph after the operations, or null when the result is not a valid workflow. Details of the library entry stay. */
export function editedGraph(current: EditorGraph, ops: unknown[]): { graph: EditorGraph; applied: number; skipped: string[] } | null {
  const { graph, applied, skipped } = applyWorkflowOps(serializeWorkflow(current), ops);
  const parsed = deserializeWorkflow(graph);
  if (!parsed) return null;
  return { graph: { ...parsed, meta: current.meta }, applied, skipped };
}
