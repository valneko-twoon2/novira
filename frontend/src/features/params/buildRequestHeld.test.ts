// The image form's request when its pictures are held for the Candidates view: the destination, and the items the extra
// dynamic-prompt batches queue, which join the press of Invoke that made them.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type QueueItem } from '@/backend';
import { useParams } from '@/state/params';
import { buildGenerateRequest, takeExtraHeld } from './buildRequest';

const items = (...ids: number[]) => ids.map((id) => ({ id }) as QueueItem);

beforeEach(() => {
  useParams.setState({ modelKey: null, loras: [], refImages: [], positivePrompt: 'a {cat|dog}', dynamicPromptMode: 'combinatorial', iterations: 1 });
  takeExtraHeld();
});
afterEach(() => vi.restoreAllMocks());

describe('a request for the Candidates view', () => {
  it('goes to the gallery unless the pictures are held, and then to the candidates', { tags: ['decision-table'] }, async () => {
    useParams.setState({ positivePrompt: 'a cat' });
    expect((await buildGenerateRequest(false)).destination).toBe('gallery');
    expect((await buildGenerateRequest(false, false)).destination).toBe('gallery');
    expect((await buildGenerateRequest(false, true)).destination).toBe('candidates');
  });

  it(
    'queues the other dynamic-prompt batches for the candidates too, and hands their items over once, in queue order',
    { tags: ['state-transition'] },
    async () => {
      let next = 10;
      const enqueue = vi.spyOn(backend, 'enqueue').mockImplementation(async () => items(next++));
      const first = await buildGenerateRequest(false, true);
      expect(first.destination).toBe('candidates');
      expect(enqueue.mock.calls.map(([r]) => r.destination)).toEqual(['candidates']);
      expect(takeExtraHeld().map((i) => i.id)).toEqual([10]);
      expect(takeExtraHeld()).toEqual([]);
    },
  );

  it('keeps nothing of the extra batches for pictures that go to a board', { tags: ['condition'] }, async () => {
    vi.spyOn(backend, 'enqueue').mockResolvedValue(items(1));
    const first = await buildGenerateRequest(false);
    expect(first.destination).toBe('gallery');
    expect(takeExtraHeld()).toEqual([]);
  });
});
