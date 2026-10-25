// Compiling single built-in and pack nodes to ComfyUI prompts: loaders, pictures and their sizes, blur, previews, values,
// and the failures (a missing input, an unsupported connection).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import type { ComfyNodeDef, ImageDTO } from '@/backend';
import { useGallery } from '@/state/gallery';
import type { WorkflowEdge, WorkflowNode } from '@/state/workflows/workflows';
import { comfyTemplates } from './comfyNodes';
import { ComfyGraphError, compileComfyPrompt } from './comfyPrompt';
import { createNode, makeEdge } from './graph';
import { getTemplate, setExtensionTemplates } from './templates';

/** A pack node with a picture picked from the gallery (`image_upload`), one required and one optional. */
const PICTURE_NODE: ComfyNodeDef = {
  input: { required: { picture: ['IMAGE', { image_upload: true }] }, optional: { extra: ['IMAGE', { image_upload: true }] } },
  output: ['IMAGE'],
  output_name: ['IMAGE'],
  name: 'MockPicture',
  python_module: 'custom_nodes.Mock-Tools',
  output_node: false,
};

const initialGallery = useGallery.getState();
beforeEach(() => setExtensionTemplates(comfyTemplates({ ...MOCK_NODE_DEFS, MockPicture: PICTURE_NODE })));
afterEach(() => {
  setExtensionTemplates([]);
  useGallery.setState(initialGallery, true);
});

const node = (type: string, id: string, inputs: Record<string, unknown> = {}) => createNode(getTemplate(type)!, { x: 0, y: 0 }, { id, inputs });

/** Compiles `nodes` with `source.handle` feeding Film Grain's `field`, and Film Grain saved. */
function through(nodes: WorkflowNode[], edges: WorkflowEdge[], source: string, handle: string, field = 'image') {
  const grain = node('comfy:MockFilmGrain', 'grain', field === 'image' ? {} : { intensity: 0 });
  const save = node('save_image', 'save');
  const bridge = field === 'image' || !nodes.some((n) => n.id === 'src') ? [] : [makeEdge('src', 'image', 'grain', 'image')];
  return compileComfyPrompt({
    nodes: [...nodes, grain, save],
    edges: [...edges, ...bridge, makeEdge(source, handle, 'grain', field), makeEdge('grain', 'IMAGE', 'save', 'image')],
  });
}

const picture = () => node('image', 'src', { image: 'a.png' });
const fail = (run: () => unknown): ComfyGraphError => {
  try {
    run();
  } catch (e) {
    return e as ComfyGraphError;
  }
  throw new Error('expected the compile to fail');
};

describe('model loaders', () => {
  const base = () => [node('main_model_loader', 'ckpt', { model: 'm-key' }), node('lora_loader', 'lora', { lora: 'l-key', weight: 0.5 })];

  it('compiles a LoRA without a text encoder to the model-only loader', () => {
    const { graph } = through(base(), [makeEdge('ckpt', 'unet', 'lora', 'unet')], 'lora', 'unet');
    expect(graph.prompt.lora).toEqual({ class_type: 'LoraLoaderModelOnly', inputs: { model: ['ckpt', 0], lora_name: { $model: 'l-key' }, strength_model: 0.5 } });
  });

  it('compiles a LoRA with a text encoder to the full loader and exposes both outputs', () => {
    const { graph } = through(base(), [makeEdge('ckpt', 'unet', 'lora', 'unet'), makeEdge('ckpt', 'clip', 'lora', 'clip')], 'lora', 'clip');
    expect(graph.prompt.lora).toEqual({
      class_type: 'LoraLoader',
      inputs: { model: ['ckpt', 0], clip: ['ckpt', 1], lora_name: { $model: 'l-key' }, strength_model: 0.5, strength_clip: 0.5 },
    });
    expect(graph.prompt.grain!.inputs.image).toEqual(['lora', 1]);
  });

  it('names the missing model input of a LoRA', () => {
    expect(fail(() => through(base(), [], 'lora', 'unet'))).toMatchObject({ reason: 'missingInput', nodeId: 'lora', field: 'unet' });
  });

  it('compiles a VAE loader', () => {
    const { graph } = through([node('vae_loader', 'vae', { vae_model: 'v-key' })], [], 'vae', 'vae');
    expect(graph.prompt.vae).toEqual({ class_type: 'VAELoader', inputs: { vae_name: { $model: 'v-key' } } });
  });
});

describe('pictures and their sizes', () => {
  it('uses the size of a gallery picture it knows', () => {
    useGallery.setState({ images: [{ name: 'a.png', width: 640, height: 480 } as ImageDTO] });
    const { graph } = through([picture()], [], 'src', 'width', 'intensity');
    expect(graph.prompt.src).toEqual({ class_type: 'LoadImage', inputs: { image: { $image: 'a.png' } } });
    expect(graph.prompt.grain!.inputs.intensity).toBe(640);
    expect(graph.prompt['src:size']).toBeUndefined();
  });

  it('asks ComfyUI to measure a picture it does not know', () => {
    const { graph } = through([picture()], [], 'src', 'height', 'intensity');
    expect(graph.prompt['src:size']).toEqual({ class_type: 'GetImageSize', inputs: { image: ['src', 0] } });
    expect(graph.prompt.grain!.inputs.intensity).toEqual(['src:size', 1]);
  });

  it('passes a connected picture through and measures that one', () => {
    const nodes = [picture(), node('image', 'again')];
    const edges = [makeEdge('src', 'image', 'again', 'image')];
    const out = through(nodes, edges, 'again', 'image');
    expect(out.graph.prompt.again).toBeUndefined();
    expect(out.graph.prompt.grain!.inputs.image).toEqual(['src', 0]);
    const sized = through(nodes, edges, 'again', 'width', 'intensity');
    expect(sized.graph.prompt['again:size']).toEqual({ class_type: 'GetImageSize', inputs: { image: ['src', 0] } });
    expect(sized.graph.prompt.grain!.inputs.intensity).toEqual(['again:size', 0]);
  });

  it('names a picture node that has no picture', () => {
    expect(fail(() => through([node('image', 'src')], [], 'src', 'image'))).toMatchObject({ reason: 'missingInput', nodeId: 'src', field: 'image' });
  });

  it('blurs with the radius and sigma limited to what ComfyUI accepts', () => {
    const nodes = [picture(), node('img_blur', 'blur', { radius: 40, blur_type: 'gaussian' })];
    const { graph } = through(nodes, [makeEdge('src', 'image', 'blur', 'image')], 'blur', 'image');
    expect(graph.prompt.blur).toEqual({ class_type: 'ImageBlur', inputs: { image: ['src', 0], blur_radius: 31, sigma: 10 } });
  });

  it('cannot run a box blur', () => {
    const nodes = [picture(), node('img_blur', 'blur', { blur_type: 'box' })];
    expect(fail(() => through(nodes, [makeEdge('src', 'image', 'blur', 'image')], 'blur', 'image'))).toMatchObject({ reason: 'unsupported', nodeId: 'blur', field: 'blur_type' });
  });

  it('loads the gallery picture a built-in node holds itself', () => {
    const resize = node('img_resize', 'rs', { image: 'b.png', width: 64, height: 64 });
    const { graph } = through([resize], [], 'rs', 'image');
    expect(graph.prompt['rs:image']).toEqual({ class_type: 'LoadImage', inputs: { image: { $image: 'b.png' } } });
    expect(graph.prompt.rs!.inputs.image).toEqual(['rs:image', 0]);
    expect(fail(() => through([node('img_resize', 'rs')], [], 'rs', 'image'))).toMatchObject({ reason: 'missingInput', nodeId: 'rs', field: 'image' });
  });

  it('works out Integer Math and Float Math from plain numbers', () => {
    const value = (type: string, inputs: Record<string, unknown>) => through([picture(), node(type, 'm', inputs)], [], 'm', 'value', 'intensity').graph.prompt.grain!.inputs.intensity;
    expect(value('integer_math', { operation: 'ADD', a: 2, b: 3 })).toBe(5);
    expect(value('integer_math', { operation: 'DIV', a: 7, b: 2 })).toBe(3);
    expect(value('integer_math', { operation: 'MOD', a: 7, b: 4 })).toBe(3);
    expect(value('integer_math', { operation: 'MAX', a: 7, b: 4 })).toBe(7);
    expect(value('float_math', { operation: 'MUL', a: 1.5, b: 4 })).toBe(6);
    expect(value('float_math', { operation: 'SQRT', a: 9, b: 0 })).toBe(3);
    expect(value('float_math', { operation: 'ABS', a: -2.5, b: 0 })).toBe(2.5);
  });

  it('refuses a sum with no result, or one that needs a number only the run knows', () => {
    const run = (type: string, inputs: Record<string, unknown>) => () => through([picture(), node(type, 'm', inputs)], [], 'm', 'value', 'intensity');
    expect(fail(run('integer_math', { operation: 'DIV', a: 1, b: 0 }))).toMatchObject({ reason: 'unsupported', nodeId: 'm', field: 'operation' });
    expect(fail(run('integer_math', { operation: 'SQRT', a: 4, b: 1 }))).toMatchObject({ reason: 'unsupported', nodeId: 'm' });
    const random = () => through([picture(), node('rand_int', 'r'), node('integer_math', 'm', { operation: 'ADD', b: 1 })], [makeEdge('r', 'value', 'm', 'a')], 'm', 'value', 'intensity');
    expect(fail(random)).toMatchObject({ reason: 'unsupported', nodeId: 'm', field: 'a' });
  });

  it('turns primitive nodes into plain values', () => {
    const { graph } = through([picture(), node('integer', 'n', { value: 7 })], [], 'n', 'value', 'intensity');
    expect(graph.prompt.grain!.inputs.intensity).toBe(7);
    expect(graph.prompt.n).toBeUndefined();
  });

  it('rejects a ControlNet wired into a plain input', () => {
    const nodes = [picture(), node('controlnet', 'cn', { control_model: 'c-key', image: 'a.png' })];
    expect(fail(() => through(nodes, [makeEdge('src', 'image', 'cn', 'image')], 'cn', 'control', 'intensity'))).toMatchObject({ reason: 'unsupported', nodeId: 'grain', field: 'intensity' });
  });
});

describe('samplers', () => {
  const sampler = (extra: Record<string, unknown> = {}) =>
    node('denoise_latents', 'den', { positive_conditioning: 'p', negative_conditioning: 'n', noise: 'z', unet: 'u', steps: 20, cfg_scale: 5, scheduler: 'euler', ...extra });

  it('takes a random seed when no noise node fixes one', () => {
    const out = through([sampler()], [], 'den', 'latents');
    expect(out.random).toBe(true);
    expect(out.seed).toBeNull();
    expect(out.graph.prompt.den!.inputs.seed).toEqual({ $seed: true });
  });

  it('cannot say the size of the latent without a noise node', () => {
    expect(fail(() => through([sampler(), picture()], [], 'den', 'width', 'intensity'))).toMatchObject({ reason: 'unsupported', nodeId: 'den', field: 'width' });
  });

  it('does not run a control input that is not a ControlNet, nor an IP-Adapter input that is not an IP-Adapter', () => {
    const withValue = () => through([sampler(), node('integer', 'n', { value: 1 })], [makeEdge('n', 'value', 'den', 'control')], 'den', 'latents');
    expect(fail(withValue)).toMatchObject({ reason: 'unsupported', nodeId: 'den', field: 'control' });
    const withNumber = () => through([sampler(), node('integer', 'n', { value: 1 })], [makeEdge('n', 'value', 'den', 'ip_adapter')], 'den', 'latents');
    expect(fail(withNumber)).toMatchObject({ reason: 'unsupported', nodeId: 'den', field: 'ip_adapter' });
  });

  it('patches the model the sampler runs with an IP-Adapter', () => {
    const adapter = node('ip_adapter', 'ip', { ip_adapter_model: 'k', image: 'a.png', clip_vision_model: 'ViT-G', weight: 0.6, method: 'style', begin_step_percent: 0.1, end_step_percent: 0.9 });
    const { graph } = through([sampler(), adapter], [makeEdge('ip', 'ip_adapter', 'den', 'ip_adapter')], 'den', 'latents');
    expect(graph.prompt['den:ipadapter']).toEqual({ class_type: 'IPAdapterModelLoader', inputs: { ipadapter_file: { $model: 'k' } } });
    expect(graph.prompt['den:clipvision']).toEqual({ class_type: 'CLIPVisionLoader', inputs: { clip_name: { $clip_vision: 'ViT-G' } } });
    expect(graph.prompt['ip:image']).toEqual({ class_type: 'LoadImage', inputs: { image: { $image: 'a.png' } } });
    expect(graph.prompt['den:ipapply']).toEqual({
      class_type: 'IPAdapterAdvanced',
      inputs: {
        model: 'u',
        ipadapter: ['den:ipadapter', 0],
        image: ['ip:image', 0],
        weight: 0.6,
        weight_type: 'style transfer',
        combine_embeds: 'concat',
        start_at: 0.1,
        end_at: 0.9,
        embeds_scaling: 'V only',
        clip_vision: ['den:clipvision', 0],
      },
    });
    expect(graph.prompt.den!.inputs.model).toEqual(['den:ipapply', 0]);
  });

  it('names the method an IP-Adapter applies in the words of the pack', () => {
    const typeOf = (method: string) => {
      const adapter = node('ip_adapter', 'ip', { ip_adapter_model: 'k', image: 'a.png', method });
      return through([sampler(), adapter], [makeEdge('ip', 'ip_adapter', 'den', 'ip_adapter')], 'den', 'latents').graph.prompt['den:ipapply']!.inputs.weight_type;
    };
    expect(['full', 'style', 'composition'].map(typeOf)).toEqual(['linear', 'style transfer', 'composition']);
  });

  it('names the IP-Adapter model or picture that is missing', () => {
    const run = (inputs: Record<string, unknown>) => () =>
      through([sampler(), node('ip_adapter', 'ip', inputs)], [makeEdge('ip', 'ip_adapter', 'den', 'ip_adapter')], 'den', 'latents');
    expect(fail(run({ image: 'a.png' }))).toMatchObject({ reason: 'missingInput', nodeId: 'ip', field: 'ip_adapter_model' });
    expect(fail(run({ ip_adapter_model: 'k' }))).toMatchObject({ reason: 'missingInput', nodeId: 'ip', field: 'image' });
  });

  it('applies a ControlNet to both conditionings', () => {
    const nodes = [picture(), sampler(), node('controlnet', 'cn', { control_model: 'c-key' })];
    const { graph } = through(nodes, [makeEdge('src', 'image', 'cn', 'image'), makeEdge('cn', 'control', 'den', 'control')], 'den', 'latents');
    expect(graph.prompt['den:control']!.class_type).toBe('ControlNetApplyAdvanced');
    expect(graph.prompt.den!.inputs).toMatchObject({ positive: ['den:control', 0], negative: ['den:control', 1] });
  });
});

describe('pack node inputs', () => {
  const via = (inputs: Record<string, unknown>) => through([node('comfy:MockPicture', 'pic', inputs)], [], 'pic', 'IMAGE');

  it('uploads the gallery picture a pack node names', () => {
    const { graph } = via({ picture: 'a.png' });
    expect(graph.prompt.pic!.inputs).toEqual({ picture: { $image: 'a.png' } });
  });

  it('names a required picture that is not picked, and leaves an optional one out', () => {
    expect(fail(() => via({}))).toMatchObject({ reason: 'missingInput', nodeId: 'pic', field: 'picture' });
    const { graph } = via({ picture: 'a.png', extra: '' });
    expect(graph.prompt.pic!.inputs).not.toHaveProperty('extra');
  });

  it('fails on a missing required connection', () => {
    const rig = node('comfy:MockFaceRig', 'rig');
    expect(fail(() => through([rig], [], 'rig', 'image'))).toMatchObject({ reason: 'missingInput', nodeId: 'rig', field: 'image' });
  });
});
