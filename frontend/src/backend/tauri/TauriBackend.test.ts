// @vitest-environment jsdom
import { emit } from '@tauri-apps/api/event';
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BackendEvent, EnqueueRequest, GenerationMetadata, QueueItem } from '../types';
import { EVENT_CHANNEL, isBackendImageUrl, isTauri, TauriBackend } from './TauriBackend';

const params: GenerationMetadata = {
  generationMode: 'img2img',
  positivePrompt: 'p',
  negativePrompt: '',
  modelKey: 'main-1',
  modelName: 'M',
  vaeKey: null,
  seed: 1,
  steps: 4,
  cfgScale: 7,
  cfgRescale: 0,
  scheduler: 'euler',
  width: 64,
  height: 64,
  clipSkip: 0,
  seamlessX: false,
  seamlessY: false,
  loras: [],
};

const item = (id: number, status: QueueItem['status']): QueueItem => ({
  id,
  batchId: 'b',
  status,
  origin: 'generate',
  destination: 'gallery',
  params,
  boardId: null,
  initImageUrl: null,
  workflow: null,
  createdAt: 0,
  startedAt: null,
  completedAt: null,
  imageName: null,
  error: null,
});

const STORED = 'http://novira-image.localhost/full/abc.png';
let calls: { cmd: string; payload: unknown }[] = [];

beforeEach(() => {
  calls = [];
  mockIPC(
    (cmd, payload) => {
      calls.push({ cmd, payload });
      switch (cmd) {
        case 'bootstrap':
          return {
            models: [],
            boards: [],
            images: [],
            workflows: [
              {
                id: 'wf-user',
                name: 'Mine',
                description: '',
                author: '',
                tags: [],
                category: 'user',
                updatedAt: 1,
                graph: {},
              },
            ],
            engine: { state: 'downloading', bytes: 5, totalBytes: 10 },
            queue: {
              items: [item(1, 'pending')],
              status: {
                pending: 1,
                inProgress: 0,
                completed: 0,
                failed: 0,
                canceled: 0,
                total: 1,
                isPaused: true,
              },
            },
          };
        case 'upload_image':
          return { name: 'abc.png', url: STORED };
        case 'enqueue':
          return [item(2, 'pending')];
        case 'queue_snapshot':
          return { items: [item(2, 'pending'), item(1, 'pending')], status: { isPaused: false } };
        default:
          return null;
      }
    },
    { shouldMockEvents: true },
  );
});

afterEach(() => clearMocks());

describe('TauriBackend', () => {
  it('is selected only inside Tauri and recognizes its image URLs', () => {
    expect(isTauri()).toBe(true);
    expect(isBackendImageUrl(STORED)).toBe(true);
    expect(isBackendImageUrl('blob:http://localhost/x')).toBe(false);
  });

  it('bootstraps the queue mirror and adds the built-in workflows', async () => {
    const b = new TauriBackend();
    const data = await b.bootstrap();
    expect(data.workflows.some((w) => w.category === 'default')).toBe(true);
    expect(data.workflows.at(-1)?.id).toBe('wf-user');
    expect(b.queueStatus()).toMatchObject({ pending: 1, total: 1, isPaused: true });
  });

  it('keeps the mirror in step with events before listeners see them', async () => {
    const b = new TauriBackend();
    await b.bootstrap();
    const seen: { event: BackendEvent; total: number; completed: number }[] = [];
    b.subscribe((event) =>
      seen.push({ event, total: b.queueStatus().total, completed: b.queueStatus().completed }),
    );

    await emit(EVENT_CHANNEL, { type: 'queue_item_status_changed', item: item(1, 'completed') });
    await emit(EVENT_CHANNEL, { type: 'processor_state', isPaused: false });
    await emit(EVENT_CHANNEL, { type: 'queue_cleared', items: [item(5, 'pending')] });

    expect(seen.map((s) => s.event.type)).toEqual([
      'queue_item_status_changed',
      'processor_state',
      'queue_cleared',
    ]);
    expect(seen[0]?.completed).toBe(1);
    expect(seen[2]?.event).toEqual({ type: 'queue_cleared' });
    expect(b.listQueue().map((q) => q.id)).toEqual([5]);
    expect(b.queueStatus().isPaused).toBe(false);
  });

  it('stores a page-rendered source image before enqueueing it', async () => {
    const b = new TauriBackend();
    await b.bootstrap();
    const request: EnqueueRequest = {
      origin: 'canvas',
      destination: 'canvas',
      params,
      iterations: 1,
      randomizeSeed: false,
      prepend: false,
      boardId: null,
      initImageUrl: 'data:image/png;base64,iVBORw0KGgo=',
    };
    await b.enqueue(request);
    const upload = calls.find((c) => c.cmd === 'upload_image');
    expect(upload?.payload).toBeInstanceOf(Uint8Array);
    const enq = calls.find((c) => c.cmd === 'enqueue')?.payload as { request: EnqueueRequest };
    expect(enq.request.initImageUrl).toBe(STORED);
    expect(b.listQueue().map((q) => q.id)).toEqual([1, 2]);
  });

  it('stores page-rendered masks and control pictures and passes stored reference images through', async () => {
    const b = new TauriBackend();
    await b.bootstrap();
    await b.enqueue({
      origin: 'canvas',
      destination: 'canvas',
      params: { ...params, generationMode: 'inpaint', controlLayerCount: 1, refImageCount: 1, regionalGuidanceCount: 1 },
      iterations: 1,
      randomizeSeed: false,
      prepend: false,
      boardId: null,
      initImageUrl: STORED,
      maskImageUrl: 'data:image/png;base64,iVBORw0KGgo=',
      controlLayers: [{ imageUrl: 'data:image/png;base64,iVBORw0KGgo=', modelKey: 'cn', weight: 0.75, beginEnd: [0, 0.75], controlMode: 'balanced' }],
      regionalLayers: [{ imageUrl: 'data:image/png;base64,iVBORw0KGgo=', positivePrompt: 'a hat', negativePrompt: null, autoNegative: true }],
      refImages: [{ imageUrl: STORED, modelKey: 'ipa', clipVisionModel: 'ViT-H', weight: 0.5, beginEnd: [0, 1], method: 'style' }],
    });
    // The mask, the control picture and the region are uploaded; the source and the reference are already stored.
    expect(calls.filter((c) => c.cmd === 'upload_image')).toHaveLength(3);
    const enq = calls.find((c) => c.cmd === 'enqueue')?.payload as { request: EnqueueRequest };
    expect(enq.request.maskImageUrl).toBe(STORED);
    expect(enq.request.controlLayers?.[0]).toMatchObject({ imageUrl: STORED, modelKey: 'cn', controlMode: 'balanced' });
    expect(enq.request.refImages?.[0]).toMatchObject({ imageUrl: STORED, method: 'style' });
    expect(enq.request.regionalLayers?.[0]).toMatchObject({ imageUrl: STORED, positivePrompt: 'a hat', autoNegative: true });
  });

  it('passes pictures given to the model as references, storing one the page rendered', async () => {
    const b = new TauriBackend();
    await b.bootstrap();
    await b.enqueue({ origin: 'generate', destination: 'gallery', params, iterations: 1, randomizeSeed: false, prepend: false, boardId: null, referencePictures: [STORED, 'data:image/png;base64,iVBORw0KGgo='] });
    expect(calls.filter((c) => c.cmd === 'upload_image')).toHaveLength(1);
    const enq = calls.find((c) => c.cmd === 'enqueue')?.payload as { request: EnqueueRequest };
    expect(enq.request.referencePictures).toEqual([STORED, STORED]);
  });

  it('sends empty guidance when a request has none', async () => {
    const b = new TauriBackend();
    await b.bootstrap();
    await b.enqueue({ origin: 'generate', destination: 'gallery', params, iterations: 1, randomizeSeed: false, prepend: false, boardId: null });
    const enq = calls.find((c) => c.cmd === 'enqueue')?.payload as { request: EnqueueRequest };
    expect(enq.request).toMatchObject({ initImageUrl: null, maskImageUrl: null, controlLayers: [], regionalLayers: [], refImages: [], referencePictures: [] });
  });

  it('reloads the queue order after a prepend and passes stored sources through', async () => {
    const b = new TauriBackend();
    await b.bootstrap();
    await b.enqueue({
      origin: 'generate',
      destination: 'gallery',
      params,
      iterations: 1,
      randomizeSeed: false,
      prepend: true,
      boardId: null,
      initImageUrl: STORED,
    });
    expect(calls.some((c) => c.cmd === 'upload_image')).toBe(false);
    expect(b.listQueue().map((q) => q.id)).toEqual([2, 1]);
  });

  it('returns the engine status and forwards engine events', async () => {
    const b = new TauriBackend();
    expect((await b.bootstrap()).engine).toEqual({ state: 'downloading', bytes: 5, totalBytes: 10 });
    const seen: BackendEvent[] = [];
    b.subscribe((e) => seen.push(e));
    await emit(EVENT_CHANNEL, { type: 'engine_status', status: { state: 'ready' } });
    expect(seen).toEqual([{ type: 'engine_status', status: { state: 'ready' } }]);
  });

  it('asks the shell to open a Civitai page by model id', async () => {
    await new TauriBackend().openCivitaiPage('123');
    expect(calls.find((c) => c.cmd === 'open_civitai_page')?.payload).toEqual({ modelId: '123' });
  });

  it('forwards the assistant status, sign-in, chat and tool answers to the shell', async () => {
    const b = new TauriBackend();
    await b.agentStatus();
    await b.agentLogin('codex');
    const server = { baseUrl: 'http://127.0.0.1:11434/v1', model: 'llama3.2', apiKey: 'k' };
    await b.agentEndpointSave(server);
    await b.agentEndpointModels(server);
    await b.agentEndpointTest(server);
    await b.agentChat({ message: 'hi', locale: 'ja' });
    const answer = { callId: 'c-0123456789abcdef0123456789abcdef', ok: false, content: 'declined' };
    await b.agentToolResult(answer);
    await b.agentCancel();
    expect(calls.filter((c) => c.cmd.startsWith('agent_')).map((c) => c.cmd)).toEqual([
      'agent_status',
      'agent_login',
      'agent_endpoint_save',
      'agent_endpoint_models',
      'agent_endpoint_test',
      'agent_chat',
      'agent_tool_result',
      'agent_cancel',
    ]);
    expect(calls.find((c) => c.cmd === 'agent_login')?.payload).toEqual({ provider: 'codex' });
    expect(calls.find((c) => c.cmd === 'agent_tool_result')?.payload).toEqual({ answer });
    for (const cmd of ['agent_endpoint_save', 'agent_endpoint_models', 'agent_endpoint_test']) expect(calls.find((c) => c.cmd === cmd)?.payload).toEqual({ input: server });
  });
});
