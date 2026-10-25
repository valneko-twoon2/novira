// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CORE_NODE_DEFS } from '@/backend/mock/comfyCoreDefs';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { EMPTY_META, useWorkflows } from '@/state/workflows/workflows';
import { TooltipProvider } from '@/ui';
import { comfyTemplates } from './comfyNodes';
import { compileComfyPrompt, runsAsPrompt } from './comfyPrompt';
import { createsCycle, invalidEdges } from './graph';
import { buildTemplate, GRAPH_TEMPLATES } from './graphTemplates';
import { readinessReasons } from './invokeBuilder';
import { MODEL_FIELDS } from './fieldTypes';
import { getTemplate, setExtensionTemplates } from './templates';
import { addOffset, templateReady, TemplatesView } from './TemplatesView';

beforeEach(() => useWorkflows.getState().setGraph({ nodes: [], edges: [], form: [], meta: EMPTY_META }));
afterEach(cleanup);

describe('graph templates', () => {
  beforeAll(() => setExtensionTemplates(comfyTemplates({ ...MOCK_NODE_DEFS, ...CORE_NODE_DEFS, ...PACK_NODE_DEFS })));
  afterAll(() => setExtensionTemplates([]));

  it.each(GRAPH_TEMPLATES.map((t) => [t.id, t] as const))('%s builds a valid graph that only waits for models and images', (_id, template) => {
    const { nodes, edges } = buildTemplate(template);
    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length);
    expect(invalidEdges(nodes, edges)).toEqual([]);
    for (const e of edges) expect(createsCycle(edges.filter((x) => x !== e), e.source, e.target)).toBe(false);
    // Each input takes one connection.
    const targets = edges.map((e) => `${e.target}.${e.targetHandle}`);
    expect(new Set(targets).size).toBe(targets.length);
    // The only missing things are the ones the user picks: a model or a picture.
    const missing = readinessReasons({ nodes, edges });
    for (const reason of missing) expect(reason).toMatch(/モデル|画像|動画|Load Video/);
    expect(missing.some((r) => r.includes('出力'))).toBe(false);
  });

  it.each(GRAPH_TEMPLATES.filter((t) => t.packs).map((t) => [t.id, t] as const))('%s runs as a ComfyUI prompt once a model and pictures are picked', (_id, template) => {
    const { nodes, edges } = buildTemplate(template);
    expect(runsAsPrompt({ nodes })).toBe(true);
    for (const n of nodes) {
      if (n.data.type === 'image') n.data.inputs.image = 'photo.png';
      // Every model the user would pick.
      for (const input of getTemplate(n.data.type)!.inputs) if (MODEL_FIELDS[input.type] && !n.data.inputs[input.name]) n.data.inputs[input.name] = 'model-key';
    }
    const { graph } = compileComfyPrompt({ nodes, edges });
    expect(graph.outputs.length).toBeGreaterThan(0);
    const classes = Object.values(graph.prompt).map((n) => n.class_type);
    for (const n of nodes.filter((x) => x.data.type.startsWith('comfy:'))) expect(classes).toContain(n.data.type.slice('comfy:'.length));
  });

  it('gives fresh ids each time so a template can be added twice', () => {
    const a = buildTemplate(GRAPH_TEMPLATES[0]!);
    const b = buildTemplate(GRAPH_TEMPLATES[0]!);
    expect(a.nodes.some((n) => b.nodes.some((m) => m.id === n.id))).toBe(false);
  });

  it('adds a template to the right of the existing nodes', () => {
    expect(addOffset([])).toEqual({ x: 0, y: 0 });
    expect(addOffset([{ position: { x: 100, y: 40 } }, { position: { x: 900, y: -20 } }])).toEqual({ x: 1360, y: -20 });
  });
});

describe('templates tab', () => {
  it('asks for the packs a template needs before it can be opened', () => {
    setExtensionTemplates([]);
    render(<TooltipProvider><TemplatesView /></TooltipProvider>);
    const withPacks = GRAPH_TEMPLATES.filter((t) => t.packs);
    expect(withPacks.every((t) => !templateReady(t))).toBe(true);
    expect(screen.getAllByTestId('wf-template-install').length).toBeGreaterThanOrEqual(1);
    const open = screen.getAllByTestId('wf-template-open') as HTMLButtonElement[];
    // The graphs of ComfyUI's own nodes wait for ComfyUI too, without packs to install.
    const waiting = GRAPH_TEMPLATES.filter((t) => !templateReady(t));
    expect(waiting.length).toBeGreaterThan(withPacks.length);
    expect(open.filter((b) => b.disabled)).toHaveLength(waiting.length);
    expect(screen.getAllByText('ComfyUI が動き出すと使えます')).toHaveLength(waiting.length - withPacks.length);
  });

  it('lists every template; Open replaces the graph and Add keeps what is there', () => {
    render(<TooltipProvider><TemplatesView /></TooltipProvider>);
    expect(screen.getAllByTestId('wf-template')).toHaveLength(GRAPH_TEMPLATES.length);

    fireEvent.click(screen.getAllByTestId('wf-template-add')[0]!);
    const first = GRAPH_TEMPLATES[0]!.nodes.length;
    expect(useWorkflows.getState().nodes).toHaveLength(first);
    fireEvent.click(screen.getAllByTestId('wf-template-add')[0]!);
    expect(useWorkflows.getState().nodes).toHaveLength(first * 2);

    fireEvent.click(screen.getAllByTestId('wf-template-open')[1]!);
    expect(useWorkflows.getState().nodes).toHaveLength(GRAPH_TEMPLATES[1]!.nodes.length);
  });
});
