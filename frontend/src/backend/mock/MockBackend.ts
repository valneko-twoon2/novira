// In-memory backend that behaves like the InvokeAI server: a queue processor with step progress,
// boards, images, model installs and workflows. Nothing touches disk or the network.
import { MockEngine } from './mockEngine';
import type { BackendClient } from '../client';
import type {
  AgentEndpointInfo,
  AgentEndpointInput,
  AgentEndpointTest,
  AgentProvider,
  AgentReply,
  AgentRequest,
  AgentToolAnswer,
  GenerationMetadata,
  AgentModelOption,
  AgentStatus,
  BackendEvent,
  BackupInfo,
  BackupSummary,
  BoardDTO,
  CivitaiSearchParams,
  CivitaiSearchResult,
  ComfyNodeDefs,
  ComfyUiLocale,
  ComicRecord,
  EnqueueRequest,
  ExportOptions,
  ExportResult,
  WatermarkCheck,
  WatermarkStatus,
  FaceRigLibrary,
  FaceRigPreviewRequest,
  FaceRigPreviewResult,
  ImageDTO,
  LowMemoryMode,
  EngineSettings,
  EngineSettingsPatch,
  ModelConfig,
  ModelInstallJob,
  NodePackInfo,
  NodePacks,
  ReferenceHit,
  ReferenceLanguage,
  RegistryNode,
  HardwareInfo,
  PackKind,
  Packs,
  PackStatus,
  QueueItem,
  QueueStatus,
  RetrySize,
  RestoreOutcome,
  UnfinishedDownload,
  SavedWorkflow,
  ModelPartsReport,
  StarterModel,
} from '../types';
import { AGENT_MAX_ATTACHMENTS } from '../types';
import { runMockAgent } from './agent';
import { mockReadGated, type MockToolAnswer } from './agentScript';
import { endpointInfo, noToolsMessage, noToolsReason, normalizeAddress, serverModels, testServer } from './agentEndpoint';
import { HUGGINGFACE_MODELS, searchCivitaiModels } from './civitaiSearch';
import { MOCK_NODE_DEFS } from './comfyNodeDefs';
import { MOCK_FACE_RIG_ANCHORS, MOCK_FACE_RIG_LIBRARY, MOCK_FACE_RIG_PLACEHOLDER } from './faceRigData';
import { CORE_NODE_DEFS } from './comfyCoreDefs';
import { PACK_NODE_DEFS } from './comfyPackDefs';
import { isPoseExtractGraph, mockPoseExtract } from './poseExtract';
import { draftStep } from '../draft';
import { fixedSampling } from '../familySampling';
import { checkGuidance } from './guidance';
import { audioUrl, synthMusic, synthSpeech, waveformThumbnail } from './audioSynth';
import { savesSound, songSeconds, speechText } from './graphAudio';
import { synthesizeVideo } from './videoSynth';
import { imageSize, synthesize } from './imageSynth';
import { mockPicture } from './mockPictures';
import { pointsOf, sourceOf, synthMask } from './maskSynth';
import { batchSeed, randomSeed } from './random';
import { isTextGraph, mockCaption } from './captionText';
import { DEFAULT_WORKFLOWS } from '../defaultWorkflows';
import { perf, snakeCase } from '../perf';
import { MOCK_USER_WORKFLOWS, SEED_BOARDS, SEED_IMAGES, SEED_MODELS, STARTER_MODELS } from './seedData';
import { backupInfo, downloadMockBackup, exportFileName, exportInBrowser, mockWatermarkCheck, type MockWatermark } from './shareBackup';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const LATENCY = 60;
/** The largest comic document, as its JSON text in bytes (the backend's cap for the same data). */
const MAX_COMIC_BYTES = 32 * 1024 * 1024;
/** The backend's limits of the canvas document and the screen state (`service/canvas.rs`, `service/ui_state.rs`). */
const MAX_CANVAS_BYTES = 32 * 1024 * 1024;
const MAX_UI_STATE_BYTES = 32 * 1024 * 1024;
const MAX_UI_STATE_KEY = 200;

/** The JSON object `text` holds, or `null` when it is not one (an array, a number, broken text). */
function jsonObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Refuses a screen state the backend refuses: too large, or not an object of `novira.` keys with text values. */
function checkUiState(state: string): void {
  if (new TextEncoder().encode(state).length > MAX_UI_STATE_BYTES) throw new Error('the screen state is too large');
  const map = jsonObject(state);
  const fine = map !== null && Object.entries(map).every(([k, v]) => k.startsWith('novira.') && new TextEncoder().encode(k).length <= MAX_UI_STATE_KEY && typeof v === 'string');
  if (!fine) throw new Error('the screen state must be a JSON object of novira.* keys with text values');
}

/** What each pack downloads in the mock: file names and sizes (only for the progress display). */
const MOCK_PACK_FILES: Record<PackKind, { file: string; size: number }[]> = {
  video: [
    { file: 'wan2.2_ti2v_5B_fp16.safetensors', size: 10_000_000_000 },
    { file: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors', size: 6_700_000_000 },
    { file: 'wan2.2_vae.safetensors', size: 1_400_000_000 },
  ],
  turbo: [
    { file: 'wan2.2_ti2v_5b_turbo_bf16_f32_mixed.safetensors', size: 10_000_000_000 },
    { file: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors', size: 6_700_000_000 },
    { file: 'wan2.2_vae.safetensors', size: 1_400_000_000 },
  ],
  music: [{ file: 'ace_step_1.5_turbo_aio.safetensors', size: 10_000_000_000 }],
  voice: [
    { file: 'Qwen3-TTS-12Hz-1.7B-CustomVoice', size: 4_500_000_000 },
    { file: 'Qwen3-TTS-12Hz-1.7B-VoiceDesign', size: 4_500_000_000 },
  ],
  inpaint: [{ file: 'big-lama.pt', size: 205_669_692 }],
  logo: [
    { file: 'z_image_turbo_bf16.safetensors', size: 12_300_000_000 },
    { file: 'qwen_3_4b.safetensors', size: 8_000_000_000 },
    { file: 'ae.safetensors', size: 335_000_000 },
  ],
};

/** What a prompt holding `[oom]` fails with: the text ComfyUI sends when the GPU runs out of memory. */
class MockOutOfMemory extends Error {
  constructor() {
    super('ComfyUI KSampler: Allocation on device 0 would exceed allowed memory. (out of memory) This error means you ran out of memory on your GPU. (mock)');
  }
}

/** Modes whose picture size a smaller retry may change (as the Rust queue). */
const RESIZABLE_MODES = new Set(['txt2img', 'img2img', 'inpaint', 'outpaint']);
/** Creation time of the backup the mock "opens" for a restore before one was made (fixed for the manual's pictures). */
const MOCK_BACKUP_TIME = 1759900000000;

/** The session storage key of the comics the mock keeps across a reload. */
const COMIC_STORAGE_KEY = 'novira.mock.comics';

/** The comics kept by an earlier page of this session; none when there are none or they cannot be read. */
function readKeptComics(storage: Pick<Storage, 'getItem'> | null): Map<string, ComicRecord> {
  try {
    const list: unknown = JSON.parse(storage?.getItem(COMIC_STORAGE_KEY) ?? '[]');
    const records = Array.isArray(list) ? list.filter((r): r is ComicRecord => !!r && typeof r.id === 'string' && typeof r.updatedAt === 'number' && typeof r.document === 'object') : [];
    return new Map(records.map((r) => [r.id, r]));
  } catch {
    return new Map();
  }
}

/** Time between two sample pictures. */
export const SEED_IMAGE_SPACING_MS = 9 * 60 * 60 * 1000;

/** The models each tool offers in the mock: Claude's aliases, and two models such as Codex lists for an account. */
const MOCK_AGENT_MODELS: Record<AgentProvider, AgentModelOption[]> = {
  claude: ['fable', 'opus', 'sonnet', 'haiku'].map((id) => ({ id, name: id[0]!.toUpperCase() + id.slice(1), efforts: ['low', 'medium', 'high', 'xhigh', 'max'], defaultEffort: 'high' })),
  codex: [
    { id: 'gpt-mock-pro', name: 'GPT-Mock-Pro', efforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'], defaultEffort: 'medium' },
    { id: 'gpt-mock-mini', name: 'GPT-Mock-Mini', efforts: ['low', 'medium', 'high'], defaultEffort: 'low' },
  ],
  // A server's models come from its own list (agentEndpointModels).
  openai: [],
};

export class MockBackend implements BackendClient {
  readonly kind = 'mock' as const;
  private listeners = new Set<(e: BackendEvent) => void>();
  private models: ModelConfig[] = [];
  private boards: BoardDTO[] = [];
  private images: ImageDTO[] = [];
  /** Whether `bootstrap` has filled the pretend library. */
  private seeded = false;
  /** Deleted pictures that `restoreImages` can bring back. */
  private trash: ImageDTO[] = [];
  private workflows: SavedWorkflow[] = [];
  private queue: QueueItem[] = [];
  private nextItemId = 1;
  private nextImage = 1;
  private nextId = 1;
  private paused = false;
  private running: { id: number; cancelled: boolean } | null = null;
  private stepDelay = 60;
  private installs = new Map<string, { job: ModelInstallJob; cancelled: boolean }>();
  /** Creation time of the sample pictures. Each is 9 hours after the one before, so they spread over several days (date filter, calendar). */
  private clock = 1759600000000;

  private readonly engine = new MockEngine({
    emit: (event) => this.emit(event),
    stepDelay: () => this.stepDelay,
    jobRunning: () => this.queue.some((q) => q.status === 'in_progress'),
  });

  constructor(
    private readonly scenario: 'default' | 'empty' = 'default',
    /** Pretends the image engine is being installed at start-up (`?engine=install`), to try the start-up screen. */
    private readonly engineInstall = false,
    /** Where the comics are kept across a reload of the page (the browser's session storage); in memory only without. */
    private readonly comicStorage: Pick<Storage, 'getItem' | 'setItem'> | null = null,
  ) {
    this.comics = readKeptComics(comicStorage);
  }

  private simulateEngineInstall() {
    const total = 2_400_000_000;
    const steps = 40;
    let i = 0;
    this.emit({ type: 'engine_status', status: { state: 'downloading', bytes: 0, totalBytes: total } });
    const timer = setInterval(() => {
      i += 1;
      if (i <= steps) {
        this.emit({ type: 'engine_status', status: { state: 'downloading', bytes: Math.round((total * i) / steps), totalBytes: total } });
      } else if (i === steps + 1) {
        this.emit({ type: 'engine_status', status: { state: 'extracting' } });
      } else if (i === steps + 8) {
        this.emit({ type: 'engine_status', status: { state: 'starting' } });
      } else if (i === steps + 14) {
        this.emit({ type: 'engine_status', status: { state: 'ready' } });
        clearInterval(timer);
      }
    }, 350);
  }

  subscribe(listener: (event: BackendEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: BackendEvent) {
    this.listeners.forEach((l) => l(event));
  }

  private now(): number {
    // Wall clock for display; content stays deterministic.
    return Date.now();
  }

  private id(prefix: string): string {
    return `${prefix}-${(this.nextId++).toString(36)}-${this.now().toString(36)}`;
  }

  setWindowTheme(): void {
    // The browser has no window frame of its own to colour.
  }

  setStepDelay(ms: number): void {
    this.stepDelay = Math.max(0, ms);
  }

  async bootstrap() {
    // The first call fills the pretend library; later ones read what is there now, as the backend does.
    const first = !this.seeded;
    this.seeded = true;
    if (first) this.seed();
    await wait(LATENCY);
    if (first && this.engineInstall) setTimeout(() => this.simulateEngineInstall(), 0);
    return {
      models: this.models.map((m) => ({ ...m })),
      boards: this.boards.map((b) => ({ ...b })),
      images: this.images.map((i) => ({ ...i })),
      workflows: this.workflows.map((w) => ({ ...w })),
      engine: this.engineInstall ? ({ state: 'downloading', bytes: 0, totalBytes: 2_400_000_000 } as const) : ({ state: 'ready' } as const),
      packs: { ...this.packs },
    };
  }

  /** The pretend library of the scenario: models, workflows and, by default, boards and pictures. */
  private seed() {
    this.models = SEED_MODELS.map((m) => ({ ...m }));
    this.workflows = [...DEFAULT_WORKFLOWS, ...MOCK_USER_WORKFLOWS].map((w) => ({ ...w }));
    if (this.scenario === 'default') {
      this.boards = SEED_BOARDS.map((b) => ({ ...b }));
      for (const spec of SEED_IMAGES) {
        const model = this.models.find((m) => m.key === spec.modelKey);
        const url = mockPicture(spec.seed);
        this.clock += SEED_IMAGE_SPACING_MS;
        this.images.unshift({
          name: this.imageName(),
          mediaType: 'image',
          url,
          thumbnailUrl: url,
          width: spec.width,
          height: spec.height,
          createdAt: this.clock,
          boardId: spec.boardId,
          starred: spec.starred ?? false,
          isIntermediate: false,
          category: 'general',
          workflow: null,
          metadata: {
            generationMode: 'txt2img',
            positivePrompt: spec.prompt,
            negativePrompt: spec.negative,
            modelKey: spec.modelKey,
            modelName: model?.name ?? spec.modelKey,
            vaeKey: null,
            seed: spec.seed,
            steps: model?.defaultSettings?.steps ?? 30,
            cfgScale: model?.defaultSettings?.cfgScale ?? 7,
            cfgRescale: 0,
            scheduler: model?.defaultSettings?.scheduler ?? 'euler',
            width: spec.width,
            height: spec.height,
            clipSkip: 0,
            seamlessX: false,
            seamlessY: false,
            loras: [],
          },
        });
      }
    }
  }

  /** The settings as the backend saves them: with the sampling a model of the newer families ran in place of the
   * scheduler setting (`fixed_sampling` in the backend's comfy/split.rs), and without one the job may have sent. */
  private withSampling(p: GenerationMetadata): GenerationMetadata {
    const { sampling: _sent, ...rest } = p;
    const drawn = ['txt2img', 'img2img', 'inpaint', 'outpaint', 'upscale', 'workflow'].includes(p.generationMode);
    const model = this.models.find((m) => m.key === p.modelKey);
    const sampling = drawn && model ? fixedSampling(model) : undefined;
    return sampling ? { ...rest, sampling } : rest;
  }

  private imageName(): string {
    return `${String(this.nextImage++).padStart(6, '0')}-${this.now().toString(36)}.png`;
  }

  // Boards -----------------------------------------------------------------

  async createBoard(name: string): Promise<BoardDTO> {
    await wait(LATENCY);
    const board: BoardDTO = { id: this.id('board'), name: boardName(name), archived: false, createdAt: this.now() };
    this.boards.push(board);
    return { ...board };
  }

  async updateBoard(id: string, patch: Partial<Pick<BoardDTO, 'name' | 'archived'>>): Promise<BoardDTO> {
    await wait(LATENCY);
    const board = this.boards.find((b) => b.id === id);
    if (!board) throw new Error(`board not found: ${id}`);
    // Validate before touching anything so a blank rename changes nothing.
    const name = patch.name === undefined ? undefined : boardName(patch.name);
    Object.assign(board, patch, name === undefined ? {} : { name });
    return { ...board };
  }

  async deleteBoard(id: string, deleteImages: boolean) {
    await wait(LATENCY);
    this.boards = this.boards.filter((b) => b.id !== id);
    const deleted: string[] = [];
    for (const img of this.images) {
      if (img.boardId !== id) continue;
      if (deleteImages) deleted.push(img.name);
      else img.boardId = null;
    }
    this.trash.push(...this.images.filter((i) => deleted.includes(i.name)));
    this.images = this.images.filter((i) => !deleted.includes(i.name));
    return { deletedImages: deleted };
  }

  // Images -----------------------------------------------------------------

  async uploadImage(file: Blob, opts: { boardId: string | null; isIntermediate?: boolean; category?: ImageDTO['category'] }) {
    const url = URL.createObjectURL(file);
    return this.saveImageFromUrl(url, { category: 'user', ...opts });
  }

  async saveImageFromUrl(url: string, opts: { boardId: string | null; isIntermediate?: boolean; category?: ImageDTO['category'] }) {
    const { width, height } = await imageSize(url);
    const image: ImageDTO = {
      name: this.imageName(),
      mediaType: 'image',
      url,
      thumbnailUrl: url,
      width,
      height,
      createdAt: this.now(),
      boardId: opts.boardId,
      starred: false,
      isIntermediate: opts.isIntermediate ?? false,
      category: opts.category ?? 'general',
      metadata: null,
      workflow: null,
    };
    this.images.unshift(image);
    this.emit({ type: 'image_added', image: { ...image }, item: null });
    return { ...image };
  }

  async updateImages(names: string[], patch: Partial<Pick<ImageDTO, 'boardId' | 'starred' | 'isIntermediate'>>) {
    await wait(LATENCY);
    const out: ImageDTO[] = [];
    for (const img of this.images) {
      if (names.includes(img.name)) {
        Object.assign(img, patch);
        out.push({ ...img });
      }
    }
    return out;
  }

  async deleteImages(names: string[]) {
    await wait(LATENCY);
    this.trash.push(...this.images.filter((i) => names.includes(i.name)));
    this.images = this.images.filter((i) => !names.includes(i.name));
  }

  async restoreImages(names: string[]) {
    await wait(LATENCY);
    const back = this.trash.filter((i) => names.includes(i.name));
    this.trash = this.trash.filter((i) => !names.includes(i.name));
    const boards = new Set(this.boards.map((b) => b.id));
    for (const img of back) if (img.boardId && !boards.has(img.boardId)) img.boardId = null;
    this.images = [...back, ...this.images].sort((a, b) => b.createdAt - a.createdAt);
    return back.map((i) => ({ ...i }));
  }

  // Queue ------------------------------------------------------------------

  async enqueue(request: EnqueueRequest): Promise<QueueItem[]> {
    await wait(LATENCY);
    checkGuidance(request);
    const batchId = this.id('batch');
    const items: QueueItem[] = [];
    for (let i = 0; i < Math.max(1, request.iterations); i++) {
      const seed = request.randomizeSeed ? randomSeed() : batchSeed(request.params.seed, i);
      items.push({
        id: this.nextItemId++,
        batchId,
        status: 'pending',
        origin: request.origin,
        destination: request.destination,
        // Like the desktop backend, the picture remembers the guidance it was made with.
        params: {
          ...request.params,
          seed,
          ...(request.refImages?.length ? { refImages: request.refImages } : {}),
          ...(request.controlLayers?.length ? { controlLayers: request.controlLayers } : {}),
          ...(request.regionalLayers?.length ? { regionalLayers: request.regionalLayers } : {}),
          ...(request.referencePictures?.length ? { referencePictures: request.referencePictures } : {}),
        },
        boardId: request.boardId,
        initImageUrl: request.initImageUrl ?? null,
        workflow: request.workflow ?? null,
        comfyGraph: request.comfyGraph ?? null,
        maskImageUrl: request.maskImageUrl ?? null,
        controlLayers: request.controlLayers ?? [],
        regionalLayers: request.regionalLayers ?? [],
        refImages: request.refImages ?? [],
        referencePictures: request.referencePictures ?? [],
        createdAt: this.now(),
        startedAt: null,
        completedAt: null,
        imageName: null,
        error: null,
        errorKind: null,
      });
    }
    if (request.prepend) {
      const firstPending = this.queue.findIndex((q) => q.status === 'pending');
      const at = firstPending < 0 ? this.queue.length : firstPending;
      this.queue.splice(at, 0, ...items);
    } else {
      this.queue.push(...items);
    }
    items.forEach((item) => this.emit({ type: 'queue_item_status_changed', item: { ...item } }));
    void this.pump();
    return items.map((i) => ({ ...i }));
  }

  private setStatus(item: QueueItem, status: QueueItem['status'], patch: Partial<QueueItem> = {}) {
    Object.assign(item, patch, { status });
    this.emit({ type: 'queue_item_status_changed', item: { ...item } });
  }

  private async pump() {
    if (this.running || this.paused) return;
    const item = this.queue.find((q) => q.status === 'pending');
    if (!item) return;
    const run = { id: item.id, cancelled: false };
    this.running = run;
    this.setStatus(item, 'in_progress', { startedAt: this.now() });
    try {
      await this.process(item, run);
    } catch (err) {
      const message = String(err instanceof Error ? err.message : err);
      // Like the Rust worker, a failed job also leaves a line in the developer log.
      this.emit({ type: 'log', entry: { at: this.now(), level: 'error', source: 'queue', message: `job ${item.id} failed: ${message}` } });
      if (!run.cancelled) this.setStatus(item, 'failed', { completedAt: this.now(), error: message, errorKind: err instanceof MockOutOfMemory ? 'out_of_memory' : null });
    }
    this.running = null;
    void this.pump();
  }

  private async process(item: QueueItem, run: { cancelled: boolean }) {
    const p = item.params;
    if (p.generationMode === 'music' || p.generationMode === 'voice' || savesSound(item.comfyGraph)) return this.processAudio(item, run);
    if (isTextGraph(item.comfyGraph)) return this.processText(item, run);
    if (item.comfyGraph && Object.values(item.comfyGraph.prompt).some((n) => n.class_type === 'Sam2Segmentation')) return this.processMask(item, run);
    if (item.comfyGraph && Object.values(item.comfyGraph.prompt).some((n) => n.class_type === 'INPAINT_MaskedFill' || n.class_type === 'INPAINT_InpaintWithModel' || n.class_type === 'SetLatentNoiseMask' || n.class_type === 'RMBG' || n.class_type === 'MangaFinish' || n.class_type === 'LoadVideo' || n.class_type === 'ImageUpscaleWithModel')) return this.processErase(item, run);
    // Like the backend graph: the high-resolution fix is a second pass of text or image to image, never of a draft.
    const hires = p.hiresFix;
    if (hires && ((p.generationMode !== 'txt2img' && p.generationMode !== 'img2img') || p.draftAt !== undefined)) throw new Error('The high-resolution fix is only available for text to image and image to image');
    const scale = p.generationMode === 'upscale' ? (p.upscaleScale ?? 2) : 1;
    const round8 = (v: number) => Math.max(64, Math.round(v / 8) * 8);
    const width = hires ? round8(p.width * hires.scale) : Math.round(p.width * scale);
    const height = hires ? round8(p.height * hires.scale) : Math.round(p.height * scale);
    const strength = p.generationMode === 'txt2img' || p.generationMode === 'workflow' || p.generationMode === 'graph' ? undefined : (p.strength ?? (p.generationMode === 'upscale' ? 0.35 : 0.7));
    const isVideo = p.generationMode === 'video';
    // Images show a mock picture; a video is cut from frames drawn on a canvas.
    const picture = mockPicture(`${p.seed}|${p.positivePrompt}`);
    const canvas = isVideo ? (await synthesize({ width, height, seed: p.seed, prompt: p.positivePrompt, initImageUrl: item.initImageUrl, strength, maskImageUrl: item.maskImageUrl })).canvas : null;
    const total = Math.max(1, p.steps + (hires ? (hires.steps ?? p.steps) : 0));
    const stopAt = p.draftAt !== undefined ? draftStep(total, p.draftAt) : total;
    for (let step = 1; step <= stopAt; step++) {
      if (run.cancelled) return;
      await wait(this.stepDelay);
      if (run.cancelled) return;
      this.emit({
        type: 'invocation_progress',
        progress: {
          itemId: item.id,
          step,
          totalSteps: total,
          progressImageUrl: picture,
          message: 'denoise',
        },
      });
    }
    if (/\[fail\]/i.test(p.positivePrompt)) throw new Error('Mock failure requested by prompt');
    if (/\[oom\]/i.test(p.positivePrompt)) throw new MockOutOfMemory();
    const videoUrl = canvas ? await synthesizeVideo(canvas, { frames: p.videoFrames ?? 49, fps: p.videoFps ?? 24 }) : null;
    const image: ImageDTO = {
      name: this.imageName(),
      mediaType: isVideo ? 'video' : 'image',
      url: videoUrl ?? picture,
      thumbnailUrl: picture,
      width,
      height,
      createdAt: this.now(),
      boardId: item.destination === 'canvas' ? null : item.boardId,
      starred: false,
      isIntermediate: item.destination === 'canvas' || p.draftAt !== undefined,
      // Logos are kept with the assets.
      category: p.generationMode === 'logo' ? 'other' : 'general',
      // With the high-resolution fix the stored size stays the first pass's (the setting the scale applies to).
      metadata: this.withSampling(hires ? { ...p } : { ...p, width, height }),
      workflow: item.workflow,
    };
    this.images.unshift(image);
    this.setStatus(item, 'completed', { completedAt: this.now(), imageName: image.name });
    this.emit({ type: 'image_added', image: { ...image }, item: { ...item } });
  }

  /** A segmentation prompt: a mask picture the size of the source, kept as a hidden helper result. */
  private async processMask(item: QueueItem, run: { cancelled: boolean }) {
    const graph = item.comfyGraph!;
    const source = this.images.find((i) => i.name === sourceOf(graph));
    if (!source) throw new Error('The picture was deleted');
    await wait(this.stepDelay * 2);
    if (run.cancelled) return;
    const url = await synthMask(source.width, source.height, pointsOf(graph));
    const image: ImageDTO = {
      name: this.imageName(),
      mediaType: 'image',
      url,
      thumbnailUrl: url,
      width: source.width,
      height: source.height,
      createdAt: this.now(),
      boardId: null,
      starred: false,
      isIntermediate: true,
      category: 'general',
      metadata: { ...item.params },
      workflow: null,
    };
    this.images.unshift(image);
    this.setStatus(item, 'completed', { completedAt: this.now(), imageName: image.name });
    this.emit({ type: 'image_added', image: { ...image }, item: { ...item } });
  }

  /** A prompt that ends in "Preview as Text": the picture described in words chosen by its name; no picture is stored. */
  private async processText(item: QueueItem, run: { cancelled: boolean }) {
    const source = this.images.find((i) => i.name === sourceOf(item.comfyGraph!));
    if (!source) throw new Error('The picture was deleted');
    await wait(this.stepDelay * 4);
    if (run.cancelled) return;
    this.setStatus(item, 'completed', { completedAt: this.now(), resultText: isPoseExtractGraph(item.comfyGraph) ? mockPoseExtract() : mockCaption(item.comfyGraph!, source.name) });
  }

  /** An erase prompt: the mock cannot fill anything in, so the result is the source picture again. */
  private async processErase(item: QueueItem, run: { cancelled: boolean }) {
    const source = this.images.find((i) => i.name === sourceOf(item.comfyGraph!));
    if (!source) throw new Error('The picture was deleted');
    await wait(this.stepDelay * 2);
    if (run.cancelled) return;
    const image: ImageDTO = { ...source, name: this.imageName(), createdAt: this.now(), boardId: item.boardId, starred: false, isIntermediate: item.destination === 'intermediate', metadata: { ...item.params }, workflow: null };
    this.images.unshift(image);
    this.setStatus(item, 'completed', { completedAt: this.now(), imageName: image.name });
    this.emit({ type: 'image_added', image: { ...image }, item: { ...item } });
  }

  /** Music and speech (and a graph that saves a sound): some steps of progress, then a short clip whose thumbnail is its waveform. */
  private async processAudio(item: QueueItem, run: { cancelled: boolean }) {
    const p = item.params;
    const spoken = speechText(item.comfyGraph);
    const isMusic = p.generationMode === 'music' || (p.generationMode === 'graph' && spoken === null);
    const text = isMusic ? p.positivePrompt : (spoken ?? p.voice?.text ?? '');
    const steps = isMusic ? Math.max(1, p.steps) : 3;
    for (let step = 1; step <= steps; step++) {
      if (run.cancelled) return;
      await wait(this.stepDelay);
      this.emit({ type: 'invocation_progress', progress: { itemId: item.id, step, totalSteps: steps, progressImageUrl: null, message: isMusic ? 'compose' : 'speak' } });
    }
    if (run.cancelled) return;
    if (/\[fail\]/i.test(text)) throw new Error('Mock failure requested by the text');
    if (/\[oom\]/i.test(text)) throw new MockOutOfMemory();
    if (!isMusic && !text.trim()) throw new Error('There is no text to read');
    const wav = isMusic ? synthMusic(p.seed, p.music?.seconds ?? songSeconds(item.comfyGraph) ?? 30, p.music?.bpm) : synthSpeech(text, p.seed);
    const image: ImageDTO = {
      name: this.imageName().replace(/\.png$/, '.wav'),
      mediaType: 'audio',
      url: audioUrl(wav),
      thumbnailUrl: waveformThumbnail(wav),
      width: 256,
      height: 144,
      createdAt: this.now(),
      boardId: item.boardId,
      starred: false,
      isIntermediate: false,
      category: 'general',
      metadata: { ...p },
      workflow: item.workflow,
    };
    this.images.unshift(image);
    this.setStatus(item, 'completed', { completedAt: this.now(), imageName: image.name });
    this.emit({ type: 'image_added', image: { ...image }, item: { ...item } });
  }

  async cancelQueueItem(id: number) {
    const item = this.queue.find((q) => q.id === id);
    if (!item || (item.status !== 'pending' && item.status !== 'in_progress')) return;
    if (this.running?.id === id) this.running.cancelled = true;
    this.setStatus(item, 'canceled', { completedAt: this.now() });
  }

  async cancelBatch(batchId: string) {
    for (const item of this.queue.filter((q) => q.batchId === batchId)) await this.cancelQueueItem(item.id);
  }

  async clearQueue() {
    if (this.running) this.running.cancelled = true;
    this.queue = [];
    this.emit({ type: 'queue_cleared' });
  }

  async pruneQueue() {
    this.queue = this.queue.filter((q) => q.status === 'pending' || q.status === 'in_progress');
    this.emit({ type: 'queue_cleared' });
  }

  async pauseProcessor() {
    this.paused = true;
    this.emit({ type: 'processor_state', isPaused: true });
  }

  async resumeProcessor() {
    this.paused = false;
    this.emit({ type: 'processor_state', isPaused: false });
    void this.pump();
  }

  async retryQueueItem(id: number, size?: RetrySize) {
    const item = this.queue.find((q) => q.id === id);
    if (!item || (item.status !== 'failed' && item.status !== 'canceled')) return null;
    const params = { ...item.params };
    if (size) {
      if (!RESIZABLE_MODES.has(params.generationMode)) throw new Error('Only pictures made from a prompt can be retried at another size');
      const fits = (v: number, before: number) => v >= 64 && v % 8 === 0 && v <= Math.max(64, before);
      if (!fits(size.width, params.width) || !fits(size.height, params.height)) throw new Error(`A retry size must be multiples of 8 from 64 up to the size before, not ${size.width}x${size.height}`);
      params.width = size.width;
      params.height = size.height;
    }
    const [copy] = await this.enqueue({
      origin: item.origin,
      destination: item.destination,
      params,
      iterations: 1,
      randomizeSeed: false,
      prepend: false,
      boardId: item.boardId,
      initImageUrl: item.initImageUrl,
      workflow: item.workflow,
      comfyGraph: item.comfyGraph ?? null,
      maskImageUrl: item.maskImageUrl ?? null,
      controlLayers: item.controlLayers ?? [],
      regionalLayers: item.regionalLayers ?? [],
      refImages: item.refImages ?? [],
      referencePictures: item.referencePictures ?? [],
    });
    return copy ?? null;
  }

  queueStatus(): QueueStatus {
    const count = (s: QueueItem['status']) => this.queue.filter((q) => q.status === s).length;
    return {
      pending: count('pending'),
      inProgress: count('in_progress'),
      completed: count('completed'),
      failed: count('failed'),
      canceled: count('canceled'),
      total: this.queue.length,
      isPaused: this.paused,
    };
  }

  listQueue(): QueueItem[] {
    return this.queue.map((q) => ({ ...q }));
  }

  // Models -----------------------------------------------------------------

  async listStarterModels(): Promise<StarterModel[]> {
    await wait(LATENCY);
    return STARTER_MODELS.map((m) => ({ ...m }));
  }

  /** Stands in for the backend's family table with the one family the mock has starters for: Anima. */
  async modelParts(modelKey: string): Promise<ModelPartsReport> {
    await wait(LATENCY);
    const model = this.models.find((m) => m.key === modelKey);
    if (!model) throw new Error(`model not found: ${modelKey}`);
    const wanted: [string, string][] =
      model.base === 'anima' && model.type === 'diffusion_model' ? [['starter-qwen3-06b', 'qwen_3_06b'], ['starter-qwen-image-vae', 'qwen_image_vae']] : [];
    const missing = wanted
      .filter(([, word]) => !this.models.some((m) => m.name.toLowerCase().includes(word)))
      .map(([id]) => STARTER_MODELS.find((s) => s.id === id)!);
    return { modelKey, modelName: model.name, missing: missing.map((m) => ({ ...m })), unavailable: [] };
  }

  async installModel(source: string, name?: string): Promise<ModelInstallJob> {
    await wait(LATENCY);
    const starter = STARTER_MODELS.find((s) => s.source === source);
    const job: ModelInstallJob = {
      id: this.id('install'),
      source,
      name: name ?? starter?.name ?? source.split(/[/\\:]/).filter(Boolean).pop() ?? source,
      status: 'waiting',
      bytes: 0,
      totalBytes: 2 * 1024 ** 3,
    };
    const entry = { job, cancelled: false };
    this.installs.set(job.id, entry);
    this.emit({ type: 'model_install', job: { ...job } });
    void this.runInstall(entry, starter);
    return { ...job };
  }

  private async runInstall(entry: { job: ModelInstallJob; cancelled: boolean }, starter: StarterModel | undefined) {
    const { job } = entry;
    if (/fail|invalid/i.test(job.source) || !job.source.trim()) {
      await wait(400);
      job.status = 'error';
      job.error = 'Unable to determine model type from source';
      this.emit({ type: 'model_install', job: { ...job } });
      return;
    }
    job.status = 'downloading';
    for (let i = 1; i <= 20; i++) {
      await wait(120);
      if (entry.cancelled) {
        job.status = 'cancelled';
        this.emit({ type: 'model_install', job: { ...job } });
        return;
      }
      job.bytes = Math.round((job.totalBytes * i) / 20);
      this.emit({ type: 'model_install', job: { ...job } });
    }
    job.status = 'running';
    this.emit({ type: 'model_install', job: { ...job } });
    await wait(300);
    const model: ModelConfig = {
      key: this.id('model'),
      name: job.name,
      base: starter?.base ?? 'sdxl',
      type: starter?.type ?? 'main',
      format: 'diffusers',
      description: starter?.description ?? '',
      path: `${starter?.base ?? 'sdxl'}/${starter?.type ?? 'main'}/${job.name}`,
      size: job.totalBytes,
      source: job.source,
    };
    this.models.push(model);
    job.status = 'completed';
    this.emit({ type: 'model_install', job: { ...job } });
    this.emit({ type: 'model_added', model: { ...model } });
  }

  async searchCivitai(params: CivitaiSearchParams): Promise<CivitaiSearchResult> {
    await wait(250 + Math.floor(Math.random() * 150));
    if (/fail|error/i.test(params.query)) throw new Error('Civitai request failed (mock)');
    return searchCivitaiModels(params, params.source === 'huggingface' ? HUGGINGFACE_MODELS : undefined);
  }

  private packs: Packs = {
    video: { state: 'missing', totalBytes: 18_000_000_000 },
    turbo: { state: 'missing', totalBytes: 18_000_000_000 },
    music: { state: 'missing', totalBytes: 10_000_000_000 },
    voice: { state: 'missing', totalBytes: 9_400_000_000 },
    inpaint: { state: 'missing', totalBytes: 205_669_692 },
    logo: { state: 'missing', totalBytes: 20_635_000_000 },
  };
  private packInstalls = new Map<PackKind, { cancelled: boolean }>();

  private setPack(kind: PackKind, status: PackStatus) {
    this.packs = { ...this.packs, [kind]: status };
    this.emit({ type: 'pack', kind, status });
  }

  /** A mid-range card, so the recommendations show a mix of fits. */
  async hardwareInfo(): Promise<HardwareInfo> {
    return { gpuName: 'Mock GPU', vramBytes: 12 * 1024 ** 3 };
  }

  /** A few fonts a Windows computer has, so the font lists show installed fonts beside the app's own. */
  async listFonts(): Promise<string[]> {
    return ['BIZ UDGothic', 'Meiryo', 'MS Gothic', 'MS Mincho', 'Segoe UI', 'Yu Gothic', 'Yu Mincho'];
  }

  async installPack(kind: PackKind) {
    if (this.packInstalls.has(kind)) return;
    const run = { cancelled: false };
    this.packInstalls.set(kind, run);
    const plan = MOCK_PACK_FILES[kind];
    const total = plan.reduce((sum, f) => sum + f.size, 0);
    const missing: PackStatus = { state: 'missing', totalBytes: total };
    if (kind === 'voice') {
      this.setPack(kind, { state: 'installing', step: 'libraries' });
      await wait(Math.max(200, this.stepDelay * 6));
    }
    let done = 0;
    for (let i = 0; i < plan.length && !run.cancelled; i++) {
      for (let p = 1; p <= 4 && !run.cancelled; p++) {
        await wait(Math.max(40, this.stepDelay));
        this.setPack(kind, { state: 'downloading', file: plan[i]!.file, index: i + 1, count: plan.length, bytes: done + (plan[i]!.size * p) / 4, totalBytes: total });
      }
      done += plan[i]!.size;
    }
    this.packInstalls.delete(kind);
    this.setPack(kind, run.cancelled ? missing : { state: 'ready' });
  }

  async cancelPack(kind: PackKind) {
    const run = this.packInstalls.get(kind);
    if (run) run.cancelled = true;
  }

  private hfTokenSet = false;

  async hasHuggingFaceToken() {
    return this.hfTokenSet;
  }

  async setHuggingFaceToken(token: string | null) {
    this.hfTokenSet = !!token?.trim();
  }

  async openHuggingFacePage(): Promise<void> {
    // The mock has no browser to open.
  }

  async openSourcePage(): Promise<void> {
    // The mock has no browser to open.
  }

  private civitaiKeySet = false;

  async hasCivitaiKey() {
    return this.civitaiKeySet;
  }

  async setCivitaiKey(key: string | null) {
    this.civitaiKeySet = !!key?.trim();
  }

  async setUiZoom(): Promise<void> {
    // The browser zooms the page itself.
  }

  async openCivitaiPage(): Promise<void> {
    // The mock has no browser to open.
  }

  private agent: AgentStatus = { provider: null, installed: true, loggedIn: false, models: [] };

  /** The saved OpenAI-compatible server, kept whichever provider is selected. */
  private endpoint: AgentEndpointInfo | null = null;

  async agentStatus(): Promise<AgentStatus> {
    return { ...this.agent, ...(this.endpoint ? { endpoint: { ...this.endpoint } } : {}) };
  }

  async agentEndpointSave(input: AgentEndpointInput): Promise<AgentStatus> {
    const baseUrl = normalizeAddress(input.baseUrl);
    const model = input.model.trim();
    if (!model) throw new Error('Enter or choose the name of the model');
    const saved = this.endpoint;
    const sameServer = saved?.baseUrl === baseUrl;
    const hasKey = input.apiKey !== undefined ? input.apiKey.trim() !== '' : sameServer && saved.hasKey;
    const keep = sameServer && saved.model === model ? saved : null;
    this.endpoint = endpointInfo(baseUrl, model, hasKey, keep?.tools ?? 'unknown', keep?.toolsReason);
    this.agent = { provider: 'openai', installed: true, loggedIn: true, models: [] };
    return this.agentStatus();
  }

  async agentEndpointModels(input: AgentEndpointInput): Promise<string[]> {
    await wait(150);
    return serverModels(normalizeAddress(input.baseUrl));
  }

  async agentEndpointTest(input: AgentEndpointInput): Promise<AgentEndpointTest> {
    await wait(300);
    const result = testServer(input);
    const saved = this.endpoint;
    if (saved && result.tools !== 'unknown' && saved.baseUrl === normalizeAddress(input.baseUrl) && saved.model === input.model.trim()) {
      this.endpoint = endpointInfo(saved.baseUrl, saved.model, saved.hasKey, result.tools, result.toolsReason);
    }
    return result;
  }

  async agentLogin(provider: AgentProvider): Promise<AgentStatus> {
    if (provider === 'openai') throw new Error('A server has no sign-in: enter its address and model instead');
    await wait(1200);
    this.agent = { provider, installed: true, loggedIn: true, models: MOCK_AGENT_MODELS[provider] };
    return { ...this.agent };
  }

  /** Stops the request that is running. */
  private stopAgentChat: (() => void) | null = null;
  /** Tool calls of the running request waiting for the window's answer, by call id. */
  private agentCalls = new Map<string, (answer: MockToolAnswer) => void>();
  private agentCallSeq = 0;

  /** Sends a tool call to the window, as the backend's relay does, and waits for its answer (tests script calls with it). */
  callAgentTool(tool: string, args: Record<string, unknown> = {}): Promise<MockToolAnswer> {
    this.agentCallSeq += 1;
    const callId = `c-${this.agentCallSeq.toString(16).padStart(32, '0')}`;
    return new Promise((resolve) => {
      this.agentCalls.set(callId, resolve);
      this.emit({ type: 'agent_tool_call', call: { callId, tool, args, readGated: mockReadGated(tool, args) } });
    });
  }

  /** A server whose model cannot call tools fails the request, as the backend does (it never answers without tools). */
  private refuseWithoutTools(): void {
    const saved = this.endpoint;
    if (this.agent.provider !== 'openai' || !saved) return;
    const reason = saved.tools === 'unsupported' ? (saved.toolsReason ?? '') : saved.tools === 'unknown' ? noToolsReason(saved.model, saved.baseUrl) : undefined;
    if (reason === undefined) return;
    this.endpoint = endpointInfo(saved.baseUrl, saved.model, saved.hasKey, 'unsupported', reason);
    throw new Error(noToolsMessage(reason));
  }

  async agentChat(request: AgentRequest): Promise<AgentReply> {
    if (this.stopAgentChat) throw new Error('The assistant is already working on a request');
    if ((request.images?.length ?? 0) > AGENT_MAX_ATTACHMENTS) throw new Error(`At most ${AGENT_MAX_ATTACHMENTS} pictures can go with one message`);
    this.refuseWithoutTools();
    const stopped = new Promise<never>((_, reject) => {
      this.stopAgentChat = () => reject(new Error('Stopped'));
    });
    try {
      await Promise.race([wait(700 + Math.floor(Math.random() * 500)), stopped]);
      return await Promise.race([runMockAgent(request, (tool, args) => this.callAgentTool(tool, args)), stopped]);
    } finally {
      this.stopAgentChat = null;
      // Calls still waiting end with the request.
      for (const resolve of this.agentCalls.values()) resolve({ ok: false, content: 'Stopped' });
      this.agentCalls.clear();
    }
  }

  async agentToolResult(answer: AgentToolAnswer): Promise<void> {
    const resolve = this.agentCalls.get(answer.callId);
    if (!resolve) throw new Error('no tool call is waiting for this answer');
    this.agentCalls.delete(answer.callId);
    resolve({ ok: answer.ok, content: answer.content });
  }

  /** A pretend look-up: the same canned article for the same words (nothing for words with [none]). */
  async lookupReference(language: ReferenceLanguage, query: string): Promise<ReferenceHit[]> {
    await wait(LATENCY);
    const words = query.trim();
    if (!words) throw new Error('query is empty');
    if (words.includes('[none]')) return [];
    const host = `${language}.wikipedia.org`;
    return [
      {
        title: words,
        extract: language === 'ja' ? `${words}についての説明です（ブラウザ版の見本の文章）。` : `This is a sample description of ${words} (browser demo text).`,
        url: `https://${host}/wiki/${encodeURIComponent(words.replace(/ /g, '_'))}`,
      },
    ];
  }

  async agentCancel(): Promise<void> {
    this.stopAgentChat?.();
  }

  async cancelInstall(jobId: string) {
    const entry = this.installs.get(jobId);
    if (entry) entry.cancelled = true;
  }

  async updateModel(key: string, patch: Partial<ModelConfig>) {
    await wait(LATENCY);
    const model = this.models.find((m) => m.key === key);
    if (!model) throw new Error(`model not found: ${key}`);
    Object.assign(model, patch, { key });
    return { ...model };
  }

  async deleteModel(key: string) {
    await wait(LATENCY);
    this.models = this.models.filter((m) => m.key !== key);
  }

  async scanFolder() {
    await wait(400);
    const base = 'D:\\models';
    return ['epicrealism_v5.safetensors', 'animagine-xl-3.1.safetensors', 'detail-tweaker.safetensors', 'juggernautXL_v9.safetensors'].map((f) => ({
      path: `${base}\\${f}`,
      installed: this.models.some((m) => m.path.endsWith(f)),
    }));
  }

  async listHuggingFaceFiles(repo: string): Promise<string[]> {
    await wait(400);
    const name = repo.split('/').filter(Boolean).pop() ?? repo;
    return [name + '.safetensors', name + '.fp16.safetensors'];
  }

  // Workflows --------------------------------------------------------------

  async saveWorkflow(workflow: Omit<SavedWorkflow, 'id' | 'updatedAt' | 'category'> & { id?: string }) {
    await wait(LATENCY);
    // The backend keeps a workflow only with a name and a graph that is an object (service/workflows.rs).
    if (!workflow.name.trim()) throw new Error("the workflow's name must be 1 to 200 characters without control characters");
    if (typeof workflow.graph !== 'object' || workflow.graph === null || Array.isArray(workflow.graph)) throw new Error("the workflow's graph must be a JSON object");
    const existing = workflow.id ? this.workflows.find((w) => w.id === workflow.id && w.category === 'user') : undefined;
    if (existing) {
      Object.assign(existing, workflow, { updatedAt: this.now() });
      return { ...existing };
    }
    const saved: SavedWorkflow = { ...workflow, id: this.id('wf'), category: 'user', updatedAt: this.now() };
    this.workflows.push(saved);
    return { ...saved };
  }

  async deleteWorkflow(id: string) {
    await wait(LATENCY);
    this.workflows = this.workflows.filter((w) => w.id !== id);
  }

  // Comics -----------------------------------------------------------------

  private comics: Map<string, ComicRecord>;

  /** Keeps the comics for a reload of the page, when there is somewhere to keep them. */
  private keepComics() {
    try {
      this.comicStorage?.setItem(COMIC_STORAGE_KEY, JSON.stringify([...this.comics.values()]));
    } catch {
      // Full or blocked storage: the comics stay in memory only.
    }
  }

  async listComics(): Promise<ComicRecord[]> {
    await wait(LATENCY);
    return [...this.comics.values()]
      .sort((a, b) => a.updatedAt - b.updatedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((c) => structuredClone(c));
  }

  async saveComic(id: string, document: unknown) {
    await wait(LATENCY);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error("the comic id must be 1 to 64 letters, digits, '-' or '_'");
    if (typeof document !== 'object' || document === null || Array.isArray(document)) throw new Error('the comic must be a JSON object');
    if (new TextEncoder().encode(JSON.stringify(document)).length > MAX_COMIC_BYTES) throw new Error('the comic is too large');
    this.comics.set(id, { id, updatedAt: this.now(), document: structuredClone(document) });
    this.keepComics();
  }

  async deleteComic(id: string) {
    await wait(LATENCY);
    this.comics.delete(id);
    this.keepComics();
  }

  // Canvas -----------------------------------------------------------------

  private canvasDocument: string | null = null;

  async loadCanvas() {
    await wait(LATENCY);
    return this.canvasDocument;
  }

  async saveCanvas(document: string) {
    await wait(LATENCY);
    if (new TextEncoder().encode(document).length > MAX_CANVAS_BYTES) throw new Error('the canvas document is too large');
    if (!jsonObject(document)) throw new Error('the canvas document must be a JSON object');
    this.canvasDocument = document;
  }

  // Screen state -----------------------------------------------------------

  /** Lives as long as the page does, so the page's own storage stays the truth in a browser (the backend keeps it across starts). */
  private uiState: string | null = null;

  async adoptUiState(local: string | null) {
    if (local !== null) checkUiState(local);
    if (this.uiState !== null) return this.uiState;
    if (local !== null && local !== '{}') this.uiState = local;
    return null;
  }

  async saveUiState(state: string) {
    checkUiState(state);
    this.uiState = state;
  }

  /**
   * ComfyUI's own nodes in its order (the rest of them are read only here, so the app does not carry them), the
   * hand-made ones in their place, then the mock's own and the packs'.
   */
  async nodeDefs(): Promise<ComfyNodeDefs> {
    await wait(LATENCY);
    const { default: more } = await import('./comfyMoreCoreDefs.json');
    const core: ComfyNodeDefs = {};
    for (const [name, def] of Object.entries(more as Record<string, unknown>)) {
      const own = CORE_NODE_DEFS[name] ?? (def as ComfyNodeDefs[string] | null);
      if (own) core[name] = own;
    }
    return structuredClone({ ...core, ...MOCK_NODE_DEFS, ...CORE_NODE_DEFS, ...PACK_NODE_DEFS });
  }

  /** The browser has no ComfyUI to read its words from: its own names show. */
  async comfyUiLocale(): Promise<ComfyUiLocale | null> {
    await wait(LATENCY);
    return null;
  }

  // The pretend engine: packs, ComfyUI version, low-memory mode and engine settings (see mockEngine.ts) ------------

  nodePacks = (): Promise<NodePacks> => this.engine.nodePacks();
  nodePackInfo = (url: string): Promise<NodePackInfo> => this.engine.nodePackInfo(url);
  registryNodes = (refresh: boolean): Promise<RegistryNode[]> => this.engine.registryNodes(refresh);
  nodePackVersions = (url: string): Promise<string[]> => this.engine.nodePackVersions(url);
  comfyVersions = (): Promise<string[]> => this.engine.comfyVersions();
  switchComfyVersion = (version: string): Promise<string[]> => this.engine.switchComfyVersion(version);
  installNodePack = (url: string, version?: string): Promise<void> => this.engine.installNodePack(url, version);
  cancelNodePack = (url: string): Promise<void> => this.engine.cancelNodePack(url);
  removeNodePack = (folder: string): Promise<NodePacks> => this.engine.removeNodePack(folder);
  restartEngine = (): Promise<NodePacks> => this.engine.restartEngine();
  lowMemoryMode = (): Promise<LowMemoryMode> => this.engine.lowMemoryMode();
  setLowMemoryMode = (enabled: boolean): Promise<LowMemoryMode> => this.engine.setLowMemoryMode(enabled);
  engineSettings = (): Promise<EngineSettings> => this.engine.engineSettings();
  setEngineSettings = (patch: EngineSettingsPatch): Promise<EngineSettings> => this.engine.setEngineSettings(patch);
  addModelRoot = (): Promise<EngineSettings | null> => this.engine.addModelRoot();
  chooseDataDir = (moveData: boolean): Promise<EngineSettings | null> => this.engine.chooseDataDir(moveData);
  cancelDataDirChange = (): Promise<EngineSettings> => this.engine.cancelDataDirChange();
  chooseComfyuiInstallDir = (): Promise<EngineSettings | null> => this.engine.chooseComfyuiInstallDir();
  resetComfyuiInstallDir = (): Promise<EngineSettings> => this.engine.resetComfyuiInstallDir();
  removeModelRoot = (index: number): Promise<EngineSettings> => this.engine.removeModelRoot(index);

  async faceRigLibrary(): Promise<FaceRigLibrary> {
    await wait(LATENCY);
    return structuredClone(MOCK_FACE_RIG_LIBRARY);
  }

  private faceRigFrames = new Map<string, string>();

  /** The mock cannot move a face: it returns the picture itself, with handle positions to drag. */
  async faceRigPreview(request: FaceRigPreviewRequest): Promise<FaceRigPreviewResult> {
    await wait(Math.max(10, this.stepDelay / 4));
    if (request.image) {
      // A picture the mock does not hold (a test, a fresh scenario) gets a plain placeholder.
      const picture = this.images.find((i) => i.name === request.image);
      this.faceRigFrames.set(request.nodeKey, picture?.url ?? MOCK_FACE_RIG_PLACEHOLDER);
    }
    const image = this.faceRigFrames.get(request.nodeKey);
    if (!image) return { needsFrame: true };
    return { image, anchors: structuredClone(MOCK_FACE_RIG_ANCHORS), settled: true };
  }

  // Export for sharing and backups (see shareBackup.ts) ------------------------

  /** The backup "opened" for a restore: the last one made in this session, else one of the current state. */
  private lastBackup: BackupInfo | null = null;

  async exportImages(names: string[], options: ExportOptions): Promise<ExportResult | null> {
    if (!names.length) throw new Error('Choose at least one picture');
    const picked = names.map((n) => this.images.find((i) => i.name === n));
    const found = picked.filter((i): i is ImageDTO => !!i);
    const result = await exportInBrowser(found, options);
    // The browser cannot mark pixels; the mock only remembers the "watermarked" copy for `checkWatermarkFile`.
    const stills = found.filter((i) => (i.mediaType ?? 'image') === 'image');
    const last = stills.at(-1);
    if (options.watermark && last) {
      this.lastWatermark = {
        id: (this.now() % 0xffffffffffff).toString(16).padStart(12, '0'),
        imageName: last.name,
        exportedAt: this.now(),
        fileName: exportFileName(last.name, options.format),
      };
    }
    return {
      ...result,
      watermarked: options.watermark ? result.count : 0,
      skipped: result.skipped + (picked.length - found.length),
    };
  }

  async revealExportFolder(): Promise<void> {
    // The browser downloaded the files; there is no folder to open.
  }

  /** The copy exported last with the watermark on (what `checkWatermarkFile` pretends the user picked). */
  private lastWatermark: MockWatermark | null = null;

  async watermarkStatus(): Promise<WatermarkStatus> {
    return { state: 'ready' };
  }

  async prepareWatermark(): Promise<void> {
    // Nothing to download in the browser.
  }

  async checkWatermarkFile(): Promise<WatermarkCheck | null> {
    return mockWatermarkCheck(this.lastWatermark, (name) => this.images.some((i) => i.name === name));
  }

  async checkWatermarkImage(name: string): Promise<WatermarkCheck> {
    if (!this.images.some((i) => i.name === name)) throw new Error(`no picture ${name}`);
    return mockWatermarkCheck(null, () => false, name);
  }

  async createBackup(uiState: string): Promise<BackupSummary | null> {
    const data = { boards: this.boards, images: this.images, workflows: this.workflows };
    const summary = downloadMockBackup(data, uiState, new Date(this.now()));
    this.lastBackup = summary.info;
    this.emit({ type: 'backup', progress: { phase: 'create', done: 1, total: 1 } });
    return summary;
  }

  async openBackup(): Promise<BackupInfo | null> {
    await wait(LATENCY);
    const data = { boards: this.boards, images: this.images, workflows: this.workflows };
    return { ...(this.lastBackup ?? backupInfo(data, MOCK_BACKUP_TIME)) };
  }

  async confirmRestore(): Promise<void> {
    // Replacing the data needs the desktop app (it restarts to apply a restore); the mock keeps its state.
    this.lastBackup = null;
  }

  async discardRestore(): Promise<void> {
    this.lastBackup = null;
  }

  async takeRestoredUiState(): Promise<RestoreOutcome> {
    return { state: 'none' };
  }

  /** Partial files of interrupted downloads. The mock starts with none and seeds no rows. */
  private unfinishedDownloads: UnfinishedDownload[] = [];

  async listUnfinishedDownloads(): Promise<UnfinishedDownload[]> {
    return this.unfinishedDownloads.map((d) => ({ ...d }));
  }

  async deleteUnfinishedDownloads(paths: string[]): Promise<UnfinishedDownload[]> {
    this.unfinishedDownloads = this.unfinishedDownloads.filter((d) => !paths.includes(d.path));
    return this.listUnfinishedDownloads();
  }
}

// The mock has no transport to time, so its methods are timed instead (named like the commands, `list_images`).
perf.timeMethods(MockBackend.prototype, snakeCase);

/** A board name as stored: trimmed, and never blank (the same rule as the Rust backend). */
function boardName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Board name is empty');
  return trimmed;
}
