// Drawing panels, reference pictures and sheet views when the queue refuses a job or answers with nothing, when a panel
// cannot be drawn, and how the waits for the pictures end. The desktop shell rejects a command with the error's text, not
// an Error, so most refusals here are strings.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type EnqueueRequest, type ImageDTO, type ModelConfig, type QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useQueue } from '@/state/queue';
import { useToasts } from '@/state/toasts';
import { newProject, type ComicCharacter } from './document';
import { drawPanels, drawPanelsAndWait, makeSheet, STALL_MS } from './generate';
import { onComicImage } from './results';
import { useComic } from './store';

const model = (over: Partial<ModelConfig>): ModelConfig => ({ key: 'main', name: 'Main', base: 'sdxl', type: 'main', ...over }) as ModelConfig;
const IPA = model({ key: 'ipa', name: 'IP-Adapter SDXL', base: 'sdxl', type: 'ip_adapter', path: 'ip-adapter_sdxl_vit-h.safetensors' });
const initial = { params: useParams.getState(), models: useModels.getState(), gallery: useGallery.getState(), queue: useQueue.getState() };

const A: ComicCharacter = { id: 'a', name: 'Grandpa', tags: '1boy, old man', imageName: null };
const C: ComicCharacter = { id: 'c', name: 'Mina', tags: '1girl, red scarf', imageName: null };

/** A comic of one page with three panels with prompts, the first holding the cast; character references on. */
function makeProject(cast: ComicCharacter[] = []) {
  const project = newProject('Walk');
  project.cast = cast;
  project.castReference = 0.4;
  const panels = project.pages[0]!.panels;
  project.pages[0]!.panels = [
    { ...panels[0]!, prompt: 'p1 at the gate', cast: cast.map((c) => c.id) },
    { ...panels[1]!, prompt: 'p2 on the bench' },
    { ...panels[2]!, prompt: 'p3 by the river' },
  ];
  return project;
}

function seed(cast: ComicCharacter[] = []) {
  const project = makeProject(cast);
  useComic.getState().setProjects([project]);
  return project.pages[0]!.panels.map((p) => p.id);
}

/**
 * Queue mock. `answer(n, request)` gives the n-th call's result (from 1): undefined for one pending item, a string or an
 * Error to refuse, an array for that answer as it is.
 */
function mockQueue(first: number, answer: (n: number, request: EnqueueRequest) => unknown = () => undefined) {
  let next = first - 1;
  let calls = 0;
  const sent: EnqueueRequest[] = [];
  const spy = vi.spyOn(backend, 'enqueue').mockImplementation(async (request) => {
    sent.push(request);
    const given = answer(++calls, request);
    if (typeof given === 'string' || given instanceof Error) throw given;
    if (Array.isArray(given)) return given as QueueItem[];
    const item = { id: ++next, status: 'pending' } as unknown as QueueItem;
    useQueue.setState({ items: [...useQueue.getState().items, item] });
    return [item];
  });
  return { sent, spy, prompts: () => sent.map((r) => r.params.positivePrompt) };
}

const toasts = () => useToasts.getState().toasts.map((x) => ({ status: x.status, title: x.title, ...(x.description ? { description: x.description } : {}) }));
const failed = (description: string) => ({ status: 'error', title: t('comic.draw.failed'), description });
const enqueued = (count: number) => ({ status: 'success', title: t('app.invoke.enqueued', { count }) });
/** Lets work that awaits only promises the mocks settle at once run to its end. */
const flush = () => new Promise((r) => setTimeout(r, 0));
/** Finishes a portrait's queue item with its picture, as the app does when the picture arrives. */
const finishPortrait = (id: number, name: string) => {
  const item = useQueue.getState().items.find((i) => i.id === id)!;
  onComicImage(item, { name, url: 'u' } as ImageDTO);
  useQueue.setState({ items: useQueue.getState().items.map((i) => (i.id === id ? { ...i, status: 'completed' as const } : i)) });
};

beforeEach(() => {
  useParams.setState({ ...initial.params, modelKey: 'main' }, true);
  useModels.setState({ ...initial.models, models: [model({}), IPA] }, true);
  useGallery.setState({ ...initial.gallery, images: [] }, true);
  useQueue.setState({ ...initial.queue, items: [] }, true);
  useComic.setState({ pending: {}, sheetPending: {} });
  useToasts.setState({ toasts: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  useParams.setState(initial.params, true);
  useModels.setState(initial.models, true);
  useGallery.setState(initial.gallery, true);
  useQueue.setState(initial.queue, true);
  useComic.setState({ pending: {}, sheetPending: {} });
});

describe('queueing panels', () => {
  it('stops at the first panel the queue refuses, says why, and leaves only the queued panel waiting for its picture', async () => {
    const ids = seed();
    const { spy } = mockQueue(101, (n) => (n === 2 ? 'queue is full' : undefined));
    expect(await drawPanels(ids)).toBe(1);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(useComic.getState().pending).toEqual({ 101: ids[0] });
    expect(toasts()).toEqual([failed('queue is full'), enqueued(1)]);
  });

  it('skips a panel that is gone or has no prompt, and draws the rest', async () => {
    const ids = seed();
    const project = useComic.getState().projects[0]!;
    useComic.getState().setProjects([{ ...project, pages: [{ ...project.pages[0]!, panels: project.pages[0]!.panels.map((p, i) => (i === 1 ? { ...p, prompt: '  ' } : p)) }] }]);
    const { prompts } = mockQueue(111);
    expect(await drawPanels(['gone', ids[1]!, ids[2]!])).toBe(1);
    expect(prompts()).toHaveLength(1);
    expect(prompts()[0]).toContain('p3 by the river');
    expect(useComic.getState().pending).toEqual({ 111: ids[2] });
  });
});

describe('the characters\' reference pictures before the panels', () => {
  it('draws the panels from the words alone when a portrait cannot be queued, and tries no other portrait', async () => {
    const ids = seed([A, C]);
    const { prompts } = mockQueue(121, (n) => (n === 1 ? new Error('engine is down') : undefined));
    expect(await drawPanels(ids)).toBe(3);
    // One refused portrait, then the three panels: no second portrait, and no wait for a picture that was never queued.
    expect(prompts()).toHaveLength(4);
    expect(prompts()[0]).toContain('white background');
    expect(prompts().slice(1).every((p) => !p.includes('white background'))).toBe(true);
    expect(useComic.getState().projects[0]!.cast.map((c) => c.imageName)).toEqual([null, null]);
    expect(toasts()).toEqual([failed('engine is down'), enqueued(3)]);
  });

  it('does not wait for a portrait the queue answered with no item', async () => {
    const ids = seed([A]);
    const { prompts } = mockQueue(131, (n) => (n === 1 ? [] : undefined));
    expect(await drawPanels(ids)).toBe(3);
    expect(prompts()).toHaveLength(4);
    expect(toasts()).toEqual([enqueued(3)]);
  });

  it('queues the panels only once every character\'s portrait has come', async () => {
    const ids = seed([A, C]);
    const { prompts } = mockQueue(141);
    const drawing = drawPanels(ids);
    await vi.waitFor(() => expect(prompts()).toHaveLength(2));
    await flush();
    finishPortrait(141, 'grandpa.png');
    await flush();
    expect(prompts()).toHaveLength(2);
    finishPortrait(142, 'mina.png');
    expect(await drawing).toBe(3);
    expect(useComic.getState().projects[0]!.cast.map((c) => c.imageName)).toEqual(['grandpa.png', 'mina.png']);
  });

  it('gives the portrait to the character of its own comic when another comic is open', async () => {
    const walk = makeProject([A]);
    // The open comic has a character of the same id, which must keep its own picture.
    const other = { ...newProject('Other'), cast: [{ ...A, name: 'Someone else', imageName: 'else.png' }] };
    useComic.getState().setProjects([other, walk]);
    const { prompts } = mockQueue(151);
    const drawing = drawPanels(walk.pages[0]!.panels.map((p) => p.id));
    await vi.waitFor(() => expect(prompts()).toHaveLength(1));
    await flush();
    finishPortrait(151, 'grandpa.png');
    expect(await drawing).toBe(3);
    const projects = useComic.getState().projects;
    expect(projects.find((p) => p.id === walk.id)!.cast).toEqual([{ ...A, imageName: 'grandpa.png' }]);
    expect(projects.find((p) => p.id === other.id)!.cast).toEqual(other.cast);
    expect(useComic.getState().activeProjectId).toBe(walk.id);
  });

  it('ends quietly when the comic is deleted while its portrait is drawn', async () => {
    const walk = makeProject([A]);
    const other = { ...newProject('Other'), cast: [C] };
    useComic.getState().setProjects([walk, other]);
    const { prompts } = mockQueue(161);
    const drawing = drawPanels(walk.pages[0]!.panels.map((p) => p.id));
    await vi.waitFor(() => expect(prompts()).toHaveLength(1));
    await flush();
    useComic.getState().setProjects([other]);
    finishPortrait(161, 'grandpa.png');
    // Its panels are gone too: nothing more is queued, and the comic left open is not touched.
    expect(await drawing).toBe(0);
    expect(prompts()).toHaveLength(1);
    expect(useComic.getState().projects).toEqual([other]);
  });
});

describe('making a character\'s sheet', () => {
  const withFront = (over: Partial<ComicCharacter> = {}) => {
    seed([{ ...A, imageName: 'a.png', ...over }]);
    useGallery.setState({ images: [{ name: 'a.png', url: 'novira-image://a.png' } as ImageDTO] });
  };
  const views = () => Object.values(useComic.getState().sheetPending).map((p) => p.view);

  it('says there is no front picture, and queues no view, when the front cannot be drawn', async () => {
    seed([A]);
    const { spy } = mockQueue(201, () => 'engine is down');
    expect(await makeSheet('a')).toBe(0);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(views()).toEqual([]);
    expect(toasts()).toEqual([failed('engine is down'), { status: 'error', title: t('comic.sheet.noFront') }]);
  });

  it('stops at the first view the queue refuses and keeps the views already queued', async () => {
    withFront();
    const { spy } = mockQueue(211, (n) => (n === 2 ? 'queue is full' : undefined));
    expect(await makeSheet('a')).toBe(1);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(views()).toEqual(['threeQuarter']);
    expect(toasts()).toEqual([failed('queue is full'), enqueued(1)]);
  });

  it('does not count the views being drawn for another character or another comic', async () => {
    withFront({ sheet: { face: 'face.png' } });
    const projectId = useComic.getState().projects[0]!.id;
    useComic.setState({ sheetPending: { 1: { projectId, characterId: 'b', view: 'side' }, 2: { projectId: 'other', characterId: 'a', view: 'back' } } });
    mockQueue(221);
    expect(await makeSheet('a')).toBe(3);
    expect(views()).toEqual(['side', 'back', 'threeQuarter', 'side', 'back']);
  });

  it('leaves out a view the character has no words for', async () => {
    // Only the eyes are written, and a view from behind does not show them.
    withFront({ tags: '', parts: { eyes: 'blue eyes' } });
    const { prompts } = mockQueue(231);
    expect(await makeSheet('a')).toBe(3);
    expect(views()).toEqual(['threeQuarter', 'side', 'face']);
    expect(prompts().some((p) => p.includes('from behind'))).toBe(false);
  });
});

describe('waiting for the panels\' pictures', () => {
  it('answers at once when the engine refused every panel as it was queued', async () => {
    vi.useFakeTimers();
    const ids = seed();
    // The failure reaches the queue store before the enqueue call returns (see bindComicItem).
    let next = 300;
    vi.spyOn(backend, 'enqueue').mockImplementation(async () => {
      const item = { id: ++next, status: 'failed' } as unknown as QueueItem;
      useQueue.setState({ items: [...useQueue.getState().items, item] });
      return [{ ...item, status: 'pending' } as QueueItem];
    });
    let done = false;
    const waiting = drawPanelsAndWait(ids).then((n) => ((done = true), n));
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
    expect(await waiting).toBe(3);
  });

  it('does not wait longer for a change of the queue that does not move these pictures', async () => {
    vi.useFakeTimers();
    const ids = seed();
    mockQueue(311);
    let done = false;
    const waiting = drawPanelsAndWait(ids).then((n) => ((done = true), n));
    await vi.advanceTimersByTimeAsync(0);
    expect(useQueue.getState().items).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(STALL_MS - 60_000);
    // Another screen's job joins the queue: these pictures have not moved.
    useQueue.setState({ items: [...useQueue.getState().items, { id: 999, status: 'pending' } as unknown as QueueItem] });
    await vi.advanceTimersByTimeAsync(60_000 + 11_000);
    expect(done).toBe(true);
    expect(await waiting).toBe(3);
  });
});
