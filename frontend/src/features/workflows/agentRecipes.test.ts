import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CORE_NODE_DEFS } from '@/backend/mock/comfyCoreDefs';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { agentNodeTypes, agentRecipes, extensionNodes } from './agentRecipes';
import { comfyTemplates } from './comfyNodes';
import { GRAPH_TEMPLATES } from './graphTemplates';
import { setExtensionTemplates } from './templates';

describe('what the assistant is told about graphs', () => {
  beforeAll(() => setExtensionTemplates(comfyTemplates({ ...MOCK_NODE_DEFS, ...CORE_NODE_DEFS, ...PACK_NODE_DEFS })));
  afterAll(() => setExtensionTemplates([]));

  it('lists every recipe with the packs it still lacks', () => {
    const none = agentRecipes([]);
    expect(none.map((r) => r.id)).toEqual(GRAPH_TEMPLATES.map((g) => g.id));
    expect(none.find((r) => r.id === 'removeBackground')?.missing).toEqual(['rmbg']);
    expect(agentRecipes(['rmbg']).find((r) => r.id === 'removeBackground')?.missing).toEqual([]);
    expect(none.find((r) => r.id === 'text2image')?.missing).toEqual([]);
  });

  it('keeps every node type a recipe uses in the node list, and stays small', () => {
    const types = new Set(agentNodeTypes().map((n) => n.type));
    for (const g of GRAPH_TEMPLATES) for (const n of g.nodes) expect(types.has(n[1])).toBe(true);
    expect(JSON.stringify(agentNodeTypes()).length).toBeLessThan(60000);
  });
});

describe('what the assistant is told about the nodes of an extension', () => {
  const defs = { ...MOCK_NODE_DEFS, ...CORE_NODE_DEFS, ...PACK_NODE_DEFS };

  it('lists the nodes of the extension with inputs and outputs, and none of ComfyUI itself', () => {
    const folder = Object.values(PACK_NODE_DEFS)
      .map((d) => /^custom_nodes[./]([^./]+)/.exec(d.python_module ?? '')?.[1])
      .find((f) => f)!;
    const nodes = extensionNodes(defs, folder);
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.length).toBeLessThan(Object.keys(defs).length);
    for (const n of nodes) expect(n.name).not.toBe('');
    expect(extensionNodes(defs, folder.toUpperCase()).length).toBe(nodes.length);
  });

  it('lists nothing for an unknown folder or before the definitions are loaded', () => {
    expect(extensionNodes(defs, 'No-Such-Pack')).toEqual([]);
    expect(extensionNodes(null, 'ComfyUI-RMBG')).toEqual([]);
  });
});
