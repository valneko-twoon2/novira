import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CORE_NODE_DEFS } from '@/backend/mock/comfyCoreDefs';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { comfyTemplates } from './comfyNodes';
import { missingPacks, packsOfNodes } from './packRequirements';
import { setExtensionTemplates } from './templates';

const file = (types: string[], packs?: unknown) => ({
  format: 'novira-workflow',
  version: 1,
  meta: { name: 'Shared' },
  nodes: types.map((type, i) => ({ id: `n${i}`, position: { x: 0, y: 0 }, data: { type, inputs: {} } })),
  edges: [],
  form: [],
  ...(packs ? { packs } : {}),
});

describe('packs a workflow needs', () => {
  beforeAll(() => setExtensionTemplates(comfyTemplates({ ...MOCK_NODE_DEFS, ...CORE_NODE_DEFS, ...PACK_NODE_DEFS })));
  afterAll(() => setExtensionTemplates([]));

  it('names the pack folder of each custom node once, and nothing for the app own nodes', () => {
    const refs = packsOfNodes([{ data: { type: 'comfy:RMBG' } }, { data: { type: 'comfy:RMBG' } }, { data: { type: 'save_image' } }]);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.folder).toBe('ComfyUI-RMBG');
    // The address comes from the suggested packs when nothing is installed from elsewhere.
    expect(refs[0]!.url).toBe('https://github.com/1038lab/ComfyUI-RMBG');
  });

  it('reads the pack list of a file whose nodes are unknown here', () => {
    const missing = missingPacks(file(['comfy:SomeNewNode'], [{ folder: 'ComfyUI-Some', url: 'https://github.com/a/ComfyUI-Some' }]));
    expect(missing).toEqual({ packs: [{ folder: 'ComfyUI-Some', url: 'https://github.com/a/ComfyUI-Some' }], types: ['comfy:SomeNewNode'] });
    expect(missingPacks(JSON.stringify(file(['comfy:SomeNewNode'])))?.packs).toEqual([]);
  });

  it('leaves other failures alone: an unknown app node, a known file, or a broken one', () => {
    expect(missingPacks(file(['no_such_app_node']))).toBeNull();
    expect(missingPacks(file(['comfy:RMBG', 'no_such_app_node']))).toBeNull();
    expect(missingPacks(file(['comfy:RMBG']))).toBeNull();
    expect(missingPacks('not json')).toBeNull();
    expect(missingPacks({ nodes: 3 })).toBeNull();
  });
});
