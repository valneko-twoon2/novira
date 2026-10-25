// Writes the browser mock's definitions of the rest of ComfyUI's own nodes (src/backend/mock/comfyMoreCoreDefs.json),
// so the node editor in the browser lists what a real ComfyUI offers. Read from a saved `object_info` of a ComfyUI
// with no custom nodes installed or with them left out here: only ComfyUI's own nodes (`nodes`, `comfy_extras.*`) are
// kept, its cloud API, partner and deprecated nodes are not, and a node the hand-made `comfyCoreDefs.json` already has
// is written as null where it comes, so the mock keeps ComfyUI's order and takes that node from the hand-made file. Choices that name files (models, pictures in the input folder) are emptied, so nothing of the machine
// the definitions were read on is kept; tooltips are left out to keep the file small.
// Usage (in frontend/): node scripts/mock-comfy-defs.mjs <object_info.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MOCK = resolve(HERE, '..', 'src', 'backend', 'mock');
const source = process.argv[2];
if (!source) {
  console.error('usage: node scripts/mock-comfy-defs.mjs <object_info.json>');
  process.exit(2);
}

const all = JSON.parse(readFileSync(source, 'utf8'));
const handMade = JSON.parse(readFileSync(resolve(MOCK, 'comfyCoreDefs.json'), 'utf8'));

/** A choice that names a file or a folder. */
const namesFile = (c) => typeof c === 'string' && (/\.[A-Za-z0-9]{2,12}$/.test(c) || /[\\/]/.test(c.replace(/^[a-z]+\/[a-z0-9.+-]+$/i, '')));

function cleanSpec(spec) {
  if (!Array.isArray(spec)) return spec;
  let [type, opts] = spec;
  opts = opts && typeof opts === 'object' ? { ...opts } : opts;
  if (opts) {
    delete opts.tooltip;
    if (Array.isArray(opts.options) && opts.options.some(namesFile)) {
      opts.options = [];
      delete opts.default;
    }
  }
  if (Array.isArray(type) && type.some(namesFile)) {
    type = [];
    if (opts) delete opts.default;
  }
  return opts === undefined ? [type] : [type, opts];
}

function cleanInputs(section) {
  if (!section || typeof section !== 'object') return section;
  return Object.fromEntries(Object.entries(section).map(([k, v]) => [k, cleanSpec(v)]));
}

const out = {};
for (const [name, def] of Object.entries(all)) {
  const module = def.python_module ?? '';
  const partner = def.api_node === true || /^(partner|comfy cloud)(\/|$)/.test(def.category ?? '');
  if (!/^(nodes|comfy_extras)(\.|$)/.test(module) || partner || def.deprecated) continue;
  if (name in handMade) {
    out[name] = null;
    continue;
  }
  const { output_tooltips: _tips, ...rest } = def;
  out[name] = { ...rest, input: { ...def.input, required: cleanInputs(def.input?.required), optional: cleanInputs(def.input?.optional) } };
  if (out[name].input.required === undefined) delete out[name].input.required;
  if (out[name].input.optional === undefined) delete out[name].input.optional;
  // Hidden inputs (prompt, unique id) mean nothing to the mock.
  delete out[name].input.hidden;
}

const target = resolve(MOCK, 'comfyMoreCoreDefs.json');
writeFileSync(target, JSON.stringify(out));
console.log(`mock: ${Object.keys(out).length} nodes written to ${target}`);
