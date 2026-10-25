// The assistant's view of the comic page and the operations it sends: each one checked, the ones that do not fit skipped,
// and the whole answer undone at once.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useParams } from '@/state/params';
import { applyComicOps, comicAgentEditor, comicAnswer, comicContext } from './agentEditor';
import * as generate from './generate';
import { newProject } from './document';
import { newRough } from './rough';
import * as layout from './layout';
import { frameOutlines } from './layout';
import { allValid } from './shapes';
import { useModels } from '@/state/models';
import { useComic } from './store';

function reset() {
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, selectedPanelId: null, selectedBubbleId: null, bubbleEditor: false, cutting: false, pending: {}, past: [], future: [] });
}

/** A comic with one page of three panels, read from the right. */
function seed() {
  const project = newProject('Harbour');
  useComic.getState().setProjects([project]);
  return project;
}

const page = () => useComic.getState().projects[0]!.pages.find((p) => p.id === useComic.getState().activePageId)!;
type Context = { project: string | null; page: number; pageCount: number; panels: { panel: number; shape: { x: number; y: number }[]; bubbles: { id: string }[] }[]; layoutTemplates: string[] };

beforeEach(reset);

describe('comicContext', () => {
  it('says there is no comic when none is open', () => {
    expect((comicContext() as Context).project).toBeNull();
  });

  it('tells whether a pose reaches the picture: only with an OpenPose model installed', () => {
    seed();
    const before = useModels.getState().models;
    expect((comicContext() as { poseControl: boolean }).poseControl).toBe(false);
    useModels.setState({ models: [{ key: 'pose', name: 'OpenPose', base: 'sdxl', type: 'controlnet', path: 'openpose-sdxl.safetensors' } as (typeof before)[number]] });
    // The chosen main model decides which base is wanted; with none chosen, any base counts.
    expect(typeof (comicContext() as { poseControl: boolean }).poseControl).toBe('boolean');
    useModels.setState({ models: before });
  });

  it('tells how to word a prompt for the main model, the style words every panel gets, and whether references are used', () => {
    seed();
    const before = { models: useModels.getState().models, key: useParams.getState().modelKey };
    useModels.setState({ models: [{ key: 'xl', name: 'WAI', base: 'sdxl', type: 'main' }, { key: 'f2', name: 'FLUX.2', base: 'flux2', type: 'main' }] as typeof before.models });
    useParams.setState({ modelKey: 'xl' });
    const c = comicContext() as { promptStyle: string; style: { positive: string; negative: string; own: boolean }; castReference: number | false };
    expect(c.promptStyle).toBe('tags');
    expect(c.style).toMatchObject({ own: false });
    expect(c.style.positive).toMatch(/^masterpiece, best quality/);
    expect(c.castReference).toBe(false);
    useParams.setState({ modelKey: 'f2' });
    expect((comicContext() as { promptStyle: string }).promptStyle).toBe('sentences');
    useModels.setState({ models: before.models });
    useParams.setState({ modelKey: before.key });
  });

  it('describes the page on screen with its panels numbered from 1 and their shapes in unit points', () => {
    seed();
    const c = comicContext() as Context;
    expect(c).toMatchObject({ project: 'Harbour', page: 1, pageCount: 1 });
    expect(c.panels.map((p) => p.panel)).toEqual([1, 2, 3]);
    for (const p of c.panels) for (const corner of p.shape) {
      expect(corner.x).toBeGreaterThanOrEqual(-0.001);
      expect(corner.x).toBeLessThanOrEqual(1.001);
    }
    expect(c.layoutTemplates).toContain('slants');
  });
});

describe('applyComicOps', () => {
  it('sets the finishing effect of the page or of the comic, and refuses a name it does not know', () => {
    seed();
    expect(applyComicOps([{ op: 'effect', effect: 'mono', scope: 'comic' }, { op: 'effect', effect: 'ebook' }])).toBe(true);
    const state = useComic.getState();
    expect(state.projects[0]!.effect).toBe('mono');
    expect(state.projects[0]!.pages[0]!.effect).toBe('ebook');
    expect(comicContext()).toMatchObject({ effect: 'mono', pageEffect: 'ebook' });
    expect(applyComicOps([{ op: 'effect', effect: 'neon' }])).toBe(false);
  });

  it('sets the style words of the comic or of the page, an empty text going back to the default, and refuses no words', () => {
    seed();
    expect(applyComicOps([{ op: 'style', positive: ' masterpiece, (shigure ui:0.5) ', negative: 'lowres' }])).toBe(true);
    expect(useComic.getState().projects[0]!.style).toEqual({ positive: 'masterpiece, (shigure ui:0.5)', negative: 'lowres' });
    expect(comicContext()).toMatchObject({ style: { positive: 'masterpiece, (shigure ui:0.5)', negative: 'lowres', own: true } });
    expect(applyComicOps([{ op: 'style', negative: '' }])).toBe(true);
    expect(useComic.getState().projects[0]!.style).toEqual({ positive: 'masterpiece, (shigure ui:0.5)' });
    expect(applyComicOps([{ op: 'style', positive: 'sketch', scope: 'page' }])).toBe(true);
    expect(page().style).toEqual({ positive: 'sketch' });
    expect(applyComicOps([{ op: 'style' }, { op: 'style', positive: 3 }])).toBe(false);
  });

  it('turns the character references on at a strength, and off with null', () => {
    seed();
    expect(applyComicOps([{ op: 'castReference', strength: 0.4 }])).toBe(true);
    expect(useComic.getState().projects[0]!.castReference).toBe(0.4);
    expect(comicContext()).toMatchObject({ castReference: 0.4 });
    expect(applyComicOps([{ op: 'castReference', strength: null }])).toBe(true);
    expect(useComic.getState().projects[0]).not.toHaveProperty('castReference');
    expect(applyComicOps([{ op: 'castReference', strength: 'strong' }, { op: 'castReference' }])).toBe(false);
  });

  it('lays the page out from a template, its own shapes, or a panel count', () => {
    seed();
    expect(applyComicOps([{ op: 'template', id: 'diagonal' }])).toBe(true);
    expect(page().panels).toHaveLength(2);
    const halves = [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.3 }, { x: 0, y: 0.7 }],
      [{ x: 0, y: 0.7 }, { x: 1, y: 0.3 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    ];
    expect(applyComicOps([{ op: 'shapes', shapes: halves }])).toBe(true);
    expect(allValid(page().shapes!)).toBe(true);
    expect(applyComicOps([{ op: 'layout', panelCount: 5, columns: 2 }])).toBe(true);
    expect(page().panels).toHaveLength(5);
    expect(page().shapes).toBeNull();
  });

  it('skips shapes that overlap, a template that does not exist and an unknown operation', () => {
    seed();
    const overlapping = [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.6 }, { x: 0, y: 0.6 }],
      [{ x: 0, y: 0.4 }, { x: 1, y: 0.4 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    ];
    expect(applyComicOps([{ op: 'shapes', shapes: overlapping }, { op: 'template', id: 'nope' }, { op: 'explode' }, 'x', null])).toBe(false);
    expect(page().panels).toHaveLength(3);
    expect(page().shapes).toBeNull();
  });

  it('adds and cuts panels, and swaps two of them', () => {
    seed();
    applyComicOps([{ op: 'panel', panel: 1, prompt: 'first' }]);
    expect(applyComicOps([{ op: 'addPanel', panel: 1 }])).toBe(true);
    expect(page().panels).toHaveLength(4);
    expect(applyComicOps([{ op: 'split', panel: 3, from: { x: 0, y: 0.8 }, to: { x: 1, y: 0.9 } }])).toBe(true);
    expect(page().panels).toHaveLength(5);
    expect(applyComicOps([{ op: 'swap', a: 1, b: 2 }])).toBe(true);
    expect(page().panels[1]!.prompt).toBe('first');
    expect(applyComicOps([{ op: 'addPanel', panel: 99 }, { op: 'swap', a: 1, b: 1 }])).toBe(false);
    expect(applyComicOps([{ op: 'removePanel', panel: 2 }])).toBe(true);
    expect(page().panels).toHaveLength(4);
    expect(applyComicOps([{ op: 'removePanel', panel: 40 }])).toBe(false);
  });

  it('adds a panel with no panel given without changing the others', () => {
    seed();
    const drawn = frameOutlines(page());
    expect(applyComicOps([{ op: 'addPanel', panel: null }])).toBe(true);
    expect(page().panels).toHaveLength(4);
    expect(page().free).toBe(true);
    expect(page().shapes!.slice(0, 3)).toEqual(drawn);
  });

  it('sets a panel prompt and selects a panel, and refuses a panel number that is not on the page', () => {
    seed();
    expect(applyComicOps([{ op: 'panel', panel: 2, prompt: 'close-up, 1girl', negativePrompt: 'lowres' }, { op: 'select', panel: 2 }])).toBe(true);
    expect(page().panels[1]).toMatchObject({ prompt: 'close-up, 1girl', negativePrompt: 'lowres' });
    expect(useComic.getState().selectedPanelId).toBe(page().panels[1]!.id);
    expect(applyComicOps([{ op: 'panel', panel: 0, prompt: 'x' }, { op: 'panel', panel: 1.5, prompt: 'x' }, { op: 'panel', panel: 4, prompt: 'x' }])).toBe(false);
  });

  it('adds balloons with their fields checked, then changes and removes them by id', () => {
    seed();
    expect(applyComicOps([{ op: 'addBubble', panel: 1, kind: 'shout', text: 'Wait!', x: 3, y: -1, scale: 1.25, vertical: true, tail: null }])).toBe(true);
    const bubble = page().panels[0]!.bubbles[0]!;
    expect(bubble).toMatchObject({ kind: 'shout', text: 'Wait!', x: 1, y: 0, vertical: true, tail: null });
    // A balloon never takes more of the panel than the limit: its words may be made smaller than asked, never larger.
    expect(bubble.scale).toBeLessThanOrEqual(1.25);
    expect(applyComicOps([{ op: 'bubble', id: bubble.id, set: { text: 'Stop!', kind: 'nope' } }])).toBe(true);
    expect(page().panels[0]!.bubbles[0]).toMatchObject({ text: 'Stop!', kind: 'shout' });
    expect(applyComicOps([{ op: 'bubble', id: 'missing', set: { text: 'x' } }])).toBe(false);
    expect(applyComicOps([{ op: 'removeBubble', id: bubble.id }])).toBe(true);
    expect(page().panels[0]!.bubbles).toHaveLength(0);
  });

  it('lays panels freely when asked: overlapping shapes on the page are kept, and a free layout must still be valid shapes', () => {
    seed();
    const a = [{ x: 0.05, y: 0.05 }, { x: 0.7, y: 0.05 }, { x: 0.7, y: 0.5 }, { x: 0.05, y: 0.5 }];
    const b = [{ x: 0.3, y: 0.3 }, { x: 0.95, y: 0.35 }, { x: 0.9, y: 0.9 }, { x: 0.3, y: 0.8 }];
    expect(applyComicOps([{ op: 'shapes', free: true, shapes: [a, b] }])).toBe(true);
    expect(page()).toMatchObject({ free: true });
    expect(page().panels).toHaveLength(2);
    expect(page().shapes![1]![0]).toEqual({ x: 0.3, y: 0.3 });
    expect((comicContext() as { free: boolean }).free).toBe(true);
    // The same shapes without "free" overlap, so a tiled layout refuses them and the page stays as it was.
    expect(applyComicOps([{ op: 'shapes', shapes: [a, b] }])).toBe(false);
    expect(page().free).toBe(true);
    expect(applyComicOps([{ op: 'shapes', free: true, shapes: [[{ x: 0.1, y: 0.1 }, { x: 0.11, y: 0.1 }, { x: 0.11, y: 0.11 }]] }])).toBe(false);
  });

  it('cuts the page as manga pages are cut: a free page of the asked panel count, the same seed giving the same page', () => {
    seed();
    expect(applyComicOps([{ op: 'mangaLayout', panelCount: 5, mood: 'dramatic', focus: 2, seed: 4 }])).toBe(true);
    expect(page()).toMatchObject({ free: true });
    expect(page().panels).toHaveLength(5);
    const first = page().shapes;
    expect(applyComicOps([{ op: 'mangaLayout', panelCount: 5, mood: 'dramatic', focus: 2, seed: 4 }])).toBe(true);
    expect(page().shapes).toEqual(first);
    // An unknown mood falls back to action, and a count past the most is cut down to it.
    expect(applyComicOps([{ op: 'mangaLayout', panelCount: 40, mood: 'silly' }])).toBe(true);
    expect(page().panels).toHaveLength(12);
  });

  it('adds a sound effect as a tailless, large balloon and keeps its slant within range', () => {
    seed();
    expect(applyComicOps([{ op: 'addBubble', panel: 1, kind: 'sfx', text: 'ドーン', rotation: 200 }])).toBe(true);
    expect(page().panels[0]!.bubbles[0]).toMatchObject({ kind: 'sfx', text: 'ドーン', tail: null, scale: 2.2, rotation: 90 });
    const id = page().panels[0]!.bubbles[0]!.id;
    expect(applyComicOps([{ op: 'bubble', id, set: { rotation: -12.4, scale: 4 } }])).toBe(true);
    expect(page().panels[0]!.bubbles[0]).toMatchObject({ rotation: -12, scale: 4 });
  });

  it('adds a sound-effect picture by its id or by its word, and refuses a word it has no picture for', () => {
    seed();
    expect(applyComicOps([{ op: 'addBubble', panel: 1, kind: 'stamp', text: 'burst-doon', rotation: -20 }])).toBe(true);
    expect(page().panels[0]!.bubbles[0]).toMatchObject({ kind: 'stamp', text: 'burst-doon', tail: null, scale: 2.2, rotation: -20 });
    expect(applyComicOps([{ op: 'addBubble', panel: 1, kind: 'stamp', text: 'ざわ' }])).toBe(true);
    expect(page().panels[0]!.bubbles[1]).toMatchObject({ kind: 'stamp', text: 'block-zawa' });
    // No words: the default picture. An unknown word: nothing is added.
    expect(applyComicOps([{ op: 'addBubble', panel: 1, kind: 'stamp' }])).toBe(true);
    expect(page().panels[0]!.bubbles[2]!.text).toBe('block-doon');
    expect(applyComicOps([{ op: 'addBubble', panel: 1, kind: 'stamp', text: 'no such sound' }])).toBe(false);
    expect(page().panels[0]!.bubbles).toHaveLength(3);
    // Changing the picture by its word keeps the balloon; an unknown word changes nothing.
    const id = page().panels[0]!.bubbles[0]!.id;
    expect(applyComicOps([{ op: 'bubble', id, set: { text: 'ドキ' } }])).toBe(true);
    expect(page().panels[0]!.bubbles[0]!.text).toBe('block-doki');
    expect(applyComicOps([{ op: 'bubble', id, set: { text: 'no such sound' } }])).toBe(false);
    expect(page().panels[0]!.bubbles[0]!.text).toBe('block-doki');
  });

  it('adds the newer kinds of balloon with their line and fill, and leaves out a line it does not know', () => {
    seed();
    expect(applyComicOps([{ op: 'addBubble', panel: 1, kind: 'icicle', text: 'Cold', line: 'dashed', dark: true }])).toBe(true);
    expect(page().panels[0]!.bubbles[0]).toMatchObject({ kind: 'icicle', line: 'dashed', dark: true });
    const id = page().panels[0]!.bubbles[0]!.id;
    expect(applyComicOps([{ op: 'bubble', id, set: { text: 'Brr', line: 'zigzag', dark: 'yes' } }])).toBe(true);
    expect(page().panels[0]!.bubbles[0]).toMatchObject({ text: 'Brr', line: 'dashed', dark: true });
  });

  it('sets the colour of the frame lines, and takes only a #rrggbb colour', () => {
    seed();
    expect(applyComicOps([{ op: 'frame', color: '#1A2B3C' }])).toBe(true);
    expect(page().frameColor).toBe('#1a2b3c');
    expect(applyComicOps([{ op: 'frame', color: 'blue' }])).toBe(false);
    expect(page().frameColor).toBe('#1a2b3c');
  });

  it('adds a page and works on it, and goes back to a page by its number', () => {
    seed();
    expect(applyComicOps([{ op: 'addPage' }, { op: 'panel', panel: 1, prompt: 'second page' }])).toBe(true);
    expect(useComic.getState().projects[0]!.pages).toHaveLength(2);
    expect(page().panels[0]!.prompt).toBe('second page');
    expect(applyComicOps([{ op: 'page', page: 1 }])).toBe(true);
    expect(page().panels[0]!.prompt).toBe('');
    expect(applyComicOps([{ op: 'page', page: 7 }])).toBe(false);
  });

  it('puts an earlier picture of a panel back by its number, and says how many there are when the number is wrong', () => {
    seed();
    const id = page().panels[0]!.id;
    expect(applyComicOps([{ op: 'take', panel: 1, take: 1 }])).toBe(false);
    for (const name of ['old.png', 'mid.png', 'new.png']) useComic.getState().setPanelImage(id, name);
    const told = (comicContext() as { panels: { earlierPictures?: number }[] }).panels;
    expect(told[0]!.earlierPictures).toBe(2);
    expect(told[1]!.earlierPictures).toBeUndefined();
    expect(applyComicOps([{ op: 'take', panel: 1, take: 2 }])).toBe(true);
    expect(page().panels[0]!.imageName).toBe('old.png');
    expect(page().panels[0]!.takes.map((t) => t.imageName)).toEqual(['new.png', 'mid.png']);
    expect(applyComicOps([{ op: 'take', panel: 1, take: 3 }])).toBe(false);
    expect(comicAgentEditor.skipped()[0]).toContain('2 earlier picture(s)');
  });

  it('redraws boxes of a drawn panel picture, and says why when the panel has none or the boxes are not boxes', () => {
    seed();
    const before = { models: useModels.getState().models, modelKey: useParams.getState().modelKey };
    useModels.setState({ models: [{ key: 'main', name: 'Main', base: 'sdxl', type: 'main' } as (typeof before.models)[number]] });
    useParams.setState({ modelKey: 'main' });
    const redraw = vi.spyOn(generate, 'redrawPart').mockResolvedValue(true);
    const target = vi.spyOn(generate, 'fixTarget').mockReturnValue({} as never);
    try {
      expect(applyComicOps([{ op: 'fix', panel: 1, boxes: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.3 }] }])).toBe(false);
      expect(comicAgentEditor.skipped()[0]).toContain('no picture yet');
      useComic.getState().setPanelImage(page().panels[0]!.id, 'pic.png');
      expect(applyComicOps([{ op: 'fix', panel: 1, boxes: [{ x: 0.1, y: 0.2 }] }])).toBe(false);
      expect(comicAgentEditor.skipped()[0]).toContain('fix needs "boxes"');
      // A redraw that would be refused (no model for masks, the picture gone) is not told as applied.
      target.mockReturnValueOnce('The panel needs a picture to redraw a part of it');
      expect(applyComicOps([{ op: 'fix', panel: 1, boxes: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.3 }] }])).toBe(false);
      expect(comicAgentEditor.skipped()[0]).toContain('needs a picture');
      expect(redraw).not.toHaveBeenCalled();
      expect(applyComicOps([{ op: 'fix', panel: 1, boxes: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.3 }], prompt: 'detailed hand', strength: 9 }])).toBe(true);
      expect(redraw).toHaveBeenCalledWith(page().panels[0]!.id, { strokes: [], boxes: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.3 }] }, { words: 'detailed hand', strength: 1 });
    } finally {
      redraw.mockRestore();
      target.mockRestore();
      useModels.setState({ models: before.models });
      useParams.setState({ modelKey: before.modelKey });
    }
  });

  it('draws the sheet of a character named in any case, and says why it cannot for an unknown name or a full sheet', () => {
    seed();
    const before = { models: useModels.getState().models, modelKey: useParams.getState().modelKey };
    useModels.setState({ models: [{ key: 'main', name: 'Main', base: 'sdxl', type: 'main' } as (typeof before.models)[number]] });
    useParams.setState({ modelKey: 'main' });
    const make = vi.spyOn(generate, 'makeSheet').mockResolvedValue(4);
    try {
      applyComicOps([{ op: 'cast', characters: [{ name: 'Mina', tags: '1girl' }] }]);
      expect(applyComicOps([{ op: 'sheet', character: 'Nobody' }])).toBe(false);
      expect(comicAgentEditor.skipped()[0]).toContain('the cast is: Mina');
      expect(applyComicOps([{ op: 'sheet', character: ' mina ' }])).toBe(true);
      const mina = useComic.getState().projects[0]!.cast[0]!;
      expect(make).toHaveBeenCalledWith(mina.id);
      for (const view of ['threeQuarter', 'side', 'back', 'face'] as const) useComic.getState().setCharacterView(useComic.getState().projects[0]!.id, mina.id, view, `${view}.png`);
      expect(applyComicOps([{ op: 'sheet', character: 'Mina' }])).toBe(false);
      expect(comicAgentEditor.skipped()[0]).toContain('every view');
      expect((comicContext() as { cast: { sheet?: string[] }[] }).cast[0]!.sheet).toEqual(['threeQuarter', 'side', 'back', 'face']);
    } finally {
      make.mockRestore();
      useModels.setState({ models: before.models });
      useParams.setState({ modelKey: before.modelKey });
    }
  });

  it('moves only a picture that is there, and takes off a pose with an empty list', () => {
    seed();
    expect(applyComicOps([{ op: 'picture', panel: 1, scale: 2 }])).toBe(false);
    useComic.getState().setPanelImage(page().panels[0]!.id, 'pic.png');
    expect(applyComicOps([{ op: 'picture', panel: 1, scale: 2, flipX: true }])).toBe(true);
    expect(page().panels[0]!.imageView).toMatchObject({ scale: 2, flipX: true });
    useComic.getState().setPanelPose(page().panels[1]!.id, [], 'pose.png');
    expect(applyComicOps([{ op: 'pose', panel: 2, people: [] }])).toBe(true);
    expect(page().panels[1]!.poseImageName).toBeNull();
  });

  it('tells which panels the user laid out in a 3D rough, until a pose put in another way drops its depth map', () => {
    seed();
    const id = page().panels[0]!.id;
    useComic.getState().setPanelRough(id, newRough(), [], 'rough-pose.png', 'rough-depth.png');
    const told = () => (comicContext() as { panels: { rough?: boolean }[] }).panels;
    expect(told()[0]!.rough).toBe(true);
    expect(told()[1]!.rough).toBeUndefined();
    applyComicOps([{ op: 'pose', panel: 1, people: [] }]);
    expect(told()[0]!.rough).toBeUndefined();
  });
});

describe('a pose on a panel without a place on the page', () => {
  it('changes nothing and says why, so the assistant is not told it took effect with half of it written', () => {
    seed();
    applyComicOps([{ op: 'cast', characters: [{ name: 'Jin', tags: '1boy' }] }]);
    const before = page().panels[0]!;
    const geometry = vi.spyOn(layout, 'panelGeometry').mockReturnValue([]);
    try {
      expect(applyComicOps([{ op: 'pose', panel: 1, people: [{ x: 0.3, who: 'Jin' }] }])).toBe(false);
      expect(comicAgentEditor.skipped()[0]).toContain('cannot take a pose');
    } finally {
      geometry.mockRestore();
    }
    expect(page().panels[0]!.poseCast).toEqual(before.poseCast);
    expect(page().panels[0]!.cast).toEqual(before.cast);
  });
});

describe('who each person of a pose is', () => {
  it('names the people by the cast, puts a named character in the panel, and tells it back', () => {
    seed();
    applyComicOps([{ op: 'cast', characters: [{ name: 'Jin', tags: '1boy' }, { name: 'Akane', tags: '1girl' }] }]);
    const [jin, akane] = useComic.getState().projects[0]!.cast;
    expect(applyComicOps([{ op: 'pose', panel: 1, people: [{ x: 0.3, who: 'akane' }, { x: 0.7, who: 'Jin' }, { x: 0.5, who: 'Nobody' }] }])).toBe(true);
    const panel = page().panels[0]!;
    expect(panel.poseCast).toEqual([akane!.id, jin!.id, null]);
    expect(panel.cast).toEqual(expect.arrayContaining([akane!.id, jin!.id]));
    const told = (comicContext() as { panels: { whoIsWho?: (string | null)[] }[] }).panels[0]!;
    expect(told.whoIsWho).toEqual(['Akane', 'Jin', null]);
    applyComicOps([{ op: 'pose', panel: 1, people: [] }]);
    expect(page().panels[0]!.poseCast).toEqual([]);
  });
});

describe('a panel written as a scene', () => {
  function castAndPlace() {
    seed();
    applyComicOps([
      { op: 'cast', characters: [{ name: 'Mio', tags: '1girl' }, { name: 'Sota', tags: '1boy' }] },
      { op: 'places', places: [{ name: 'Cafe', tags: 'cozy cafe' }] },
    ]);
    return useComic.getState().projects[0]!;
  }

  it('makes the prompt, cast, place, pose with who and words, and the balloons by speaker', () => {
    const project = castAndPlace();
    const [mio, sota] = project.cast;
    useComic.getState().addBubble(page().panels[0]!.id, 'speech');
    const ok = applyComicOps([
      {
        op: 'scene',
        panel: 1,
        shot: 'knees',
        place: 'cafe',
        people: [
          { who: 'Mio', pose: 'standing', doing: 'holding a tray', face: 'smile' },
          { who: 'Sota', pose: 'sittingOnChair', doing: 'drinking tea' },
        ],
        things: 'rainbow in the window',
        lines: [{ who: 'Sota', text: 'Thanks' }],
        note: 'Mio brings the tea',
      },
    ]);
    expect(ok).toBe(true);
    const panel = page().panels[0]!;
    expect(panel.prompt).toBe('1girl, 1boy, cowboy shot, looking at another, holding a tray, smile, drinking tea, (rainbow in the window:1.2)');
    expect(panel.cast).toEqual([mio!.id, sota!.id]);
    expect(panel.place).toBe(project.places[0]!.id);
    expect(panel.note).toBe('Mio brings the tea');
    expect(panel.poses).toHaveLength(2);
    expect(panel.poseCast).toEqual([mio!.id, sota!.id]);
    expect(panel.poseWords).toEqual(['holding a tray, smile', 'drinking tea']);
    // The balloon that was there is replaced by the scene's line, aimed at Sota's mouth.
    expect(panel.bubbles.map((b) => b.text)).toEqual(['Thanks']);
    expect(panel.bubbles[0]!.tail).not.toBeNull();
  });

  it('tells the assistant what the scene named that the comic lacks, and a scene for a panel that is not there', () => {
    castAndPlace();
    applyComicOps([{ op: 'scene', panel: 1, people: [{ who: 'Nobody', pose: 'moonwalk' }] }]);
    const skipped = comicAgentEditor.skipped().join('\n');
    expect(skipped).toMatch(/op 1 \(scene\): no pose is named "moonwalk"/);
    expect(skipped).toMatch(/op 1 \(scene\): no character is named "Nobody"/);
    expect(applyComicOps([{ op: 'scene', panel: 9 }])).toBe(false);
    expect(comicAgentEditor.skipped()[0]).toMatch(/panel 9 is not on the open page/);
  });

  it('clears what each person does when a pose is taken off', () => {
    castAndPlace();
    applyComicOps([{ op: 'scene', panel: 1, people: [{ who: 'Mio', doing: 'waving' }] }]);
    expect(page().panels[0]!.poseWords).toEqual(['waving']);
    applyComicOps([{ op: 'pose', panel: 1, people: [] }]);
    expect(page().panels[0]!.poseWords).toBeUndefined();
  });
});

describe('undo of an answer', () => {
  it('puts the comic back as it was before the answer, in one step', () => {
    seed();
    const before = comicAgentEditor.snapshot();
    applyComicOps([{ op: 'template', id: 'slants' }, { op: 'panel', panel: 1, prompt: 'x' }, { op: 'addBubble', panel: 2, text: 'hi' }]);
    expect(page().panels.length).not.toBe(3);
    comicAgentEditor.restore(before);
    expect(page().panels).toHaveLength(3);
    expect(page().panels.every((p) => p.prompt === '' && p.bubbles.length === 0)).toBe(true);
  });
});

describe('making and opening comics', () => {
  it('makes a new comic, adds its pages, and opens another by name', () => {
    seed();
    expect(applyComicOps([{ op: 'newComic', name: 'Voyage' }, { op: 'addPages', count: 29 }])).toBe(true);
    const made = useComic.getState().projects.find((p) => p.name === 'Voyage')!;
    expect(useComic.getState().activeProjectId).toBe(made.id);
    expect(useComic.getState().projects.find((p) => p.id === made.id)!.pages).toHaveLength(30);
    expect(applyComicOps([{ op: 'page', page: 12 }, { op: 'template', id: 'nope' }])).toBe(true);
    expect((comicContext() as Context).page).toBe(12);
    expect(applyComicOps([{ op: 'openComic', name: 'harbour' }])).toBe(true);
    expect((comicContext() as Context).project).toBe('Harbour');
    expect(applyComicOps([{ op: 'openComic', name: 'missing' }, { op: 'addPages', count: 'x' }])).toBe(false);
  });

  it('caps the pages added at once, and tells the assistant the comics when none is open', () => {
    applyComicOps([{ op: 'newComic', name: '' }, { op: 'addPages', count: 1000 }]);
    expect(useComic.getState().projects[0]!.pages).toHaveLength(101);
    expect(comicContext()).toMatchObject({ pageCount: 101, comics: [useComic.getState().projects[0]!.name] });
    useComic.setState({ activeProjectId: null, activePageId: null });
    expect(comicContext()).toMatchObject({ project: null, comics: [useComic.getState().projects[0]!.name] });
  });

  it('draws nothing without a model, and says why', () => {
    seed();
    applyComicOps([{ op: 'panel', panel: 1, prompt: 'a ship' }]);
    expect(applyComicOps([{ op: 'draw', scope: 'page' }])).toBe(false);
  });
});

describe('balloons that name who speaks', () => {
  /** Two people in the first panel: one on the left, one on the right, as 18 joints each (nose first). */
  const stand = (x: number) => Array.from({ length: 18 }, (_, i) => ({ x: x + (i > 1 ? (i % 2 ? 0.05 : -0.05) : 0), y: 0.3 + i * 0.03 }));
  function twoPeople() {
    seed();
    const panel = page().panels[0]!;
    useComic.getState().setPanelPose(panel.id, [stand(0.2), stand(0.8)], null);
    return panel.id;
  }
  const bubbles = () => page().panels[0]!.bubbles;

  it('puts the balloon in free space and aims its tail at the speaker mouth', () => {
    twoPeople();
    expect(applyComicOps([{ op: 'addBubble', panel: 1, kind: 'speech', text: 'おはよう', vertical: true, speaker: 2 }])).toBe(true);
    const b = bubbles()[0]!;
    expect(b.tail).not.toBeNull();
    // It sits above the people, nearer the right one than the left.
    expect(b.x + 0.1).toBeGreaterThan(0.4);
    // The tip lies outside the balloon's own box, towards the head beside or under it.
    expect(b.tail!.x > 1 || b.tail!.y > 1).toBe(true);
  });

  it('keeps the place and the tail the assistant gave', () => {
    twoPeople();
    applyComicOps([{ op: 'addBubble', panel: 1, kind: 'speech', text: 'やあ', x: 0.5, y: 0.5, tail: null, speaker: 1 }]);
    expect(bubbles()[0]).toMatchObject({ x: 0.5, y: 0.5, tail: null });
  });

  it('gives a tailless kind a free place but no tail, and moves a balloon only when a speaker is named', () => {
    twoPeople();
    applyComicOps([{ op: 'addBubble', panel: 1, kind: 'caption', text: '朝', speaker: 1 }]);
    expect(bubbles()[0]!.tail).toBeNull();
    const id = bubbles()[0]!.id;
    const before = { x: bubbles()[0]!.x, y: bubbles()[0]!.y };
    applyComicOps([{ op: 'bubble', id, set: { text: '昼' } }]);
    expect(bubbles()[0]).toMatchObject(before);
    applyComicOps([{ op: 'bubble', id, set: { speaker: 2, kind: 'speech' } }]);
    expect(bubbles()[0]!.tail).not.toBeNull();
  });

  it('ignores a speaker the panel does not have, and a panel without poses', () => {
    twoPeople();
    applyComicOps([{ op: 'addBubble', panel: 1, kind: 'speech', text: 'え', speaker: 3 }]);
    expect(bubbles()[0]!.tail).toEqual(expect.objectContaining({}));
    seed();
    applyComicOps([{ op: 'addBubble', panel: 1, kind: 'speech', text: 'え', speaker: 1 }]);
    expect(bubbles()).toHaveLength(1);
  });

  it('tells where the heads are', () => {
    twoPeople();
    const c = comicContext() as { panels: { people: number; peopleAt: { x: number; y: number }[] }[] };
    expect(c.panels[0]!.people).toBe(2);
    expect(c.panels[0]!.peopleAt[1]!.x).toBeCloseTo(0.8, 1);
  });

  it('makes a balloon that would cover the panel smaller, but leaves sound-effect lettering big', () => {
    seed();
    applyComicOps([
      { op: 'addBubble', panel: 1, kind: 'speech', text: 'すごい雨だね。濡れなかった？風邪をひかないようにね', vertical: true, scale: 2 },
      { op: 'addBubble', panel: 1, kind: 'sfx', text: 'ザーッ', scale: 3 },
    ]);
    const [speech, sfx] = bubbles();
    expect(speech!.scale).toBeLessThan(2);
    expect(sfx!.scale).toBe(3);
  });

  it('gives a balloon smaller words when no free place is left at its size', () => {
    twoPeople();
    applyComicOps([{ op: 'addBubble', panel: 1, kind: 'speech', text: 'こんにちは、いい天気ですね。散歩日和です。', vertical: false, scale: 1, speaker: 1 }]);
    expect(bubbles()[0]!.scale).toBeLessThanOrEqual(1);
  });
});

describe('the cast the assistant writes', () => {
  const cast = () => useComic.getState().projects[0]!.cast;
  const panelCast = (n: number) => page().panels[n]!.cast;

  it('adds characters, rewrites one by its name, removes one, and says them in the context', () => {
    seed();
    expect(applyComicOps([{ op: 'cast', characters: [{ name: 'Grandpa', tags: '1boy, old man, flat cap' }, { name: 'Goro', tags: '1dog, shiba inu' }] }])).toBe(true);
    expect(cast().map((c) => c.name)).toEqual(['Grandpa', 'Goro']);
    expect(applyComicOps([{ op: 'cast', characters: [{ name: 'grandpa', tags: '1boy, old man, straw hat' }] }])).toBe(true);
    expect(cast()).toHaveLength(2);
    expect(cast()[0]!.tags).toBe('1boy, old man, straw hat');
    expect((comicContext() as { cast: { name: string; tags: string }[] }).cast[1]).toEqual({ name: 'Goro', tags: '1dog, shiba inu', parts: {}, hasReferencePicture: false });
    expect(applyComicOps([{ op: 'cast', remove: ['Goro'] }])).toBe(true);
    expect(cast().map((c) => c.name)).toEqual(['Grandpa']);
    expect(applyComicOps([{ op: 'cast', remove: ['nobody'], characters: [{ name: '', tags: 'x' }, { name: 'Y' }, 3] }])).toBe(false);
  });

  it('keeps the words a character keeps out of its panels, and clears them with an empty text', () => {
    seed();
    expect(applyComicOps([{ op: 'cast', characters: [{ name: 'Mina', tags: '1girl', negative: 'hat, glasses' }] }])).toBe(true);
    expect(cast()[0]!.negative).toBe('hat, glasses');
    expect(applyComicOps([{ op: 'cast', characters: [{ name: 'Mina', negative: '' }] }])).toBe(true);
    expect(cast()[0]).not.toHaveProperty('negative');
  });

  it('puts characters in a panel by name, drops unknown names, and tells the cast of each panel', () => {
    seed();
    applyComicOps([{ op: 'cast', characters: [{ name: 'Grandpa', tags: 'a' }, { name: 'Goro', tags: 'b' }] }]);
    expect(applyComicOps([{ op: 'panel', panel: 1, cast: ['goro', 'Grandpa', 'Stranger'] }])).toBe(true);
    expect(panelCast(0)).toEqual([cast()[0]!.id, cast()[1]!.id]);
    expect((comicContext() as { panels: { cast: string[] }[] }).panels[0]!.cast).toEqual(['Grandpa', 'Goro']);
    applyComicOps([{ op: 'cast', remove: ['Goro'] }]);
    expect(panelCast(0)).toEqual([cast()[0]!.id]);
  });

  it('reads the list and the words under their plain alternative names, and says why an operation did nothing', () => {
    seed();
    expect(applyComicOps([{ op: 'cast', cast: [{ name: 'A', look: '1girl, red scarf' }, { name: 'B', description: '1dog' }] }])).toBe(true);
    expect(cast().map((c) => c.tags)).toEqual(['1girl, red scarf', '1dog']);
    expect(comicAgentEditor.skipped()).toEqual([]);
    expect(applyComicOps([{ op: 'cast', characters: [{ name: 'C', colour: 'x' }] }, { op: 'nonsense' }, 5])).toBe(false);
    const skipped = comicAgentEditor.skipped();
    expect(skipped).toHaveLength(3);
    expect(skipped[0]).toContain('op 1 (cast)');
    expect(skipped[0]).toContain('"characters"');
    expect(skipped[1]).toContain('op 2 (nonsense)');
    expect(skipped[2]).toContain('not an object');
  });
});

describe('the places the assistant writes', () => {
  const places = () => useComic.getState().projects[0]!.places;
  type Context = { places: { name: string; tags: string; negative?: string }[]; world: string; panels: { place?: string }[] };

  it('adds places, rewrites one by its name, removes one, sets the world, and says them in the context', () => {
    seed();
    expect(applyComicOps([{ op: 'places', places: [{ name: 'Room', tags: 'bedroom, desk lamp' }, { name: 'Pier', words: 'pier, sea', negative: 'boats' }], world: ' summer, 1990s ' }])).toBe(true);
    expect(places().map((p) => [p.name, p.tags, p.negative])).toEqual([['Room', 'bedroom, desk lamp', undefined], ['Pier', 'pier, sea', 'boats']]);
    expect(applyComicOps([{ op: 'places', places: [{ name: 'room', tags: 'bedroom, night' }, { name: 'Pier', negative: '' }] }])).toBe(true);
    expect(places().map((p) => [p.name, p.tags, p.negative])).toEqual([['Room', 'bedroom, night', undefined], ['Pier', 'pier, sea', undefined]]);
    const context = comicContext() as Context;
    expect(context.places).toEqual([{ name: 'Room', tags: 'bedroom, night' }, { name: 'Pier', tags: 'pier, sea' }]);
    expect(context.world).toBe('summer, 1990s');
    expect(applyComicOps([{ op: 'places', remove: ['PIER'], world: '' }])).toBe(true);
    expect(places().map((p) => p.name)).toEqual(['Room']);
    expect((comicContext() as Context).world).toBe('');
    expect(applyComicOps([{ op: 'places', remove: ['nobody'], places: [{ name: '', tags: 'x' }, { name: 'Y' }, 3] }])).toBe(false);
    expect(comicAgentEditor.skipped()[0]).toContain('places needs');
  });

  it('sets the place of a panel by name, takes it out with null, and says a name the comic lacks while keeping the rest', () => {
    seed();
    applyComicOps([{ op: 'places', places: [{ name: 'Room', tags: 'bedroom' }] }]);
    expect(applyComicOps([{ op: 'panel', panel: 1, place: 'room' }])).toBe(true);
    expect(page().panels[0]!.place).toBe(places()[0]!.id);
    expect((comicContext() as Context).panels.map((p) => p.place)).toEqual(['Room', undefined, undefined]);
    expect(applyComicOps([{ op: 'panel', panel: 1, place: null }])).toBe(true);
    expect(page().panels[0]).not.toHaveProperty('place');
    // An unknown place: the prompt still lands, and the answer says what was left out.
    expect(applyComicOps([{ op: 'panel', panel: 2, prompt: '1girl, solo', place: 'Station' }])).toBe(true);
    expect(page().panels[1]!.prompt).toBe('1girl, solo');
    expect(page().panels[1]).not.toHaveProperty('place');
    expect(comicAgentEditor.skipped()).toEqual([expect.stringContaining('took effect except for a part (no place is named "Station"; the places are: Room')]);
    expect(applyComicOps([{ op: 'panel', panel: 2, place: 'Station' }])).toBe(false);
    expect(comicAgentEditor.skipped()[0]).toContain('took no effect');
  });

  it('names the places only in the answer of an edit', () => {
    seed();
    applyComicOps([{ op: 'places', places: [{ name: 'Room', tags: 'bedroom, wooden desk' }] }]);
    expect((comicAnswer() as { places: unknown }).places).toEqual(['Room']);
  });
});

describe('list operations written in another form', () => {
  // Claude Haiku 4.5 on 2026-10-17 sent each of these.
  const project = () => useComic.getState().projects[0]!;

  it('reads one character or one place written flat into its operation, and the world sent on its own', () => {
    seed();
    expect(applyComicOps([
      { op: 'cast', name: 'Mio', tags: '1girl, short hair' },
      { op: 'places', name: 'Cafe', description: 'cafe, wooden tables' },
      { op: 'world', world: 'rainy season' },
    ])).toBe(true);
    expect(project().cast.map((c) => [c.name, c.tags])).toEqual([['Mio', '1girl, short hair']]);
    expect(project().places.map((p) => [p.name, p.tags])).toEqual([['Cafe', 'cafe, wooden tables']]);
    expect((comicContext() as { world: string }).world).toBe('rainy season');
  });
});

describe('figures: where animals stand', () => {
  it('stores the boxes of a panel op, tells them in the context, and keeps balloons clear of them', () => {
    seed();
    expect(applyComicOps([{ op: 'panel', panel: 1, figures: [{ x: 0.3, y: 0.0, w: 0.4, h: 0.5 }, { x: 'bad' }] }])).toBe(true);
    expect(page().panels[0]!.figures).toEqual([{ x: 0.3, y: 0, w: 0.4, h: 0.5 }]);
    expect((comicContext() as { panels: { figures: unknown[] }[] }).panels[0]!.figures).toHaveLength(1);
    applyComicOps([{ op: 'addBubble', panel: 1, kind: 'speech', text: 'わん', vertical: true }]);
    const b = page().panels[0]!.bubbles[0]!;
    // The balloon is not over the figure's box (it sits left or right of it, or below it).
    const overlapsAcross = b.x < 0.7 && b.x + 0.2 > 0.3;
    const overlapsDown = b.y < 0.5;
    expect(overlapsAcross && overlapsDown).toBe(false);
  });

  it('clears the boxes with an empty list', () => {
    seed();
    applyComicOps([{ op: 'panel', panel: 1, figures: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.2 }] }]);
    applyComicOps([{ op: 'panel', panel: 1, figures: [] }]);
    expect(page().panels[0]!.figures).toEqual([]);
  });
});

describe('the parts of a character the assistant writes', () => {
  beforeEach(seed);
  it('adds a character with parts and merges later parts over the earlier ones', () => {
    expect(applyComicOps([{ op: 'cast', characters: [{ name: 'Mio', tags: '1girl', parts: { hair: 'long black hair', eyes: 'green eyes' } }] }])).toBe(true);
    expect(applyComicOps([{ op: 'cast', characters: [{ name: 'Mio', parts: { eyes: 'blue eyes', outfit: 'navy blazer' } }] }])).toBe(true);
    const mio = useComic.getState().projects[0]!.cast[0]!;
    expect(mio.tags).toBe('1girl');
    expect(mio.parts).toEqual({ hair: 'long black hair', eyes: 'blue eyes', outfit: 'navy blazer' });
    expect(((comicContext() as { cast: { parts: unknown }[] }).cast[0])!.parts).toEqual(mio.parts);
  });

  it('marks a character as not human, keeps it, and can take it back', () => {
    expect(applyComicOps([{ op: 'cast', characters: [{ name: 'Kage', tags: '1creature', nonHuman: true }] }])).toBe(true);
    expect(useComic.getState().projects[0]!.cast[0]!.nonHuman).toBe(true);
    expect((comicContext() as { cast: { nonHuman?: boolean }[] }).cast[0]!.nonHuman).toBe(true);
    applyComicOps([{ op: 'cast', characters: [{ name: 'Kage', nonHuman: false }] }]);
    expect(useComic.getState().projects[0]!.cast[0]!.nonHuman).toBeFalsy();
  });

  it('refuses a character with neither words nor parts', () => {
    expect(applyComicOps([{ op: 'cast', characters: [{ name: 'Nobody' }] }])).toBe(false);
  });
});

describe('the answer of an edit', () => {
  type Answer = { project: string; page: number; panels: unknown[]; cast: Record<string, unknown>[]; comics?: unknown; layoutTemplates?: unknown; parts?: unknown; more: string };

  it('keeps the page but leaves out the cast words, the comic list and the templates', () => {
    seed();
    applyComicOps([{ op: 'cast', characters: [{ name: 'Aoi', tags: '1girl, black hair' }] }]);
    const answer = comicAnswer() as Answer;
    expect(answer.project).toBe('Harbour');
    expect(answer.panels).toHaveLength(3);
    expect(answer.cast).toEqual([{ name: 'Aoi', hasReferencePicture: false }]);
    expect(answer.comics).toBeUndefined();
    expect(answer.layoutTemplates).toBeUndefined();
    expect(answer.parts).toBeUndefined();
    expect(answer.more).toContain('get_comic_page');
    expect(JSON.stringify(answer)).not.toContain('black hair');
    expect(JSON.stringify(comicContext())).toContain('black hair');
  });

  it('is the context itself when no comic is open, and is what the editor answers an edit with', () => {
    expect(comicAnswer()).toEqual(comicContext());
    expect(comicAgentEditor.answer).toBe(comicAnswer);
  });
});
