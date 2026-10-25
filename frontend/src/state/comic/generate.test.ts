import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO, type ModelConfig, type QueueItem } from '@/backend';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useQueue } from '@/state/queue';
import { newProject, type ComicCharacter } from './document';
import { t } from '@/i18n';
import { drawPanels, drawPanelsAndWait, fixTarget, makeSheet, portraitCharacters, STALL_MS } from './generate';
import { bindComicItem, onComicImage } from './results';
import { findPanel, useComic } from './store';

const model = (over: Partial<ModelConfig>): ModelConfig => ({ key: 'main', name: 'Main', base: 'sdxl', type: 'main', ...over }) as ModelConfig;
const initial = { params: useParams.getState(), models: useModels.getState(), gallery: useGallery.getState(), queue: useQueue.getState() };

const IPA = model({ key: 'ipa', name: 'IP-Adapter SDXL', base: 'sdxl', type: 'ip_adapter', path: 'ip-adapter_sdxl_vit-h.safetensors' });
const A: ComicCharacter = { id: 'a', name: 'Grandpa', tags: '1boy, old man', imageName: null };
const B: ComicCharacter = { id: 'b', name: 'Goro', tags: '1dog, shiba inu', imageName: 'goro.png' };

/**
 * One page of three panels with prompts: panel 1 has both characters, panel 2 only Grandpa, panel 3 only Goro. The comic
 * draws with its character references, through the installed IP-Adapter, unless `castReference` is null (off).
 */
function seed(cast: ComicCharacter[] = [A, B], castReference: number | null = 0.4) {
  const project = newProject('Walk');
  const panels = project.pages[0]!.panels;
  project.cast = cast;
  if (castReference !== null) project.castReference = castReference;
  project.pages[0]!.panels = [
    { ...panels[0]!, prompt: 'p1 at the gate', cast: ['a', 'b'] },
    { ...panels[1]!, prompt: 'p2 on the bench', cast: ['a'] },
    { ...panels[2]!, prompt: 'p3 by the river', cast: ['b'] },
  ];
  useComic.getState().setProjects([project]);
  return project.pages[0]!.panels.map((p) => p.id);
}

beforeEach(() => {
  useParams.setState({ ...initial.params, modelKey: 'main' }, true);
  useModels.setState({ ...initial.models, models: [model({}), IPA] }, true);
  useGallery.setState({ ...initial.gallery, images: [] }, true);
  useQueue.setState({ ...initial.queue, items: [] }, true);
});

afterEach(() => {
  vi.restoreAllMocks();
  useParams.setState(initial.params, true);
  useModels.setState(initial.models, true);
  useGallery.setState(initial.gallery, true);
  useQueue.setState(initial.queue, true);
});

describe('which characters need a reference picture', () => {
  it('judges a panel by the model of its own page, not by the page on screen', () => {
    const ids = seed([A, B], null);
    const project = useComic.getState().projects[0]!;
    useModels.setState({ models: [model({}), model({ key: 'flux', name: 'Flux', base: 'flux2' }), IPA] });
    // The comic draws with an SD model and no references: no portrait is needed.
    expect(portraitCharacters(ids)).toEqual([]);
    // Its page uses FLUX.2, which takes pictures in itself, while the form still holds the SD model.
    useComic.getState().setProjects([{ ...project, pages: project.pages.map((pg) => ({ ...pg, draw: { modelKey: 'flux' } })) }]);
    expect(portraitCharacters(ids).map((c) => c.character.id)).toEqual(['a']);
  });

  it('lists each character of the panels once: no picture yet and tags to draw it from', () => {
    const ids = seed();
    expect(portraitCharacters(ids).map((c) => c.character.id)).toEqual(['a']);
    expect(portraitCharacters([])).toEqual([]);
    expect(portraitCharacters(['missing'])).toEqual([]);
    const bare = seed([{ ...A, tags: '  ' }, { ...B, imageName: null }]);
    expect(portraitCharacters(bare).map((c) => c.character.id)).toEqual(['b']);
  });

  it('lists none when the panels are drawn without the pictures of their characters: references off, or no IP-Adapter', () => {
    expect(portraitCharacters(seed([A, B], null))).toEqual([]);
    useModels.setState({ models: [model({})] });
    expect(portraitCharacters(seed())).toEqual([]);
    // A model that takes pictures in itself always draws with them.
    useModels.setState({ models: [model({ base: 'flux2' })] });
    expect(portraitCharacters(seed([A, B], null)).map((c) => c.character.id)).toEqual(['a']);
  });

  it('queues the panels without drawing the characters alone first when the comic uses no references', async () => {
    const ids = seed([A, B], null);
    const { prompts } = mockQueue();
    expect(await drawPanels(ids)).toBe(3);
    expect(prompts.every((p) => !p.includes('white background'))).toBe(true);
  });
});

/** Queue mock that answers each request with a pending item and remembers the prompts; ids count from `first`. */
function mockQueue(first = 1) {
  let next = first - 1;
  const prompts: string[] = [];
  const spy = vi.spyOn(backend, 'enqueue').mockImplementation(async (request) => {
    const item = { id: ++next, status: 'pending' } as unknown as QueueItem;
    useQueue.setState({ items: [...useQueue.getState().items, item] });
    prompts.push(request.params.positivePrompt);
    return [item];
  });
  return { prompts, spy };
}

describe('drawing several panels with references', () => {
  it('draws the character alone first, waits for it, makes it the reference, then queues the panels', async () => {
    const ids = seed();
    const { prompts } = mockQueue();
    const drawing = drawPanels(ids);
    await vi.waitFor(() => expect(prompts).toHaveLength(1));
    // Only the portrait (the tags alone, on a plain background) is queued while its picture is awaited.
    expect(prompts[0]).toContain('1boy, old man');
    expect(prompts[0]).toContain('white background');
    await new Promise((r) => setTimeout(r, 30));
    expect(prompts).toHaveLength(1);
    const item = useQueue.getState().items[0]!;
    useQueue.setState({ items: [{ ...item, status: 'completed' }] });
    onComicImage(item, { name: 'grandpa.png', url: 'u' } as ImageDTO);
    expect(await drawing).toBe(3);
    expect(prompts).toHaveLength(4);
    expect(prompts[1]).toContain('p1 at the gate');
    expect(prompts[3]).toContain('p3 by the river');
    // The portrait is now the character's reference, and the other character's is untouched.
    const cast = findPanel(useComic.getState().projects, ids[0]!)!.project.cast;
    expect(cast.find((c) => c.id === 'a')!.imageName).toBe('grandpa.png');
    expect(cast.find((c) => c.id === 'b')!.imageName).toBe('goro.png');
  });

  it('queues the panels at once when every character already has a picture', async () => {
    const ids = seed([{ ...A, imageName: 'a.png' }, B]);
    const { spy } = mockQueue();
    expect(await drawPanels(ids)).toBe(3);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('carries on with the panels when the portrait never comes, after the wait', async () => {
    vi.useFakeTimers();
    try {
      const ids = seed();
      const { spy } = mockQueue();
      const drawing = drawPanels(ids);
      await vi.advanceTimersByTimeAsync(31 * 60_000);
      await vi.advanceTimersByTimeAsync(11_000);
      expect(await drawing).toBe(3);
      expect(spy).toHaveBeenCalledTimes(4);
      // No picture was made, so the character has no reference.
      expect(findPanel(useComic.getState().projects, ids[0]!)!.project.cast.find((c) => c.id === 'a')!.imageName).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('drawing panels and waiting for their pictures', () => {
  /** Finishes the queue item `id` and puts its picture in its panel, as the app does when a picture arrives. */
  const finish = (id: number) => {
    const items = useQueue.getState().items.map((i) => (i.id === id ? { ...i, status: 'completed' as const } : i));
    useQueue.setState({ items });
    onComicImage(items.find((i) => i.id === id)!, { name: `pic-${id}.png`, url: 'u' } as ImageDTO);
  };

  // The ids start past the earlier tests' ones: a portrait that never came keeps its id in the results module.
  it('answers once every picture is in its panel, with the number queued', async () => {
    const ids = seed([{ ...A, imageName: 'a.png' }, B]);
    mockQueue(101);
    let done = false;
    const waiting = drawPanelsAndWait(ids).then((n) => ((done = true), n));
    await vi.waitFor(() => expect(useQueue.getState().items).toHaveLength(3));
    finish(101);
    finish(102);
    await new Promise((r) => setTimeout(r, 20));
    expect(done).toBe(false);
    finish(103);
    expect(await waiting).toBe(3);
    expect(useComic.getState().projects[0]!.pages[0]!.panels.map((p) => p.imageName)).toEqual(['pic-101.png', 'pic-102.png', 'pic-103.png']);
  });

  it('waits as long as the pictures keep moving, and gives up when they stop', async () => {
    vi.useFakeTimers();
    try {
      const ids = seed([{ ...A, imageName: 'a.png' }, B]);
      mockQueue(201);
      let done = false;
      const waiting = drawPanelsAndWait(ids).then((n) => ((done = true), n));
      await vi.advanceTimersByTimeAsync(0);
      expect(useQueue.getState().items).toHaveLength(3);
      await vi.advanceTimersByTimeAsync(STALL_MS - 60_000);
      // The first picture starts: the wait begins again from here.
      useQueue.setState({ items: useQueue.getState().items.map((i) => (i.id === 201 ? { ...i, status: 'in_progress' as const } : i)) });
      await vi.advanceTimersByTimeAsync(STALL_MS - 60_000);
      expect(done).toBe(false);
      // Nothing moves any more: the wait ends, and so does the short one for pictures that never reach their panels.
      await vi.advanceTimersByTimeAsync(60_000 + 11_000);
      expect(done).toBe(true);
      expect(await waiting).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not take items the queue store has not got yet for finished ones', async () => {
    const ids = seed([{ ...A, imageName: 'a.png' }, B]);
    // The queue answers the call before its event reaches the store: the items are not in it.
    let next = 600;
    vi.spyOn(backend, 'enqueue').mockImplementation(async () => [{ id: ++next, status: 'pending' } as unknown as QueueItem]);
    let done = false;
    const waiting = drawPanelsAndWait(ids).then((n) => ((done = true), n));
    await vi.waitFor(() => expect(useQueue.getState().items).toHaveLength(3));
    await new Promise((r) => setTimeout(r, 30));
    expect(done).toBe(false);
    for (const id of [601, 602, 603]) finish(id);
    expect(await waiting).toBe(3);
  });

  it('ends the wait for items the queue no longer holds', async () => {
    const ids = seed([{ ...A, imageName: 'a.png' }, B]);
    mockQueue(701);
    const waiting = drawPanelsAndWait(ids);
    await vi.waitFor(() => expect(useQueue.getState().items).toHaveLength(3));
    // The person cleared the queue's history; nothing will bring the pictures any more.
    useQueue.setState({ items: [] });
    useComic.setState({ pending: {} });
    expect(await waiting).toBe(3);
  });

  it('queues nothing and waits for nothing without a panel to draw', async () => {
    seed();
    const { spy } = mockQueue();
    expect(await drawPanelsAndWait([])).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('redrawing a part of a panel\'s picture', () => {
  const mask = { strokes: [], boxes: [{ x: 0.1, y: 0.1, w: 0.3, h: 0.3 }] };

  it('says why it cannot at once: no picture in the gallery, a model that takes no masks', () => {
    const ids = seed();
    expect(fixTarget(ids[0]!, mask)).toBe(t('comic.fix.noPicture'));
    useComic.getState().setPanelImage(ids[0]!, 'pic.png');
    useGallery.setState({ images: [{ name: 'pic.png', url: 'novira-image://pic.png', width: 512, height: 512 } as ImageDTO] });
    expect(fixTarget(ids[0]!, { strokes: [], boxes: [] })).toBe(t('comic.fix.empty'));
    expect(typeof fixTarget(ids[0]!, mask)).toBe('object');
    // FLUX.2 does not take masks (the backend refuses the job): the panel's own model decides.
    useModels.setState({ models: [model({}), model({ key: 'flux', name: 'Flux', base: 'flux2' })] });
    const project = useComic.getState().projects[0]!;
    useComic.getState().setProjects([{ ...project, pages: project.pages.map((pg) => ({ ...pg, draw: { modelKey: 'flux' } })) }]);
    expect(fixTarget(ids[0]!, mask)).toBe(t('comic.fix.noInpaint'));
  });

  it('puts the redrawn picture in the panel as the old one sat', () => {
    const ids = seed();
    useComic.getState().setPanelImage(ids[0]!, 'pic.png');
    useComic.getState().setPanelImageView(ids[0]!, { scale: 2, cx: 0.3 });
    const item = { id: 801, status: 'pending' } as unknown as QueueItem;
    bindComicItem(item, ids[0]!, { keepView: true });
    onComicImage(item, { name: 'fixed.png', url: 'u' } as ImageDTO);
    const panel = findPanel(useComic.getState().projects, ids[0]!)!.panel;
    expect(panel.imageName).toBe('fixed.png');
    expect(panel.imageView.scale).toBe(2);
    expect(panel.takes[0]!.imageName).toBe('pic.png');
    // A picture drawn anew starts as it covers the panel.
    const other = { id: 802, status: 'pending' } as unknown as QueueItem;
    bindComicItem(other, ids[0]!);
    onComicImage(other, { name: 'again.png', url: 'u' } as ImageDTO);
    expect(findPanel(useComic.getState().projects, ids[0]!)!.panel.imageView.scale).toBe(1);
  });
});

describe('making the sheet of a character', () => {
  const IPA = model({ key: 'ipa', name: 'IP-Adapter SDXL', base: 'sdxl', type: 'ip_adapter', path: 'ip-adapter_sdxl_vit-h.safetensors' });
  const cast = () => useComic.getState().projects[0]!.cast;

  it('queues the views it lacks, each from the front picture, and a view being drawn only once', async () => {
    seed([{ ...A, imageName: 'a.png', sheet: { face: 'face.png' } }, B]);
    useModels.setState({ models: [model({}), IPA] });
    useGallery.setState({ images: [{ name: 'a.png', url: 'novira-image://a.png' } as ImageDTO] });
    const { prompts } = mockQueue(301);
    expect(await makeSheet('a')).toBe(3);
    expect(prompts.map((p) => /three-quarter|from side|from behind/.exec(p)?.[0])).toEqual(['three-quarter', 'from side', 'from behind']);
    expect(Object.values(useComic.getState().sheetPending).map((p) => p.view)).toEqual(['threeQuarter', 'side', 'back']);
    expect(await makeSheet('a')).toBe(0);
    useComic.setState({ sheetPending: {} });
  });

  it('draws the front picture first when there is none, then the views from it', async () => {
    seed();
    useModels.setState({ models: [model({}), IPA] });
    const { prompts } = mockQueue(401);
    const making = makeSheet('a');
    await vi.waitFor(() => expect(prompts).toHaveLength(1));
    expect(prompts[0]).toContain('white background');
    // The item is bound to its portrait a moment after the queue answers.
    await new Promise((r) => setTimeout(r, 0));
    const item = useQueue.getState().items[0]!;
    useGallery.setState({ images: [{ name: 'grandpa.png', url: 'novira-image://grandpa.png' } as ImageDTO] });
    useQueue.setState({ items: [{ ...item, status: 'completed' }] });
    onComicImage(item, { name: 'grandpa.png', url: 'u' } as ImageDTO);
    expect(await making).toBe(4);
    expect(cast()[0]!.imageName).toBe('grandpa.png');
    expect(prompts).toHaveLength(5);
    useComic.setState({ sheetPending: {} });
  });

  it('asks for words first, and queues nothing for an unknown character', async () => {
    seed([{ ...A, tags: '', imageName: 'a.png' }]);
    const { spy } = mockQueue(501);
    expect(await makeSheet('a')).toBe(0);
    expect(await makeSheet('nobody')).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
});
