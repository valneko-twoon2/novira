// The checks before a workflow is queued (what keeps it from running) and where the values of a built-in graph land in
// the request it queues.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ImageDTO, ModelConfig } from '@/backend';
import { CORE_NODE_DEFS } from '@/backend/mock/comfyCoreDefs';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { t } from '@/i18n';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { useGallery } from '@/state/gallery';
import { usePacks } from '@/state/media/packs';
import { useModels } from '@/state/models';
import { EMPTY_META, type EditorGraph, type WorkflowNode } from '@/state/workflows/workflows';
import { comfyTemplates } from './comfyNodes';
import { buildDefaultGraph } from './defaultGraphs';
import { createNode, makeEdge } from './graph';
import { buildTemplate, GRAPH_TEMPLATES } from './graphTemplates';
import { buildRequest, readinessReasons } from './invokeBuilder';
import { fieldLabel, getTemplate, nodeTitle, setExtensionTemplates } from './templates';

const initial = { packs: useNodePacks.getState(), models: useModels.getState(), gallery: useGallery.getState(), media: usePacks.getState() };
beforeEach(() => setExtensionTemplates(comfyTemplates({ ...MOCK_NODE_DEFS, ...CORE_NODE_DEFS })));
afterEach(() => {
  setExtensionTemplates([]);
  useNodePacks.setState(initial.packs, true);
  useModels.setState(initial.models, true);
  useGallery.setState(initial.gallery, true);
  usePacks.setState(initial.media, true);
});

const node = (type: string, id: string, inputs: Record<string, unknown> = {}) => createNode(getTemplate(type)!, { x: 0, y: 0 }, { id, inputs });
const graphOf = (id: string, name = id): EditorGraph => ({ ...buildTemplate(GRAPH_TEMPLATES.find((g) => g.id === id)!), form: [], meta: { ...EMPTY_META, name } });
const byType = (g: Pick<EditorGraph, 'nodes'>, type: string): WorkflowNode => g.nodes.find((n) => n.data.type === type)!;
const VIDEO_META = { name: '', description: '', author: '', tags: [] as string[] };
const picture = (name: string, width: number, height: number) => ({ name, url: `http://x/full/${name}`, thumbnailUrl: '', width, height, mediaType: 'image' }) as ImageDTO;

/** Text to image with its model picked: ready to run. */
function text2image(name = 'Plain'): EditorGraph {
  const g = graphOf('text2image', name);
  byType(g, 'sdxl_model_loader').data.inputs.model = 'sdxl-key';
  return g;
}

describe('what keeps a workflow from running', () => {
  it('asks for an output node when nothing saves or shows the result, besides what else is missing', () => {
    const g = { nodes: [node('sdxl_model_loader', 'model', { model: '' }), node('noise', 'noise')], edges: [] };
    const missing = t('workflows.readiness.missingModel', { node: nodeTitle('sdxl_model_loader'), field: fieldLabel('sdxl_model_loader', 'model') });
    expect(readinessReasons(g)).toEqual([t('workflows.readiness.noOutput'), missing]);
    g.nodes[0]!.data.inputs.model = 'sdxl-key';
    expect(readinessReasons(g)).toEqual([t('workflows.readiness.noOutput')]);
  });

  it('counts the connections whose types do not match', () => {
    const g = text2image();
    expect(readinessReasons(g)).toEqual([]);
    const pos = byType(g, 'sdxl_compel_prompt');
    const denoise = byType(g, 'denoise_latents');
    g.edges.push(makeEdge(pos.id, 'conditioning', denoise.id, 'cfg_scale'));
    expect(readinessReasons(g)).toEqual([t('workflows.readiness.invalidEdges', { count: 1 })]);
    g.edges.push(makeEdge(pos.id, 'conditioning', denoise.id, 'steps'));
    expect(readinessReasons(g)).toEqual([t('workflows.readiness.invalidEdges', { count: 2 })]);
  });

  it('refuses a Generate Video node among ComfyUI nodes, naming the node', () => {
    usePacks.getState().setPack('video', { state: 'ready' });
    const g = buildDefaultGraph({ id: 'default-video-t2v', ...VIDEO_META }, [])!;
    expect(readinessReasons(g)).toEqual([]);
    g.nodes.push(node('comfy:EmptyImage', 'blank'));
    expect(readinessReasons(g)).toEqual([t('workflows.readiness.comfyUnsupported', { node: nodeTitle('video_generate'), field: '' })]);
  });

  it('lets a node of a missing extension that is wired to nothing stay in the graph', () => {
    const g = text2image();
    g.nodes.push(node('comfy:MockFilmGrain', 'grain', { intensity: 0.4 }));
    setExtensionTemplates([]);
    expect(readinessReasons(g)).toEqual([]);
  });

  it('names a wired node whose extension is gone instead of counting its connections as mismatched ones', () => {
    const g = text2image();
    g.nodes.push(node('comfy:MockFilmGrain', 'grain', { intensity: 0.4 }));
    g.edges.push(makeEdge(byType(g, 'l2i').id, 'image', 'grain', 'image'));
    setExtensionTemplates([]);
    expect(readinessReasons(g)).toEqual([t('workflows.readiness.packGone', { node: 'MockFilmGrain' })]);
    g.nodes.find((n) => n.id === 'grain')!.data.label = 'Grain';
    g.edges.push(makeEdge(byType(g, 'sdxl_compel_prompt').id, 'conditioning', byType(g, 'denoise_latents').id, 'cfg_scale'));
    expect(readinessReasons(g)).toEqual([t('workflows.readiness.packGone', { node: 'Grain' }), t('workflows.readiness.invalidEdges', { count: 1 })]);
  });

  it('asks for the description of a described voice, which only that voice needs', () => {
    usePacks.getState().setPack('voice', { state: 'ready' });
    const g = graphOf('voiceRead');
    const say = byType(g, 'voice_speak');
    expect(readinessReasons(g)).toEqual([]);
    say.data.inputs.mode = 'design';
    say.data.inputs.instruct = '';
    const args = { node: nodeTitle('voice_speak'), field: fieldLabel('voice_speak', 'instruct') };
    expect(readinessReasons(g)).toEqual([t('workflows.readiness.missingInput', args)]);
    say.data.inputs.instruct = 'a calm old man';
    expect(readinessReasons(g)).toEqual([]);
  });

  it('asks for text to read that is more than spaces', () => {
    usePacks.getState().setPack('voice', { state: 'ready' });
    const g = graphOf('voiceRead');
    byType(g, 'voice_speak').data.inputs.text = '   ';
    const args = { node: nodeTitle('voice_speak'), field: fieldLabel('voice_speak', 'text') };
    expect(readinessReasons(g)).toEqual([t('workflows.readiness.missingInput', args)]);
  });

  it('asks for a result a picture graph still lacks: a decoded picture that only feeds an unsaved resize', () => {
    const g = text2image();
    const decode = byType(g, 'l2i');
    const save = byType(g, 'save_image');
    g.nodes = [...g.nodes.filter((n) => n.id !== save.id), node('img_resize', 'resize', { width: 512, height: 512 })];
    g.edges = [...g.edges.filter((e) => e.target !== save.id), makeEdge(decode.id, 'image', 'resize', 'image')];
    expect(readinessReasons(g)).toEqual([t('workflows.readiness.noOutput')]);
  });

  it('checks the CLIP ViT-H encoder for an IP-Adapter saved without a size, the size it runs with', () => {
    const g = text2image();
    const ip = node('ip_adapter', 'ip', { ip_adapter_model: 'k', image: 'a.png' });
    delete ip.data.inputs.clip_vision_model;
    g.nodes.push(ip);
    g.edges.push(makeEdge('ip', 'ip_adapter', byType(g, 'denoise_latents').id, 'ip_adapter'));
    useNodePacks.setState({ packs: { available: true, installed: [{ folder: 'ComfyUI_IPAdapter_plus', url: null, version: null }], comfyVersion: null, restartNeeded: false } });
    useModels.setState({ models: [{ type: 'clip_vision', path: '/m/CLIP-ViT-bigG-14.safetensors' } as ModelConfig] });
    expect(readinessReasons(g)).toEqual([t('workflows.readiness.ipAdapterEncoder', { node: nodeTitle('ip_adapter'), size: 'ViT-H' })]);
    useModels.setState({ models: [{ type: 'clip_vision', path: '/m/CLIP-ViT-H-14.safetensors' } as ModelConfig] });
    expect(readinessReasons(g)).toEqual([]);
  });

  it('asks for a ComfyUI choice the node holds no value for (a model never picked), not for an empty name in the list', () => {
    const g = graphOf('musicAceStep');
    const loader = byType(g, 'comfy:CheckpointLoaderSimple');
    const args = { node: nodeTitle(loader.data.type), field: fieldLabel(loader.data.type, 'ckpt_name') };
    for (const unset of [null, undefined, '']) {
      loader.data.inputs.ckpt_name = unset;
      expect(readinessReasons(g)).toEqual([t('workflows.readiness.missingInput', args)]);
    }
  });

  it('names a ComfyUI choice that is not in the list ComfyUI has now', () => {
    const g = graphOf('musicAceStep');
    const loader = byType(g, 'comfy:CheckpointLoaderSimple');
    loader.data.inputs.ckpt_name = 'elsewhere.safetensors';
    const args = { node: nodeTitle(loader.data.type), field: fieldLabel(loader.data.type, 'ckpt_name') };
    expect(readinessReasons(g)).toEqual([t('workflows.readiness.notInList', { ...args, value: 'elsewhere.safetensors' })]);
  });
});

describe('the request of a built-in picture graph', () => {
  it('takes the prompt and the sampler settings from the Integer and String nodes wired to them', () => {
    const g = text2image();
    const pos = byType(g, 'sdxl_compel_prompt');
    const denoise = byType(g, 'denoise_latents');
    g.nodes.push(node('string', 'words', { value: 'a red fox' }), node('integer', 'steps', { value: 12 }));
    g.edges.push(makeEdge('words', 'value', pos.id, 'prompt'), makeEdge('steps', 'value', denoise.id, 'steps'));
    expect(readinessReasons(g)).toEqual([]);
    const req = buildRequest(g, null, { prepend: false });
    expect(req.params).toMatchObject({ positivePrompt: 'a red fox', steps: 12 });
    expect(req.comfyGraph!.prompt[denoise.id]!.inputs.steps).toBe(12);
  });

  it('records the strength of a picture-to-picture graph as what the sampler leaves of the source', () => {
    useGallery.setState({ images: [picture('a.png', 640, 384)] });
    const g = graphOf('image2image');
    byType(g, 'sdxl_model_loader').data.inputs.model = 'sdxl-key';
    byType(g, 'image').data.inputs.image = 'a.png';
    byType(g, 'denoise_latents').data.inputs.denoising_start = 0.3;
    expect(readinessReasons(g)).toEqual([]);
    const req = buildRequest(g, null, { prepend: false });
    expect(req.params.strength).toBe(0.7);
    expect(req.comfyGraph!.prompt[byType(g, 'denoise_latents').id]!.inputs.denoise).toBe(0.7);
    expect(buildRequest(text2image(), null, { prepend: false }).params).not.toHaveProperty('strength');
  });

  it('names an untitled workflow as untitled', () => {
    expect(buildRequest(text2image(''), null, { prepend: false }).params.workflowName).toBe(t('workflows.untitled'));
  });

  it('saves to the board Save Image names, to none, or to the auto-add board', () => {
    useGallery.setState({ autoAddBoardId: 'auto-board' });
    const g = text2image();
    const save = byType(g, 'save_image');
    const board = (value: unknown) => {
      save.data.inputs.board = value;
      return buildRequest(g, null, { prepend: false }).boardId;
    };
    expect(board('auto')).toBe('auto-board');
    expect(board(undefined)).toBe('auto-board');
    expect(board('none')).toBeNull();
    expect(board(null)).toBeNull();
    expect(board('trips')).toBe('trips');
  });

  it('saves a graph without Save Image (a preview) to the auto-add board', () => {
    useGallery.setState({ autoAddBoardId: 'auto-board' });
    const g = text2image();
    const save = byType(g, 'save_image');
    g.nodes = g.nodes.filter((n) => n.id !== save.id);
    g.edges = g.edges.filter((e) => e.target !== save.id);
    expect(readinessReasons(g)).toEqual([]);
    expect(buildRequest(g, null, { prepend: false }).boardId).toBe('auto-board');
  });
});

describe('the request of a ComfyUI video graph', () => {
  it('tells the speed of a video it re-makes at a set frame rate, but no frame count it cannot know', () => {
    const g = graphOf('videoNarration');
    const video = byType(g, 'comfy:CreateVideo');
    g.edges = g.edges.filter((e) => !(e.target === video.id && e.targetHandle === 'fps'));
    video.data.inputs.fps = 30;
    byType(g, 'comfy:LoadVideo').data.inputs.file = 'clip.mp4';
    const req = buildRequest(g, null, { prepend: false });
    expect(req.params.videoFps).toBe(30);
    expect(req.params).not.toHaveProperty('videoFrames');
  });
});

describe('the request of a Generate Video graph', () => {
  beforeEach(() => usePacks.getState().setPack('video', { state: 'ready' }));

  it('keeps the seed typed in the node when no Random Integer feeds it', () => {
    const g = buildDefaultGraph({ id: 'default-video-t2v', ...VIDEO_META }, [])!;
    const video = byType(g, 'video_generate');
    g.edges = g.edges.filter((e) => !(e.target === video.id && e.targetHandle === 'seed'));
    video.data.inputs.seed = 777;
    const req = buildRequest(g, {}, { prepend: false });
    expect(req.params.seed).toBe(777);
    expect(req.randomizeSeed).toBe(false);
  });

  it('falls back to the default size and no start picture when the chosen picture left the gallery', () => {
    useGallery.setState({ images: [] });
    const g = buildDefaultGraph({ id: 'default-video-i2v', ...VIDEO_META }, [])!;
    byType(g, 'image').data.inputs.image = 'gone.png';
    const req = buildRequest(g, {}, { prepend: false });
    expect(req.params).toMatchObject({ width: 832, height: 480 });
    expect(req.initImageUrl).toBeNull();
  });
});
