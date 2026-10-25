// Saves the node definitions of a running ComfyUI that the graph tests check against.
//
//   node tools/comfy-node-defs.mjs <ComfyUI URL>      e.g. http://127.0.0.1:8188
//
// Keeps only the nodes that the committed graph snapshots use (backend/crates/novira-core/src/comfy/__snapshots__/graph/),
// and for each its input names, types, number limits, the choices of a combo and its output types. The file names a
// ComfyUI lists for its loaders depend on the machine, so those choices are left out. Writes
// backend/crates/novira-core/src/comfy/__snapshots__/node-defs.json (read by `comfy::node_defs_check`).
//
// Run it again after a graph gains a node, or to follow a newer ComfyUI. What it cannot save: nodes a snapshot does not
// use, and anything a ComfyUI only decides when it runs the graph (a file that is not there, a model that does not fit).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const comfy = path.join(root, 'backend/crates/novira-core/src/comfy/__snapshots__');
const url = process.argv[2];
if (!url) {
  console.error('usage: node tools/comfy-node-defs.mjs <ComfyUI URL>');
  process.exit(2);
}

// The prompt of a snapshot: built graphs keep it under `prompt`. The editor graph (`prepared`)
// is the user's own, with nodes of any pack, so it is not checked.
const promptOf = (j) => j.prompt ?? (j.prepared ? {} : j);

const used = new Set();
for (const f of fs.readdirSync(path.join(comfy, 'graph'))) {
  const j = JSON.parse(fs.readFileSync(path.join(comfy, 'graph', f), 'utf8'));
  for (const n of Object.values(promptOf(j))) used.add(n.class_type);
}

const info = await (await fetch(`${url}/object_info`)).json();
const version = (await (await fetch(`${url}/system_stats`)).json()).system?.comfyui_version ?? 'unknown';

// An input that names a file or a picture on this machine: its choices are not part of the definition.
const machineChoice = (name) => /(^|_)(name|file|folder|lora)\d*$/.test(name) || ['image', 'video', 'audio', 'file'].includes(name);

function spec(name, raw) {
  const [type, opts = {}] = raw;
  // A list a ComfyUI without models leaves empty cannot be checked either.
  const listed = (o) => (machineChoice(name) || !o || o.length === 0 ? null : o);
  if (Array.isArray(type)) return { type: 'COMBO', options: listed(type) };
  if (type === 'COMBO') return { type: 'COMBO', options: listed(opts.options) };
  if (type.startsWith('COMFY_')) return { type: 'DYNAMIC' };
  const s = { type };
  if (typeof opts.min === 'number') s.min = opts.min;
  if (typeof opts.max === 'number') s.max = opts.max;
  return s;
}

const out = { comfyui: version, nodes: {} };
const missing = [];
for (const cls of [...used].sort()) {
  const n = info[cls];
  if (!n) {
    missing.push(cls);
    continue;
  }
  const group = (g) => Object.fromEntries(Object.entries(g ?? {}).map(([k, v]) => [k, spec(k, v)]));
  out.nodes[cls] = {
    required: group(n.input?.required),
    optional: group(n.input?.optional),
    output: n.output,
  };
}
// A node this ComfyUI lacks (an extension not installed here) keeps the definition saved before, so the file never loses
// what the check needs; the run still fails so the gap is seen.
const file = path.join(comfy, 'node-defs.json');
const before = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).nodes ?? {} : {};
const kept = missing.filter((cls) => before[cls]);
for (const cls of kept) out.nodes[cls] = before[cls];
out.nodes = Object.fromEntries(Object.entries(out.nodes).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`saved ${Object.keys(out.nodes).length} nodes of ComfyUI ${version}`);
if (missing.length) {
  console.error(`this ComfyUI has no node: ${missing.join(', ')}; ${kept.length ? `kept the earlier definitions of ${kept.join(', ')}` : 'none was saved before'}. Install the extension that has it and run again.`);
  process.exitCode = 1;
}
