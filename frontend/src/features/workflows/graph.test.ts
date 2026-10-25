// Pure workflow graph logic: connection rules, serialization, default graphs and message keys.
import { describe, expect, it } from 'vitest';
import type { ModelConfig } from '@/backend';
import { ja } from '@/i18n/catalog';
import { buildDefaultGraph } from './defaultGraphs';
import { createNode, createsCycle, invalidEdges, isValidConnection, makeEdge } from './graph';
import { readinessReasons } from './invokeBuilder';
import { deserializeWorkflow, serializeWorkflow } from './serialize';
import { NODE_CATEGORIES, NODE_TEMPLATES, categoryKey, fieldLabelKey, getTemplate, nodeDescKey, nodeTitleKey } from './templates';

const tpl = (type: string) => {
  const t = getTemplate(type);
  if (!t) throw new Error(type);
  return t;
};

const MODELS = [
  { key: 'sd1', name: 'sd1', base: 'sd-1', type: 'main' },
  { key: 'xl', name: 'xl', base: 'sdxl', type: 'main' },
] as ModelConfig[];

describe('workflow graph', () => {
  const noise = createNode(tpl('noise'), { x: 0, y: 0 }, { id: 'noise' });
  const denoise = createNode(tpl('denoise_latents'), { x: 0, y: 0 }, { id: 'denoise' });
  const l2i = createNode(tpl('l2i'), { x: 0, y: 0 }, { id: 'l2i' });
  const int = createNode(tpl('integer'), { x: 0, y: 0 }, { id: 'int' });
  const nodes = [noise, denoise, l2i, int];

  it('accepts matching types and integer to float', () => {
    expect(isValidConnection(nodes, [], { source: 'noise', sourceHandle: 'noise', target: 'denoise', targetHandle: 'noise' })).toBe(true);
    expect(isValidConnection(nodes, [], { source: 'int', sourceHandle: 'value', target: 'denoise', targetHandle: 'cfg_scale' })).toBe(true);
  });

  it('rejects mismatched types and missing handles', () => {
    expect(isValidConnection(nodes, [], { source: 'noise', sourceHandle: 'noise', target: 'l2i', targetHandle: 'latents' })).toBe(false);
    expect(isValidConnection(nodes, [], { source: 'noise', sourceHandle: 'nope', target: 'denoise', targetHandle: 'noise' })).toBe(false);
  });

  it('rejects cycles', () => {
    const edges = [makeEdge('denoise', 'width', 'noise', 'width')];
    expect(createsCycle(edges, 'noise', 'denoise')).toBe(true);
    expect(isValidConnection(nodes, edges, { source: 'noise', sourceHandle: 'noise', target: 'denoise', targetHandle: 'noise' })).toBe(false);
  });

  it('detects invalid edges', () => {
    expect(invalidEdges(nodes, [makeEdge('noise', 'noise', 'l2i', 'latents')])).toHaveLength(1);
  });

  it('round-trips through serialization', () => {
    const g = buildDefaultGraph({ id: 'default-t2i-sd15', name: 'T2I', description: '', author: '', tags: ['a'] }, MODELS);
    expect(g).not.toBeNull();
    if (!g) return;
    const back = deserializeWorkflow(JSON.parse(JSON.stringify(serializeWorkflow(g))));
    expect(back?.nodes.map((n) => n.id)).toEqual(g.nodes.map((n) => n.id));
    expect(back?.edges).toHaveLength(g.edges.length);
    expect(back?.form).toEqual(g.form);
    expect(back?.meta.name).toBe('T2I');
  });

  it('rejects unknown node types', () => {
    expect(deserializeWorkflow({ nodes: [{ id: 'x', position: { x: 0, y: 0 }, data: { type: 'nope' } }], edges: [] })).toBeNull();
    expect(deserializeWorkflow(null)).toBeNull();
    expect(deserializeWorkflow({ format: 'another-app', version: 1, nodes: [], edges: [] })).toBeNull();
    expect(deserializeWorkflow({ format: 'novira-workflow', version: 2, nodes: [], edges: [] })).toBeNull();
    expect(deserializeWorkflow({ nodes: [], edges: [] })).not.toBeNull();
  });

  it('default graphs are valid', () => {
    for (const id of ['default-t2i-sd15', 'default-t2i-sdxl', 'default-i2i-sdxl', 'default-multidiffusion', 'default-face-detailer']) {
      const g = buildDefaultGraph({ id, name: id, description: '', author: '', tags: [] }, MODELS);
      expect(g, id).not.toBeNull();
      if (!g) continue;
      expect(invalidEdges(g.nodes, g.edges), id).toEqual([]);
    }
    const t2i = buildDefaultGraph({ id: 'default-t2i-sd15', name: '', description: '', author: '', tags: [] }, MODELS);
    expect(t2i && readinessReasons(t2i)).toEqual([]);
  });

  it('every template message key exists', () => {
    const keys = new Set(Object.keys(ja));
    const missing: string[] = [];
    for (const t of NODE_TEMPLATES) {
      for (const k of [nodeTitleKey(t.type), nodeDescKey(t.type), ...t.inputs.map((i) => fieldLabelKey(i.name)), ...t.outputs.map((o) => fieldLabelKey(o.name))])
        if (!keys.has(k)) missing.push(k);
    }
    for (const c of NODE_CATEGORIES) if (!keys.has(categoryKey(c))) missing.push(categoryKey(c));
    expect(missing).toEqual([]);
  });
});
