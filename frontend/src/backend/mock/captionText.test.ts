// @vitest-environment jsdom
// The mock's jobs without a picture as result: describing a picture (text on the queue item).
import { describe, expect, it, vi } from 'vitest';
import type { BackendEvent, ComfyGraph, EnqueueRequest, GenerationMetadata, QueueItem } from '../types';
import { MockBackend } from './MockBackend';
import { mockCaption } from './captionText';

vi.mock('./imageSynth', async (original) => ({
  ...(await original<typeof import('./imageSynth')>()),
  imageSize: vi.fn(async () => ({ width: 64, height: 48 })),
}));

const captionGraph = (name: string, task: string): ComfyGraph => ({
  prompt: {
    source: { class_type: 'LoadImage', inputs: { image: { $image: name } } },
    caption: { class_type: 'Florence2Run', inputs: { image: ['source', 0], task } },
    show: { class_type: 'PreviewAny', inputs: { source: ['caption', 2] } },
  },
  outputs: ['show'],
});

const params = (over: Partial<GenerationMetadata>): GenerationMetadata => ({
  generationMode: 'graph',
  positivePrompt: '',
  negativePrompt: '',
  modelKey: '',
  modelName: '',
  vaeKey: null,
  seed: 1,
  steps: 40,
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
});

const captionRequest = (name: string): EnqueueRequest => ({ origin: 'workflows', destination: 'intermediate', params: params({}), iterations: 1, randomizeSeed: false, prepend: true, boardId: null, comfyGraph: captionGraph(name, 'prompt_gen_tags') });

async function setUp() {
  const backend = new MockBackend('empty');
  await backend.bootstrap();
  backend.setStepDelay(0);
  const events: BackendEvent[] = [];
  backend.subscribe((e) => events.push(e));
  const a = await backend.uploadImage(new Blob(['a']), { boardId: null });
  return { backend, events, names: [a.name] };
}

const finished = (events: BackendEvent[], id: number): QueueItem | undefined =>
  events.flatMap((e) => (e.type === 'queue_item_status_changed' && e.item.id === id && e.item.status !== 'pending' && e.item.status !== 'in_progress' ? [e.item] : [])).at(-1);

async function waitFor<T>(f: () => T | undefined): Promise<T> {
  for (let i = 0; i < 200; i++) {
    const v = f();
    if (v !== undefined) return v;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('not reached');
}

describe('describing a picture in the mock', () => {
  it('gives the same words for the same picture, tags or a sentence by the task', () => {
    const tags = mockCaption(captionGraph('a.png', 'prompt_gen_tags'), 'a.png');
    expect(tags).toBe(mockCaption(captionGraph('a.png', 'prompt_gen_tags'), 'a.png'));
    expect(tags.split(', ').length).toBeGreaterThan(3);
    expect(mockCaption(captionGraph('a.png', 'more_detailed_caption'), 'a.png')).toMatch(/\.$/);
  });

  it('completes the job with the text and stores no picture', async () => {
    const { backend, events, names } = await setUp();
    const before = events.filter((e) => e.type === 'image_added').length;
    const [item] = await backend.enqueue(captionRequest(names[0]!));
    const done = await waitFor(() => finished(events, item!.id));
    expect(done.status).toBe('completed');
    expect(done.resultText).toBe(mockCaption(item!.comfyGraph!, names[0]!));
    expect(events.filter((e) => e.type === 'image_added').length).toBe(before);
  });
});
