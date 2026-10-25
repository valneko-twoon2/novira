// Running the sound and video graphs: what blocks them before they are queued (a model ComfyUI does not list), and what
// the queued request tells the gallery about the sound or video it makes.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CORE_NODE_DEFS } from '@/backend/mock/comfyCoreDefs';
import type { ComfyNodeDefs } from '@/backend';
import { EMPTY_META, type EditorGraph } from '@/state/workflows/workflows';
import { comfyTemplates } from './comfyNodes';
import { buildTemplate, GRAPH_TEMPLATES } from './graphTemplates';
import { buildRequest, readinessReasons } from './invokeBuilder';
import { setExtensionTemplates } from './templates';

const defsWith = (patch: (defs: ComfyNodeDefs) => void): void => {
  const defs = structuredClone(CORE_NODE_DEFS);
  patch(defs);
  setExtensionTemplates(comfyTemplates(defs));
};
beforeEach(() => setExtensionTemplates(comfyTemplates(CORE_NODE_DEFS)));
afterEach(() => setExtensionTemplates([]));

const graphOf = (id: string): EditorGraph => ({ ...buildTemplate(GRAPH_TEMPLATES.find((t) => t.id === id)!), form: [], meta: { ...EMPTY_META, name: id } });

describe('the ready-made sound and video graphs', () => {
  it('are ready to run once the models they name are in ComfyUI\'s lists', () => {
    expect(readinessReasons(graphOf('musicAceStep'))).toEqual([]);
    expect(readinessReasons(graphOf('videoWan22'))).toEqual([]);
  });

  it('say which model is missing, whether ComfyUI lists none or lists others', () => {
    const music = graphOf('musicAceStep');
    defsWith((defs) => {
      defs.CheckpointLoaderSimple!.input.required!.ckpt_name![0] = ['other.safetensors'] as never;
    });
    const reasons = readinessReasons(music);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatch(/「ace_step_1\.5_turbo_aio\.safetensors」は ComfyUI の一覧にありません/);
    defsWith((defs) => {
      defs.UNETLoader!.input.required!.unet_name![0] = [] as never;
    });
    expect(readinessReasons(graphOf('videoWan22')).join()).toMatch(/選べるファイルがありません/);
  });

  it('do not ask about the choices of a format that is not the one chosen', () => {
    // The MP3 and Opus qualities and the codecs only count while their format is chosen; FLAC and MP4 ask for none.
    expect(readinessReasons(graphOf('musicAceStep'))).toEqual([]);
    const g = graphOf('musicAceStep');
    g.nodes.find((n) => n.data.type === 'comfy:SaveAudioAdvanced')!.data.inputs['format.quality'] = 'not a quality';
    expect(readinessReasons(g)).toEqual([]);
    g.nodes.find((n) => n.data.type === 'comfy:SaveAudioAdvanced')!.data.inputs.format = 'mp3';
    expect(readinessReasons(g).join()).toMatch(/not a quality/);
  });

  it('wait for the start picture of the picture-to-video graph', () => {
    const g = graphOf('videoWan22Image');
    expect(readinessReasons(g).join()).toMatch(/画像/);
    g.nodes.find((n) => n.data.type === 'image')!.data.inputs.image = 'photo.png';
    expect(readinessReasons(g)).toEqual([]);
  });
});

describe('the request of a sound or video graph', () => {
  it('describes a song by the style tags, the sampler and the model it loads, and takes a new seed each run', () => {
    const g = graphOf('musicAceStep');
    const req = buildRequest(g, {}, { prepend: false });
    expect(req.params).toMatchObject({
      generationMode: 'graph',
      positivePrompt: expect.stringContaining('city pop'),
      modelName: 'ace_step_1.5_turbo_aio.safetensors',
      steps: 8,
      cfgScale: 1,
      workflowName: 'musicAceStep',
    });
    expect(req.randomizeSeed).toBe(true);
    expect(req.comfyGraph!.outputs).toEqual([g.nodes.find((n) => n.data.type === 'comfy:SaveAudioAdvanced')!.id]);
    expect(req.comfyGraph!.thumbnail).toBeUndefined();
  });

  it('describes a video by its prompts, size, frames and speed, and names the node that gives its first frame', () => {
    const g = graphOf('videoWan22');
    const req = buildRequest(g, {}, { prepend: false });
    const save = g.nodes.find((n) => n.data.type === 'comfy:SaveVideo')!.id;
    expect(req.params).toMatchObject({
      generationMode: 'graph',
      positivePrompt: expect.stringContaining('puppy'),
      negativePrompt: expect.stringContaining('blurry'),
      modelName: 'wan2.2_ti2v_5B_fp16.safetensors',
      steps: 20,
      cfgScale: 5,
      width: 832,
      height: 480,
      videoFrames: 49,
      videoFps: 24,
    });
    expect(req.comfyGraph!.outputs).toEqual([save]);
    expect(req.comfyGraph!.thumbnail).toBe(`${save}:frame`);
    expect(req.randomizeSeed).toBe(true);
  });
});
