// Property and fuzz tests for saving and loading workflows: a graph survives serialise / JSON / deserialise, and
// loading arbitrary or damaged JSON never throws and never yields a graph with dangling edges or form fields.
// In-process only: the mock node catalogue, no network.
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CORE_NODE_DEFS } from '@/backend/mock/comfyCoreDefs';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { check, junkJson, junkText, blockExternalNetwork } from '@/propertyTest.testkit';
import type { EditorGraph } from '@/state/workflows/workflows';
import { EMPTY_META } from '@/state/workflows/workflows';
import { comfyTemplates } from './comfyNodes';
import { buildTemplate, GRAPH_TEMPLATES } from './graphTemplates';
import { deserializeWorkflow, serializeWorkflow, WORKFLOW_FORMAT } from './serialize';
import { getInput, getOutput, setExtensionTemplates } from './templates';

blockExternalNetwork();

beforeAll(() => setExtensionTemplates(comfyTemplates({ ...MOCK_NODE_DEFS, ...CORE_NODE_DEFS, ...PACK_NODE_DEFS })));
afterAll(() => setExtensionTemplates([]));

const templateGraph = (id: string): EditorGraph => {
  const t = GRAPH_TEMPLATES.find((x) => x.id === id)!;
  const { nodes, edges } = buildTemplate(t);
  return { nodes, edges, form: nodes.slice(0, 2).flatMap((n) => Object.keys(n.data.inputs).slice(0, 1).map((fieldName) => ({ nodeId: n.id, fieldName }))), meta: { ...EMPTY_META, name: 'x' } };
};
const template = fc.constantFrom(...GRAPH_TEMPLATES.map((t) => t.id));
const edgeKeys = (g: EditorGraph) => g.edges.map((e) => `${e.source}.${e.sourceHandle}>${e.target}.${e.targetHandle}`).sort();

/** Every path to a value inside a JSON document. */
const paths = (v: unknown, at: (string | number)[] = []): (string | number)[][] =>
  v && typeof v === 'object' ? [at, ...Object.entries(v).flatMap(([k, x]) => paths(x, [...at, Array.isArray(v) ? Number(k) : k]))] : [at];

function replaceAt(doc: unknown, path: (string | number)[], value: unknown): unknown {
  if (path.length === 0) return value;
  const copy = Array.isArray(doc) ? [...doc] : { ...(doc as Record<string, unknown>) };
  const [head, ...rest] = path;
  (copy as Record<string | number, unknown>)[head!] = replaceAt((doc as Record<string | number, unknown>)[head!], rest, value);
  return copy;
}

function assertConsistent(g: EditorGraph | null) {
  if (g === null) return;
  const ids = g.nodes.map((n) => n.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const e of g.edges) {
    const src = g.nodes.find((n) => n.id === e.source);
    const tgt = g.nodes.find((n) => n.id === e.target);
    expect(src).toBeDefined();
    expect(tgt).toBeDefined();
    expect(getOutput(src!.data.type, e.sourceHandle ?? '')).toBeDefined();
    expect(getInput(tgt!.data.type, e.targetHandle ?? '')).toBeDefined();
  }
  for (const f of g.form) {
    const node = g.nodes.find((n) => n.id === f.nodeId);
    expect(node).toBeDefined();
    expect(getInput(node!.data.type, f.fieldName)).toBeDefined();
  }
}

describe('workflow files (properties)', () => {
  it('a graph survives serialise, JSON and deserialise (nodes, inputs, edges, form, positions rounded)', () => {
    check(
      fc.property(template, (id) => {
        const g = templateGraph(id);
        const back = deserializeWorkflow(JSON.stringify(serializeWorkflow(g)));
        expect(back).not.toBeNull();
        expect(back!.nodes.map((n) => n.id)).toEqual(g.nodes.map((n) => n.id));
        expect(back!.nodes.map((n) => n.data.type)).toEqual(g.nodes.map((n) => n.data.type));
        expect(back!.nodes.map((n) => n.data.inputs)).toEqual(g.nodes.map((n) => JSON.parse(JSON.stringify(n.data.inputs))));
        expect(back!.nodes.map((n) => n.position)).toEqual(g.nodes.map((n) => ({ x: Math.round(n.position.x), y: Math.round(n.position.y) })));
        expect(edgeKeys(back!)).toEqual(edgeKeys(g));
        expect(back!.form).toEqual(g.form);
        expect(back!.meta.name).toBe('x');
        // and a second round trip changes nothing
        expect(JSON.stringify(serializeWorkflow(back!))).toBe(JSON.stringify(serializeWorkflow(deserializeWorkflow(JSON.stringify(serializeWorkflow(back!)))!)));
      }),
    );
  });

  it('a saved workflow with any one value replaced by junk loads without throwing, or is refused, and is consistent', () => {
    check(
      fc.property(template, fc.nat(), junkJson, (id, pick, junk) => {
        const doc = JSON.parse(JSON.stringify(serializeWorkflow(templateGraph(id)))) as unknown;
        const all = paths(doc);
        const damaged = replaceAt(doc, all[pick % all.length]!, junk);
        assertConsistent(deserializeWorkflow(damaged));
        assertConsistent(deserializeWorkflow(JSON.stringify(damaged)));
      }),
    );
  });

  it('arbitrary JSON and arbitrary text never throw and give null or a consistent graph', () => {
    check(
      fc.property(fc.oneof(junkJson, junkText, fc.record({ format: fc.constant(WORKFLOW_FORMAT), nodes: junkJson, edges: junkJson, meta: junkJson, form: junkJson })), (raw) => {
        assertConsistent(deserializeWorkflow(raw));
      }),
    );
  });
});
