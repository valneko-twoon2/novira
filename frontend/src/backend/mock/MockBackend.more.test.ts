// @vitest-environment jsdom
// Less travelled paths of the mock backend: the full model install, node packs, the face rig preview, exports and
// backups, and the jobs that edit or describe a picture (including when the picture is gone).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackendEvent, ComfyGraph, EnqueueRequest, ExportOptions, GenerationMetadata, QueueItem } from '../types';
import { installRecordingCanvases } from './canvas2dRecorder.testkit';
import { MockBackend } from './MockBackend';

vi.mock('./imageSynth', async (original) => ({
  ...(await original<typeof import('./imageSynth')>()),
  synthesize: vi.fn(async () => ({ canvas: document.createElement('canvas'), url: 'synth:x' })),
  progressPreview: vi.fn(() => 'preview'),
  imageSize: vi.fn(async () => ({ width: 64, height: 48 })),
}));
vi.mock('./maskSynth', async (original) => ({ ...(await original<typeof import('./maskSynth')>()), synthMask: vi.fn(async () => 'mask:x') }));
vi.mock('./shareBackup', async (original) => ({
  ...(await original<typeof import('./shareBackup')>()),
  exportInBrowser: vi.fn(async (images: unknown[]) => ({ count: images.length, skipped: 0, folder: '' })),
  downloadMockBackup: vi.fn(() => ({ fileName: 'b.json', bytes: 10, info: { appVersion: 'x', createdAt: 1, images: 1, boards: 1, workflows: 0 } })),
}));

const params = (over: Partial<GenerationMetadata> = {}): GenerationMetadata => ({
  generationMode: 'graph',
  positivePrompt: '',
  negativePrompt: '',
  modelKey: 'main-juggernaut-xl',
  modelName: 'Juggernaut XL',
  vaeKey: null,
  seed: 1,
  steps: 1,
  cfgScale: 0,

  cfgRescale: 0,
  scheduler: 'euler',
  width: 0,
  height: 0,
  clipSkip: 0,
  seamlessX: false,
  seamlessY: false,
  loras: [],
  ...over,
} as GenerationMetadata);

const request = (over: Partial<EnqueueRequest> = {}, p: Partial<GenerationMetadata> = {}): EnqueueRequest => ({ origin: 'generate', destination: 'gallery', params: params(p), iterations: 1, randomizeSeed: false, prepend: false, boardId: null, ...over });
const graphOf = (name: string, node: string): ComfyGraph => ({ prompt: { source: { class_type: 'LoadImage', inputs: { image: { $image: name } } }, work: { class_type: node, inputs: {} } }, outputs: ['work'] });

async function start() {
  const backend = new MockBackend('empty');
  const booting = backend.bootstrap();
  if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(1000);
  await booting;
  backend.setStepDelay(0);
  const events: BackendEvent[] = [];
  backend.subscribe((e) => events.push(e));
  return { backend, events };
}
const finished = (events: BackendEvent[], id: number): QueueItem | undefined =>
  events.flatMap((e) => (e.type === 'queue_item_status_changed' && e.item.id === id && e.item.status !== 'pending' && e.item.status !== 'in_progress' ? [e.item] : [])).at(-1);
async function waitFor<T>(f: () => T | undefined): Promise<T> {
  for (let i = 0; i < 400; i++) {
    const v = f();
    if (v !== undefined) return v;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('not reached');
}

describe('jobs on a picture', () => {
  it('fails a job whose picture was deleted, whatever the kind of job', async () => {
    const { backend, events } = await start();
    for (const node of ['Sam2Segmentation', 'RMBG', 'PreviewAny']) {
      const [item] = await backend.enqueue(request({ destination: 'intermediate', comfyGraph: graphOf('gone.png', node) }));
      const done = await waitFor(() => finished(events, item!.id));
      expect([node, done.status, done.error]).toEqual([node, 'failed', 'The picture was deleted']);
    }
  });

  it('makes a mask picture from the clicks, and gives a cut-out the source picture again on the same board', async () => {
    const { backend, events } = await start();
    const source = await backend.uploadImage(new Blob(['a']), { boardId: null });
    const [maskItem] = await backend.enqueue(request({ destination: 'intermediate', comfyGraph: graphOf(source.name, 'Sam2Segmentation') }));
    const maskDone = await waitFor(() => finished(events, maskItem!.id));
    expect(maskDone.status).toBe('completed');
    const mask = events.find((e): e is Extract<BackendEvent, { type: 'image_added' }> => e.type === 'image_added' && e.item?.id === maskItem!.id)!;
    expect(mask.image).toMatchObject({ url: 'mask:x', isIntermediate: true, width: source.width, height: source.height });

    const [cutItem] = await backend.enqueue(request({ boardId: null, comfyGraph: graphOf(source.name, 'RMBG') }));
    await waitFor(() => finished(events, cutItem!.id));
    const cut = events.find((e): e is Extract<BackendEvent, { type: 'image_added' }> => e.type === 'image_added' && e.item?.id === cutItem!.id)!;
    expect(cut.image.url).toBe(source.url);
    expect(cut.image.name).not.toBe(source.name);
    expect(cut.image.isIntermediate).toBe(false);
  });

  it('reads a text aloud into an audio clip', async () => {
    const canvases = installRecordingCanvases();
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
    const { backend, events } = await start();
    const [item] = await backend.enqueue(request({}, { generationMode: 'voice', voice: { text: 'hello there' } as GenerationMetadata['voice'] }));
    const done = await waitFor(() => finished(events, item!.id));
    expect(done.status).toBe('completed');
    const added = events.find((e): e is Extract<BackendEvent, { type: 'image_added' }> => e.type === 'image_added' && e.item?.id === item!.id)!;
    expect(added.image.mediaType).toBe('audio');
    expect(added.image.name.endsWith('.wav')).toBe(true);
    canvases.restore();
  });

  it('turns a graph that saves a sound into an audio clip that keeps the graph, reading aloud when the graph asks for it', async () => {
    const { backend, events } = await start();
    const prompt = (audio: unknown): ComfyGraph['prompt'] => ({
      src: { class_type: 'LoadAudio', inputs: { audio } },
      save: { class_type: 'SaveAudioAdvanced', inputs: { audio: ['src', 0], format: 'flac' } },
    });
    const queue = async (graph: ComfyGraph) => {
      const [item] = await backend.enqueue({ ...request({}, { generationMode: 'graph' }), comfyGraph: graph, workflow: { nodes: [] } });
      await waitFor(() => finished(events, item!.id));
      return events.find((e): e is Extract<BackendEvent, { type: 'image_added' }> => e.type === 'image_added' && e.item?.id === item!.id)!.image;
    };
    const spoken = await queue({ prompt: prompt({ $speech: { text: 'hello there', language: 'Auto', mode: 'preset', speaker: 'Ono_Anna', instruct: '' } }), outputs: ['save'] });
    expect(spoken.mediaType).toBe('audio');
    expect(spoken.workflow).toEqual({ nodes: [] });
    const song = await queue({ prompt: { ...prompt('x.wav'), latent: { class_type: 'EmptyAceStep1.5LatentAudio', inputs: { seconds: 5 } } }, outputs: ['save'] });
    expect(song.mediaType).toBe('audio');
    expect(song.url).not.toBe(spoken.url);
  });
});

describe('models, node packs and the face rig', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const settle = async <T,>(promise: Promise<T>, ms = 1000): Promise<T> => {
    await vi.advanceTimersByTimeAsync(ms);
    return promise;
  };

  it('installs a model to the end: downloading, then running, then a model on the list', async () => {
    const { backend, events } = await start();
    const job = await settle(backend.installModel('https://example.com/models/fancy.safetensors', 'Fancy'));
    expect(job.name).toBe('Fancy');
    await vi.advanceTimersByTimeAsync(120 * 20 + 600);
    const statuses = events.flatMap((e) => (e.type === 'model_install' && e.job.id === job.id ? [e.job.status] : []));
    expect(statuses).toContain('downloading');
    expect(statuses).toContain('running');
    expect(events.some((e) => e.type === 'model_added' && e.model.name === 'Fancy')).toBe(true);
  });

  it('reports the files an Anima model lacks, and none once they are installed', async () => {
    const { backend, events } = await start();
    const keyOf = (name: string) => events.flatMap((e) => (e.type === 'model_added' && e.model.name === name ? [e.model.key] : []))[0]!;
    const job = await settle(backend.installModel('circlestone-labs/Anima::split_files/diffusion_models/anima-base-v1.0.safetensors', 'Anima Base 1.0'));
    await vi.advanceTimersByTimeAsync(120 * 20 + 600);
    const animaKey = keyOf(job.name);
    const before = await settle(backend.modelParts(animaKey));
    expect(before.missing.map((m) => m.id)).toEqual(['starter-qwen3-06b', 'starter-qwen-image-vae']);
    for (const part of before.missing) {
      await settle(backend.installModel(part.source, part.name));
      await vi.advanceTimersByTimeAsync(120 * 20 + 600);
    }
    expect((await settle(backend.modelParts(animaKey))).missing).toEqual([]);
    const sd = await settle(backend.installModel('stable-diffusion-v1-5/stable-diffusion-v1-5'));
    await vi.advanceTimersByTimeAsync(120 * 20 + 600);
    expect((await settle(backend.modelParts(keyOf(sd.name)))).missing).toEqual([]);
    const gone = expect(backend.modelParts('nope')).rejects.toThrow('model not found');
    await vi.advanceTimersByTimeAsync(1000);
    await gone;
  });

  it('hands out copies of the starter models, and the Civitai search can fail or search Hugging Face', async () => {
    const { backend } = await start();
    const starters = await settle(backend.listStarterModels());
    starters[0]!.name = 'changed';
    expect((await settle(backend.listStarterModels()))[0]!.name).not.toBe('changed');
    const failed = expect(backend.searchCivitai({ query: 'this will fail', source: 'civitai' } as never)).rejects.toThrow('Civitai request failed');
    await vi.advanceTimersByTimeAsync(1000);
    await failed;
    const hf = backend.searchCivitai({ query: 'flux', source: 'huggingface' } as never);
    await vi.advanceTimersByTimeAsync(1000);
    expect(Array.isArray((await hf).items)).toBe(true);
  });

  it('installs a node pack from a GitHub address, marks the engine for restart, and removes it again', async () => {
    const { backend, events } = await start();
    await backend.installNodePack('https://github.com/someone/ComfyUI-Fancy.git');
    await backend.installNodePack('https://github.com/someone/ComfyUI-Fancy');
    await vi.advanceTimersByTimeAsync(2000);
    const states = events.flatMap((e) => (e.type === 'node_pack' ? [e.status.state] : []));
    expect(states.at(-1)).toBe('ready');
    expect(states.filter((s) => s === 'installing')).toHaveLength(1);
    const packs = await settle(backend.nodePacks());
    expect(packs.restartNeeded).toBe(true);
    expect(packs.installed.some((p) => p.folder === 'ComfyUI-Fancy')).toBe(true);
    const removed = await settle(backend.removeNodePack('ComfyUI-Fancy'));
    expect(removed.installed.some((p) => p.folder === 'ComfyUI-Fancy')).toBe(false);
    const missing = expect(backend.removeNodePack('ComfyUI-Fancy')).rejects.toThrow('is not installed');
    await vi.advanceTimersByTimeAsync(1000);
    await missing;
  });

  it('switches the ComfyUI version through the engine states and refuses a version that is not plain', async () => {
    const { backend, events } = await start();
    const releases = backend.comfyVersions();
    await vi.advanceTimersByTimeAsync(500);
    expect((await releases)[0]).toBe('v0.3.60');
    await expect(backend.switchComfyVersion('../x')).rejects.toThrow('Not a ComfyUI version');
    const switching = backend.switchComfyVersion('v0.3.40');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await switching).toEqual([]);
    expect(events.flatMap((e) => (e.type === 'engine_status' ? [e.status.state] : [])).slice(-3)).toEqual(['extracting', 'starting', 'ready']);
    const packs = backend.nodePacks();
    await vi.advanceTimersByTimeAsync(500);
    expect((await packs).comfyVersion).toBe('0.3.40');
  });

  it('lists versions for a GitHub address only, and refuses a version that is not a plain tag', async () => {
    const { backend } = await start();
    const listing = backend.nodePackVersions('https://github.com/someone/ComfyUI-Fancy');
    await vi.advanceTimersByTimeAsync(500);
    expect((await listing)[0]).toBe('v2.1.0');
    await expect(backend.nodePackVersions('https://example.com/a/b')).rejects.toThrow('Not a GitHub repository address');
    const none = backend.nodePackVersions('https://github.com/someone/untagged');
    await vi.advanceTimersByTimeAsync(500);
    expect(await none).toEqual([]);
    await expect(backend.installNodePack('https://github.com/someone/ComfyUI-Fancy', '../evil')).rejects.toThrow('Not a version tag');
  });

  it('lists the registry most downloaded first, only with GitHub addresses', async () => {
    const { backend } = await start();
    const list = backend.registryNodes(false);
    await vi.advanceTimersByTimeAsync(500);
    const nodes = await list;
    expect(nodes.length).toBeGreaterThan(60);
    expect(nodes.every((n, i) => i === 0 || nodes[i - 1]!.downloads >= n.downloads)).toBe(true);
    expect(nodes.every((n) => n.repository.startsWith('https://github.com/'))).toBe(true);
  });

  it('describes a repository by its GitHub address only', async () => {
    const { backend } = await start();
    const info = backend.nodePackInfo('https://github.com/someone/ComfyUI-Fancy');
    await vi.advanceTimersByTimeAsync(500);
    expect(await info).toMatchObject({ author: 'someone', license: 'MIT' });
    const none = backend.nodePackInfo('https://github.com/someone/nolicense');
    await vi.advanceTimersByTimeAsync(500);
    expect((await none).license).toBeNull();
    await expect(backend.nodePackInfo('https://example.com/a/b')).rejects.toThrow('Not a GitHub repository address');
  });

  it('refuses an address that is not GitHub, reports a failing pack and cancels one in progress', async () => {
    const { backend, events } = await start();
    await expect(backend.installNodePack('https://example.com/a/b')).rejects.toThrow('Not a GitHub repository address');
    await backend.installNodePack('https://github.com/someone/fail-pack');
    await vi.advanceTimersByTimeAsync(2000);
    expect(events.flatMap((e) => (e.type === 'node_pack' && e.url.endsWith('fail-pack') ? [e.status.state] : [])).at(-1)).toBe('error');
    await backend.installNodePack('https://github.com/someone/slow-pack');
    await vi.advanceTimersByTimeAsync(100);
    await backend.cancelNodePack('https://github.com/someone/slow-pack');
    await vi.advanceTimersByTimeAsync(2000);
    expect(events.flatMap((e) => (e.type === 'node_pack' && e.url.endsWith('slow-pack') ? [e.status.state] : [])).at(-1)).toBe('missing');
  });

  it('lists the node definitions (as a copy) and the face rig library', async () => {
    const { backend } = await start();
    const defs = await settle(backend.nodeDefs());
    expect(Object.keys(defs).length).toBeGreaterThan(5);
    delete defs[Object.keys(defs)[0]!];
    expect(Object.keys(await settle(backend.nodeDefs())).length).toBeGreaterThan(Object.keys(defs).length);
    expect(await settle(backend.faceRigLibrary())).toBeTruthy();
  });

  it('asks for a frame first, then previews the picture it was given (a placeholder when the mock does not hold it)', async () => {
    const { backend } = await start();
    expect(await settle(backend.faceRigPreview({ nodeKey: 'n1' } as never), 100)).toEqual({ needsFrame: true });
    const unknown = await settle(backend.faceRigPreview({ nodeKey: 'n1', image: 'gone.png' } as never), 100);
    expect(unknown).toMatchObject({ settled: true });
    const kept = await settle(backend.faceRigPreview({ nodeKey: 'n1' } as never), 100);
    expect(kept).toMatchObject({ image: (unknown as { image: string }).image });
    const source = await backend.uploadImage(new Blob(['a']), { boardId: null });
    const known = await settle(backend.faceRigPreview({ nodeKey: 'n2', image: source.name } as never), 100);
    expect(known).toMatchObject({ image: source.url });
  });
});

describe('exports and backups', () => {
  const options: ExportOptions = { format: 'png', quality: 90, maxSide: null, removeInfo: true, watermark: false };

  it('refuses an empty choice and counts the pictures that no longer exist as skipped', async () => {
    const { backend } = await start();
    const source = await backend.uploadImage(new Blob(['a']), { boardId: null });
    await expect(backend.exportImages([], options)).rejects.toThrow('Choose at least one picture');
    expect(await backend.exportImages([source.name, 'gone.png', 'gone2.png'], options)).toEqual({ count: 1, skipped: 2, watermarked: 0, folder: '' });
    await expect(backend.revealExportFolder()).resolves.toBeUndefined();
  });

  it('pretends to watermark: the last marked copy is what a file check finds, a gallery picture has no marks', async () => {
    const { backend } = await start();
    const source = await backend.uploadImage(new Blob(['a']), { boardId: null });
    expect(await backend.watermarkStatus()).toEqual({ state: 'ready' });
    await expect(backend.prepareWatermark()).resolves.toBeUndefined();
    expect(await backend.checkWatermarkFile()).toMatchObject({ watermarkFound: false, credentialsPresent: false });
    const done = await backend.exportImages([source.name], { ...options, format: 'jpeg', watermark: true });
    expect(done).toMatchObject({ count: 1, watermarked: 1 });
    const check = await backend.checkWatermarkFile();
    expect(check).toMatchObject({ noviraMarker: true, originalName: source.name, originalInGallery: true, credentialsThisApp: true, iptcAi: true });
    expect(check!.fileName).toMatch(/\.jpg$/);
    expect(check!.watermarkId).toMatch(/^[0-9a-f]{12}$/);
    expect(await backend.checkWatermarkImage(source.name)).toMatchObject({ fileName: source.name, watermarkFound: false });
    await expect(backend.checkWatermarkImage('gone.png')).rejects.toThrow('no picture');
  });

  it('makes a backup, reports it as the one to restore, and forgets it after confirming', async () => {
    vi.useFakeTimers();
    try {
      const { backend, events } = await start();
      const summary = await backend.createBackup('{}');
      expect(summary).toMatchObject({ fileName: 'b.json' });
      expect(events.some((e) => e.type === 'backup' && e.progress.phase === 'create')).toBe(true);
      const opened = backend.openBackup();
      await vi.advanceTimersByTimeAsync(1000);
      expect(await opened).toMatchObject({ images: 1, boards: 1 });
      await backend.confirmRestore();
      const again = backend.openBackup();
      await vi.advanceTimersByTimeAsync(1000);
      expect((await again)?.appVersion).toBe('0.1.0-mock');
    } finally {
      vi.useRealTimers();
    }
  });
});
