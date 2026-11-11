// What the features tell the assistant: the editors, the workflow opener and node lists, an extension's nodes and the model selection.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModelConfig } from '@/backend';
import {
  agentEditor,
  agentWorkflow,
  extensionNodes,
  registerAgentEditor,
  registerAgentExtensionNodes,
  registerAgentModelSelector,
  registerAgentWorkflow,
  selectAgentModel,
  type AgentEditor,
} from './agentRegistry';

const editor = (): AgentEditor => ({ context: () => ({ n: 1 }), apply: () => true, snapshot: () => 's', restore: () => undefined });
const model = { key: 'wai', name: 'wai' } as ModelConfig;

afterEach(() => vi.unstubAllEnvs());

describe('agent editors', () => {
  it('gives back the editor registered for a screen, and none for a screen that has none', () => {
    const e = editor();
    registerAgentEditor('text', e);
    expect(agentEditor('text')).toBe(e);
    expect(agentEditor('workflows')).toBeUndefined();
  });

  it('hides the editor of a screen the production build leaves out', () => {
    const e = editor();
    registerAgentEditor('comic', e);
    expect(agentEditor('comic')).toBe(e);
    vi.stubEnv('MODE', 'production');
    expect(agentEditor('comic')).toBeUndefined();
    registerAgentEditor('text', e);
    expect(agentEditor('text')).toBe(e);
  });
});

describe('the workflow side', () => {
  it('does nothing before the workflows feature registers: nothing opened, no nodes, no recipes, search not ready', () => {
    registerAgentWorkflow(() => ({ dropped: [] }), () => []);
    expect(agentWorkflow.open('a', {})).toEqual({ dropped: [] });
    expect(agentWorkflow.nodeTypes()).toEqual([]);
    expect(agentWorkflow.recipes(['pack'])).toEqual([]);
    expect(agentWorkflow.searchNodes('blur', 5)).toEqual({ ready: false, total: 0, matches: [] });
  });

  it('uses what the feature registers', () => {
    const open = vi.fn(() => ({ error: 'no', dropped: ['x'] }));
    const types = vi.fn(() => [{ type: 'Blur' }] as never);
    const recipes = vi.fn(() => [{ id: 'r' }] as never);
    const search = vi.fn(() => ({ ready: true, total: 1, matches: [] }));
    registerAgentWorkflow(open, types, recipes, search);
    expect(agentWorkflow.open('flow', { g: 1 })).toEqual({ error: 'no', dropped: ['x'] });
    expect(open).toHaveBeenCalledWith('flow', { g: 1 });
    expect(agentWorkflow.nodeTypes()).toEqual([{ type: 'Blur' }]);
    expect(agentWorkflow.recipes(['p'])).toEqual([{ id: 'r' }]);
    expect(recipes).toHaveBeenCalledWith(['p']);
    expect(agentWorkflow.searchNodes('blur', 3).ready).toBe(true);
    expect(search).toHaveBeenCalledWith('blur', 3);
  });
});

describe('the nodes of an extension', () => {
  it('asks the editor that registered for them', () => {
    registerAgentExtensionNodes((folder) => [{ type: `${folder}-node` }] as never);
    expect(extensionNodes('pack')).toEqual([{ type: 'pack-node' }]);
  });
});

describe('selecting a model', () => {
  it('uses the richer selection once the params feature registers it', () => {
    const select = vi.fn();
    registerAgentModelSelector(select);
    selectAgentModel(model);
    expect(select).toHaveBeenCalledWith(model);
  });

  it('otherwise only sets the model key', async () => {
    vi.resetModules();
    const fresh = await import('./agentRegistry');
    const params = await import('./params');
    fresh.selectAgentModel(model);
    expect(params.useParams.getState().modelKey).toBe('wai');
  });
});
