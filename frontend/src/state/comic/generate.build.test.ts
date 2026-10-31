// The Invoke bar's build for the comic screen, by draw scope (the selected panel, the page on screen, the whole comic), and
// the comic-wide draw button: which panel the build draws, which panels follow it, and why nothing can be drawn.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type EnqueueRequest, type ImageDTO, type ModelConfig, type QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useQueue } from '@/state/queue';
import { useToasts } from '@/state/toasts';
import { emptyPage, newProject, type ComicCharacter, type ComicPanel } from './document';
import { comicInvokeBuilder, drawComic } from './generate';
import { onComicImage } from './results';
import { useComic } from './store';

const model = (over: Partial<ModelConfig>): ModelConfig => ({ key: 'main', name: 'Main', base: 'sdxl', type: 'main', ...over }) as ModelConfig;
const IPA = model({ key: 'ipa', name: 'IP-Adapter SDXL', base: 'sdxl', type: 'ip_adapter', path: 'ip-adapter_sdxl_vit-h.safetensors' });
const initial = { params: useParams.getState(), models: useModels.getState(), gallery: useGallery.getState(), queue: useQueue.getState() };

/**
 * A comic of two pages. Page 1: "at the gate", a panel without a prompt, "by the river". Page 2: "on the roof" and two
 * panels without one. Returns the panel ids by page.
 */
function seed(cast: ComicCharacter[] = [], castReference?: number) {
  const project = newProject('Walk');
  project.cast = cast;
  if (castReference !== undefined) project.castReference = castReference;
  const prompts = (panels: ComicPanel[], words: string[], who: string[][] = []) => panels.map((p, i) => ({ ...p, prompt: words[i] ?? '', cast: who[i] ?? [] }));
  const page2 = emptyPage();
  project.pages[0]!.panels = prompts(project.pages[0]!.panels, ['p1 at the gate', '', 'p3 by the river'], [cast.map((c) => c.id)]);
  page2.panels = prompts(page2.panels, ['q1 on the roof']);
  project.pages.push(page2);
  useComic.getState().setProjects([project]);
  return { page1: project.pages[0]!.panels.map((p) => p.id), page2: page2.panels.map((p) => p.id) };
}

/** Queue mock: each request gets one pending item, numbered from `first`; the requests are remembered in order. */
function mockQueue(first = 1) {
  let next = first - 1;
  const sent: EnqueueRequest[] = [];
  const spy = vi.spyOn(backend, 'enqueue').mockImplementation(async (request) => {
    const item = { id: ++next, status: 'pending' } as unknown as QueueItem;
    useQueue.setState({ items: [...useQueue.getState().items, item] });
    sent.push(request);
    return [item];
  });
  return { sent, spy, prompts: () => sent.map((r) => r.params.positivePrompt) };
}

/** Lets the work started by onEnqueued (the later panels) run to its end: it awaits only promises the mock settles at once. */
const flush = () => new Promise((r) => setTimeout(r, 0));

/** What the Invoke bar does: build, queue the request it gets back, and hand the items to onEnqueued. */
async function invoke(prepend = false) {
  const request = await comicInvokeBuilder.build({ prepend });
  const items = await backend.enqueue(request);
  comicInvokeBuilder.onEnqueued!(items);
  return { request, items };
}

beforeEach(() => {
  useParams.setState({ ...initial.params, modelKey: 'main' }, true);
  useModels.setState({ ...initial.models, models: [model({}), IPA] }, true);
  useGallery.setState({ ...initial.gallery, images: [] }, true);
  useQueue.setState({ ...initial.queue, items: [] }, true);
  useComic.setState({ pending: {}, drawScope: 'panel' });
  useToasts.setState({ toasts: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
  useParams.setState(initial.params, true);
  useModels.setState(initial.models, true);
  useGallery.setState(initial.gallery, true);
  useQueue.setState(initial.queue, true);
  useComic.setState({ pending: {}, drawScope: 'panel' });
});

describe('the Invoke build of the comic screen', () => {
  it('draws the selected panel alone in the panel scope', async () => {
    const { page1 } = seed();
    useComic.getState().selectPanel(page1[2]!);
    const { prompts } = mockQueue(11);
    const { request } = await invoke();
    await flush();
    expect(request.params.positivePrompt).toContain('p3 by the river');
    expect(prompts()).toHaveLength(1);
    expect(useComic.getState().pending).toEqual({ 11: page1[2] });
  });

  it('draws the page on screen in the page scope: its first panel with a prompt, then the others in reading order', async () => {
    const { page1 } = seed();
    useComic.getState().setDrawScope('page');
    const { prompts } = mockQueue(21);
    const { request } = await invoke();
    // The build itself queues nothing: the first panel goes back to the Invoke bar.
    expect(request.params.positivePrompt).toContain('p1 at the gate');
    await vi.waitFor(() => expect(prompts()).toHaveLength(2));
    await flush();
    // The panel without a prompt is skipped, and the other page is not drawn.
    expect(prompts()[1]).toContain('p3 by the river');
    expect(prompts()).toHaveLength(2);
    expect(useComic.getState().pending).toEqual({ 21: page1[0], 22: page1[2] });
  });

  it('draws every page in the comic scope, from the comic\'s first panel whichever page is on screen', async () => {
    const { page1, page2 } = seed();
    const project = useComic.getState().projects[0]!;
    useComic.getState().selectPage(project.pages[1]!.id);
    useComic.getState().setDrawScope('comic');
    const { prompts } = mockQueue(31);
    const { request } = await invoke();
    expect(request.params.positivePrompt).toContain('p1 at the gate');
    await vi.waitFor(() => expect(prompts()).toHaveLength(3));
    expect(prompts()[1]).toContain('p3 by the river');
    expect(prompts()[2]).toContain('q1 on the roof');
    expect(useComic.getState().pending).toEqual({ 31: page1[0], 32: page1[2], 33: page2[0] });
  });

  it('says why nothing can be drawn, in the words of each scope', async () => {
    const spy = vi.spyOn(backend, 'enqueue');
    seed();
    const project = useComic.getState().projects[0]!;
    useComic.getState().setProjects([{ ...project, pages: project.pages.map((pg) => ({ ...pg, panels: pg.panels.map((p) => ({ ...p, prompt: ' ' })) })) }]);
    useComic.getState().setDrawScope('page');
    await expect(comicInvokeBuilder.build({ prepend: false })).rejects.toThrow(t('comic.readiness.noPrompts'));
    useComic.getState().setDrawScope('comic');
    await expect(comicInvokeBuilder.build({ prepend: false })).rejects.toThrow(t('comic.readiness.noPromptsComic'));
    useComic.getState().setProjects([]);
    useComic.getState().setDrawScope('panel');
    await expect(comicInvokeBuilder.build({ prepend: false })).rejects.toThrow(t('comic.readiness.noPanel'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('draws the characters\' reference pictures before the page\'s first panel is built', async () => {
    const grandpa: ComicCharacter = { id: 'a', name: 'Grandpa', tags: '1boy, old man', imageName: null };
    seed([grandpa], 0.4);
    useComic.getState().setDrawScope('page');
    const { prompts } = mockQueue(41);
    const building = comicInvokeBuilder.build({ prepend: false });
    await vi.waitFor(() => expect(prompts()).toHaveLength(1));
    expect(prompts()[0]).toContain('white background');
    // The item is bound to its portrait a moment after the queue answers.
    await flush();
    const item = useQueue.getState().items[0]!;
    onComicImage(item, { name: 'grandpa.png', url: 'u' } as ImageDTO);
    useQueue.setState({ items: [{ ...item, status: 'completed' }] });
    const request = await building;
    expect(request.params.positivePrompt).toContain('p1 at the gate');
    expect(useComic.getState().projects[0]!.cast[0]!.imageName).toBe('grandpa.png');
  });

  describe('a prompt with several combinations', () => {
    const colour = (r: EnqueueRequest) => /red|blue|green/.exec(r.params.positivePrompt)?.[0];

    beforeEach(() => {
      const { page1 } = seed();
      const project = useComic.getState().projects[0]!;
      useComic.getState().setProjects([{ ...project, pages: [{ ...project.pages[0]!, panels: project.pages[0]!.panels.map((p) => (p.id === page1[0] ? { ...p, prompt: '{red|blue|green} hat' } : p)) }] }]);
      useComic.getState().selectPanel(page1[0]!);
      useParams.setState({ dynamicPromptMode: 'combinatorial' });
    });

    it('queues the further combinations from the build and gives the first back for the panel', async () => {
      const { sent } = mockQueue(51);
      const first = await comicInvokeBuilder.build({ prepend: false });
      expect(colour(first)).toBe('red');
      expect(sent.map(colour)).toEqual(['blue', 'green']);
      expect(sent.every((r) => !r.prepend)).toBe(true);
    });

    it('keeps the combinations in order at the front of the queue when they are put first', async () => {
      // A queue that puts a prepended request in front of everything waiting.
      const order: string[] = [];
      vi.spyOn(backend, 'enqueue').mockImplementation(async (request) => {
        if (request.prepend) order.unshift(colour(request)!);
        else order.push(colour(request)!);
        return [{ id: 61 + order.length, status: 'pending' } as unknown as QueueItem];
      });
      const first = await comicInvokeBuilder.build({ prepend: true });
      expect(first.prepend).toBe(true);
      await backend.enqueue(first);
      expect(order).toEqual(['red', 'blue', 'green']);
    });
  });
});

describe('drawing the whole comic', () => {
  it('says that no model is chosen and queues nothing', async () => {
    seed();
    const spy = vi.spyOn(backend, 'enqueue');
    useParams.setState({ modelKey: null });
    expect(await drawComic()).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    expect(useToasts.getState().toasts.map((x) => [x.status, x.title])).toEqual([['warning', t('comic.readiness.noModel')]]);
  });

  it('queues every panel with a prompt on every page, and says how many', async () => {
    const { page1, page2 } = seed();
    const { prompts } = mockQueue(71);
    expect(await drawComic()).toBe(3);
    expect(prompts().map((p) => /p1|p3|q1/.exec(p)?.[0])).toEqual(['p1', 'p3', 'q1']);
    expect(Object.values(useComic.getState().pending)).toEqual([page1[0], page1[2], page2[0]]);
    expect(useToasts.getState().toasts.map((x) => [x.status, x.title])).toEqual([['success', t('app.invoke.enqueued', { count: 3 })]]);
  });
});
