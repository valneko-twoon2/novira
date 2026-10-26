// The model sweep (tools/models-sweep*.mjs): what it reads from the code agrees with the code, which models stand for their
// kind, the graph and picture checks, the verdicts and the table, which changes need a sweep and when a record still covers
// HEAD, the Stop hook's reminder, and the main checkout a worktree shares its harness folder with.
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BASE_LABELS, isDrawable, isVideoModel, SPLIT_BASES, VIDEO_BASES } from '@/state/models';
import { CATEGORIES, coverKind } from '@/features/models/modelCategories';
import type { BaseModel, ModelConfig, ModelType } from '@/backend';
import {
  baseHint,
  brightnessSpread,
  classificationCheck,
  comfyNameOf,
  decodePng,
  graphCheck,
  isSweepTrigger,
  loadedFiles,
  markdownTable,
  narrow,
  overall,
  packRows,
  pickerOf,
  pictureCheck,
  porcelainPaths,
  railOf,
  readCode,
  recordCoversHead,
  representatives,
  summaryLines,
  sweepReminder,
  unscannedFolders,
  wireKind,
  // @ts-expect-error -- plain ESM script without types
} from '../../tools/models-sweep-lib.mjs';
// @ts-expect-error -- plain ESM script without types
import { mergeRuns, parseArgs } from '../../tools/models-sweep.mjs';
// @ts-expect-error -- plain ESM script without types
import { harnessRoots, mainCheckout, movedDataDir } from '../../tools/harness-paths.mjs';
// @ts-expect-error -- plain ESM script without types
import { reminder, sweepReminders } from '../../.claude/hooks/commit-before-stop.mjs';

const code = readCode('..');
const TYPES: ModelType[] = ['main', 'vae', 'lora', 'controlnet', 't2i_adapter', 'ip_adapter', 'clip_vision', 'spandrel_image_to_image', 't5_encoder', 'clip_embed', 'diffusion_model', 'text_encoder', 'model_patch'];
const BASES = Object.keys(BASE_LABELS) as BaseModel[];
const model = (over: Partial<ModelConfig>): ModelConfig => ({ key: 'k', name: 'm', base: 'sdxl', type: 'main', format: 'checkpoint', description: '', path: 'E:/models/checkpoints/m.safetensors', size: 1, ...over }) as ModelConfig;

describe('what the sweep reads from the code', () => {
  it('reads the scanned folders of layout.rs with their wire kinds and the model extensions', () => {
    expect(code.categories.map((c: { folder: string }) => c.folder)).toEqual(expect.arrayContaining(['checkpoints', 'loras', 'vae', 'diffusion_models', 'text_encoders', 'upscale_models']));
    expect(code.categories.find((c: { folder: string }) => c.folder === 'checkpoints').aliases).toContain('Stable-diffusion');
    for (const c of code.categories) expect(TYPES).toContain(c.kind);
    expect(code.extensions).toEqual(expect.arrayContaining(['safetensors', 'gguf', 'ckpt']));
    expect(wireKind('SpandrelImageToImage')).toBe('spandrel_image_to_image');
    expect(wireKind('IpAdapter')).toBe('ip_adapter');
  });

  it('reads the same families, labels, rail and cover kinds as the screens use', () => {
    expect(code.splitBases).toEqual(new Set(SPLIT_BASES));
    expect(code.videoBases).toEqual(new Set(VIDEO_BASES));
    expect(code.baseLabels).toEqual(BASE_LABELS);
    expect(code.rail).toEqual(CATEGORIES.map((c) => ({ id: c.id, types: c.types })));
    for (const type of TYPES) expect(code.pictureTypes.has(type)).toBe(coverKind(type) !== 'icon');
  });

  it('sends every kind and base to the screen that draws with it, as the screens decide', () => {
    for (const type of TYPES) {
      for (const base of BASES) {
        const m = model({ type, base });
        const { picker } = pickerOf(m, code);
        expect(picker === 'generate', `${type}/${base}`).toBe(isDrawable(m));
        if (picker === 'video') expect(isVideoModel(m)).toBe(true);
        if (isVideoModel(m)) expect(picker).toBe('video');
      }
    }
    expect(pickerOf(model({ type: 'lora' }), code).picker).toBe('lora');
    expect(pickerOf(model({ type: 'vae' }), code).picker).toBe('vae');
    expect(pickerOf(model({ type: 'controlnet' }), code)).toEqual({ picker: null, why: expect.stringContaining('canvas') });
    expect(pickerOf(model({ type: 'diffusion_model', base: 'hunyuan-dit' }), code).why).toContain('no screen');
  });

  it('names the rail entry of every kind', () => {
    for (const type of TYPES) expect(railOf(type, code.rail), type).not.toBeNull();
    expect(railOf('diffusion_model', code.rail)).toBe('diffusion');
    expect(railOf('clip_vision', code.rail)).toBe('ipAdapter');
  });
});

describe('the model packs', () => {
  type Pack = { kind: string; dir: string; files: { folder: string; file: string; home: string | null }[]; voiceModels: string[] };
  const packs: Pack[] = code.packs;
  const pack = (kind: string) => packs.find((p) => p.kind === kind)!;

  it('reads every pack kind, its folder and its files from packs.rs, and the voice models from the voice engine', () => {
    expect(packs.map((p) => p.kind).sort()).toEqual(['inpaint', 'logo', 'music', 'turbo', 'video', 'voice']);
    expect(pack('music').files).toEqual([{ folder: 'checkpoints', file: expect.stringContaining('ace_step'), home: null }]);
    expect(pack('video').files.map((f) => f.folder)).toEqual(['diffusion_models', 'text_encoders', 'vae']);
    expect(pack('turbo').files.filter((f) => f.home === 'video')).toHaveLength(2);
    expect(pack('voice').files).toEqual([]);
    expect(pack('voice').voiceModels.length).toBeGreaterThan(0);
  });

  const only = (...kinds: string[]) => packs.filter((p) => kinds.includes(p.kind));
  const on = (...present: string[]) => (p: string) => present.some((x) => p === x);
  const status = (state: string) => ({ music: { state }, video: { state }, turbo: { state }, voice: { state } });

  it('passes a pack whose files are in a shared root and which the app reports ready', () => {
    const [row] = packRows({ packs: only('music'), status: status('ready'), roots: ['E:/own', 'E:/shared'], has: on(`E:/shared/music/checkpoints/${pack('music').files[0]!.file}`) });
    expect(row).toMatchObject({ name: 'music pack', type: 'pack' });
    expect(row.checks.listed).toMatchObject({ status: 'pass' });
    expect(row.checks.listed.why).toContain('E:/shared');
    expect(row.checks.coverOff.status).toBe('n/a');
    expect(row.checks.picker.status).toBe('n/a');
  });

  it('fails when the files are there and the app says missing, or the app says ready and a file is nowhere; n/a when not installed', () => {
    const music = `E:/shared/music/checkpoints/${pack('music').files[0]!.file}`;
    const there = packRows({ packs: only('music'), status: status('missing'), roots: ['E:/shared'], has: on(music) })[0];
    expect(there.checks.listed.status).toBe('fail');
    const ghost = packRows({ packs: only('music'), status: status('ready'), roots: ['E:/shared'], has: () => false })[0];
    expect(ghost.checks.listed.status).toBe('fail');
    const none = packRows({ packs: only('music'), status: status('missing'), roots: ['E:/shared'], has: () => false })[0];
    expect(none.checks.listed).toMatchObject({ status: 'n/a' });
    expect(none.checks.listed.why).toContain('no model root');
    expect(overall(none.checks)).toBe('pass');
  });

  it('looks for the files Turbo shares in the video pack folder, and for the voice models by their marker file', () => {
    const turbo = pack('turbo');
    const present = turbo.files.map((f) => `E:/s/${f.home ? 'video' : 'turbo'}/${f.folder}/${f.file}`);
    expect(packRows({ packs: only('turbo'), status: status('ready'), roots: ['E:/s'], has: on(...present) })[0].checks.listed.status).toBe('pass');
    const marks = pack('voice').voiceModels.map((m) => `E:/s/voice/${m}/.complete`);
    expect(packRows({ packs: only('voice'), status: status('ready'), roots: ['E:/s'], has: on(...marks) })[0].checks.listed.status).toBe('pass');
    // The libraries live in the data folder: models alone with the pack missing is not a fault.
    expect(packRows({ packs: only('voice'), status: status('missing'), roots: ['E:/s'], has: on(...marks) })[0].checks.listed.status).toBe('n/a');
  });

  it('adds one row per pack to the merged table, narrowed by --model and --category', () => {
    const off = { status: 0, data: { models: [], results: {}, packs: status('missing') } };
    const base = { off, on: { status: 0, data: null }, lookup: false, gpuWhy: null, files: [], code, roots: ['E:/s'], has: () => false };
    expect(mergeRuns(base).filter((r: { type: string }) => r.type === 'pack')).toHaveLength(6);
    expect(mergeRuns({ ...base, filter: { model: 'music' } }).map((r: { name: string }) => r.name)).toEqual(['music pack']);
    expect(mergeRuns({ ...base, filter: { category: 'loras' } })).toEqual([]);
    expect(mergeRuns({ ...base, filter: { category: 'packs' } })).toHaveLength(6);
  });
});

describe('model files and their folders', () => {
  const roots = ['E:/data/models', 'E:/shared/models'];

  it('gives the category folder and the name ComfyUI lists, in any root and alias, ignoring case', () => {
    expect(comfyNameOf('E:\\shared\\models\\Stable-diffusion\\sub\\a.safetensors', roots, code.categories)).toEqual({ folder: 'checkpoints', kind: 'main', alias: 'Stable-diffusion', name: 'sub/a.safetensors' });
    expect(comfyNameOf('E:/data/models/Lora/b.safetensors', roots, code.categories)).toMatchObject({ folder: 'loras', name: 'b.safetensors' });
    expect(comfyNameOf('E:/shared/models/video/diffusion_models/c.safetensors', roots, code.categories)).toBeNull();
    expect(comfyNameOf('E:/elsewhere/checkpoints/c.safetensors', roots, code.categories)).toBeNull();
  });

  it('names the folders of a root that novira does not scan, not the categories', () => {
    expect(unscannedFolders(['checkpoints', 'video', 'Lora', 'music', '.downloads', 'VAE'], code.categories)).toEqual(['music', 'video']);
  });

  it('fails a file listed as another kind than its folder holds, a kind without a base, and a base the name contradicts', () => {
    const where = (folder: string, kind: string) => ({ folder, kind, alias: folder, name: 'x' });
    expect(classificationCheck(model({}), where('checkpoints', 'main'), code.categories).status).toBe('pass');
    expect(classificationCheck(model({ type: 'lora' }), where('checkpoints', 'main'), code.categories).why).toContain('loader does not read checkpoints/');
    // A T5 encoder has no folder of its own: text_encoders/ holds it.
    expect(classificationCheck(model({ type: 't5_encoder', base: 'any' }), where('text_encoders', 'text_encoder'), code.categories).status).toBe('pass');
    expect(classificationCheck(model({ type: 'lora', base: 'any' }), where('loras', 'lora'), code.categories).why).toContain('without a base');
    expect(classificationCheck(model({ type: 'vae', base: 'any' }), where('vae', 'vae'), code.categories).status).toBe('pass');
    expect(classificationCheck(model({ type: 'lora', base: 'sd-1', path: 'E:/m/loras/BuAnime_Style_Anima_V3.safetensors' }), where('loras', 'lora'), code.categories).why).toContain('the name says anima');
    expect(classificationCheck(model({}), null, code.categories).status).toBe('fail');
  });

  it('reads a base from a file name only where the name says it', () => {
    expect(baseHint('FComic_1to1000_IL_V2.safetensors')).toEqual(['sdxl']);
    expect(baseHint('reverse_bunnysuit-Illustrious.safetensors')).toEqual(['sdxl']);
    expect(baseHint('ryugahama_yueilxl_v1.safetensors')).toEqual(['sdxl']);
    expect(baseHint('wan2.2_ti2v_5B_fp16.safetensors')).toEqual(['wan']);
    expect(baseHint('BuAnime_NSFW_Style_V6.safetensors')).toBeNull();
    expect(baseHint('Pixel_style.safetensors')).toBeNull();
  });
});

describe('which models the sweep runs', () => {
  const list = [
    model({ key: '1', name: 'b-sdxl', type: 'main', base: 'sdxl' }),
    model({ key: '2', name: 'a-sdxl', type: 'main', base: 'sdxl' }),
    model({ key: '3', name: 'anima', type: 'diffusion_model', base: 'anima' }),
    model({ key: '4', name: 'style', type: 'lora', base: 'sdxl' }),
  ];

  it('takes one model per kind and base, the first by name, or the ones whose name has the part asked for', () => {
    expect(representatives(list).map((m: ModelConfig) => m.key)).toEqual(['2', '3', '4']);
    expect(representatives(list, { model: 'B-SD' }).map((m: ModelConfig) => m.key)).toEqual(['1']);
  });

  it('narrows by folder, kind, rail entry, base or part of the name', () => {
    const keys = (opts: object) => narrow(list, opts, code).map((m: ModelConfig) => m.key);
    expect(keys({})).toEqual(['1', '2', '3', '4']);
    expect(keys({ category: 'diffusion_models' })).toEqual(['3']);
    expect(keys({ category: 'lora' })).toEqual(['4']);
    expect(keys({ category: 'diffusion' })).toEqual(['3']);
    expect(keys({ category: 'sdxl' })).toEqual(['1', '2', '4']);
    expect(keys({ category: 'loras', model: 'none' })).toEqual([]);
  });
});

describe('what the job really loaded', () => {
  const prompt = {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sub\\waiIllustrious.safetensors' } },
    '2': { class_type: 'LoraLoader', inputs: { lora_name: 'style.safetensors', model: ['1', 0], strength_model: 1 } },
    '3': { class_type: 'CLIPTextEncode', inputs: { text: 'a girl.safetensors? no' } },
  };

  it('lists the model files the nodes load, with forward slashes', () => {
    expect(loadedFiles(prompt, code.extensions)).toEqual([
      { node: 'CheckpointLoaderSimple', input: 'ckpt_name', file: 'sub/waiIllustrious.safetensors' },
      { node: 'LoraLoader', input: 'lora_name', file: 'style.safetensors' },
    ]);
    expect(loadedFiles(null, code.extensions)).toEqual([]);
  });

  it('passes only when the chosen file is among them', () => {
    expect(graphCheck(prompt, 'sub/WAIillustrious.safetensors', code.extensions)).toMatchObject({ status: 'pass', why: 'CheckpointLoaderSimple.ckpt_name = sub/waiIllustrious.safetensors' });
    expect(graphCheck(prompt, 'other.safetensors', code.extensions).why).toContain('not other.safetensors');
    expect(graphCheck({ '1': { class_type: 'EmptyLatentImage', inputs: { width: 8 } } }, 'a.safetensors', code.extensions).why).toContain('no model file');
  });
});

/** A PNG of `rows` (each a flat array of RGB bytes), each row written with the given filter type (0 to 4). */
function png(width: number, rows: number[][], filters: number[]): Buffer {
  const bpp = 3;
  const raw: number[] = [];
  rows.forEach((row, y) => {
    const f = filters[y % filters.length]!;
    raw.push(f);
    row.forEach((v, x) => {
      const a = x >= bpp ? row[x - bpp]! : 0;
      const b = y > 0 ? rows[y - 1]![x]! : 0;
      const c = x >= bpp && y > 0 ? rows[y - 1]![x - bpp]! : 0;
      const p = a + b - c;
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      const pred = [0, a, b, (a + b) >> 1, paeth][f]!;
      raw.push((v - pred) & 0xff);
    });
  });
  const chunk = (type: string, body: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    return Buffer.concat([len, Buffer.from(type, 'latin1'), body, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(rows.length, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from(raw))), chunk('IEND', Buffer.alloc(0))]);
}

describe('the blank-picture check', () => {
  const W = 16;
  const gradient = Array.from({ length: 16 }, (_, y) => Array.from({ length: W * 3 }, (_, i) => (Math.floor(i / 3) * 13 + y * 7 + (i % 3) * 50) & 0xff));

  it('decodes every PNG row filter back to the same pixels', () => {
    const plain = decodePng(png(W, gradient, [0]));
    const mixed = decodePng(png(W, gradient, [0, 1, 2, 3, 4]));
    expect(plain.width).toBe(W);
    expect(Array.from(plain.pixels)).toEqual(gradient.flat());
    expect(Array.from(mixed.pixels)).toEqual(gradient.flat());
  });

  it('fails a one-colour or unreadable picture and passes a real one', () => {
    const flat = Array.from({ length: 16 }, () => Array.from({ length: W * 3 }, () => 12));
    expect(brightnessSpread(decodePng(png(W, flat, [1])))).toBe(0);
    expect(pictureCheck(png(W, flat, [0])).status).toBe('fail');
    expect(pictureCheck(png(W, gradient, [4]))).toMatchObject({ status: 'pass' });
    expect(pictureCheck(Buffer.from('not a picture')).why).toContain('could not be read');
  });
});

describe('verdicts and the table', () => {
  const rows = [
    { name: 'A', type: 'main', base: 'sdxl', checks: { listed: { status: 'pass', why: '' }, coverOff: { status: 'n/a', why: 'icon' }, generate: { status: 'not run', why: 'GPU busy' } } },
    { name: 'B', type: 'lora', base: 'anima', checks: { listed: { status: 'fail', why: 'not listed' }, generate: { status: 'not run', why: 'x' } } },
    { name: 'C', type: 'vae', base: 'any', checks: { listed: { status: 'pass', why: '' }, coverOff: { status: 'n/a', why: 'icon' } } },
  ];

  it('is fail before not run before pass; n/a alone is a pass', () => {
    expect(rows.map((r) => overall(r.checks))).toEqual(['not run', 'fail', 'pass']);
    expect(overall({})).toBe('pass');
  });

  it('writes one row per model and the reasons of every check that did not pass, never calling not run a pass', () => {
    const md = markdownTable(rows);
    expect(md).toContain('| A | main / sdxl | pass | n/a |  |  | not run |  |  | **not run** |');
    expect(md).toContain('- B, a listed: fail: not listed');
    expect(md).toContain('- A, d generate: not run: GPU busy');
    expect(summaryLines(rows)).toEqual(['not run A (main / sdxl): GPU busy', 'fail    B (lora / anima): not listed', 'pass    C (vae / any)']);
  });

  it('joins the two runs, marks a failed run, and adds a file the app does not list', () => {
    const m = { key: 'k1', name: 'wai', type: 'main', base: 'sdxl', path: 'E:/s/checkpoints/wai.safetensors' };
    const ok = { status: 'pass', why: '' };
    const off = { status: 0, data: { models: [m], results: { k1: { listed: ok, cover: ok, picker: ok } } } };
    const on = { status: 1, data: null };
    const rows = mergeRuns({ off, on, gpuWhy: 'not run (GPU busy): load 90%', files: ['E:/s/checkpoints/wai.safetensors', 'E:/s/loras/lost.safetensors'], code, roots: ['E:/s'] });
    expect(rows[0].checks.coverOn).toEqual({ status: 'not run', why: 'the "on" run failed (exit 1)' });
    expect(rows[0].checks.generate).toEqual({ status: 'not run', why: 'not run (GPU busy): load 90%' });
    expect(rows[1]).toMatchObject({ name: 'lost.safetensors', type: 'lora', checks: { listed: { status: 'fail', why: "on disk in loras/ but not in the app's model list" } } });
  });

  it('does not list the files of other models as missing in a narrowed run', () => {
    const m = { key: 'k1', name: 'wai', type: 'main', base: 'sdxl', path: 'E:/s/checkpoints/wai.safetensors' };
    const ok = { status: 'pass', why: '' };
    const off = { status: 0, data: { models: [m], results: { k1: { listed: ok, cover: ok, picker: ok } } } };
    const files = ['E:/s/checkpoints/wai.safetensors', 'E:/s/loras/other.safetensors'];
    const rows = mergeRuns({ off, on: { status: 0, data: null }, lookup: false, gpuWhy: null, files, code, roots: ['E:/s'], filter: { model: 'wai' } });
    expect(rows.map((r: { name: string }) => r.name)).toEqual(['wai']);
  });

  it('shows the lookup-on cover as not run unless --lookup was given, and takes the GPU part from the lookup-off run', () => {
    const m = { key: 'k1', name: 'wai', type: 'main', base: 'sdxl', path: 'E:/s/checkpoints/wai.safetensors' };
    const icon = { key: 'k2', name: 'vae1', type: 'vae', base: 'sdxl', path: 'E:/s/vae/vae1.safetensors' };
    const ok = { status: 'pass', why: '' };
    const off = { status: 0, data: { models: [m, icon], results: { k1: { listed: ok, cover: ok, picker: ok, generate: ok, graph: ok, picture: ok }, k2: { listed: ok, cover: ok, picker: ok } } } };
    const rows = mergeRuns({ off, on: { status: 0, data: null }, lookup: false, gpuWhy: null, files: [], code, roots: ['E:/s'] });
    const wai = rows.find((r: { name: string }) => r.name === 'wai');
    expect(wai?.checks.coverOn).toEqual({ status: 'not run', why: 'not run (use --lookup)' });
    expect(wai?.checks.generate).toEqual(ok);
    expect(rows.find((r: { name: string }) => r.name === 'vae1')?.checks.coverOn.status).toBe('n/a');
    expect(overall(wai!.checks)).toBe('not run');
  });

  it('reads its flags and refuses unknown ones', () => {
    expect(parseArgs([])).toMatchObject({ lookup: false });
    expect(parseArgs(['--category', 'loras', '--lookup'])).toMatchObject({ category: 'loras', lookup: true });
    expect(parseArgs(['--category', 'loras', '--model', 'wai', '--no-gpu'])).toMatchObject({ category: 'loras', model: 'wai', gpu: false, build: false });
    expect(parseArgs([])).toMatchObject({ via: 'app' });
    expect(parseArgs(['--via', 'server'])).toMatchObject({ via: 'server' });
    expect(() => parseArgs(['--via', 'window'])).toThrow(/app or server/);
    expect(() => parseArgs(['--fast'])).toThrow(/unknown argument/);
    expect(() => parseArgs(['--model'])).toThrow(/missing its value/);
  });
});

describe('when a sweep is due', () => {
  it('needs one for model code, the graphs, the Models and Browse screens and the pickers, not for their tests', () => {
    for (const p of [
      'backend/crates/novira-core/src/models/classify.rs',
      'backend/crates/novira-core/src/service/model_store.rs',
      'backend/crates/novira-core/src/comfy/graph.rs',
      'frontend/src/features/models/CoverImage.tsx',
      'frontend/src/features/browse/ModelCard.tsx',
      'frontend/src/features/params/model/LoraPicker.tsx',
      'frontend/src/ui/ModelPicker.tsx',
      'frontend/src/state/models.ts',
    ]) {
      expect(isSweepTrigger(p), p).toBe(true);
    }
    for (const p of [
      'backend/crates/novira-core/src/comfy/process.rs',
      'backend/crates/novira-core/src/comfy/install.rs',
      'backend/crates/novira-core/src/comfy/__snapshots__/graph/a.json',
      'frontend/src/features/models/CoverImage.test.tsx',
      'frontend/src/state/queue.ts',
      'docs/design/models.md',
      'frontend/src/features/models/ModelManager.css',
      'frontend/src/ui/CoverImage.CSS',
    ]) {
      expect(isSweepTrigger(p), p).toBe(false);
    }
  });

  const record = { complete: true, head: 'abc', dirty: { 'frontend/src/state/models.ts': 'blob1' } };

  it('does not count a changed style sheet against a record', () => {
    expect(recordCoversHead(record, ['frontend/src/features/models/models.css'], () => null)).toBe(true);
    expect(sweepReminder({ root: 'E:/wt', records: [], committed: ['frontend/src/features/models/models.css'], covers: () => false })).toBeNull();
  });

  it('counts a complete record whose model files since its commit are the ones it swept', () => {
    expect(recordCoversHead(record, [], () => null)).toBe(true);
    expect(recordCoversHead({ ...record, via: 'server' }, [], () => null)).toBe(false);
    expect(recordCoversHead({ ...record, via: 'app' }, [], () => null)).toBe(true);
    expect(recordCoversHead(record, ['docs/x.md'], () => null)).toBe(true);
    expect(recordCoversHead(record, ['frontend/src/state/models.ts'], () => 'blob1')).toBe(true);
    expect(recordCoversHead(record, ['frontend/src/state/models.ts'], () => 'blob2')).toBe(false);
    expect(recordCoversHead(record, ['frontend/src/ui/ModelPicker.tsx'], () => 'blob1')).toBe(false);
    expect(recordCoversHead({ ...record, complete: false }, [], () => null)).toBe(false);
    expect(recordCoversHead(null, [], () => null)).toBe(false);
  });

  it('reminds only when model code was committed and no record covers HEAD', () => {
    const base = { root: 'E:/wt', records: [record] };
    expect(sweepReminder({ ...base, committed: ['docs/a.md'], covers: () => false })).toBeNull();
    expect(sweepReminder({ ...base, committed: ['frontend/src/state/models.ts'], covers: () => true })).toBeNull();
    expect(sweepReminder({ ...base, committed: ['frontend/src/state/models.ts'], covers: () => false })).toContain('node tools/models-sweep.mjs');
  });
});

describe('the files a sweep record lists as uncommitted', () => {
  it('reads git status -z whole: the first status starting with a space, a non-ASCII name, the new path of a rename', () => {
    const out = [' M frontend/src/state/models.ts', '?? frontend/src/features/models/新しい.tsx', 'R  frontend/src/ui/ModelPicker.tsx', 'frontend/src/ui/OldPicker.tsx', ''].join('\0');
    expect(porcelainPaths(out)).toEqual(['frontend/src/state/models.ts', 'frontend/src/features/models/新しい.tsx', 'frontend/src/ui/ModelPicker.tsx']);
    expect(porcelainPaths('')).toEqual([]);
  });
});

describe('the Stop hook and the sweep', () => {
  it('asks for the sweep only when nothing is uncommitted or left over, once', () => {
    expect(reminder({}, [], false, [], ['E:/wt: model code'])).toContain('E:/wt: model code');
    expect(reminder({}, ['a.ts'], false, [], ['E:/wt: model code'])).not.toContain('E:/wt: model code');
    expect(reminder({ stop_hook_active: true }, [], false, [], ['x'])).toBeNull();
    expect(reminder({}, [], false, [], [])).toBeNull();
  });

  it('reads the commits of each work tree since main and checks the records against its HEAD', () => {
    const calls: string[] = [];
    const git = (root: string, args: string[]) => {
      calls.push(`${root} ${args.join(' ')}`);
      if (args[0] === 'log') return root === 'E:/main' ? '' : 'frontend/src/state/models.ts\n';
      if (args[0] === 'diff') return 'frontend/src/state/models.ts\n';
      if (args[0] === 'rev-parse') return 'blob1\n';
      throw new Error('unexpected');
    };
    const record = { complete: true, head: 'abc', dirty: { 'frontend/src/state/models.ts': 'blob1' } };
    expect(sweepReminders(['E:/main', 'E:/wt'], { git, records: [record] })).toEqual([]);
    expect(calls).toContain('E:/main log --format= --name-only @{upstream}..HEAD');
    expect(calls).toContain('E:/wt log --format= --name-only main..HEAD');
    const stale = sweepReminders(['E:/main', 'E:/wt'], { git, records: [{ ...record, dirty: {} }] });
    expect(stale).toHaveLength(1);
    expect(stale[0]).toContain('E:/wt');
    const cssOnly = (root: string, args: string[]) => (args[0] === 'log' ? 'frontend/src/features/models/models.css\n' : git(root, args));
    expect(sweepReminders(['E:/main', 'E:/wt'], { git: cssOnly, records: [] })).toEqual([]);
    const broken = () => {
      throw new Error('no upstream');
    };
    expect(sweepReminders(['E:/main'], { git: broken, records: [] })).toEqual([]);
  });
});

describe('the main checkout a worktree shares', () => {
  it('is the first entry of `git worktree list`, or the folder itself when Git cannot tell', () => {
    const list = () => 'worktree E:/Code/novira\nHEAD a\nbranch refs/heads/main\n\nworktree E:/Code/novira-wt-x\nHEAD b\n';
    expect(mainCheckout('E:/Code/novira-wt-x', list).replaceAll('\\', '/')).toBe('E:/Code/novira');
    expect(mainCheckout('E:/Code/copy', () => {
      throw new Error('not a repository');
    }).replaceAll('\\', '/')).toBe('E:/Code/copy');
    const roots = harnessRoots('E:/Code/novira-wt-x', 'E:/Code/novira', null, () => true);
    expect(roots.work.replaceAll('\\', '/')).toBe('E:/Code/novira/novira-data/work');
    expect(roots.models.replaceAll('\\', '/')).toBe('E:/Code/novira/novira-data/models');
  });

  it('shares the models of a data folder the app moved out of the repository, and keeps the harness folder in it', () => {
    const exists = (p: string) => p.replaceAll('\\', '/').startsWith('C:/data/models');
    const roots = harnessRoots('E:/Code/novira', 'E:/Code/novira', 'C:/data', exists);
    expect(roots.models.replaceAll('\\', '/')).toBe('C:/data/models');
    expect(roots.work.replaceAll('\\', '/')).toBe('E:/Code/novira/novira-data/work');
    // The repository's own models win while they are there; no pointer keeps them.
    expect(harnessRoots('E:/Code/novira', 'E:/Code/novira', 'C:/data', () => true).models.replaceAll('\\', '/')).toBe('E:/Code/novira/novira-data/models');
    expect(harnessRoots('E:/Code/novira', 'E:/Code/novira', null, () => false).models.replaceAll('\\', '/')).toBe('E:/Code/novira/novira-data/models');
  });

  it('reads the moved data folder from the debug pointer first, then the installed one', () => {
    const files: Record<string, string> = { 'L/novira/data-location.json': '{"dataDir":"D:/inst"}', 'L/novira/data-location-dev.json': '{"dataDir":"D:/dev"}' };
    const read = (f: string) => {
      const text = files[f.replaceAll('\\', '/')];
      if (text === undefined) throw new Error('missing');
      return text;
    };
    expect(movedDataDir({ LOCALAPPDATA: 'L' }, read)?.replaceAll('\\', '/')).toBe('D:/dev');
    delete files['L/novira/data-location-dev.json'];
    expect(movedDataDir({ LOCALAPPDATA: 'L' }, read)?.replaceAll('\\', '/')).toBe('D:/inst');
    files['L/novira/data-location.json'] = 'not json';
    expect(movedDataDir({ LOCALAPPDATA: 'L' }, read)).toBeNull();
    expect(movedDataDir({}, read)).toBeNull();
  });
});
