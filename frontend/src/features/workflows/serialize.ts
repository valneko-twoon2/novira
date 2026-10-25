// Conversion between the editor graph and the JSON stored in the library, image metadata and files.
import { EMPTY_META, type EditorGraph, type FormField, type WorkflowEdge, type WorkflowMeta, type WorkflowNode } from '@/state/workflows/workflows';
import { createNode, makeEdge } from './graph';
import { packsOfNodes, type PackRef } from './packRequirements';
import { getInput, getOutput, getTemplate } from './templates';

export const WORKFLOW_FORMAT = 'novira-workflow';

export interface SerializedWorkflow {
  format: typeof WORKFLOW_FORMAT;
  version: 1;
  meta: Omit<WorkflowMeta, 'id' | 'category'>;
  nodes: { id: string; position: { x: number; y: number }; data: WorkflowNode['data'] }[];
  edges: { source: string; sourceHandle: string; target: string; targetHandle: string }[];
  form: FormField[];
  /** Custom node packs the nodes come from, so another PC knows what to install. */
  packs?: PackRef[];
}

export function serializeWorkflow(g: Pick<EditorGraph, 'nodes' | 'edges' | 'meta' | 'form'>): SerializedWorkflow {
  const { id: _id, category: _category, ...meta } = g.meta;
  const packs = packsOfNodes(g.nodes);
  return {
    format: WORKFLOW_FORMAT,
    version: 1,
    meta,
    nodes: g.nodes.map((n) => ({ id: n.id, position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }, data: n.data })),
    edges: g.edges.map((e) => ({ source: e.source, sourceHandle: e.sourceHandle ?? '', target: e.target, targetHandle: e.targetHandle ?? '' })),
    form: g.form,
    ...(packs.length ? { packs } : {}),
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

/**
 * Parse a serialized workflow. Unknown node types make it invalid; dangling edges and form fields are dropped. A file
 * that names another format, or a version this editor does not know, is refused: its shape may differ. A file that
 * names neither (written by hand or by an older build) is read as version 1.
 */
export function deserializeWorkflow(raw: unknown): EditorGraph | null {
  const value = typeof raw === 'string' ? safeParse(raw) : raw;
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return null;
  if (value.format !== undefined && value.format !== WORKFLOW_FORMAT) return null;
  if (value.version !== undefined && value.version !== 1) return null;
  const nodes: WorkflowNode[] = [];
  for (const n of value.nodes) {
    if (!isRecord(n) || typeof n.id !== 'string' || !isRecord(n.data) || !isRecord(n.position)) return null;
    const template = getTemplate(str(n.data.type));
    if (!template) return null;
    const d = n.data;
    nodes.push(
      createNode(
        template,
        { x: Number(n.position.x) || 0, y: Number(n.position.y) || 0 },
        {
          id: n.id,
          label: str(d.label),
          notes: str(d.notes),
          isOpen: d.isOpen !== false,
          useCache: typeof d.useCache === 'boolean' ? d.useCache : (template.useCache ?? true),
          inputs: isRecord(d.inputs) ? d.inputs : {},
        },
      ),
    );
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: WorkflowEdge[] = [];
  for (const e of value.edges) {
    if (!isRecord(e)) continue;
    const src = byId.get(str(e.source));
    const tgt = byId.get(str(e.target));
    const sh = str(e.sourceHandle);
    const th = str(e.targetHandle);
    if (!src || !tgt || !getOutput(src.data.type, sh) || !getInput(tgt.data.type, th)) continue;
    edges.push(makeEdge(src.id, sh, tgt.id, th));
  }
  const metaRaw = isRecord(value.meta) ? value.meta : {};
  const meta: WorkflowMeta = { ...EMPTY_META };
  for (const k of ['name', 'author', 'description', 'version', 'tags', 'notes', 'contact'] as const) meta[k] = str(metaRaw[k], EMPTY_META[k]);
  const form = (Array.isArray(value.form) ? value.form : []).filter(
    (f): f is FormField => isRecord(f) && typeof f.fieldName === 'string' && byId.has(str(f.nodeId)) && !!getInput(byId.get(str(f.nodeId))?.data.type ?? '', f.fieldName),
  );
  return { nodes, edges, meta, form };
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
