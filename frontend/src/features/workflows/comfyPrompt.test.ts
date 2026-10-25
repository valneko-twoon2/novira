import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ModelConfig } from '@/backend';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { useModels } from '@/state/models';
import { EMPTY_META, type WorkflowEdge, type WorkflowNode } from '@/state/workflows/workflows';
import { comfyTemplates } from './comfyNodes';
import { ComfyGraphError, compileComfyPrompt, runsAsPrompt } from './comfyPrompt';
import { createNode, makeEdge } from './graph';
import { buildTemplate, GRAPH_TEMPLATES } from './graphTemplates';
import { buildRequest, readinessReasons } from './invokeBuilder';
import { getTemplate, setExtensionTemplates } from './templates';

const initial = { packs: useNodePacks.getState(), models: useModels.getState() };
beforeEach(() => setExtensionTemplates(comfyTemplates(MOCK_NODE_DEFS)));
afterEach(() => {
  setExtensionTemplates([]);
  useNodePacks.setState(initial.packs, true);
  useModels.setState(initial.models, true);
});

const node = (type: string, id: string, inputs: Record<string, unknown> = {}) => createNode(getTemplate(type)!, { x: 0, y: 0 }, { id, inputs });

/** Text to image (with a model picked) with Film Grain between the decoder and Save Image. */
function grainGraph(): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const { nodes, edges } = buildTemplate(GRAPH_TEMPLATES.find((t) => t.id === 'text2image')!);
  const loader = nodes.find((n) => n.data.type === 'sdxl_model_loader')!;
  loader.data.inputs.model = 'sdxl-key';
  const noise = nodes.find((n) => n.data.type === 'noise')!;
  const seedEdge = edges.findIndex((e) => e.target === noise.id && e.targetHandle === 'seed');
  edges.splice(seedEdge, 1);
  noise.data.inputs.seed = 42;
  const decode = nodes.find((n) => n.data.type === 'l2i')!;
  const save = nodes.find((n) => n.data.type === 'save_image')!;
  const grain = node('comfy:MockFilmGrain', 'grain', { intensity: 0.4 });
  const kept = edges.filter((e) => !(e.source === decode.id && e.target === save.id));
  return {
    nodes: [...nodes, grain],
    edges: [...kept, makeEdge(decode.id, 'image', 'grain', 'image'), makeEdge('grain', 'IMAGE', save.id, 'image')],
  };
}

describe('ComfyUI prompt from an editor graph', () => {
  it('is how every graph runs but a video graph without pack nodes', () => {
    expect(runsAsPrompt(buildTemplate(GRAPH_TEMPLATES[0]!))).toBe(true);
    expect(runsAsPrompt(grainGraph())).toBe(true);
    const video = node('video_generate', 'video');
    expect(runsAsPrompt({ nodes: [video] })).toBe(false);
    expect(runsAsPrompt({ nodes: [video, node('comfy:MockFilmGrain', 'grain')] })).toBe(true);
  });

  it('turns built-in nodes into ComfyUI core nodes and passes pack nodes through', () => {
    const g = grainGraph();
    const { graph, seed, random } = compileComfyPrompt(g);
    const byClass = (c: string) => Object.entries(graph.prompt).filter(([, n]) => n.class_type === c);
    const one = (c: string) => {
      const found = byClass(c);
      expect(found).toHaveLength(1);
      return found[0]!;
    };
    const [loaderId, loader] = one('CheckpointLoaderSimple');
    expect(loader.inputs.ckpt_name).toEqual({ $model: 'sdxl-key' });
    const [samplerId, sampler] = one('KSampler');
    expect(sampler.inputs).toMatchObject({
      model: [loaderId, 0],
      seed: { $seed: true },
      steps: 30,
      cfg: 6,
      sampler_name: { $sampler_name: 'dpmpp_2m_k' },
      scheduler: { $scheduler: 'dpmpp_2m_k' },
      denoise: 1,
    });
    expect(seed).toBe(42);
    expect(random).toBe(false);
    expect(byClass('CLIPTextEncode')).toHaveLength(2);
    expect(byClass('EmptyLatentImage')[0]![1].inputs).toEqual({ width: 1024, height: 1024, batch_size: 1 });
    const [decodeId, decode] = one('VAEDecode');
    expect(decode.inputs).toEqual({ samples: [samplerId, 0], vae: [loaderId, 2] });
    expect(graph.prompt.grain).toEqual({
      class_type: 'MockFilmGrain',
      inputs: { image: [decodeId, 0], intensity: 0.4, grain_size: 1.5, monochrome: true, seed: 0 },
    });
    const [saveId, save] = one('SaveImage');
    expect(save.inputs.images).toEqual(['grain', 0]);
    expect(graph.outputs).toEqual([saveId]);
  });

  it('previews a decoded picture nothing saves, and keeps pack output nodes', () => {
    const g = grainGraph();
    const save = g.nodes.find((n) => n.data.type === 'save_image')!;
    g.nodes = g.nodes.filter((n) => n !== save);
    g.edges = g.edges.filter((e) => e.target !== save.id);
    const { graph } = compileComfyPrompt(g);
    // The decoder feeds Film Grain, which is not an output: its picture is previewed.
    expect(graph.outputs).toEqual(['grain:preview']);
    expect(graph.prompt['grain:preview']).toEqual({ class_type: 'PreviewImage', inputs: { images: ['grain', 0] } });
  });

  it('uploads gallery pictures and keeps random seeds random', () => {
    const img = node('image', 'src', { image: 'photo.png' });
    const rig = node('comfy:MockFaceRig', 'rig', { gaze_x: 0.5 });
    const seed = node('rand_int', 'seed');
    const grain = node('comfy:MockFilmGrain', 'grain');
    const preview = node('comfy:MockLandmarkPreview', 'marks');
    const save = node('save_image', 'save');
    const { graph, random } = compileComfyPrompt({
      nodes: [img, rig, seed, grain, preview, save],
      edges: [
        makeEdge('src', 'image', 'rig', 'image'),
        makeEdge('rig', 'image', 'grain', 'image'),
        makeEdge('seed', 'value', 'grain', 'seed'),
        makeEdge('rig', 'landmarks', 'marks', 'landmarks'),
        makeEdge('grain', 'IMAGE', 'save', 'image'),
      ],
    });
    expect(graph.prompt.src).toEqual({ class_type: 'LoadImage', inputs: { image: { $image: 'photo.png' } } });
    expect(graph.prompt.rig!.inputs).toMatchObject({ image: ['src', 0], gaze_x: 0.5, detector: 'yunet' });
    expect(graph.prompt.rig!.inputs).not.toHaveProperty('face_mask');
    expect(graph.prompt.grain!.inputs.seed).toEqual({ $seed: true });
    expect(graph.prompt.marks!.inputs).toMatchObject({ landmarks: ['rig', 1], style: 'mesh' });
    expect(random).toBe(true);
    expect(graph.outputs).toEqual(['save', 'marks']);
  });

  it('says which node is missing what, and which built-in nodes ComfyUI cannot run', () => {
    const rig = node('comfy:MockFaceRig', 'rig');
    const save = node('save_image', 'save');
    const missing = () => compileComfyPrompt({ nodes: [rig, save], edges: [makeEdge('rig', 'image', 'save', 'image')] });
    expect(missing).toThrow(ComfyGraphError);
    try {
      missing();
    } catch (e) {
      expect(e).toMatchObject({ reason: 'missingInput', nodeId: 'rig', field: 'image' });
    }
    const g = grainGraph();
    const collect = node('collect', 'col');
    g.nodes.push(collect);
    g.edges.push(makeEdge('col', 'collection', g.nodes.find((n) => n.data.type === 'noise')!.id, 'width'));
    expect(() => compileComfyPrompt(g)).toThrow(ComfyGraphError);
  });

  it('reports what blocks a pack graph before it is queued, and queues it as a graph job', () => {
    const g = grainGraph();
    expect(readinessReasons(g)).toEqual([]);
    const req = buildRequest({ ...g, form: [], meta: { ...EMPTY_META, name: 'Grain' } }, null, { prepend: false });
    expect(req.params.generationMode).toBe('graph');
    expect(req.params.seed).toBe(42);
    expect(req.randomizeSeed).toBe(false);
    expect(req.comfyGraph?.outputs).toHaveLength(1);
    expect(req.params.positivePrompt).toContain('puppy');

    const blur = node('img_blur', 'blur', { blur_type: 'box' });
    const decode = g.nodes.find((n) => n.data.type === 'l2i')!;
    g.nodes.push(blur);
    g.edges = g.edges.map((e) => (e.source === decode.id && e.target === 'grain' ? makeEdge('blur', 'image', 'grain', 'image') : e));
    g.edges.push(makeEdge(decode.id, 'image', 'blur', 'image'));
    expect(readinessReasons(g).join()).toMatch(/まだ実行できません/);
  });

  it('queues a graph of built-in nodes as a graph job too, and describes it for the gallery', () => {
    const g = grainGraph();
    g.nodes = g.nodes.filter((n) => n.id !== 'grain');
    const decode = g.nodes.find((n) => n.data.type === 'l2i')!;
    const save = g.nodes.find((n) => n.data.type === 'save_image')!;
    g.edges = g.edges.filter((e) => e.source !== 'grain' && e.target !== 'grain');
    g.edges.push(makeEdge(decode.id, 'image', save.id, 'image'));
    expect(readinessReasons(g)).toEqual([]);
    const req = buildRequest({ ...g, form: [], meta: { ...EMPTY_META, name: 'Plain' } }, null, { prepend: false });
    expect(req.params).toMatchObject({ generationMode: 'graph', modelKey: 'sdxl-key', width: 1024, height: 1024, steps: 30, workflowName: 'Plain' });
    // A size worked out by a Math node is the size the gallery records.
    const noise = g.nodes.find((n) => n.data.type === 'noise')!;
    g.nodes.push(node('integer_math', 'sum', { operation: 'ADD', a: 300, b: 340 }));
    g.edges = g.edges.filter((e) => !(e.target === noise.id && e.targetHandle === 'width'));
    g.edges.push(makeEdge('sum', 'value', noise.id, 'width'));
    expect(buildRequest({ ...g, form: [], meta: { ...EMPTY_META, name: 'Plain' } }, null, { prepend: false }).params).toMatchObject({ width: 640, height: 1024 });
    expect(Object.values(req.comfyGraph!.prompt).map((n) => n.class_type)).toEqual(expect.arrayContaining(['CheckpointLoaderSimple', 'KSampler', 'VAEDecode', 'SaveImage']));
    expect(req.initImageUrl).toBeUndefined();
  });

  it('runs an IP-Adapter with the other nodes of the graph', () => {
    const g = grainGraph();
    const ip = node('ip_adapter', 'ip', { ip_adapter_model: 'k', image: 'a.png' });
    const denoise = g.nodes.find((n) => n.data.type === 'denoise_latents')!;
    g.nodes.push(ip);
    g.edges.push(makeEdge('ip', 'ip_adapter', denoise.id, 'ip_adapter'));
    useModels.setState({ models: [{ type: 'clip_vision', path: '/m/CLIP-ViT-H-14.safetensors' } as ModelConfig] });
    useNodePacks.setState({ packs: { available: true, installed: [{ folder: 'ComfyUI_IPAdapter_plus', url: null, version: null }], comfyVersion: null, restartNeeded: false } });
    expect(readinessReasons(g)).toEqual([]);
    const { graph } = compileComfyPrompt(g);
    expect(Object.values(graph.prompt).map((n) => n.class_type)).toContain('IPAdapterAdvanced');
  });

  it('says when the extension or the image encoder an IP-Adapter needs is missing', () => {
    const g = grainGraph();
    const denoise = g.nodes.find((n) => n.data.type === 'denoise_latents')!;
    g.nodes.push(node('ip_adapter', 'ip', { ip_adapter_model: 'k', image: 'a.png', clip_vision_model: 'ViT-G' }));
    g.edges.push(makeEdge('ip', 'ip_adapter', denoise.id, 'ip_adapter'));
    useModels.setState({ models: [{ type: 'clip_vision', path: '/m/CLIP-ViT-H-14.safetensors' } as ModelConfig] });
    useNodePacks.setState({ packs: { available: true, installed: [], comfyVersion: null, restartNeeded: false } });
    const reasons = readinessReasons(g);
    expect(reasons).toHaveLength(2);
    expect(reasons[0]).toContain('ComfyUI_IPAdapter_plus');
    expect(reasons[1]).toContain('ViT-G');
    // A node that feeds nothing needs neither.
    g.edges = g.edges.filter((e) => e.source !== 'ip');
    expect(readinessReasons(g)).toEqual([]);
  });
});
