// The pure parts of the model sweep (tools/models-sweep.mjs): what the code says about model folders and pickers, which
// models stand for their kind, what a sent graph loaded, whether a picture is blank, the verdicts, the record of a run and
// whether that record still covers HEAD. No process, network or app here, so tests/models-sweep.test.ts checks all of it.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const LAYOUT_RS = 'backend/crates/novira-core/src/models/layout.rs';
const STATE_MODELS_TS = 'frontend/src/state/models.ts';
const MODEL_CATEGORIES_TS = 'frontend/src/features/models/modelCategories.ts';

/** `ModelType::SpandrelImageToImage` → `spandrel_image_to_image` (the wire name, serde snake_case). */
export function wireKind(rustVariant) {
  return rustVariant.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/** The model folders novira scans (`layout::CATEGORIES`): `[{ folder, kind, aliases }]`, and the model file extensions. */
export function parseLayout(source) {
  const categories = [...source.matchAll(/Category\s*\{\s*folder:\s*"([^"]+)",\s*kind:\s*ModelType::(\w+),\s*aliases:\s*&\[([^\]]*)\]/g)].map(([, folder, kind, list]) => ({
    folder,
    kind: wireKind(kind),
    aliases: [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]),
  }));
  const ext = /MODEL_EXTENSIONS:\s*&\[&str\]\s*=\s*&\[([^\]]*)\]/.exec(source);
  const extensions = ext ? [...ext[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
  if (!categories.length || !extensions.length) throw new Error(`could not read the model categories from ${LAYOUT_RS}`);
  return { categories, extensions };
}

const setOf = (source, name) => {
  const m = new RegExp(`export const ${name}[^=]*=\\s*new Set<BaseModel>\\(\\[([^\\]]*)\\]`).exec(source);
  if (!m) throw new Error(`could not read ${name} from ${STATE_MODELS_TS}`);
  return new Set([...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
};

/** What the screens decide from `state/models.ts`: the families each screen draws with, and the base labels. */
export function parseStateModels(source) {
  const labels = /export const BASE_LABELS[^=]*=\s*\{([^}]*)\}/.exec(source);
  if (!labels) throw new Error(`could not read BASE_LABELS from ${STATE_MODELS_TS}`);
  return {
    splitBases: setOf(source, 'SPLIT_BASES'),
    videoBases: setOf(source, 'VIDEO_BASES'),
    baseLabels: Object.fromEntries([...labels[1].matchAll(/'?([\w-]+)'?:\s*'([^']*)'/g)].map((m) => [m[1], m[2]])),
  };
}

/** The Models screen's rail (`modelCategories.ts`): `[{ id, types }]`, and the types that show an icon instead of a cover. */
export function parseModelCategories(source) {
  const rail = [...source.matchAll(/\{\s*id:\s*'([^']+)',\s*labelKey:\s*'[^']+',\s*types:\s*\[([^\]]*)\]\s*\}/g)].map(([, id, list]) => ({ id, types: [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]) }));
  const tall = /if \(([^)]*)\) return 'tall'/.exec(source)?.[1] ?? '';
  const wide = /if \(([^)]*)\) return 'wide'/.exec(source)?.[1] ?? '';
  const typesIn = (cond) => [...cond.matchAll(/type === '([^']+)'/g)].map((m) => m[1]);
  if (!rail.length) throw new Error(`could not read the rail from ${MODEL_CATEGORIES_TS}`);
  return { rail, pictureTypes: new Set([...typesIn(tall), ...typesIn(wide)]) };
}

const PACKS_RS = 'backend/crates/novira-core/src/packs.rs';
const VOICE_RS = 'backend/crates/novira-core/src/voice/mod.rs';

/** The model packs (`packs.rs`, and the voice engine's models in `voice/mod.rs`): `[{ kind, dir, files: [{ folder, file, home }], voiceModels }]`.
 * `home` is the dir of another pack that holds the file (the Turbo pack reuses the video pack's encoder and VAE). */
export function parsePacks(packsSource, voiceSource) {
  const dirs = Object.fromEntries([...packsSource.matchAll(/Self::(\w+)\s*=>\s*"([^"]+)"/g)].map((m) => [wireKind(m[1]), m[2]]));
  const lists = Object.fromEntries(
    [...packsSource.matchAll(/pub const (\w+)_FILES: \[PackFile; \d+\] = \[([\s\S]*?)\n?\];/g)].map((m) => [
      m[1],
      m[2]
        .split('PackFile {')
        .slice(1)
        .map((b) => ({
          folder: /folder:\s*"([^"]+)"/.exec(b)?.[1],
          file: /file:\s*"([^"]+)"/.exec(b)?.[1],
          home: /home:\s*Some\(PackKind::(\w+)\)/.exec(b)?.[1] ? wireKind(/home:\s*Some\(PackKind::(\w+)\)/.exec(b)[1]) : null,
        })),
    ]),
  );
  const byKind = Object.fromEntries([...packsSource.matchAll(/PackKind::(\w+)\s*=>\s*&(\w+)_FILES/g)].map((m) => [wireKind(m[1]), lists[m[2]] ?? []]));
  const voiceModels = [...voiceSource.matchAll(/dir:\s*"([^"]+)"/g)].map((m) => m[1]);
  const kinds = Object.keys(dirs);
  if (!kinds.length || kinds.some((k) => k !== 'voice' && !byKind[k]?.length) || !voiceModels.length) throw new Error(`could not read the model packs from ${PACKS_RS} and ${VOICE_RS}`);
  return kinds.map((kind) => ({ kind, dir: dirs[kind], files: byKind[kind] ?? [], voiceModels: kind === 'voice' ? voiceModels : [] }));
}

/** Everything the sweep reads from the code of the checkout `repo`. */
export function readCode(repo) {
  const read = (p) => fs.readFileSync(path.join(repo, p), 'utf8');
  return { ...parseLayout(read(LAYOUT_RS)), ...parseStateModels(read(STATE_MODELS_TS)), ...parseModelCategories(read(MODEL_CATEGORIES_TS)), packs: parsePacks(read(PACKS_RS), read(VOICE_RS)) };
}

const norm = (p) => p.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();

/** The category folder and the name ComfyUI lists for a model file (relative to the category folder), or null when the file is
 * in no scanned folder of these roots. */
export function comfyNameOf(file, roots, categories) {
  const f = norm(file);
  for (const root of roots) {
    for (const cat of categories) {
      for (const alias of cat.aliases) {
        const dir = `${norm(path.join(root, alias))}/`;
        if (f.startsWith(dir)) return { folder: cat.folder, kind: cat.kind, alias, name: file.replaceAll('\\', '/').slice(dir.length) };
      }
    }
  }
  return null;
}

/** The model files in the scanned folders of a root, as `layout::scan_roots` walks them (hidden entries skipped, six levels). */
export function walkModels(root, code) {
  const ext = new RegExp(`\\.(${code.extensions.join('|')})$`, 'i');
  const out = [];
  const walk = (dir, depth) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (depth < 6) walk(p, depth + 1);
      } else if (ext.test(e.name)) out.push(p);
    }
  };
  const seen = new Set();
  for (const cat of code.categories) {
    for (const alias of cat.aliases) {
      const dir = path.join(root, alias);
      // Windows folders ignore case: `vae` and `VAE` are one folder.
      if (seen.has(dir.toLowerCase())) continue;
      seen.add(dir.toLowerCase());
      walk(dir, 0);
    }
  }
  return out.sort();
}

/** The entries of a model root that novira does not scan as a category (pack folders such as `video/`, `music/`). */
export function unscannedFolders(entries, categories) {
  const known = new Set(categories.flatMap((c) => c.aliases.map((a) => a.toLowerCase())));
  return entries.filter((e) => !known.has(e.toLowerCase()) && !e.startsWith('.')).sort();
}

/** One row per model pack (video, music, voice...), for checks a (listed) and b (cover): the pack's files are looked for in every
 * model root, as the app does since packs read the shared folders too, and the app's pack status must agree. A pack has no
 * cover and no picker (its media screen uses it), so those are n/a. `status` is `bootstrap.packs`; `has(path)` tells whether a
 * file exists. */
export function packRows({ packs, status, roots, has }) {
  const join = (...p) => p.join('/');
  return packs.map((pack) => {
    const where = (parts) => roots.find((r) => has(join(r, ...parts)));
    const located = pack.files.map((f) => ({ f, root: where([f.home ? packs.find((x) => x.kind === f.home)?.dir ?? f.home : pack.dir, f.folder, f.file]) }));
    const voice = pack.voiceModels.map((m) => ({ m, root: where([pack.dir, m, '.complete']) }));
    const missing = [...located.filter((x) => !x.root).map((x) => x.f.file), ...voice.filter((x) => !x.root).map((x) => x.m)];
    const onDisk = missing.length === 0;
    const state = status?.[pack.kind]?.state ?? 'unknown';
    const roots_ = [...new Set([...located, ...voice].map((x) => x.root).filter(Boolean))];
    let listed;
    if (onDisk && state === 'ready') listed = { status: 'pass', why: `ready, files in ${roots_.join(', ')}` };
    else if (onDisk && pack.kind === 'voice') listed = { status: 'n/a', why: `the models are in ${roots_.join(', ')}; the voice libraries are not installed in this data folder (pack status ${state})` };
    else if (onDisk) listed = { status: 'fail', why: `every file is in ${roots_.join(', ')} but the app says the pack is ${state}` };
    else if (state === 'ready') listed = { status: 'fail', why: `the app says the pack is ready but ${missing.join(', ')} is in no model root` };
    else listed = { status: 'n/a', why: `not installed: ${missing.join(', ')} is in no model root (pack status ${state})` };
    const na = (why) => ({ status: 'n/a', why });
    return {
      key: null,
      name: `${pack.kind} pack`,
      type: 'pack',
      base: pack.dir,
      path: '',
      checks: { listed, coverOff: na('a pack has no cover'), coverOn: na('a pack has no cover'), picker: na('a pack is used by its media screen, not picked') },
    };
  });
}

/** Where the screens offer a model: the Generate screen's model picker, the Video screen, the LoRA or VAE picker of the
 * Generate screen (shown for a main model of the same base), or nowhere the sweep drives (with the reason). */
export function pickerOf(model, code) {
  if (model.type === 'main' && !code.videoBases.has(model.base)) return { picker: 'generate' };
  if (model.type === 'diffusion_model' && code.splitBases.has(model.base)) return { picker: 'generate' };
  if ((model.type === 'diffusion_model' || model.type === 'main') && code.videoBases.has(model.base)) return { picker: 'video' };
  if (model.type === 'lora') return { picker: 'lora' };
  if (model.type === 'vae' && code.videoBases.has(model.base)) return { picker: null, why: 'the VAE of a video family, loaded with its model' };
  if (model.type === 'vae') return { picker: 'vae' };
  const where = {
    diffusion_model: 'no screen draws with this family',
    controlnet: 'picked on a control layer of the canvas, not driven by the sweep',
    t2i_adapter: 'picked on a control layer of the canvas, not driven by the sweep',
    model_patch: 'picked on a control layer of the canvas, not driven by the sweep',
    ip_adapter: 'picked in the reference image settings, not driven by the sweep',
    clip_vision: 'a part loaded with an IP-Adapter, no picker',
    spandrel_image_to_image: 'picked on the Upscaling screen, not driven by the sweep',
    text_encoder: 'a part loaded with its diffusion model, no picker',
    t5_encoder: 'a part loaded with its diffusion model, no picker',
    clip_embed: 'a part loaded with its diffusion model, no picker',
  };
  return { picker: null, why: where[model.type] ?? 'no picker' };
}

/** The rail entry that lists a type on the Models screen. */
export function railOf(type, rail) {
  return rail.find((r) => r.types.includes(type))?.id ?? null;
}

/** Bases a file name points at, for a cheap cross-check of the classification (a hint, never the truth). */
const NAME_HINTS = [
  [/anima/i, ['anima']],
  [/illustrious|noobai|pony|sdxl|ilxl|(^|[_\-. ])(xl|il)([_\-. ]|$)/i, ['sdxl']],
  [/flux/i, ['flux', 'flux2', 'chroma']],
  [/(^|[_\-. ])wan[_\-. ]?2/i, ['wan']],
  [/hunyuan[_\-. ]?image/i, ['hunyuan-image']],
  [/(^|[_\-. ])(sd ?1\.?5|sd15)([_\-. ]|$)/i, ['sd-1']],
];

/** The bases a file name suggests, or null when it says nothing. */
export function baseHint(fileName) {
  for (const [re, bases] of NAME_HINTS) if (re.test(fileName)) return bases;
  return null;
}

const KINDS_WITH_A_BASE = new Set(['main', 'diffusion_model', 'lora', 'controlnet', 'ip_adapter', 't2i_adapter']);
/** Kinds whose base decides which main models they are offered with, so a base the name contradicts is a fault too. */
const KINDS_MATCHED_BY_BASE = new Set([...KINDS_WITH_A_BASE, 'vae']);

/** Check a (offline part): the record's kind against its folder, and its base against what its kind needs and its name says. */
export function classificationCheck(model, where, categories) {
  if (!where) return { status: 'fail', why: `${model.path} is in no folder novira scans` };
  // ComfyUI loads a kind from its own folder, so a file listed as another kind than its folder holds cannot be loaded as it.
  // A kind without a folder of its own (a T5 encoder, a T2I adapter) is loaded from its relative's folder.
  const hasFolder = categories.some((c) => c.kind === model.type);
  if (hasFolder && where.kind !== model.type) return { status: 'fail', why: `in ${where.alias}/ (holds ${where.kind}) but listed as ${model.type}: ComfyUI's ${model.type} loader does not read ${where.alias}/` };
  if (KINDS_WITH_A_BASE.has(model.type) && model.base === 'any') return { status: 'fail', why: `${model.type} without a base: the screens cannot match it to a main model` };
  const hint = baseHint(path.basename(model.path));
  if (hint && !hint.includes(model.base) && KINDS_MATCHED_BY_BASE.has(model.type)) return { status: 'fail', why: `the name says ${hint.join('/')}, classified ${model.base}` };
  return { status: 'pass', why: '' };
}

/** One model per kind and base (the first by name), the ones the GPU part runs. With `model`, only names containing it. */
export function representatives(models, { model } = {}) {
  const groups = new Map();
  const wanted = model?.toLowerCase();
  for (const m of [...models].sort((a, b) => a.name.localeCompare(b.name))) {
    if (wanted && !m.name.toLowerCase().includes(wanted)) continue;
    const key = `${m.type}/${m.base}`;
    if (!groups.has(key)) groups.set(key, m);
  }
  return [...groups.values()];
}

/** Models narrowed by `--category` (a category folder, a type or a rail id) and `--model` (part of the name). */
export function narrow(models, { category, model } = {}, code) {
  return models.filter((m) => {
    if (model && !m.name.toLowerCase().includes(model.toLowerCase())) return false;
    if (!category) return true;
    const c = category.toLowerCase();
    const folder = code.categories.find((x) => x.kind === m.type)?.folder;
    return c === m.type || c === folder || c === railOf(m.type, code.rail)?.toLowerCase() || c === m.base;
  });
}

/** Every model file name a ComfyUI prompt (`{ id: { class_type, inputs } }`) asks a node to load, `/`-separated. */
export function loadedFiles(prompt, extensions) {
  const ext = new RegExp(`\\.(${extensions.join('|')})$`, 'i');
  const out = [];
  for (const node of Object.values(prompt ?? {})) {
    for (const [input, value] of Object.entries(node?.inputs ?? {})) {
      if (typeof value === 'string' && ext.test(value)) out.push({ node: node.class_type, input, file: value.replaceAll('\\', '/') });
    }
  }
  return out;
}

/** Check e (graph part): the sent prompt loads exactly the chosen file (and, for a LoRA, also a main model). */
export function graphCheck(prompt, expectedName, extensions) {
  const files = loadedFiles(prompt, extensions);
  if (!files.length) return { status: 'fail', why: 'the sent graph loads no model file', files };
  const hit = files.find((f) => norm(f.file) === norm(expectedName));
  if (!hit) return { status: 'fail', why: `the sent graph loads ${files.map((f) => f.file).join(', ')}, not ${expectedName}`, files };
  return { status: 'pass', why: `${hit.node}.${hit.input} = ${hit.file}`, files };
}

/** Decodes an 8-bit, non-interlaced PNG into `{ width, height, channels, pixels }` (pixels: Uint8Array, row after row). */
export function decodePng(buffer) {
  const sig = buffer.subarray(0, 8).toString('hex');
  if (sig !== '89504e470d0a1a0a') throw new Error('not a PNG');
  let at = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let color = 0;
  let interlace = 0;
  const data = [];
  while (at < buffer.length) {
    const len = buffer.readUInt32BE(at);
    const type = buffer.toString('latin1', at + 4, at + 8);
    const body = buffer.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      color = body[9];
      interlace = body[12];
    } else if (type === 'IDAT') data.push(body);
    else if (type === 'IEND') break;
    at += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[color];
  if (depth !== 8 || !channels || interlace) throw new Error(`unsupported PNG (depth ${depth}, colour ${color}, interlace ${interlace})`);
  const raw = zlib.inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const pixels = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[y * stride + x - channels] : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pixels[y * stride + x] = v & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

/** The standard deviation of the brightness of a decoded picture (every 7th pixel): near 0 for a blank or one-colour picture. */
export function brightnessSpread({ channels, pixels }) {
  let n = 0;
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < pixels.length; i += channels * 7) {
    const v = channels >= 3 ? 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2] : pixels[i];
    n++;
    sum += v;
    sq += v * v;
  }
  if (!n) return 0;
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sq / n - mean * mean));
}

/** Below this spread a picture counts as blank (a black or one-colour result, a NaN decode). */
export const BLANK_SPREAD = 4;

/** Check e (picture part): the result is a real picture, not a blank one. */
export function pictureCheck(png) {
  try {
    const decoded = decodePng(png);
    const spread = brightnessSpread(decoded);
    return spread < BLANK_SPREAD
      ? { status: 'fail', why: `the picture is blank (brightness spread ${spread.toFixed(1)}, ${decoded.width}x${decoded.height})` }
      : { status: 'pass', why: `${decoded.width}x${decoded.height}, brightness spread ${spread.toFixed(1)}` };
  } catch (e) {
    return { status: 'fail', why: `the result could not be read as a picture: ${e.message}` };
  }
}

const RANK = { fail: 3, 'not run': 2, pass: 1, 'n/a': 0 };

/** The verdict of one model over its checks: fail when any failed, then not run, then pass. */
export function overall(checks) {
  let worst = 'n/a';
  for (const c of Object.values(checks)) if (c && RANK[c.status] > RANK[worst]) worst = c.status;
  return worst === 'n/a' ? 'pass' : worst;
}

export const CHECK_COLUMNS = [
  ['listed', 'a listed'],
  ['coverOff', 'b cover (lookup off)'],
  ['coverOn', 'b cover (lookup on)'],
  ['picker', 'c picker'],
  ['generate', 'd generate'],
  ['graph', 'e graph'],
  ['picture', 'e picture'],
];

/** The result table in Markdown: one row per model, then the reasons of every check that failed or did not run (the reasons
 * of n/a stay in the JSON record). */
export function markdownTable(results) {
  const cell = (c) => (c ? c.status : '');
  const head = ['model', 'kind / base', ...CHECK_COLUMNS.map(([, label]) => label), 'verdict'];
  const lines = [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`];
  for (const r of results) lines.push(`| ${r.name} | ${r.type} / ${r.base} | ${CHECK_COLUMNS.map(([k]) => cell(r.checks[k])).join(' | ')} | **${overall(r.checks)}** |`);
  const reasons = results.flatMap((r) =>
    CHECK_COLUMNS.filter(([k]) => r.checks[k] && (r.checks[k].status === 'fail' || r.checks[k].status === 'not run') && r.checks[k].why).map(([k, label]) => `- ${r.name}, ${label}: ${r.checks[k].status}: ${r.checks[k].why}`),
  );
  return [...lines, '', ...(reasons.length ? ['Reasons:', '', ...reasons] : [])].join('\n') + '\n';
}

/** One summary line per model: the verdict and the first reason that is not a pass. */
export function summaryLines(results) {
  return results.map((r) => {
    const verdict = overall(r.checks);
    const why = Object.values(r.checks).find((c) => c && c.status === verdict && c.why)?.why;
    return `${verdict.padEnd(7)} ${r.name} (${r.type} / ${r.base})${why && verdict !== 'pass' ? `: ${why}` : ''}`;
  });
}

// --- Enforcement: which changes need a sweep, and whether a record still covers HEAD ---

/** Paths whose change can break what the sweep checks: model classification and installs, the graphs' loaders, the Models and
 * Browse screens, the model pickers and covers. Tests, snapshots and style sheets (*.css) alone do not need a sweep:
 * the sweep reads files and the DOM's pictures, not looks. tools/affected.mjs and the Stop hook both ask this function. */
export const SWEEP_TRIGGERS = [
  /^backend\/crates\/novira-core\/src\/models\//,
  /^backend\/crates\/novira-core\/src\/service\/model_store\.rs$/,
  /^backend\/crates\/novira-core\/src\/comfy\/(?!install\.rs$|process\.rs$|node_packs\.rs$|node_defs_check\.rs$|__snapshots__\/)/,
  /^frontend\/src\/features\/(models|browse)\//,
  /^frontend\/src\/features\/params\/model\//,
  /^frontend\/src\/state\/models\.ts$/,
  /^frontend\/src\/ui\/(ModelPicker|CoverImage|SearchPicker)\.tsx$/,
];

/**
 * The paths of `git status --porcelain -z` output, exactly as Git has them (no quoting of a non-ASCII name), the new path
 * of a rename or copy. Read untrimmed: the status of the first entry may start with a space.
 */
export function porcelainPaths(out) {
  const parts = out.split('\0');
  const paths = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length < 4) continue;
    paths.push(parts[i].slice(3));
    if (parts[i][0] === 'R' || parts[i][0] === 'C') i++; // the old path follows
  }
  return paths;
}

/** Whether a changed path needs a fresh sweep. */
export function isSweepTrigger(p) {
  const file = p.replaceAll('\\', '/');
  if (/\.css$/i.test(file)) return false;
  if (/\.(test|property\.test|snapshot\.test|testkit)\.tsx?$|(^|\/)tests\/|__snapshots__\//.test(file)) return false;
  return SWEEP_TRIGGERS.some((re) => re.test(file));
}

/** Whether a sweep record still covers HEAD: it ran to the end, and every trigger file changed since its commit is the same
 * file it swept (its uncommitted content then, `dirty` path → blob id, equals HEAD's). `changedSince` lists the paths that
 * differ between the record's commit and HEAD; `blobAtHead(path)` gives HEAD's blob id of a path (null when deleted). */
export function recordCoversHead(record, changedSince, blobAtHead) {
  if (!record || !record.complete || !record.head) return false;
  // A run through the browser server does not cover the desktop window (the novira-image scheme, WebView2): the gate asks for the app's.
  if (record.via === 'server') return false;
  return changedSince.filter(isSweepTrigger).every((p) => record.dirty?.[p] !== undefined && record.dirty[p] === blobAtHead(p));
}

/** The sweep records under `<work>/models-sweep/`, newest first (each run's `sweep.json`). Unreadable ones are skipped. */
export function readRecords(work) {
  const dir = path.join(work, 'models-sweep');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name, 'sweep.json');
    try {
      out.push({ ...JSON.parse(fs.readFileSync(file, 'utf8')), file });
    } catch {
      // Missing or half written: not a record.
    }
  }
  return out.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

/** The reminder for one work tree, or null: trigger files were committed on it (`committed`) and no record covers HEAD. */
export function sweepReminder({ root, committed, records, covers }) {
  const triggers = [...new Set(committed.filter(isSweepTrigger))];
  if (!triggers.length) return null;
  if (records.some((r) => covers(r))) return null;
  const shown = triggers.slice(0, 6).join(', ') + (triggers.length > 6 ? `, ... (${triggers.length - 6} more)` : '');
  return `${root}: model code was committed (${shown}) and no model sweep covers HEAD. Run \`node tools/models-sweep.mjs\` there (see .claude/rules/models.md), fix what fails, and show the user the table; or say in the report why it was not run.`;
}
