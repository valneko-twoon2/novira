// Catalog of node templates. Titles and labels of built-in nodes are derived message keys rendered at render time;
// nodes of ComfyUI and of custom node packs (registered at run time) carry the names ComfyUI gives them.
import { SCHEDULERS, type BaseModel } from '@/backend';
import { t, type MessageKey } from '@/i18n';
import { VOICE_LANGUAGES, VOICE_SPEAKERS } from '@/state/media/voice';
import type { FieldType } from './fieldTypes';
import { comfyInputName, comfyInputTooltip, comfyNodeDescription, comfyNodeName, comfyOutputName } from './comfyWords';

export type NodeCategory = 'model' | 'conditioning' | 'latents' | 'image' | 'primitives' | 'controlnet' | 'video' | 'audio' | 'util' | 'extension' | 'comfyui';
export const NODE_CATEGORIES: NodeCategory[] = ['model', 'conditioning', 'latents', 'image', 'controlnet', 'video', 'audio', 'primitives', 'util', 'extension', 'comfyui'];

/** 'connection' = handle only, 'direct' = control only, 'any' = control unless connected. */
export type InputMode = 'connection' | 'direct' | 'any';

export interface InputTemplate {
  name: string;
  type: FieldType;
  input: InputMode;
  default?: unknown;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly string[];
  /** The choices as ComfyUI lists them, when some are not text (`8` among `auto`, `8`, `10`): `options[i]` shows `values[i]`. */
  values?: readonly unknown[];
  /** Name a custom node pack gives the field (built-in fields take theirs from the catalog). */
  label?: string;
  /** A picture field that holds a gallery video or sound instead (ComfyUI's Load Video and Load Audio pick a file to upload). */
  media?: 'video' | 'audio';
  /** The name ComfyUI's prompt gives the input, when the editor's own `name` differs (an input several choices bring with other options). */
  promptName?: string;
  /**
   * The input belongs to a choice of ComfyUI's dynamic combo (Save Audio: the quality of an MP3): it is there only
   * while one of these chains of choices holds. A chain lists each choice made on the way (`format` is `mp3`).
   */
  when?: DynamicChoice[][];
  /** What the field does, as the custom node pack explains it. */
  tooltip?: string;
  /** Model base the selector lists (model fields). */
  base?: BaseModel;
  ui?: 'textarea' | 'slider';
}

/** A choice of a dynamic combo: the field (by its full name, `format.codec`) holds `is`. */
export interface DynamicChoice {
  field: string;
  is: string;
}

/** Whether the input is there for the values the node holds (always, unless it belongs to a choice of a dynamic combo). */
export function isActive(input: InputTemplate, values: Record<string, unknown>): boolean {
  return !input.when || input.when.some((chain) => chain.every((c) => String(values[c.field] ?? '') === c.is));
}

export interface OutputTemplate {
  name: string;
  type: FieldType;
}

export interface NodeTemplate {
  type: string;
  category: NodeCategory;
  tags: string[];
  inputs: InputTemplate[];
  outputs: OutputTemplate[];
  /** Produces a gallery image when invoked. */
  isOutput?: boolean;
  version: string;
  useCache?: boolean;
  /** Name shown for a node from a custom node pack (built-in nodes take theirs from the catalog). */
  title?: string;
  description?: string;
  /** Custom node pack the node comes from. */
  pack?: string;
  /** For a node of ComfyUI itself: the first two parts of its ComfyUI category, which the picker groups it under (`audio`, `video`, `model/sampling`). */
  group?: string;
  /** For a node made from a ComfyUI definition: its whole ComfyUI category (`model/patch/stable diffusion`), the folders the node library files it under. */
  comfyCategory?: string;
  /** For a node made from a ComfyUI definition: its place in ComfyUI's list, the order the node library keeps. */
  comfyOrder?: number;
  /** ComfyUI node class the node runs as. */
  comfyClass?: string;
  /** Inputs of a pack node the editor cannot show yet (they keep ComfyUI's defaults). */
  unsupported?: string[];
}

const MAX_INT = 2147483647;
const conn = (name: string, type: FieldType, required = true): InputTemplate => ({ name, type, input: 'connection', required });
const int = (name: string, def: number, extra: Partial<InputTemplate> = {}): InputTemplate => ({ name, type: 'integer', input: 'any', default: def, step: 1, ...extra });
const float = (name: string, def: number, extra: Partial<InputTemplate> = {}): InputTemplate => ({ name, type: 'float', input: 'any', default: def, step: 0.01, ...extra });
const bool = (name: string, def: boolean): InputTemplate => ({ name, type: 'boolean', input: 'any', default: def });
const enumOf = (name: string, options: readonly string[], def?: string): InputTemplate => ({ name, type: 'enum', input: 'direct', options, default: def ?? options[0] });
const image = (name = 'image', input: InputMode = 'any'): InputTemplate => ({ name, type: 'ImageField', input, default: null, required: true });
const model = (name: string, type: FieldType, base?: BaseModel): InputTemplate => ({ name, type, input: 'direct', default: null, required: true, base });
const out = (name: string, type: FieldType): OutputTemplate => ({ name, type });
const imageOut = [out('image', 'ImageField'), out('width', 'integer'), out('height', 'integer')];
const percent = (name: string, def: number) => float(name, def, { min: 0, max: 1, ui: 'slider' });

export const NODE_TEMPLATES: NodeTemplate[] = [
  {
    type: 'main_model_loader',
    category: 'model',
    tags: ['model', 'sd1.5', 'loader'],
    version: '1.0.3',
    inputs: [model('model', 'MainModelField', 'sd-1')],
    outputs: [out('unet', 'UNetField'), out('clip', 'CLIPField'), out('vae', 'VAEField')],
  },
  {
    type: 'sdxl_model_loader',
    category: 'model',
    tags: ['model', 'sdxl', 'loader'],
    version: '1.0.3',
    inputs: [model('model', 'MainModelField', 'sdxl')],
    outputs: [out('unet', 'UNetField'), out('clip', 'CLIPField'), out('clip2', 'CLIPField'), out('vae', 'VAEField')],
  },
  {
    type: 'lora_loader',
    category: 'model',
    tags: ['lora', 'model'],
    version: '1.0.3',
    inputs: [model('lora', 'LoRAModelField'), float('weight', 0.75, { min: -1, max: 2, step: 0.05 }), conn('unet', 'UNetField', false), conn('clip', 'CLIPField', false)],
    outputs: [out('unet', 'UNetField'), out('clip', 'CLIPField')],
  },
  {
    type: 'vae_loader',
    category: 'model',
    tags: ['vae', 'model'],
    version: '1.0.3',
    inputs: [model('vae_model', 'VAEModelField')],
    outputs: [out('vae', 'VAEField')],
  },
  {
    type: 'compel',
    category: 'conditioning',
    tags: ['prompt', 'compel'],
    version: '1.2.0',
    inputs: [{ name: 'prompt', type: 'string', input: 'any', default: '', ui: 'textarea' }, conn('clip', 'CLIPField')],
    outputs: [out('conditioning', 'ConditioningField')],
  },
  {
    type: 'sdxl_compel_prompt',
    category: 'conditioning',
    tags: ['prompt', 'compel', 'sdxl'],
    version: '1.2.0',
    inputs: [
      { name: 'prompt', type: 'string', input: 'any', default: '', ui: 'textarea' },
      { name: 'style', type: 'string', input: 'any', default: '', ui: 'textarea' },
      conn('clip', 'CLIPField'),
      conn('clip2', 'CLIPField'),
    ],
    outputs: [out('conditioning', 'ConditioningField')],
  },
  {
    type: 'noise',
    category: 'latents',
    tags: ['noise', 'seed'],
    version: '1.0.2',
    inputs: [int('seed', 0, { min: 0, max: MAX_INT }), int('width', 512, { min: 64, max: 4096, step: 8 }), int('height', 512, { min: 64, max: 4096, step: 8 }), bool('use_cpu', true)],
    outputs: [out('noise', 'NoiseField'), out('width', 'integer'), out('height', 'integer')],
  },
  {
    type: 'rand_int',
    category: 'primitives',
    tags: ['random', 'integer', 'seed'],
    version: '1.0.1',
    useCache: false,
    inputs: [int('low', 0, { min: 0, max: MAX_INT }), int('high', MAX_INT, { min: 0, max: MAX_INT })],
    outputs: [out('value', 'integer')],
  },
  { type: 'integer', category: 'primitives', tags: ['primitive', 'number'], version: '1.0.1', inputs: [int('value', 0)], outputs: [out('value', 'integer')] },
  { type: 'float', category: 'primitives', tags: ['primitive', 'number'], version: '1.0.1', inputs: [float('value', 0)], outputs: [out('value', 'float')] },
  {
    type: 'string',
    category: 'primitives',
    tags: ['primitive', 'text', 'prompt'],
    version: '1.0.1',
    inputs: [{ name: 'value', type: 'string', input: 'any', default: '', ui: 'textarea' }],
    outputs: [out('value', 'string')],
  },
  { type: 'boolean', category: 'primitives', tags: ['primitive', 'toggle'], version: '1.0.1', inputs: [bool('value', false)], outputs: [out('value', 'boolean')] },
  { type: 'image', category: 'primitives', tags: ['primitive', 'image'], version: '1.0.2', inputs: [image('image')], outputs: imageOut },
  {
    type: 'denoise_latents',
    category: 'latents',
    tags: ['denoise', 'latents', 'diffusion'],
    version: '1.5.3',
    inputs: [
      conn('positive_conditioning', 'ConditioningField'),
      conn('negative_conditioning', 'ConditioningField'),
      conn('noise', 'NoiseField', false),
      int('steps', 30, { min: 1, max: 150 }),
      float('cfg_scale', 7.5, { min: 1, max: 30, step: 0.5 }),
      percent('denoising_start', 0),
      percent('denoising_end', 1),
      { name: 'scheduler', type: 'SchedulerField', input: 'any', default: 'euler', options: SCHEDULERS },
      conn('unet', 'UNetField'),
      conn('control', 'ControlField', false),
      conn('ip_adapter', 'IPAdapterField', false),
      conn('latents', 'LatentsField', false),
    ],
    outputs: [out('latents', 'LatentsField'), out('width', 'integer'), out('height', 'integer')],
  },
  {
    type: 'l2i',
    category: 'latents',
    tags: ['latents', 'image', 'vae', 'decode'],
    version: '1.3.0',
    isOutput: true,
    inputs: [conn('latents', 'LatentsField'), conn('vae', 'VAEField'), bool('tiled', false), bool('fp32', false)],
    outputs: imageOut,
  },
  {
    type: 'i2l',
    category: 'latents',
    tags: ['latents', 'image', 'vae', 'encode'],
    version: '1.1.0',
    inputs: [image('image', 'connection'), conn('vae', 'VAEField'), bool('tiled', false), bool('fp32', false)],
    outputs: [out('latents', 'LatentsField'), out('width', 'integer'), out('height', 'integer')],
  },
  {
    type: 'img_resize',
    category: 'image',
    tags: ['image', 'resize'],
    version: '1.2.2',
    inputs: [
      image(),
      int('width', 512, { min: 8, max: 8192, step: 8 }),
      int('height', 512, { min: 8, max: 8192, step: 8 }),
      enumOf('resample_mode', ['nearest', 'box', 'bilinear', 'hamming', 'bicubic', 'lanczos'], 'bicubic'),
    ],
    outputs: imageOut,
  },
  {
    type: 'canny_edge_detection',
    category: 'controlnet',
    tags: ['controlnet', 'canny', 'edge', 'preprocessor'],
    version: '1.0.0',
    inputs: [image(), int('low_threshold', 100, { min: 0, max: 255, ui: 'slider' }), int('high_threshold', 200, { min: 0, max: 255, ui: 'slider' })],
    outputs: imageOut,
  },
  {
    type: 'controlnet',
    category: 'controlnet',
    tags: ['controlnet', 'control'],
    version: '1.1.2',
    inputs: [
      image(),
      model('control_model', 'ControlNetModelField'),
      float('control_weight', 1, { min: -1, max: 2, step: 0.05, ui: 'slider' }),
      percent('begin_step_percent', 0),
      percent('end_step_percent', 1),
      enumOf('control_mode', ['balanced', 'more_prompt', 'more_control', 'unbalanced']),
      enumOf('resize_mode', ['just_resize', 'crop_resize', 'fill_resize', 'just_resize_simple']),
    ],
    outputs: [out('control', 'ControlField')],
  },
  {
    type: 'ip_adapter',
    category: 'controlnet',
    tags: ['ip-adapter', 'reference', 'style'],
    version: '1.4.1',
    inputs: [
      image(),
      model('ip_adapter_model', 'IPAdapterModelField'),
      enumOf('clip_vision_model', ['ViT-H', 'ViT-G', 'ViT-L']),
      float('weight', 1, { min: -1, max: 2, step: 0.05, ui: 'slider' }),
      enumOf('method', ['full', 'style', 'composition']),
      percent('begin_step_percent', 0),
      percent('end_step_percent', 1),
    ],
    outputs: [out('ip_adapter', 'IPAdapterField')],
  },
  {
    type: 'img_blur',
    category: 'image',
    tags: ['image', 'blur', 'filter'],
    version: '1.2.2',
    inputs: [image(), float('radius', 8, { min: 0, max: 100, step: 0.5 }), enumOf('blur_type', ['gaussian', 'box'])],
    outputs: imageOut,
  },
  {
    type: 'spandrel_image_to_image',
    category: 'image',
    tags: ['upscale', 'image', 'spandrel', 'esrgan'],
    version: '1.3.0',
    inputs: [image(), model('image_to_image_model', 'SpandrelModelField'), int('tile_size', 512, { min: 0, max: 2048, step: 8 })],
    outputs: imageOut,
  },
  {
    type: 'video_generate',
    category: 'video',
    tags: ['video', 'animation', 'i2v', 'text2video', 'wan', 'output'],
    version: '1.0.0',
    isOutput: true,
    useCache: false,
    inputs: [
      { name: 'prompt', type: 'string', input: 'any', default: '', ui: 'textarea', required: true },
      { name: 'negative_prompt', type: 'string', input: 'any', default: '', ui: 'textarea' },
      { name: 'image', type: 'ImageField', input: 'any', default: null, required: false },
      int('width', 832, { min: 64, max: 1280, step: 32 }),
      int('height', 480, { min: 64, max: 1280, step: 32 }),
      int('frames', 49, { min: 5, max: 241, step: 4 }),
      int('fps', 24, { min: 8, max: 30 }),
      int('steps', 20, { min: 4, max: 50 }),
      float('cfg_scale', 5, { min: 1, max: 12, step: 0.5 }),
      int('seed', 0, { min: 0, max: MAX_INT }),
    ],
    outputs: [],
  },
  {
    type: 'voice_speak',
    category: 'audio',
    tags: ['voice', 'speech', 'tts', 'read aloud', 'narration', 'audio', 'qwen'],
    version: '1.0.0',
    inputs: [
      { name: 'text', type: 'string', input: 'any', default: '', ui: 'textarea', required: true },
      enumOf('language', VOICE_LANGUAGES, 'Auto'),
      enumOf('mode', ['preset', 'design'], 'preset'),
      { ...enumOf('speaker', VOICE_SPEAKERS, 'Ono_Anna'), when: [[{ field: 'mode', is: 'preset' }]] },
      { name: 'instruct', type: 'string', input: 'any', default: '', ui: 'textarea' },
    ],
    outputs: [out('audio', 'comfy:AUDIO')],
  },
  {
    type: 'save_image',
    category: 'image',
    tags: ['image', 'save', 'board', 'output'],
    version: '1.2.2',
    isOutput: true,
    useCache: false,
    inputs: [image('image', 'connection'), { name: 'board', type: 'BoardField', input: 'direct', default: 'auto' }],
    outputs: imageOut,
  },
  {
    type: 'current_image',
    category: 'image',
    tags: ['image', 'preview', 'output', 'progress'],
    version: '1.0.0',
    useCache: false,
    inputs: [image('image', 'connection')],
    outputs: [],
  },
  { type: 'collect', category: 'util', tags: ['collection', 'collect'], version: '1.0.0', inputs: [conn('item', 'Any')], outputs: [out('collection', 'Collection')] },
  {
    type: 'iterate',
    category: 'util',
    tags: ['collection', 'iterate', 'loop'],
    version: '1.1.0',
    inputs: [conn('collection', 'Collection')],
    outputs: [out('item', 'Any'), out('index', 'integer'), out('total', 'integer')],
  },
  {
    type: 'range',
    category: 'util',
    tags: ['collection', 'range', 'integer'],
    version: '1.0.0',
    inputs: [int('start', 0), int('stop', 10), int('step', 1)],
    outputs: [out('collection', 'Collection')],
  },
  {
    type: 'integer_math',
    category: 'util',
    tags: ['math', 'add', 'multiply', 'integer'],
    version: '1.0.1',
    inputs: [enumOf('operation', ['ADD', 'SUB', 'MUL', 'DIV', 'EXP', 'MOD', 'ABS', 'MIN', 'MAX']), int('a', 1), int('b', 1)],
    outputs: [out('value', 'integer')],
  },
  {
    type: 'float_math',
    category: 'util',
    tags: ['math', 'add', 'multiply', 'float', 'lerp'],
    version: '1.0.1',
    inputs: [enumOf('operation', ['ADD', 'SUB', 'MUL', 'DIV', 'EXP', 'ABS', 'SQRT', 'MIN', 'MAX']), float('a', 1), float('b', 1)],
    outputs: [out('value', 'float')],
  },
];

const BY_TYPE = new Map(NODE_TEMPLATES.map((t) => [t.type, t]));
let extensions = new Map<string, NodeTemplate>();

/** Replaces the nodes of installed custom node packs (they never shadow a built-in node). */
export function setExtensionTemplates(list: NodeTemplate[]): void {
  extensions = new Map(list.filter((t) => !BY_TYPE.has(t.type)).map((t) => [t.type, t]));
}

/** Built-in nodes followed by the nodes of installed custom node packs. */
export function allTemplates(): NodeTemplate[] {
  return [...NODE_TEMPLATES, ...extensions.values()];
}

export function getTemplate(type: string): NodeTemplate | undefined {
  return BY_TYPE.get(type) ?? extensions.get(type);
}

export function getInput(type: string, name: string): InputTemplate | undefined {
  return getTemplate(type)?.inputs.find((i) => i.name === name);
}

export function getOutput(type: string, name: string): OutputTemplate | undefined {
  return getTemplate(type)?.outputs.find((o) => o.name === name);
}

export const nodeTitleKey = (type: string) => `workflows.nodes.${type}.title` as MessageKey;
export const nodeDescKey = (type: string) => `workflows.nodes.${type}.desc` as MessageKey;
export const fieldLabelKey = (name: string) => `workflows.fields.${name}` as MessageKey;
export const categoryKey = (c: NodeCategory) => `workflows.categories.${c}` as MessageKey;

const isExtension = (type: string) => extensions.has(type);

/**
 * Display name of a node type: the catalog's for built-in nodes; for a ComfyUI node, ComfyUI's own name in the app's
 * language when it has one (`comfyWords`), else the node's own.
 */
export function nodeTitle(type: string): string {
  if (isExtension(type)) {
    const tpl = extensions.get(type);
    return comfyNodeName(tpl?.comfyClass) ?? tpl?.title ?? type;
  }
  return t(nodeTitleKey(type)) || type;
}

export function nodeDesc(type: string): string {
  if (isExtension(type)) {
    const tpl = extensions.get(type);
    return comfyNodeDescription(tpl?.comfyClass) ?? tpl?.description ?? '';
  }
  return t(nodeDescKey(type));
}

/** Label of a field of a node type. Fields of ComfyUI nodes take ComfyUI's name, else their own (`grain_size` → `grain size`). */
export function fieldLabel(type: string, name: string): string {
  if (isExtension(type)) {
    const input = getInput(type, name);
    return comfyInputName(extensions.get(type)?.comfyClass, input?.promptName ?? name) ?? input?.label ?? name.replace(/_/g, ' ');
  }
  return t(fieldLabelKey(name)) || name;
}

/** Help of an input: ComfyUI's in the app's language when it has it, else the node's own. */
export function fieldTooltip(type: string, input: InputTemplate): string | undefined {
  if (!isExtension(type)) return input.tooltip;
  return comfyInputTooltip(extensions.get(type)?.comfyClass, input.promptName ?? input.name) ?? input.tooltip;
}

/** Label of an output of a node type: ComfyUI's name of that output when it has one. */
export function outputLabel(type: string, name: string): string {
  if (isExtension(type)) {
    const tpl = extensions.get(type);
    const index = tpl?.outputs.findIndex((o) => o.name === name) ?? -1;
    return (index >= 0 ? comfyOutputName(tpl?.comfyClass, index) : null) ?? fieldLabel(type, name);
  }
  return fieldLabel(type, name);
}
