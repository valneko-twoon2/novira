import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ImageDTO, ModelConfig } from '@/backend';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { DEPTH_CONTROL, POSE_CONTROL } from '@/state/poseSkeleton';
import { t } from '@/i18n';
import { expandPrompt, randomPrompt } from '@/state/prompts/dynamicPrompts';
import { emptyPanel, newProject, type ComicCharacter, type ComicPoint } from './document';
import { newRough } from './rough';
import { CLOSE_PLACE_WEIGHT, characterRefs, comicPanelIds, portraitRequest, comicReadiness, comicWarnings, promptReason, drawablePanel, pagePanelIds, panelBatches, panelRequest, personWords, poseModelReady, regionLayers } from './request';
import { findPanel, useComic, type PanelRef } from './store';

const model = (over: Partial<ModelConfig>): ModelConfig => ({ key: 'main', name: 'Main', base: 'sdxl', type: 'main', ...over }) as ModelConfig;
const POSE_MODEL = model({ key: 'pose', name: 'OpenPose', base: 'sdxl', type: 'controlnet', path: 'openpose-sdxl.safetensors' });
const joints: ComicPoint[] = Array.from({ length: 18 }, () => ({ x: 0.5, y: 0.5 }));

const initialParams = useParams.getState();
const initialModels = useModels.getState();
const initialGallery = useGallery.getState();

/** A project with a page of two panels, the first one selected and given a prompt. */
function seedPage(prompt = 'a girl at a window') {
  const project = newProject('Test');
  // The style words are tested on their own below: a lone comma says none.
  project.style = { positive: ',', negative: ',' };
  project.pages[0]!.panels = [
    { ...project.pages[0]!.panels[0]!, prompt },
    { ...project.pages[0]!.panels[1]!, prompt: '' },
  ];
  useComic.getState().setProjects([project]);
  const panelId = project.pages[0]!.panels[0]!.id;
  useComic.getState().selectPanel(panelId);
  return { project, panelId };
}

function refOf(panelId: string): PanelRef {
  return findPanel(useComic.getState().projects, panelId)!;
}

beforeEach(() => {
  useParams.setState({ ...initialParams, modelKey: 'main', steps: 22, cfgScale: 6, shouldRandomizeSeed: false, seed: 42 }, true);
  useModels.setState({ ...initialModels, models: [model({}), POSE_MODEL] }, true);
  useGallery.setState({ ...initialGallery, images: [] }, true);
});

afterEach(() => {
  useParams.setState(initialParams, true);
  useModels.setState(initialModels, true);
  useGallery.setState(initialGallery, true);
});

describe('the style words of a comic', () => {
  it('puts the quality words of the model family before the prompt and the base negative before the panel negative', () => {
    const { project, panelId } = seedPage('a girl at a window');
    delete project.style;
    project.pages[0]!.panels[0]!.negativePrompt = 'hat';
    useComic.getState().setProjects([project]);
    const req = panelRequest(refOf(panelId), false);
    expect(req.params.positivePrompt).toMatch(/^masterpiece, best quality.*, a girl at a window$/);
    expect(req.params.negativePrompt).toMatch(/^worst quality, low quality, normal quality.*, 3d.*, chromatic aberration, hat$/);
    // The panels are drawn in colour (a page is made black and white by its effect): kept out, colour only washed out.
    expect(req.params.negativePrompt).not.toMatch(/\bcolou?r(ed)?\b|smooth shading/);
  });

  it('takes the comic\'s own words, and a page\'s own over them, each side apart', () => {
    const { project, panelId } = seedPage('a girl at a window');
    project.style = { positive: 'soft colours', negative: 'blur' };
    project.pages[0]!.style = { negative: 'text' };
    useComic.getState().setProjects([project]);
    const req = panelRequest(refOf(panelId), false);
    expect(req.params.positivePrompt).toBe('soft colours, a girl at a window');
    expect(req.params.negativePrompt).toBe('text');
  });
});

describe('the request that draws a panel', () => {
  it('sends the panel prompt with the Generate tab settings, one picture to the gallery', () => {
    const { panelId } = seedPage();
    const req = panelRequest(refOf(panelId), false);
    expect(req.origin).toBe('generate');
    expect(req.destination).toBe('gallery');
    expect(req.iterations).toBe(1);
    expect(req.prepend).toBe(false);
    expect(req.params).toMatchObject({
      generationMode: 'txt2img',
      positivePrompt: 'a girl at a window',
      modelKey: 'main',
      steps: 22,
      cfgScale: 6,
      seed: 42,
    });
    expect(req.controlLayers).toBeUndefined();
    expect(req.params.controlLayerCount).toBeUndefined();
  });

  it('draws at the shape of the panel: a single panel is the whole portrait page, so a portrait picture of about a megapixel', () => {
    const project = newProject('One');
    project.pages[0]!.panels = project.pages[0]!.panels.slice(0, 1);
    useComic.getState().setProjects([project]);
    const req = panelRequest(refOf(project.pages[0]!.panels[0]!.id), false);
    expect(req.params.height).toBeGreaterThan(req.params.width);
    expect(req.params.width * req.params.height).toBeGreaterThan(0.8 * 1024 * 1024);
  });

  it('adds the pose as a control layer, with the installed pose model, when the panel has a pose picture', () => {
    const { panelId } = seedPage();
    useGallery.setState({ images: [{ name: 'pose.png', url: 'novira://pose.png' } as ImageDTO] });
    useComic.getState().setPanelPose(panelId, [joints], 'pose.png');
    const req = panelRequest(refOf(panelId), true);
    expect(req.prepend).toBe(true);
    // The layer says it is a pose: a union ControlNet left to guess drew the stick figure as wires.
    expect(req.controlLayers).toEqual([
      {
        imageUrl: 'novira://pose.png',
        modelKey: 'pose',
        weight: POSE_CONTROL.weight,
        beginEnd: [...POSE_CONTROL.beginEnd],
        controlMode: 'balanced',
        controlType: 'openpose',
      },
    ]);
    expect(req.params.controlLayerCount).toBe(1);
    expect(comicWarnings()).toEqual([]);
  });

  it('leaves the pose out and says so when the pose model is not installed', () => {
    const { panelId } = seedPage();
    useGallery.setState({ images: [{ name: 'pose.png', url: 'novira://pose.png' } as ImageDTO] });
    useModels.setState({ models: [model({})] });
    useComic.getState().setPanelPose(panelId, [joints], 'pose.png');
    const req = panelRequest(refOf(panelId), false);
    expect(req.controlLayers).toBeUndefined();
    expect(comicWarnings()).toHaveLength(1);
  });

  it('leaves the pose out when its picture is gone from the gallery', () => {
    const { panelId } = seedPage();
    useComic.getState().setPanelPose(panelId, [joints], 'deleted.png');
    expect(panelRequest(refOf(panelId), false).controlLayers).toBeUndefined();
  });

  it('adds the depth map of a 3D rough after the pose, lightly and over the first steps, on the union ControlNet when it is the only one', () => {
    const { panelId } = seedPage();
    const union = model({ key: 'union', name: 'controlnet-union-sdxl-1.0', base: 'sdxl', type: 'controlnet', path: 'diffusion_pytorch_model.safetensors' });
    useModels.setState({ models: [model({}), union] });
    useGallery.setState({ images: ['rough-pose.png', 'rough-depth.png'].map((name) => ({ name, url: `novira://${name}` }) as ImageDTO) });
    useComic.getState().setPanelRough(panelId, newRough(), [joints], 'rough-pose.png', 'rough-depth.png');
    const req = panelRequest(refOf(panelId), false);
    expect(req.controlLayers).toEqual([
      { imageUrl: 'novira://rough-pose.png', modelKey: 'union', weight: POSE_CONTROL.weight, beginEnd: [...POSE_CONTROL.beginEnd], controlMode: 'balanced', controlType: 'openpose' },
      { imageUrl: 'novira://rough-depth.png', modelKey: 'union', weight: DEPTH_CONTROL.weight, beginEnd: [...DEPTH_CONTROL.beginEnd], controlMode: 'balanced', controlType: 'depth' },
    ]);
    expect(req.params.controlLayerCount).toBe(2);
    expect(comicWarnings()).toEqual([]);
  });

  it('takes a depth model over a union one, and says so when no model reads the depth map', () => {
    const { panelId } = seedPage();
    const depth = model({ key: 'depth', name: 'controlnet-depth-sdxl', base: 'sdxl', type: 'controlnet', path: 'depth-sdxl.safetensors' });
    const union = model({ key: 'union', name: 'promax', base: 'sdxl', type: 'controlnet', path: 'promax.safetensors' });
    useModels.setState({ models: [model({}), POSE_MODEL, union, depth] });
    useGallery.setState({ images: ['rough-pose.png', 'rough-depth.png'].map((name) => ({ name, url: `novira://${name}` }) as ImageDTO) });
    useComic.getState().setPanelRough(panelId, newRough(), [joints], 'rough-pose.png', 'rough-depth.png');
    expect(panelRequest(refOf(panelId), false).controlLayers?.map((l) => l.modelKey)).toEqual(['pose', 'depth']);
    useModels.setState({ models: [model({}), POSE_MODEL] });
    expect(panelRequest(refOf(panelId), false).controlLayers?.map((l) => l.controlType)).toEqual(['openpose']);
    expect(comicWarnings()).toEqual([t('comic.warning.noDepthModel')]);
  });

  it('leaves out a depth map baked for another shape of panel, and says to bake the rough again', () => {
    // A rough kept its pictures after the page's cut changed the panel's shape; the engine stretched the set out of place.
    const { panelId } = seedPage();
    const union = model({ key: 'union', name: 'controlnet-union-sdxl-1.0', base: 'sdxl', type: 'controlnet', path: 'diffusion_pytorch_model.safetensors' });
    useModels.setState({ models: [model({}), union] });
    useComic.getState().setPanelRough(panelId, newRough(), [joints], 'rough-pose.png', 'rough-depth.png');
    const { width, height } = panelRequest(refOf(panelId), false).params;
    const pictures = (w: number, h: number) =>
      useGallery.setState({ images: ['rough-pose.png', 'rough-depth.png'].map((name) => ({ name, url: `novira://${name}`, width: w, height: h }) as ImageDTO) });
    pictures(width * 2, height);
    expect(panelRequest(refOf(panelId), false).controlLayers?.map((l) => l.controlType)).toEqual(['openpose']);
    expect(comicWarnings()).toEqual([t('comic.warning.roughOutOfShape')]);
    pictures(width, height);
    expect(panelRequest(refOf(panelId), false).controlLayers?.map((l) => l.controlType)).toEqual(['openpose', 'depth']);
    expect(comicWarnings()).toEqual([]);
  });
});

describe('the prompts of a panel picture', () => {
  it('draws a panel from its own prompts only, not from the text in the prompt boxes', () => {
    const { panelId } = seedPage();
    useParams.setState({ positivePrompt: 'masterpiece', negativePrompt: 'blurry' });
    useComic.getState().setPanelNegative(panelId, ' text, watermark ');
    const req = panelRequest(refOf(panelId), false);
    expect(req.params).toMatchObject({ positivePrompt: 'a girl at a window', negativePrompt: 'text, watermark' });
    // A panel with no negative prompt of its own has none.
    const other = findPanel(useComic.getState().projects, useComic.getState().projects[0]!.pages[0]!.panels[1]!.id)!;
    expect(panelRequest(other, false).params.negativePrompt).toBe('');
  });
});

describe('the Generate settings in a panel picture', () => {
  it('carries the LoRAs, the VAE, the hires fix and the reference-free settings of Generate into the panel', () => {
    const { panelId } = seedPage();
    useParams.setState({
      vaeKey: 'vae-1',
      loras: [
        { key: 'lora-on', weight: 0.6, isEnabled: true },
        { key: 'lora-off', weight: 0.9, isEnabled: false },
      ],
      hires: { enabled: true, scale: 1.5, strength: 0.4, upscaleModelKey: null, steps: 0 },
    });
    const req = panelRequest(refOf(panelId), false);
    expect(req.params.vaeKey).toBe('vae-1');
    expect(req.params.loras).toEqual([{ key: 'lora-on', weight: 0.6, isEnabled: true }]);
    expect(req.params.hiresFix).toEqual({ scale: 1.5, strength: 0.4 });
  });

  it('sizes the picture by the panel even when Generate has its own size', () => {
    const { panelId } = seedPage();
    useParams.setState({ width: 512, height: 768 });
    const req = panelRequest(refOf(panelId), false);
    expect(req.params.width).not.toBe(512);
    expect(req.params.width).toBeGreaterThan(0);
  });
});

describe('readiness of the comic screen', () => {
  it('needs a model, a selected panel and a prompt in that panel', () => {
    seedPage('');
    expect(comicReadiness()).toEqual([expect.any(String)]);
    expect(comicReadiness()).toHaveLength(1);
    useComic.getState().setPrompt(useComic.getState().selectedPanelId!, 'x');
    expect(comicReadiness()).toEqual([]);
  });

  it('names the missing prompt for the scope now, and nothing once there is one', () => {
    seedPage('');
    expect(promptReason()).toBe(t('comic.readiness.noPrompt', { number: 1 }));
    useComic.getState().setDrawScope('page');
    expect(promptReason()).toBe(t('comic.readiness.noPrompts'));
    useComic.getState().setDrawScope('comic');
    expect(promptReason()).toBe(t('comic.readiness.noPromptsComic'));
    const page = useComic.getState().projects[0]!.pages[0]!;
    useComic.getState().setPrompt(page.panels[1]!.id, 'x');
    expect(promptReason()).toBeNull();
    useComic.getState().setDrawScope('panel');
    useComic.getState().selectPanel(page.panels[1]!.id);
    expect(promptReason()).toBeNull();
  });

  it('reports no model, and no panel only when there is no page to draw on', () => {
    useParams.setState({ modelKey: null });
    seedPage('x');
    // With no panel selected, the draw button works on the page's first panel (see workPanel).
    useComic.getState().selectPanel(null);
    expect(comicReadiness()).toEqual([t('comic.readiness.noModel')]);
    useComic.getState().setProjects([]);
    expect(comicReadiness()).toEqual([t('comic.readiness.noModel'), t('comic.readiness.noPanel')]);
  });

  it('for the whole page needs only one panel with a prompt, whether or not a panel is selected', () => {
    seedPage('');
    useComic.getState().setDrawScope('page');
    useComic.getState().selectPanel(null);
    expect(comicReadiness()).toEqual([t('comic.readiness.noPrompts')]);
    const page = useComic.getState().projects[0]!.pages[0]!;
    useComic.getState().setPrompt(page.panels[1]!.id, 'x');
    useComic.getState().selectPanel(null);
    expect(comicReadiness()).toEqual([]);
    expect(pagePanelIds()).toEqual([page.panels[1]!.id]);
    // The panel scope works on the first panel when none is selected, and that one has no prompt.
    useComic.getState().setDrawScope('panel');
    expect(comicReadiness()).toEqual([t('comic.readiness.noPrompt', { number: 1 })]);
  });

  it('for the whole comic needs a prompt on any page, and names the panels of every page in reading order', () => {
    seedPage('');
    useComic.getState().setDrawScope('comic');
    expect(comicReadiness()).toEqual([t('comic.readiness.noPromptsComic')]);
    const project = useComic.getState().projects[0]!;
    useComic.getState().selectPage(useComic.getState().addPage()!);
    const second = useComic.getState().projects[0]!.pages[1]!;
    useComic.getState().setPrompt(second.panels[0]!.id, 'y');
    useComic.getState().setPrompt(project.pages[0]!.panels[1]!.id, 'x');
    // Nothing on the page on screen has a prompt, yet the comic is ready: the first page has one.
    expect(comicReadiness()).toEqual([]);
    expect(comicPanelIds()).toEqual([project.pages[0]!.panels[1]!.id, second.panels[0]!.id]);
    useComic.getState().setDrawScope('panel');
  });

  it('knows whether a pose model is installed for the chosen model', () => {
    expect(poseModelReady()).toBe(true);
    useModels.setState({ models: [model({})] });
    expect(poseModelReady()).toBe(false);
  });

  it('draws only a panel that has a prompt', () => {
    const { project } = seedPage();
    expect(drawablePanel(project.pages[0]!.panels[0]!.id)).not.toBeNull();
    expect(drawablePanel(project.pages[0]!.panels[1]!.id)).toBeNull();
    expect(drawablePanel('missing')).toBeNull();
  });
});

describe('the dynamic prompts of a panel picture', () => {
  it('draws the random mode with the combination its seed picks, and keeps that seed', () => {
    const { panelId } = seedPage('a {red|blue} cat');
    useParams.setState({ dynamicPromptMode: 'random', positivePrompt: '', seed: 42, shouldRandomizeSeed: false });
    const req = panelRequest(refOf(panelId), false);
    expect(expandPrompt('a {red|blue} cat')).toContain(req.params.positivePrompt);
    expect(req.params.seed).toBe(42);
    expect(req.randomizeSeed).toBe(false);
    expect(panelRequest(refOf(panelId), false).params.positivePrompt).toBe(req.params.positivePrompt);
  });

  it('fixes a seed of its own when the seed is random, so the prompt it picked stays with the picture', () => {
    const { panelId } = seedPage('a {red|blue} cat');
    useParams.setState({ dynamicPromptMode: 'random', positivePrompt: '', shouldRandomizeSeed: true });
    const req = panelRequest(refOf(panelId), false);
    expect(req.randomizeSeed).toBe(false);
    expect(req.params.positivePrompt).toBe(randomPrompt('a {red|blue} cat', {}, req.params.seed));
  });

  it('takes the first combination in the combinations mode, and says how many there are', () => {
    const { panelId } = seedPage('a {red|blue} cat');
    useParams.setState({ dynamicPromptMode: 'combinatorial', positivePrompt: '' });
    expect(panelRequest(refOf(panelId), false).params.positivePrompt).toBe('a red cat');
    expect(comicWarnings()).toEqual([t('comic.warning.combinations', { count: 2 })]);
  });

  it('draws a prompt without dynamic syntax as it is typed, with no warning', () => {
    const { panelId } = seedPage('a red cat');
    useParams.setState({ dynamicPromptMode: 'combinatorial', positivePrompt: '' });
    expect(panelRequest(refOf(panelId), false).params.positivePrompt).toBe('a red cat');
    expect(comicWarnings()).toEqual([]);
  });
});

describe('the batches of a panel with combinations', () => {
  it('draws the first combination in the panel, and each further one as a batch of its own', () => {
    const { panelId } = seedPage('a {red|blue|green} cat');
    useParams.setState({ dynamicPromptMode: 'combinatorial', positivePrompt: '' });
    const batches = panelBatches(refOf(panelId), false);
    expect(batches.map((b) => b.params.positivePrompt)).toEqual(['a red cat', 'a blue cat', 'a green cat']);
    expect(batches.every((b) => b.iterations === 1 && b.destination === 'gallery')).toBe(true);
  });

  it('puts the style words in front of every combination, and counts them in the warning', () => {
    const { project, panelId } = seedPage('a {red|blue} cat');
    project.style = { positive: 'soft light', negative: ',' };
    useComic.getState().setProjects([project]);
    useParams.setState({ dynamicPromptMode: 'combinatorial', positivePrompt: '' });
    expect(panelBatches(refOf(panelId), false).map((b) => b.params.positivePrompt)).toEqual(['soft light, a red cat', 'soft light, a blue cat']);
    // A style that holds combinations of its own makes more pictures than the prompt alone, and the warning says so.
    project.style = { positive: '{soft|hard} light', negative: ',' };
    useComic.getState().setProjects([project]);
    expect(panelBatches(refOf(panelId), false)).toHaveLength(4);
    expect(comicWarnings()).toEqual([t('comic.warning.combinations', { count: 4 })]);
  });

  it('keeps the settings of the panel in every batch', () => {
    const { panelId } = seedPage('a {red|blue} cat');
    useParams.setState({ dynamicPromptMode: 'combinatorial', positivePrompt: '', seed: 7, shouldRandomizeSeed: false });
    const [first, second] = panelBatches(refOf(panelId), true);
    expect(second!.prepend).toBe(true);
    expect(second!.params).toMatchObject({ ...first!.params, positivePrompt: 'a blue cat' });
  });

  it('is one batch when the prompt has no combinations, or the random mode picks one', () => {
    const { panelId } = seedPage('a red cat');
    useParams.setState({ dynamicPromptMode: 'combinatorial', positivePrompt: '' });
    expect(panelBatches(refOf(panelId), false)).toHaveLength(1);
    useParams.setState({ dynamicPromptMode: 'random' });
    const { panelId: other } = seedPage('a {red|blue} cat');
    expect(panelBatches(refOf(other), false)).toHaveLength(1);
  });
});

describe('the characters of a panel', () => {
  const withCast = () => {
    const { project, panelId } = seedPage('sitting on a bench, smiling');
    const grandpa = { id: 'c1', name: 'Grandpa', tags: '1boy, old man, white hair, flat cap, beige cardigan', imageName: null };
    const dog = { id: 'c2', name: 'Goro', tags: '1dog, shiba inu, red collar', imageName: null };
    useComic.getState().setCast([grandpa, dog]);
    return { project, panelId, grandpa, dog };
  };

  it('puts the words of the characters in the panel in front of its prompt, as written and in the cast order', () => {
    const { panelId, grandpa, dog } = withCast();
    useComic.getState().setPanelCast(panelId, [dog.id, grandpa.id]);
    expect(panelRequest(refOf(panelId), false).params.positivePrompt).toBe(`${grandpa.tags}, ${dog.tags}, sitting on a bench, smiling`);
  });

  it('names only the parts of a character that the panel framing shows', () => {
    const { panelId } = withCast();
    const mio = { id: 'c3', name: 'Mio', tags: '1girl', parts: { hair: 'long black hair', eyes: 'green eyes', outfit: 'navy blazer' }, imageName: null };
    useComic.getState().setCast([mio]);
    useComic.getState().setPanelCast(panelId, [mio.id]);
    useComic.getState().setPrompt(panelId, 'close-up, smiling');
    expect(panelRequest(refOf(panelId), false).params.positivePrompt).toBe('1girl, long black hair, green eyes, close-up, smiling');
    useComic.getState().setPrompt(panelId, 'full body, walking');
    expect(panelRequest(refOf(panelId), false).params.positivePrompt).toContain('navy blazer');
  });

  it('leaves the prompt alone for a panel with no character, and ignores a character that is not in the cast', () => {
    const { panelId } = withCast();
    expect(panelRequest(refOf(panelId), false).params.positivePrompt).toBe('sitting on a bench, smiling');
    useComic.getState().setPanelCast(panelId, ['gone']);
    expect(panelRequest(refOf(panelId), false).params.positivePrompt).toBe('sitting on a bench, smiling');
  });

  it('still needs the panel\'s own prompt to be drawn', () => {
    const { project, grandpa } = withCast();
    const second = project.pages[0]!.panels[1]!.id;
    useComic.getState().setPanelCast(second, [grandpa.id]);
    expect(drawablePanel(second)).toBeNull();
  });
});

describe('the place of a panel and the world of the comic', () => {
  const room = { id: 'room', name: 'Mio room', tags: 'bedroom, wooden desk, desk lamp, night', negative: 'window' };
  const withPlaces = (prompt = '1girl, solo, sitting, reading') => {
    const { panelId } = seedPage(prompt);
    useComic.getState().setPlaces([room, { id: 'pier', name: 'Pier', tags: 'pier, sea, sunset' }]);
    return panelId;
  };

  it('puts the words of the panel place after its prompt, the world last, and what the place keeps out into the negative', () => {
    const panelId = withPlaces();
    const mio = { id: 'c1', name: 'Mio', tags: '1girl, black bob', imageName: null };
    useComic.getState().setCast([mio]);
    useComic.getState().setPanelCast(panelId, [mio.id]);
    useComic.getState().setPanelPlace(panelId, 'room');
    useComic.getState().setWorld('summer, seaside town, 1990s');
    useComic.getState().setPanelNegative(panelId, 'hat');
    const req = panelRequest(refOf(panelId), false);
    expect(req.params.positivePrompt).toBe('1girl, black bob, 1girl, solo, sitting, reading, bedroom, wooden desk, desk lamp, night, summer, seaside town, 1990s');
    expect(req.params.negativePrompt).toBe('hat, window');
  });

  it('gives a panel without a place only the world, and adds nothing for a place that is gone or a world with no word', () => {
    const panelId = withPlaces();
    useComic.getState().setWorld('summer');
    expect(panelRequest(refOf(panelId), false).params.positivePrompt).toBe('1girl, solo, sitting, reading, summer');
    useComic.getState().setPanelPlace(panelId, 'pier');
    useComic.getState().setPlaces([room]);
    useComic.getState().setWorld('  ');
    const req = panelRequest(refOf(panelId), false);
    expect(req.params.positivePrompt).toBe('1girl, solo, sitting, reading');
    expect(req.params.negativePrompt).toBe('');
  });

  it('gives a close-up its place words more weakly, and the world as it is', () => {
    const panelId = withPlaces('1girl, extreme close-up of her hand on the button');
    useComic.getState().setPanelPlace(panelId, 'room');
    useComic.getState().setWorld('summer');
    expect(panelRequest(refOf(panelId), false).params.positivePrompt).toBe(
      `1girl, extreme close-up of her hand on the button, (bedroom, wooden desk, desk lamp, night:${CLOSE_PLACE_WEIGHT}), summer`,
    );
    // An upper-body shot is not a close-up.
    useComic.getState().setPrompt(panelId, '1girl, upper body, reading');
    expect(panelRequest(refOf(panelId), false).params.positivePrompt).toBe('1girl, upper body, reading, bedroom, wooden desk, desk lamp, night, summer');
  });

  it('keeps the place in the whole prompt when the characters are drawn in regions', () => {
    const panelId = withPlaces('two teenagers on a rooftop');
    useComic.getState().setCast([{ id: 'boy', name: 'Jin', tags: '1boy', imageName: null }]);
    useComic.getState().setPanelCast(panelId, ['boy']);
    useComic.getState().setPanelPlace(panelId, 'pier');
    const regions = [{ character: { id: 'boy', name: 'Jin', tags: '1boy', imageName: null }, imageUrl: 'novira-image://r-boy.png' }];
    expect(panelRequest(refOf(panelId), false, regions).params.positivePrompt).toBe('two teenagers on a rooftop, pier, sea, sunset');
  });
});

describe('the reference pictures of a panel characters', () => {
  const IPA = model({ key: 'ipa', name: 'IP-Adapter SDXL', base: 'sdxl', type: 'ip_adapter', path: 'ip-adapter_sdxl_vit-h.safetensors' });
  const picture = (name: string) => ({ name, url: 'novira-image://' + name }) as ImageDTO;
  function seedCast(images: (string | null)[], castReference?: number) {
    const { project, panelId } = seedPage('sitting on a bench, smiling');
    const characters = images.map((imageName, i) => ({ id: 'c' + i, name: 'C' + i, tags: 'tag' + i, imageName }));
    useComic.getState().setCast(characters);
    useComic.getState().setPanelCast(panelId, characters.map((c) => c.id));
    useComic.getState().setCastReference(project.id, castReference);
    useModels.setState({ models: [model({}), POSE_MODEL, IPA] });
    useGallery.setState({ images: images.flatMap((n) => (n ? [picture(n)] : [])) });
    return { project, panelId };
  }

  // On a real engine the adapter made the panels dull and carried the reference's plain background into them.
  it('uses no character picture unless the comic turns its references on, and keeps the CFG scale', () => {
    const { panelId } = seedCast(['a.png']);
    useParams.setState({ cfgScale: 7 });
    const req = panelRequest(refOf(panelId), false);
    expect(req.refImages).toBeUndefined();
    expect(req.params.refImageCount ?? 0).toBe(0);
    expect(req.params.cfgScale).toBe(7);
  });

  it('sends each character picture as a light IP-Adapter reference over the first steps, and keeps the CFG scale', () => {
    const { panelId } = seedCast(['a.png'], 0.4);
    useParams.setState({ cfgScale: 7 });
    const req = panelRequest(refOf(panelId), false);
    expect(req.refImages).toEqual([expect.objectContaining({ imageUrl: 'novira-image://a.png', modelKey: 'ipa', weight: 0.4, beginEnd: [0, 0.6], method: 'full', clipVisionModel: 'ViT-H' })]);
    expect(req.params.refImageCount).toBe(1);
    expect(req.params.cfgScale).toBe(7);
  });

  it('shares the weight between several characters, and skips pictures that are gone, the own picture of the panel and an absent model', () => {
    const { panelId } = seedCast(['a.png', 'b.png', 'gone.png', null], 0.6);
    useGallery.setState({ images: [picture('a.png'), picture('b.png')] });
    const refs = characterRefs(refOf(panelId).panel, refOf(panelId).project);
    expect(refs.map((r) => r.imageUrl)).toEqual(['novira-image://a.png', 'novira-image://b.png']);
    expect(refs[0]!.weight).toBeCloseTo(0.42, 2);
    useComic.getState().setPanelImage(panelId, 'a.png');
    expect(characterRefs(refOf(panelId).panel, refOf(panelId).project)).toHaveLength(1);
    useModels.setState({ models: [model({}), POSE_MODEL] });
    expect(characterRefs(refOf(panelId).panel, refOf(panelId).project)).toEqual([]);
    expect(panelRequest(refOf(panelId), false).refImages).toBeUndefined();
  });
});

describe('a panel drawn in the regions of its characters', () => {
  const IPA = model({ key: 'ipa', name: 'IP-Adapter SDXL', base: 'sdxl', type: 'ip_adapter', path: 'ip-adapter_sdxl_vit-h.safetensors' });
  const picture = (name: string) => ({ name, url: 'novira-image://' + name }) as ImageDTO;
  function seed() {
    const { panelId } = seedPage('two teenagers on a rooftop');
    const boy = { id: 'boy', name: 'Jin', tags: '1boy, black gakuran', imageName: 'boy.png' };
    const monster = { id: 'kage', name: 'Kage', tags: 'ink black monster', imageName: 'kage.png', nonHuman: true };
    useComic.getState().setCast([boy, monster]);
    useComic.getState().setPanelCast(panelId, ['boy', 'kage']);
    useComic.getState().setCastReference(useComic.getState().projects[0]!.id, 0.4);
    useModels.setState({ models: [model({}), POSE_MODEL, IPA] });
    useGallery.setState({ images: [picture('boy.png'), picture('kage.png')] });
    return panelId;
  }
  const regions = [
    { character: { id: 'boy', name: 'Jin', tags: '1boy, black gakuran', imageName: 'boy.png' }, imageUrl: 'novira-image://r-boy.png' },
    { character: { id: 'kage', name: 'Kage', tags: 'ink black monster', imageName: 'kage.png', nonHuman: true }, imageUrl: 'novira-image://r-kage.png' },
  ];

  it('says each character in its own region, with its reference picture masked to it, and keeps the words out of the whole prompt', () => {
    const panelId = seed();
    const req = panelRequest(refOf(panelId), false, regions);
    expect(req.params.positivePrompt).toBe('two teenagers on a rooftop');
    expect(req.regionalLayers).toEqual([
      { imageUrl: 'novira-image://r-boy.png', positivePrompt: '1boy, black gakuran', negativePrompt: null, autoNegative: true },
      { imageUrl: 'novira-image://r-kage.png', positivePrompt: 'ink black monster', negativePrompt: null, autoNegative: true },
    ]);
    expect(req.params.regionalGuidanceCount).toBe(2);
    expect(req.refImages?.map((r) => [r.imageUrl, r.regionImageUrl])).toEqual([
      ['novira-image://boy.png', 'novira-image://r-boy.png'],
      ['novira-image://kage.png', 'novira-image://r-kage.png'],
    ]);
  });

  it('without regions leaves the creature reference out when a person shares the panel, and keeps its words', () => {
    const panelId = seed();
    const req = panelRequest(refOf(panelId), false);
    expect(req.refImages?.map((r) => r.imageUrl)).toEqual(['novira-image://boy.png']);
    expect(req.refImages?.[0]?.regionImageUrl).toBeUndefined();
    expect(req.params.positivePrompt).toContain('ink black monster');
    expect(req.regionalLayers).toBeUndefined();
  });
});

describe('the request that draws a character reference picture', () => {
  it('draws the tags alone on a plain background, with no pose and no reference, and nothing for a character without tags', () => {
    const req = portraitRequest({ id: 'a', name: 'Grandpa', tags: '1boy, old man', imageName: 'old.png' })!;
    expect(req.params.positivePrompt).toMatch(/^1boy, old man, solo/);
    expect(req.params.positivePrompt).toContain('white background');
    expect(req.params.negativePrompt).toContain('multiple views');
    expect(req.params).toMatchObject({ width: 1024, height: 1024 });
    expect(req.refImages).toBeUndefined();
    expect(req.controlLayers).toBeUndefined();
    expect(portraitRequest({ id: 'b', name: 'Nobody', tags: '  ', imageName: null })).toBeNull();
  });
});

describe('what each person does, in their region', () => {
  const character = (id: string, tags: string): ComicCharacter => ({ id, name: id, tags, imageName: null });

  it('puts the words of the person drawn as the character after its looks, in its own region only', () => {
    const panel = { ...emptyPanel(), cast: ['a', 'b'], poseCast: ['b', 'a'], poseWords: ['sitting, drinking tea', 'holding a tray'] };
    expect(personWords(panel, 'a')).toBe('holding a tray');
    expect(personWords(panel, 'z')).toBe('');
    const layers = regionLayers(panel, [
      { character: character('a', '1girl'), imageUrl: 'ra' },
      { character: character('b', '1boy'), imageUrl: 'rb' },
    ]);
    expect(layers.map((l) => l.positivePrompt)).toEqual(['1girl, holding a tray', '1boy, sitting, drinking tea']);
  });

  it('leaves a region with the looks alone when the panel keeps no words for that person', () => {
    expect(regionLayers({ ...emptyPanel(), cast: ['a'] }, [{ character: character('a', '1girl'), imageUrl: 'ra' }])[0]!.positivePrompt).toBe('1girl');
  });
});
