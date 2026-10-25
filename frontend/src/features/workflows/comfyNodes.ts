// Turns ComfyUI node definitions (`object_info`) into editor node templates, so a new pack, or a ComfyUI that has new
// nodes, shows up in the editor without changes to the app. The nodes of installed custom node packs and ComfyUI's own
// nodes (video, music and the rest) are offered; its cloud API nodes and deprecated nodes are not. The built-in nodes
// stay as they are, and a graph may mix the two.
import type { ComfyInputSpec, ComfyNodeDef, ComfyNodeDefs } from '@/backend';
import type { FieldType } from './fieldTypes';
import type { DynamicChoice, InputTemplate, NodeTemplate, OutputTemplate } from './templates';

/** Editor node types made from ComfyUI classes are `comfy:<class>`. */
export const COMFY_PREFIX = 'comfy:';
export const comfyNodeType = (className: string) => `${COMFY_PREFIX}${className}`;
export const isComfyNodeType = (type: string) => type.startsWith(COMFY_PREFIX);

/** ComfyUI connection types that mean the same thing as an editor type, so both kinds of node connect. */
const SAME_AS: Record<string, FieldType> = {
  IMAGE: 'ImageField',
  LATENT: 'LatentsField',
  CONDITIONING: 'ConditioningField',
  MODEL: 'UNetField',
  CLIP: 'CLIPField',
  VAE: 'VAEField',
  '*': 'Any',
};

const PRIMITIVES: Record<string, FieldType> = { INT: 'integer', FLOAT: 'float', STRING: 'string', BOOLEAN: 'boolean' };

/** The editor type of a ComfyUI connection type; types with no editor counterpart stay ComfyUI's own. */
export function comfyFieldType(type: string): FieldType {
  // `IMAGE,MASK,VIDEO`: the input takes any of several types.
  if (type.includes(',')) return 'Any';
  return SAME_AS[type] ?? PRIMITIVES[type] ?? `comfy:${type}`;
}

/** The pack a node comes from (`custom_nodes.ComfyUI-Foo` → `ComfyUI-Foo`), or null for ComfyUI's own nodes. */
export function comfyPack(def: ComfyNodeDef): string | null {
  const m = /^custom_nodes[./]([^./]+)/.exec(def.python_module ?? '');
  return m ? m[1]!.replace(/@.*$/, '') : null;
}

/** ComfyUI's own node (`nodes`, `comfy_extras.nodes_audio`); its cloud API nodes (`comfy_api_nodes.*`) are not. */
const isCoreNode = (def: ComfyNodeDef) => /^(nodes|comfy_extras)(\.|$)/.test(def.python_module ?? '');

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
/** ComfyUI uses 64-bit limits for seeds; keep numbers within what the editor's controls handle exactly. */
const safe = (v: number | undefined) => (v === undefined ? undefined : Math.max(-Number.MAX_SAFE_INTEGER, Math.min(Number.MAX_SAFE_INTEGER, v)));

/** An input that grows with the connections made to it (ComfyUI's V3 auto-grow); the editor cannot show it yet. */
const AUTOGROW = 'COMFY_AUTOGROW_V3';
const DYNAMIC_COMBO = 'COMFY_DYNAMICCOMBO_V3';

function matchType(opts: Record<string, unknown>): FieldType {
  const template = opts.template as { allowed_types?: unknown } | undefined;
  const allowed = typeof template?.allowed_types === 'string' ? template.allowed_types.split(',').map((s) => s.trim()).filter(Boolean) : [];
  return allowed.length === 1 ? comfyFieldType(allowed[0]!) : 'Any';
}

function inputOf(name: string, spec: ComfyInputSpec, required: boolean): InputTemplate {
  const input = controlOf(name, spec, required);
  const opts = spec[1] ?? {};
  if (typeof opts.display_name === 'string' && opts.display_name) input.label = opts.display_name;
  if (typeof opts.tooltip === 'string' && opts.tooltip) input.tooltip = opts.tooltip;
  // A widget the pack never offers as a socket.
  if (opts.socketless === true && input.input === 'any') input.input = 'direct';
  return input;
}

function controlOf(name: string, [type, opts = {}]: ComfyInputSpec, required: boolean): InputTemplate {
  // A colour picker in ComfyUI: a `#rrggbb` text here.
  if (type === 'COLOR' || type === 'COLORCODE') return { name, type: 'string', input: 'any', default: typeof opts.default === 'string' ? opts.default : '#000000' };
  if (type === 'COMFY_MATCHTYPE_V3') return { name, type: matchType(opts), input: 'connection', required };
  if (type === DYNAMIC_COMBO) {
    // The choice itself; the inputs each choice brings follow it (`collectInputs`).
    const options = dynamicOptions(opts).map((o) => o.key);
    return { name, type: 'enum', input: 'direct', options, default: options[0] };
  }
  // A picture ComfyUI would take from its upload folder: the editor picks it from the gallery instead.
  if (opts.image_upload === true) return { name, type: 'ImageField', input: 'any', default: null, required };
  // A video or a sound: the gallery's, uploaded when the graph runs.
  if (opts.video_upload === true || opts.audio_upload === true) return { name, type: 'ImageField', input: 'direct', default: null, required, media: opts.video_upload === true ? 'video' : 'audio' };
  const choices = Array.isArray(type) ? type : type === 'COMBO' && Array.isArray(opts.options) ? opts.options : null;
  if (choices) {
    const options = choices.map(String);
    const def = options.includes(String(opts.default)) ? String(opts.default) : options[0];
    return { name, type: 'enum', input: 'direct', options, default: def, ...(choices.every((c) => typeof c === 'string') ? {} : { values: choices }) };
  }
  const prim = PRIMITIVES[type as string];
  if (prim && opts.forceInput !== true) {
    const input: InputTemplate = { name, type: prim, input: 'any', default: opts.default ?? (prim === 'string' ? '' : prim === 'boolean' ? false : 0) };
    if (prim === 'integer' || prim === 'float') {
      input.min = safe(num(opts.min));
      input.max = safe(num(opts.max));
      input.step = num(opts.step) ?? (prim === 'integer' ? 1 : 0.01);
      if (typeof input.default === 'number') input.default = safe(input.default);
      if (opts.display === 'slider' && input.min !== undefined && input.max !== undefined) input.ui = 'slider';
    }
    if (prim === 'string' && opts.multiline === true) input.ui = 'textarea';
    return input;
  }
  return { name, type: comfyFieldType(type as string), input: 'connection', required };
}

interface DynamicOption {
  key: string;
  inputs: { required?: Record<string, ComfyInputSpec>; optional?: Record<string, ComfyInputSpec> };
}

/** The options of a dynamic combo: each a key and the inputs that choice brings. */
function dynamicOptions(opts: Record<string, unknown>): DynamicOption[] {
  const list = Array.isArray(opts.options) ? opts.options : [];
  return list.map((o) => {
    const option = o as { key?: unknown; inputs?: DynamicOption['inputs'] };
    return { key: String(option.key ?? o), inputs: option.inputs ?? {} };
  });
}

/** The inputs gathered for one node: in ComfyUI's order, and by the name of the prompt with the forms each takes. */
interface Collected {
  list: InputTemplate[];
  forms: Map<string, { spec: string; input: InputTemplate }[]>;
  unsupported: string[];
}

/**
 * Adds one input and returns the template it became. An input a choice of a dynamic combo brings is there only while
 * that choice is made (`chain`). Several choices may bring the same input (every container of Save Video has a codec):
 * with the same definition it is one input, there for any of them; with another (the qualities of MP3 and of Opus) it
 * is a second input, named `<name>#2` in the editor and `<name>` in the prompt.
 */
function place(into: Collected, promptName: string, spec: ComfyInputSpec, required: boolean, chain: DynamicChoice[], label: string | null): InputTemplate {
  const key = JSON.stringify(spec);
  const forms = into.forms.get(promptName) ?? [];
  const same = forms.find((f) => f.spec === key);
  if (same) {
    if (!chain.length) delete same.input.when;
    else same.input.when?.push(chain);
    return same.input;
  }
  const input = inputOf(promptName, spec, required);
  if (forms.length) {
    input.name = `${promptName}#${forms.length + 1}`;
    input.promptName = promptName;
  }
  if (chain.length) input.when = [chain];
  // A choice's own input shows under the name ComfyUI gives it, not the dotted one.
  if (label && !input.label) input.label = label;
  forms.push({ spec: key, input });
  into.forms.set(promptName, forms);
  into.list.push(input);
  return input;
}

/** The inputs of one section of a node, and below a dynamic combo of each choice it makes (`<combo>.<input>`, as ComfyUI's prompt names them). */
function collectInputs(
  sections: { required?: Record<string, ComfyInputSpec>; optional?: Record<string, ComfyInputSpec> },
  order: Partial<Record<'required' | 'optional', string[]>> | undefined,
  prefix: string,
  chain: DynamicChoice[],
  into: Collected,
): void {
  for (const section of ['required', 'optional'] as const) {
    const specs = sections[section] ?? {};
    for (const key of order?.[section] ?? Object.keys(specs)) {
      const spec = specs[key];
      // An input ComfyUI keeps only for older workflows (Save Video's `codec`) is not offered.
      if (!spec || spec[1]?.hidden === true) continue;
      const name = `${prefix}${key}`;
      if (spec[0] === AUTOGROW) {
        into.unsupported.push(name);
        continue;
      }
      const input = place(into, name, spec, section === 'required', chain, prefix ? key.replace(/_/g, ' ') : null);
      if (spec[0] === DYNAMIC_COMBO) {
        for (const option of dynamicOptions(spec[1] ?? {})) collectInputs(option.inputs, undefined, `${name}.`, [...chain, { field: input.name, is: option.key }], into);
      }
    }
  }
}

function inputsOf(def: ComfyNodeDef): { inputs: InputTemplate[]; unsupported: string[] } {
  const into: Collected = { list: [], forms: new Map(), unsupported: [] };
  collectInputs(def.input, def.input_order, '', [], into);
  return { inputs: into.list, unsupported: into.unsupported };
}

function outputsOf(def: ComfyNodeDef): OutputTemplate[] {
  const seen = new Set<string>();
  return def.output.map((type, i) => {
    const base = def.output_name?.[i] || (typeof type === 'string' ? type : 'value');
    let name = base;
    for (let n = 2; seen.has(name); n++) name = `${base}_${n}`;
    seen.add(name);
    return { name, type: Array.isArray(type) ? 'string' : comfyFieldType(type) };
  });
}

/** The template of one ComfyUI node, or null when it is deprecated, a cloud API node, or from neither ComfyUI nor a pack. */
export function comfyTemplate(className: string, def: ComfyNodeDef): NodeTemplate | null {
  const pack = comfyPack(def);
  if (def.deprecated || def.api_node === true || (!pack && !isCoreNode(def))) return null;
  const category = def.category ?? '';
  const { inputs, unsupported } = inputsOf(def);
  return {
    type: comfyNodeType(className),
    category: pack ? 'extension' : 'comfyui',
    tags: [pack ?? 'comfyui', className, ...category.split('/')].map((s) => s.toLowerCase()).filter(Boolean),
    version: 'comfy',
    inputs,
    outputs: outputsOf(def),
    isOutput: def.output_node === true,
    title: def.display_name || className,
    description: def.description ?? '',
    ...(pack ? { pack } : { group: category.split('/').slice(0, 2).join('/').trim().toLowerCase() || 'other' }),
    comfyCategory: category,
    comfyClass: className,
    ...(unsupported.length ? { unsupported } : {}),
  };
}

/** Templates for every node in `defs` the editor offers: the packs' nodes sorted by pack, then ComfyUI's by group, each by title. */
export function comfyTemplates(defs: ComfyNodeDefs | null): NodeTemplate[] {
  if (!defs) return [];
  const list: NodeTemplate[] = [];
  for (const [i, [className, def]] of Object.entries(defs).entries()) {
    const tpl = comfyTemplate(className, def);
    if (tpl) list.push({ ...tpl, comfyOrder: i });
  }
  const byTitle = (a: NodeTemplate, b: NodeTemplate) => (a.title ?? '').localeCompare(b.title ?? '');
  return list.sort((a, b) => (a.pack ?? '').localeCompare(b.pack ?? '') || (a.group ?? '').localeCompare(b.group ?? '') || byTitle(a, b));
}
